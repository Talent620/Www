import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CartQuote } from './cart';

/**
 * Stripe Checkout integration for generated stores — dependency-free.
 *
 * Rather than pull in the full Stripe SDK, this talks to Stripe's stable REST
 * API over `fetch` and verifies webhook signatures with Node's built-in crypto.
 * That keeps the platform's "runs with zero infra" promise: with no Stripe key
 * the store still renders; a key makes it transactable.
 *
 * Pricing is never trusted from the client. Callers must build the
 * `CheckoutSessionParams` from a server-resolved {@link CartQuote} (see
 * {@link buildCheckoutSessionParams}); product amounts come straight off the
 * stored catalog, so a tampered cart can't change what is charged.
 */

const STRIPE_API = 'https://api.stripe.com/v1';
/** Pinned API version so Stripe behaviour can't shift under us. */
const DEFAULT_API_VERSION = '2024-06-20';
/** Reject webhook events whose timestamp is older than this (replay defense). */
const SIGNATURE_TOLERANCE_SEC = 300;

/** True when a Stripe secret key is configured and checkout can run. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export interface CheckoutUrls {
  successUrl: string;
  cancelUrl: string;
}

interface LineItem {
  quantity: number;
  price_data: {
    currency: string;
    unit_amount: number;
    product_data: { name: string };
  };
}

interface ShippingOption {
  shipping_rate_data: {
    type: 'fixed_amount';
    display_name: string;
    fixed_amount: { amount: number; currency: string };
  };
}

export interface CheckoutSessionParams {
  mode: 'payment';
  success_url: string;
  cancel_url: string;
  line_items: LineItem[];
  shipping_options: ShippingOption[];
  discounts?: Array<{ coupon: string }>;
  client_reference_id?: string;
  metadata?: Record<string, string>;
}

/**
 * Build Stripe Checkout Session params from a server-resolved quote. Pure and
 * fully testable — the network calls live in {@link createCheckoutSession}.
 *
 * Each catalog line becomes a Stripe line item priced from the stored catalog.
 * Shipping is modelled as a fixed-amount shipping option (free shipping is an
 * amount of 0). Any discount is applied via a pre-created coupon id — Stripe
 * forbids negative line items, so the discount can't be folded into amounts
 * without distorting per-product prices.
 */
export function buildCheckoutSessionParams(
  quote: CartQuote,
  opts: { urls: CheckoutUrls; couponId?: string; clientReferenceId?: string; metadata?: Record<string, string> },
): CheckoutSessionParams {
  const currency = quote.currency.toLowerCase();

  const params: CheckoutSessionParams = {
    mode: 'payment',
    success_url: opts.urls.successUrl,
    cancel_url: opts.urls.cancelUrl,
    line_items: quote.lines.map((line) => ({
      quantity: line.qty,
      price_data: {
        currency,
        unit_amount: line.unitCents,
        product_data: { name: line.name },
      },
    })),
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: quote.shippingCents === 0 ? 'Free shipping' : 'Standard shipping',
          fixed_amount: { amount: quote.shippingCents, currency },
        },
      },
    ],
  };

  if (opts.couponId) {
    params.discounts = [{ coupon: opts.couponId }];
  }
  if (opts.clientReferenceId) {
    params.client_reference_id = opts.clientReferenceId;
  }
  if (opts.metadata) {
    params.metadata = opts.metadata;
  }
  return params;
}

/**
 * Flatten a nested object into Stripe's bracketed form-encoding, e.g.
 * `{ a: [{ b: 1 }] }` → `a[0][b]=1`. Stripe's API speaks
 * `application/x-www-form-urlencoded`, not JSON.
 */
export function encodeForm(obj: unknown, prefix = ''): string {
  const parts: string[] = [];

  const append = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'object') {
      const nested = encodeForm(value, key);
      if (nested) parts.push(nested);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  };

  if (Array.isArray(obj)) {
    obj.forEach((value, i) => append(prefix ? `${prefix}[${i}]` : String(i), value));
  } else if (obj && typeof obj === 'object') {
    for (const [k, value] of Object.entries(obj)) {
      append(prefix ? `${prefix}[${k}]` : k, value);
    }
  }

  return parts.join('&');
}

class StripeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'StripeError';
  }
}

async function stripePost(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError('Stripe is not configured', 503);

  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': process.env.STRIPE_API_VERSION || DEFAULT_API_VERSION,
    },
    body: encodeForm(body),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new StripeError(err?.message || `Stripe request failed (${res.status})`, res.status);
  }
  return json;
}

/**
 * Create a one-off, single-use `amount_off` coupon so a validated discount code
 * shows as a proper discount line in Checkout while the charged total stays
 * exactly equal to the server-computed quote.
 */
export async function createDiscountCoupon(amountOffCents: number, currency: string, name: string): Promise<string> {
  const coupon = await stripePost('/coupons', {
    amount_off: amountOffCents,
    currency: currency.toLowerCase(),
    duration: 'once',
    name,
    max_redemptions: 1,
  });
  return coupon.id as string;
}

/** Create a Checkout Session and return its hosted-checkout URL and id. */
export async function createCheckoutSession(params: CheckoutSessionParams): Promise<{ id: string; url: string }> {
  const session = await stripePost('/checkout/sessions', params as unknown as Record<string, unknown>);
  return { id: session.id as string, url: session.url as string };
}

/**
 * Verify a Stripe webhook signature and return the parsed event. Mirrors
 * Stripe's scheme: `signed_payload = "{t}.{rawBody}"`, HMAC-SHA256 with the
 * endpoint secret, compared in constant time against the `v1` signatures, with
 * a timestamp-tolerance check to defeat replays. Throws on any mismatch.
 *
 * `now` is injectable purely so the tolerance check is unit-testable.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  now: () => number = () => Date.now(),
): Record<string, unknown> {
  if (!signatureHeader) throw new StripeError('Missing Stripe-Signature header', 400);

  let timestamp = '';
  const signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=', 2);
    if (k === 't') timestamp = v ?? '';
    else if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) {
    throw new StripeError('Malformed Stripe-Signature header', 400);
  }

  const ageSec = Math.abs(Math.floor(now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > SIGNATURE_TOLERANCE_SEC) {
    throw new StripeError('Signature timestamp outside tolerance', 400);
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const matched = signatures.some((sig) => {
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
  if (!matched) throw new StripeError('Signature verification failed', 400);

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new StripeError('Webhook payload is not valid JSON', 400);
  }
}

export { StripeError };
