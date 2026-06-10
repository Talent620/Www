import Link from 'next/link';
import { listProjects } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const projects = await listProjects();

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-bold text-brand-700">← Aurea</Link>
        <Link
          href="/generate"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          New project
        </Link>
      </header>

      <div className="mx-auto max-w-5xl px-6 pb-20">
        <h1 className="text-3xl font-extrabold text-slate-900">Your projects</h1>
        <p className="mt-2 text-slate-600">{projects.length} generated {projects.length === 1 ? 'site' : 'sites'}.</p>

        {projects.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-500">No projects yet.</p>
            <Link href="/generate" className="mt-4 inline-block font-semibold text-brand-700">
              Generate your first site →
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/preview/${p.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-400 hover:shadow"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900 group-hover:text-brand-700">{p.brief.companyName}</h2>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{p.brief.kind}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{p.brief.industry}</p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{p.brief.description}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <span className="rounded bg-brand-50 px-2 py-0.5 text-brand-700">{p.engine}</span>
                  <span>{p.spec.pages.length} pages</span>
                  {p.spec.store && <span>· {p.spec.store.products.length} products</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
