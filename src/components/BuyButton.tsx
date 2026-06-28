'use client';

import { useState } from 'react';

/**
 * Single-product checkout trigger used in the live preview. Posts the SKU to the
 * project's checkout endpoint, which re-prices server-side and returns a Stripe
 * hosted-checkout URL to redirect to. Renders nothing interactive without a slug
 * (static export). When Stripe isn't configured the endpoint replies 503 and we
 * surface a friendly inline note instead of redirecting.
 */
export function BuyButton({ slug, sku, label = 'Buy now' }: { slug?: string; sku: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  if (!slug) return null;

  async function onClick() {
    setStatus('loading');
    setMessage(null);
    try {
      const res = await fetch(`/api/sites/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ sku, qty: 1 }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url as string;
        return;
      }
      setStatus('error');
      setMessage(
        data.code === 'STRIPE_NOT_CONFIGURED'
          ? 'Payments aren’t enabled for this demo store yet.'
          : data.error || 'Could not start checkout.',
      );
    } catch {
      setStatus('error');
      setMessage('Could not start checkout. Please try again.');
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onClick}
        disabled={status === 'loading'}
        className="w-full px-3 py-2 text-sm font-semibold disabled:opacity-60"
        style={{ background: 'var(--primary)', color: 'var(--bg)', borderRadius: 'calc(var(--radius) * .7)' }}
      >
        {status === 'loading' ? 'Starting…' : label}
      </button>
      {message && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--accent)' }} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
