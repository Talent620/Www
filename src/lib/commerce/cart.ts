import type { StoreSpec } from '../ai/types';

/**
 * Cart and checkout-quote logic for generated stores.
 *
 * All pricing is resolved server-side against the project's stored catalog —
 * client-submitted prices are never trusted. Pure functions, fully unit-tested.
 */

export interface CartItem {
  sku: string;
  qty: number;
}

export interface QuoteLine {
  sku: string;
  name: string;
  unitCents: number;
  qty: number;
  lineCents: number;
}

export interface CartQuote {
  lines: QuoteLine[];
  currency: string;
  subtotalCents: number;
  discountCents: number;
  discountCode?: string;
  shippingCents: number;
  totalCents: number;
  freeShippingThresholdCents: number;
}

export class CartError extends Error {
  constructor(
    message: string,
    readonly code: 'EMPTY_CART' | 'UNKNOWN_SKU' | 'BAD_QTY' | 'UNKNOWN_CODE',
  ) {
    super(message);
    this.name = 'CartError';
  }
}

/** Orders at/above this subtotal ship free; below it pay flat-rate shipping. */
export const FREE_SHIPPING_THRESHOLD_CENTS = 5000;
export const FLAT_SHIPPING_CENTS = 590;
export const MAX_QTY_PER_LINE = 99;

/** Built-in promotion codes every generated store honors. */
const DISCOUNT_CODES: Record<string, { kind: 'percent'; value: number } | { kind: 'free_shipping' }> = {
  WELCOME10: { kind: 'percent', value: 10 },
  SPRING15: { kind: 'percent', value: 15 },
  FREESHIP: { kind: 'free_shipping' },
};

/**
 * Price a cart against a store catalog. Throws `CartError` on invalid input;
 * returns a complete, display-ready quote otherwise.
 */
export function quoteCart(store: StoreSpec, items: CartItem[], discountCode?: string): CartQuote {
  if (items.length === 0) {
    throw new CartError('Cart is empty', 'EMPTY_CART');
  }

  // Merge duplicate SKUs so { A:1, A:2 } quotes as A:3.
  const merged = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      throw new CartError(`Invalid quantity for ${item.sku}`, 'BAD_QTY');
    }
    merged.set(item.sku, (merged.get(item.sku) ?? 0) + item.qty);
  }

  const lines: QuoteLine[] = [];
  for (const [sku, rawQty] of merged) {
    const product = store.products.find((p) => p.sku === sku);
    if (!product) {
      throw new CartError(`Unknown product: ${sku}`, 'UNKNOWN_SKU');
    }
    const qty = Math.min(rawQty, MAX_QTY_PER_LINE);
    lines.push({
      sku,
      name: product.name,
      unitCents: product.priceCents,
      qty,
      lineCents: product.priceCents * qty,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineCents, 0);

  let discountCents = 0;
  let freeShippingViaCode = false;
  let appliedCode: string | undefined;
  if (discountCode !== undefined && discountCode !== '') {
    const code = discountCode.trim().toUpperCase();
    const promo = DISCOUNT_CODES[code];
    if (!promo) {
      throw new CartError(`Unknown discount code: ${code}`, 'UNKNOWN_CODE');
    }
    appliedCode = code;
    if (promo.kind === 'percent') {
      discountCents = Math.round((subtotalCents * promo.value) / 100);
    } else {
      freeShippingViaCode = true;
    }
  }

  const discountedSubtotal = subtotalCents - discountCents;
  const shippingCents =
    freeShippingViaCode || discountedSubtotal >= FREE_SHIPPING_THRESHOLD_CENTS
      ? 0
      : FLAT_SHIPPING_CENTS;

  return {
    lines,
    currency: store.currency,
    subtotalCents,
    discountCents,
    discountCode: appliedCode,
    shippingCents,
    totalCents: discountedSubtotal + shippingCents,
    freeShippingThresholdCents: FREE_SHIPPING_THRESHOLD_CENTS,
  };
}
