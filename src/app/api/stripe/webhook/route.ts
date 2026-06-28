import { NextResponse } from 'next/server';
import { verifyWebhookSignature, StripeError } from '@/lib/commerce/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 * Receives Stripe events and verifies their signature before acting. The raw
 * request body is required for signature verification, so it must be read as
 * text (never parsed/re-serialized) before hashing.
 *
 * Aurea has no Order model yet, so a completed checkout is acknowledged and
 * logged; persisting the order is a follow-up once the schema lands. Returning
 * 2xx tells Stripe the event was received and stops it retrying.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhooks are not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event: Record<string, unknown>;
  try {
    event = verifyWebhookSignature(rawBody, signature, secret);
  } catch (err) {
    const status = err instanceof StripeError ? err.status : 400;
    return NextResponse.json({ error: 'Invalid signature' }, { status });
  }

  const type = typeof event.type === 'string' ? event.type : 'unknown';
  switch (type) {
    case 'checkout.session.completed': {
      const session = (event.data as { object?: { id?: string; client_reference_id?: string } } | undefined)?.object;
      // eslint-disable-next-line no-console
      console.info(
        `[stripe] checkout completed: session=${session?.id ?? '?'} project=${session?.client_reference_id ?? '?'}`,
      );
      break;
    }
    default:
      // Unhandled but acknowledged so Stripe doesn't retry.
      break;
  }

  return NextResponse.json({ received: true });
}
