import { describe, it, expect } from 'vitest';
import {
  quoteCart,
  CartError,
  FREE_SHIPPING_THRESHOLD_CENTS,
  FLAT_SHIPPING_CENTS,
  MAX_QTY_PER_LINE,
} from '@/lib/commerce/cart';
import type { StoreSpec } from '@/lib/ai/types';

const store: StoreSpec = {
  currency: 'USD',
  categories: ['A'],
  checkoutSteps: [],
  products: [
    { sku: 'SKU-001', name: 'Cheap', description: '', priceCents: 1000, currency: 'USD', category: 'A', imagePrompt: '' },
    { sku: 'SKU-002', name: 'Mid', description: '', priceCents: 3000, currency: 'USD', category: 'A', imagePrompt: '' },
    { sku: 'SKU-003', name: 'Pricey', description: '', priceCents: 6000, currency: 'USD', category: 'A', imagePrompt: '' },
  ],
};

describe('quoteCart', () => {
  it('prices lines and adds flat shipping below the free threshold', () => {
    const q = quoteCart(store, [{ sku: 'SKU-001', qty: 2 }]); // 2000c < 5000c
    expect(q.subtotalCents).toBe(2000);
    expect(q.shippingCents).toBe(FLAT_SHIPPING_CENTS);
    expect(q.totalCents).toBe(2000 + FLAT_SHIPPING_CENTS);
  });

  it('gives free shipping at/above the threshold', () => {
    const q = quoteCart(store, [{ sku: 'SKU-003', qty: 1 }]); // 6000c >= 5000c
    expect(q.subtotalCents).toBe(FREE_SHIPPING_THRESHOLD_CENTS + 1000);
    expect(q.shippingCents).toBe(0);
    expect(q.totalCents).toBe(6000);
  });

  it('merges duplicate SKUs', () => {
    const q = quoteCart(store, [
      { sku: 'SKU-001', qty: 1 },
      { sku: 'SKU-001', qty: 2 },
    ]);
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]!.qty).toBe(3);
    expect(q.lines[0]!.lineCents).toBe(3000);
  });

  it('applies a percentage discount and recomputes shipping on the discounted subtotal', () => {
    // 3000 + 3000 = 6000 (free shipping), 10% off -> 5400, still >= 5000 so free.
    const q = quoteCart(store, [{ sku: 'SKU-002', qty: 2 }], 'WELCOME10');
    expect(q.discountCents).toBe(600);
    expect(q.discountCode).toBe('WELCOME10');
    expect(q.shippingCents).toBe(0);
    expect(q.totalCents).toBe(5400);
  });

  it('honors a free-shipping code on a small order', () => {
    const q = quoteCart(store, [{ sku: 'SKU-001', qty: 1 }], 'freeship');
    expect(q.shippingCents).toBe(0);
    expect(q.totalCents).toBe(1000);
  });

  it('caps quantity per line', () => {
    const q = quoteCart(store, [{ sku: 'SKU-001', qty: 500 }]);
    expect(q.lines[0]!.qty).toBe(MAX_QTY_PER_LINE);
  });

  it('rejects empty carts, unknown SKUs, bad quantities, and unknown codes', () => {
    expect(() => quoteCart(store, [])).toThrow(CartError);
    expect(() => quoteCart(store, [{ sku: 'NOPE', qty: 1 }])).toThrowError(/Unknown product/);
    expect(() => quoteCart(store, [{ sku: 'SKU-001', qty: 0 }])).toThrowError(/Invalid quantity/);
    expect(() => quoteCart(store, [{ sku: 'SKU-001', qty: 1 }], 'BOGUS')).toThrowError(/Unknown discount/);
  });

  it('never trusts client prices — only catalog prices are used', () => {
    const tampered = [{ sku: 'SKU-003', qty: 1, priceCents: 1 } as unknown as { sku: string; qty: number }];
    const q = quoteCart(store, tampered);
    expect(q.lines[0]!.unitCents).toBe(6000);
  });
});
