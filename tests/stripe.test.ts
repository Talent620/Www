import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  buildCheckoutSessionParams,
  encodeForm,
  verifyWebhookSignature,
  isStripeConfigured,
  StripeError,
} from '@/lib/commerce/stripe';
import type { CartQuote } from '@/lib/commerce/cart';

function quote(overrides: Partial<CartQuote> = {}): CartQuote {
  return {
    lines: [
      { sku: 'SKU-1', name: 'Widget', unitCents: 2500, qty: 2, lineCents: 5000 },
      { sku: 'SKU-2', name: 'Gadget', unitCents: 1000, qty: 1, lineCents: 1000 },
    ],
    currency: 'USD',
    subtotalCents: 6000,
    discountCents: 0,
    shippingCents: 0,
    totalCents: 6000,
    freeShippingThresholdCents: 5000,
    ...overrides,
  };
}

const urls = { successUrl: 'https://app.test/ok', cancelUrl: 'https://app.test/cancel' };

describe('buildCheckoutSessionParams', () => {
  it('maps each quote line to a Stripe line item with catalog pricing', () => {
    const params = buildCheckoutSessionParams(quote(), { urls });
    expect(params.mode).toBe('payment');
    expect(params.success_url).toBe(urls.successUrl);
    expect(params.line_items).toHaveLength(2);
    expect(params.line_items[0]).toEqual({
      quantity: 2,
      price_data: { currency: 'usd', unit_amount: 2500, product_data: { name: 'Widget' } },
    });
  });

  it('models free shipping as a zero-amount shipping option', () => {
    const params = buildCheckoutSessionParams(quote({ shippingCents: 0 }), { urls });
    const rate = params.shipping_options[0]?.shipping_rate_data;
    expect(rate?.fixed_amount.amount).toBe(0);
    expect(rate?.display_name).toBe('Free shipping');
  });

  it('models paid shipping as a fixed-amount option', () => {
    const params = buildCheckoutSessionParams(quote({ shippingCents: 590 }), { urls });
    const rate = params.shipping_options[0]?.shipping_rate_data;
    expect(rate?.fixed_amount.amount).toBe(590);
    expect(rate?.display_name).toBe('Standard shipping');
  });

  it('attaches a coupon, client reference and metadata when provided', () => {
    const params = buildCheckoutSessionParams(quote(), {
      urls,
      couponId: 'coup_123',
      clientReferenceId: 'proj_1',
      metadata: { slug: 'acme' },
    });
    expect(params.discounts).toEqual([{ coupon: 'coup_123' }]);
    expect(params.client_reference_id).toBe('proj_1');
    expect(params.metadata).toEqual({ slug: 'acme' });
  });

  it('omits optional fields when not provided', () => {
    const params = buildCheckoutSessionParams(quote(), { urls });
    expect(params.discounts).toBeUndefined();
    expect(params.client_reference_id).toBeUndefined();
    expect(params.metadata).toBeUndefined();
  });
});

describe('encodeForm', () => {
  it('flattens nested objects and arrays into Stripe bracket notation (percent-encoded keys)', () => {
    const encoded = encodeForm({
      mode: 'payment',
      line_items: [{ quantity: 2, price_data: { currency: 'usd', unit_amount: 2500 } }],
    });
    // Brackets are percent-encoded exactly as Stripe's own SDK sends them.
    expect(encoded).toContain('mode=payment');
    expect(decodeURIComponent(encoded)).toContain('line_items[0][quantity]=2');
    expect(decodeURIComponent(encoded)).toContain('line_items[0][price_data][currency]=usd');
    expect(decodeURIComponent(encoded)).toContain('line_items[0][price_data][unit_amount]=2500');
  });

  it('url-encodes values', () => {
    expect(encodeForm({ success_url: 'https://a.test/x?y=1' })).toBe(
      'success_url=https%3A%2F%2Fa.test%2Fx%3Fy%3D1',
    );
  });

  it('skips null and undefined values', () => {
    expect(encodeForm({ a: 1, b: null, c: undefined })).toBe('a=1');
  });
});

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ type: 'checkout.session.completed', id: 'evt_1' });

  function sign(payload: string, ts: number, key = secret): string {
    const sig = createHmac('sha256', key).update(`${ts}.${payload}`).digest('hex');
    return `t=${ts},v1=${sig}`;
  }

  it('returns the parsed event for a valid signature within tolerance', () => {
    const ts = 1_700_000_000;
    const header = sign(body, ts);
    const event = verifyWebhookSignature(body, header, secret, () => ts * 1000);
    expect(event.type).toBe('checkout.session.completed');
  });

  it('rejects a tampered payload', () => {
    const ts = 1_700_000_000;
    const header = sign(body, ts);
    expect(() => verifyWebhookSignature(body + 'x', header, secret, () => ts * 1000)).toThrow(StripeError);
  });

  it('rejects a signature made with the wrong secret', () => {
    const ts = 1_700_000_000;
    const header = sign(body, ts, 'whsec_wrong');
    expect(() => verifyWebhookSignature(body, header, secret, () => ts * 1000)).toThrow(/verification failed/);
  });

  it('rejects a timestamp outside the tolerance window', () => {
    const ts = 1_700_000_000;
    const header = sign(body, ts);
    const tenMinutesLater = (ts + 600) * 1000;
    expect(() => verifyWebhookSignature(body, header, secret, () => tenMinutesLater)).toThrow(/tolerance/);
  });

  it('rejects a missing or malformed header', () => {
    expect(() => verifyWebhookSignature(body, null, secret)).toThrow(/Missing/);
    expect(() => verifyWebhookSignature(body, 'garbage', secret)).toThrow(/Malformed/);
  });
});

describe('isStripeConfigured', () => {
  it('reflects the presence of STRIPE_SECRET_KEY', () => {
    const prev = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    expect(isStripeConfigured()).toBe(true);
    delete process.env.STRIPE_SECRET_KEY;
    expect(isStripeConfigured()).toBe(false);
    if (prev !== undefined) process.env.STRIPE_SECRET_KEY = prev;
  });
});
