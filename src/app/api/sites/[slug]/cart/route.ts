import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProject } from '@/lib/store';
import { quoteCart, CartError } from '@/lib/commerce/cart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cartSchema = z.object({
  items: z
    .array(z.object({ sku: z.string().min(1).max(64), qty: z.number().int().min(1).max(999) }))
    .min(1)
    .max(50),
  discountCode: z.string().max(32).optional(),
});

/**
 * POST /api/sites/:slug/cart
 * Prices a cart against the project's stored catalog (server-side prices only)
 * and returns a checkout-ready quote with shipping and any discount applied.
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (!project.spec.store) {
    return NextResponse.json({ error: 'This project is not a store' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = cartSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const quote = quoteCart(project.spec.store, parsed.data.items, parsed.data.discountCode);
    return NextResponse.json({ quote });
  } catch (err) {
    if (err instanceof CartError) {
      const status = err.code === 'UNKNOWN_SKU' ? 404 : 422;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json({ error: 'Quote failed' }, { status: 500 });
  }
}
