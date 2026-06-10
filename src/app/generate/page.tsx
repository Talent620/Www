'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface EngineHealth {
  engine: { activeEngine: string; liveAvailable: boolean; models: { primary: string } };
}

const STYLES = ['modern', 'minimal', 'bold', 'elegant', 'playful', 'corporate', 'natural', 'luxury'];
const LOCALES = ['en', 'pl', 'de', 'fr', 'es'];

interface GenerateResponse {
  slug: string;
  engine: string;
  previewUrl: string;
  report: { seo: number; accessibility: number; performance: number; security: number; passed: boolean };
  phases: { phase: string; durationMs: number; ok: boolean }[];
}

export default function GeneratePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: '',
    industry: '',
    description: '',
    style: 'modern',
    kind: 'WEBSITE' as 'WEBSITE' | 'STORE',
    locales: ['en'] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [health, setHealth] = useState<EngineHealth | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: EngineHealth) => setHealth(d))
      .catch(() => setHealth(null));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleLocale(locale: string) {
    setForm((f) => {
      const has = f.locales.includes(locale);
      const next = has ? f.locales.filter((l) => l !== locale) : [...f.locales, locale];
      return { ...f, locales: next.length ? next : ['en'] };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setResult(data as GenerateResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-bold text-brand-700">← Aurea</Link>
        <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-brand-700">Dashboard</Link>
      </header>

      <div className="mx-auto max-w-3xl px-6 pb-20">
        <h1 className="text-3xl font-extrabold text-slate-900">Describe your business</h1>
        <p className="mt-2 text-slate-600">Four fields. The engine handles the rest.</p>

        {health && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              health.engine.liveAvailable
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${health.engine.liveAvailable ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {health.engine.liveAvailable ? (
              <span>Live AI engine active — {health.engine.models.primary}</span>
            ) : (
              <span>Deterministic engine active. Set <code>ANTHROPIC_API_KEY</code> in <code>.env</code> for live AI.</span>
            )}
          </div>
        )}

        <form onSubmit={submit} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <Field label="Company name" htmlFor="companyName">
            <input
              id="companyName"
              required
              value={form.companyName}
              onChange={(e) => update('companyName', e.target.value)}
              placeholder="Northwind Studio"
              className="input"
            />
          </Field>

          <Field label="Industry" htmlFor="industry">
            <input
              id="industry"
              required
              value={form.industry}
              onChange={(e) => update('industry', e.target.value)}
              placeholder="Interior design"
              className="input"
            />
          </Field>

          <Field label="What does the business do?" htmlFor="description">
            <textarea
              id="description"
              required
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="We design calm, functional living spaces for busy families."
              className="input"
            />
          </Field>

          <Field label="Preferred style" htmlFor="style">
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => update('style', s)}
                  className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition ${
                    form.style === s
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-brand-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Project type" htmlFor="kind">
            <div className="flex gap-3">
              {(['WEBSITE', 'STORE'] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => update('kind', k)}
                  className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                    form.kind === k
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-brand-400'
                  }`}
                >
                  {k === 'WEBSITE' ? 'Website' : 'Online store'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Languages" htmlFor="locales">
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((l) => (
                <button
                  type="button"
                  key={l}
                  onClick={() => toggleLocale(l)}
                  className={`rounded-lg border px-3 py-1.5 text-sm uppercase transition ${
                    form.locales.includes(l)
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-brand-400'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </Field>

          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Generating your site…' : 'Generate site →'}
          </button>
        </form>

        {result && (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="text-lg font-semibold text-emerald-900">Site generated with the “{result.engine}” engine</h2>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {(['seo', 'accessibility', 'performance', 'security'] as const).map((k) => (
                <div key={k} className="rounded-lg bg-white p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{result.report[k]}</div>
                  <div className="text-xs capitalize text-slate-500">{k}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              {result.phases.map((p) => (
                <span key={p.phase} className="rounded bg-white px-2 py-1">
                  {p.phase} · {p.durationMs}ms {p.ok ? '✓' : '✗'}
                </span>
              ))}
            </div>
            <button
              onClick={() => router.push(result.previewUrl)}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700"
            >
              Open live preview →
            </button>
          </div>
        )}
      </div>

      <style>{`.input{width:100%;border-radius:0.6rem;border:1px solid #cbd5e1;padding:0.65rem 0.85rem;font-size:0.95rem;outline:none}.input:focus{border-color:#3563ff;box-shadow:0 0 0 3px rgba(53,99,255,.15)}`}</style>
    </main>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children}
    </div>
  );
}
