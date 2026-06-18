'use client';

import { useState } from 'react';

interface Field {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

/**
 * Interactive contact form used in the live preview. Posts to the project's
 * public leads endpoint, including a hidden honeypot field for spam defense.
 * Falls back to a plain static form when no project slug is supplied (export).
 */
export function ContactForm({ slug, fields, submitLabel }: { slug?: string; fields: Field[]; submitLabel: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slug) return;
    setStatus('sending');
    setError(null);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const res = await fetch(`/api/sites/${slug}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not send your message');
      }
      setStatus('ok');
      e.currentTarget.reset();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (status === 'ok') {
    return (
      <p className="rounded-lg px-4 py-3 text-center" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
        Thanks — your message has been sent. We&rsquo;ll be in touch shortly.
      </p>
    );
  }

  return (
    <form className="mx-auto max-w-lg space-y-4" onSubmit={onSubmit}>
      {/* Honeypot: hidden from users, tempting to bots. Must stay empty. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
            {field.label}
            {field.required && <span style={{ color: 'var(--accent)' }}> *</span>}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              id={field.name}
              name={field.name}
              rows={4}
              required={field.required}
              className="w-full rounded-lg border p-2.5 text-sm"
              style={{ borderColor: 'var(--surface)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          ) : (
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              required={field.required}
              className="w-full rounded-lg border p-2.5 text-sm"
              style={{ borderColor: 'var(--surface)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          )}
        </div>
      ))}
      {error && <p className="text-sm" style={{ color: 'var(--accent)' }}>{error}</p>}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="inline-block px-7 py-3 font-semibold disabled:opacity-60"
        style={{ background: 'var(--primary)', color: 'var(--bg)', borderRadius: 'var(--radius)' }}
      >
        {status === 'sending' ? 'Sending…' : submitLabel}
      </button>
    </form>
  );
}
