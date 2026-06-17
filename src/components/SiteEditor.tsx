'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import type { BlogPost, SiteSpec } from '@/lib/ai/types';
import { setByPath } from '@/lib/edit';
import { SiteRenderer } from './SiteRenderer';
import { BlogManager } from './BlogManager';

type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

/**
 * Inline visual editor for a generated site. Click any text on the live page to
 * edit it; tweak brand colours in the toolbar; save back to the project and
 * export the updated static site. Edits are applied immutably to a local copy
 * of the SiteSpec and persisted via PATCH /api/projects/[slug].
 */
export function SiteEditor({ initialSpec, slug }: { initialSpec: SiteSpec; slug: string }) {
  const [spec, setSpec] = useState<SiteSpec>(initialSpec);
  const [pageIndex, setPageIndex] = useState(0);
  const [view, setView] = useState<'site' | 'blog'>('site');
  const [dirty, setDirty] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: 'idle' });

  const setBlog = useCallback((posts: BlogPost[]) => {
    setSpec((s) => ({ ...s, blog: posts }));
    setDirty(true);
    setSave({ status: 'idle' });
  }, []);

  const onEdit = useCallback((path: string, value: string) => {
    setSpec((s) => setByPath(s, path, value));
    setDirty(true);
    setSave({ status: 'idle' });
  }, []);

  const setColor = (key: 'primary' | 'accent' | 'background', value: string) => {
    setSpec((s) => setByPath(s, `design.colors.${key}`, value));
    setDirty(true);
    setSave({ status: 'idle' });
  };

  const persist = useCallback(async (): Promise<boolean> => {
    setSave({ status: 'saving' });
    try {
      const res = await fetch(`/api/projects/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSave({ status: 'error', message: err.error ?? `HTTP ${res.status}` });
        return false;
      }
      setDirty(false);
      setSave({ status: 'saved' });
      return true;
    } catch (e) {
      setSave({ status: 'error', message: e instanceof Error ? e.message : 'Network error' });
      return false;
    }
  }, [slug, spec]);

  const exportSite = useCallback(async () => {
    if (dirty && !(await persist())) return;
    window.open(`/api/export/${slug}`, '_blank');
  }, [dirty, persist, slug]);

  const page = spec.pages[pageIndex] ?? spec.pages[0]!;
  const c = spec.design.colors;

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-900/95 px-4 py-2.5 text-sm text-white backdrop-blur">
        <Link href="/dashboard" className="font-semibold text-brand-300">← Aurea</Link>
        <span className="hidden text-slate-400 sm:inline">Editor · {spec.brief.companyName}</span>

        <div className="flex overflow-hidden rounded border border-slate-700 text-xs">
          <button
            onClick={() => setView('site')}
            className={`px-2.5 py-1 ${view === 'site' ? 'bg-brand-600' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            Pages
          </button>
          <button
            onClick={() => setView('blog')}
            className={`px-2.5 py-1 ${view === 'blog' ? 'bg-brand-600' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            Blog
          </button>
        </div>

        {view === 'site' && (
          <>
            <select
              value={pageIndex}
              onChange={(e) => setPageIndex(Number(e.target.value))}
              className="rounded bg-slate-700 px-2 py-1 text-xs text-white"
              aria-label="Page"
            >
              {spec.pages.map((p, i) => (
                <option key={p.path} value={i}>{p.navLabel || p.title}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <ColorField label="Primary" value={c.primary} onChange={(v) => setColor('primary', v)} />
              <ColorField label="Accent" value={c.accent} onChange={(v) => setColor('accent', v)} />
              <ColorField label="Background" value={c.background} onChange={(v) => setColor('background', v)} />
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {save.status === 'saving' && 'Saving…'}
            {save.status === 'saved' && '✓ Saved'}
            {save.status === 'error' && <span className="text-red-400">Error: {save.message}</span>}
            {save.status === 'idle' && dirty && 'Unsaved changes'}
          </span>
          <button
            onClick={persist}
            disabled={save.status === 'saving' || !dirty}
            className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold hover:bg-brand-500 disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={exportSite}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500"
          >
            ↓ Export .zip
          </button>
          <Link
            href={`/preview/${slug}`}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-600"
          >
            Preview
          </Link>
        </div>
      </div>

      {view === 'site' ? (
        <>
          <p className="bg-brand-950/40 px-4 py-1.5 text-center text-xs text-brand-200">
            💡 Click any text on the page to edit it. Changes are saved to your project and flow into the export.
          </p>
          <SiteRenderer spec={spec} page={page} pageIndex={pageIndex} editable onEdit={onEdit} />
        </>
      ) : (
        <BlogManager posts={spec.blog} companyName={spec.brief.companyName} onChange={setBlog} />
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-300" title={label}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-6 cursor-pointer rounded border border-slate-600 bg-transparent p-0"
        aria-label={label}
      />
    </label>
  );
}
