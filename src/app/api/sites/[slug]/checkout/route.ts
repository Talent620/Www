import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProject } from '@/lib/store';
import { quoteCart, CartError } from '@/lib/commerce/cart';
import {
  isStripeConfigured,
  buildCheckoutSessionParams,
  createCheckoutSession,
  createDiscountCoupon,
  StripeError,
} from '@/lib/commerce/stripe';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  items: z
    .array(z.object({ sku: z.string().min(1).max(64), qty: z.number().int().min(1).max(999) }))
    .min(1)
    .max(50),
  discountCode: z.string().max(32).optional(),
});

/** Resolve the public base URL for success/cancel redirects (no open redirect). */
function baseUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  return new URL(request.url).origin;
}

/**
 * POST /api/sites/:slug/checkout
 * Re-prices the cart server-side against the stored catalog, then creates a
 * Stripe Checkout Session and returns its hosted-checkout URL. Client prices are
 * never trusted: the charged amounts come straight from {@link quoteCart}.
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  // Creating a Checkout Session hits Stripe — throttle to curb abuse.
  const limited = enforceRateLimit(request, 'checkout', 10, 60_000);
  if (limited) return limited;

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (!project.spec.store) {
    return NextResponse.json({ error: 'This project is not a store' }, { status: 400 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Checkout is not configured. Set STRIPE_SECRET_KEY to enable payments.',
        code: 'STRIPE_NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  let quote;
  try {
    quote = quoteCart(project.spec.store, parsed.data.items, parsed.data.discountCode);
  } catch (err) {
    if (err instanceof CartError) {
      const status = err.code === 'UNKNOWN_SKU' ? 404 : 422;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json({ error: 'Quote failed' }, { status: 500 });
  }

  const origin = baseUrl(request);
  const returnTo = `${origin}/preview/${encodeURIComponent(project.slug)}`;

  try {
    const couponId =
      quote.discountCents > 0
        ? await createDiscountCoupon(quote.discountCents, quote.currency, quote.discountCode ?? 'Discount')
        : undefined;

    const sessionParams = buildCheckoutSessionParams(quote, {
      urls: {
        successUrl: `${returnTo}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${returnTo}?checkout=cancelled`,
      },
      couponId,
      clientReferenceId: project.id,
      metadata: { projectId: project.id, slug: project.slug },
    });

    const session = await createCheckoutSession(sessionParams);
    return NextResponse.json({ url: session.url, id: session.id, totalCents: quote.totalCents });
  } catch (err) {
    if (err instanceof StripeError) {
      // Don't surface raw upstream detail; log-worthy but client gets a generic 502.
      return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 });
    }
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
