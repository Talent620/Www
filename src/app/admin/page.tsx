import Link from 'next/link';
import { listProjects } from '@/lib/store';
import { hasDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const projects = await listProjects();
  const stores = projects.filter((p) => p.brief.kind === 'STORE');
  const totalProducts = stores.reduce((n, p) => n + (p.spec.store?.products.length ?? 0), 0);
  const engines = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.engine] = (acc[p.engine] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-bold text-brand-700">← Aurea Admin</Link>
        <span className="text-sm text-slate-500">
          Storage: {hasDatabase() ? 'PostgreSQL' : 'in-memory'}
        </span>
      </header>

      <div className="mx-auto max-w-5xl px-6 pb-20">
        <h1 className="text-3xl font-extrabold text-slate-900">Platform overview</h1>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Projects" value={projects.length} />
          <Stat label="Stores" value={stores.length} />
          <Stat label="Products" value={totalProducts} />
          <Stat label="Engines" value={Object.keys(engines).length} />
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Engine usage</h2>
          <div className="mt-3 space-y-2">
            {Object.entries(engines).map(([engine, count]) => (
              <div key={engine} className="flex items-center gap-3">
                <span className="w-28 text-sm text-slate-600">{engine}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-brand-600"
                    style={{ width: `${projects.length ? (count / projects.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm text-slate-500">{count}</span>
              </div>
            ))}
            {projects.length === 0 && <p className="text-sm text-slate-400">No data yet.</p>}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">All projects</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-2">Company</th>
                  <th className="px-4 py-2">Industry</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Engine</th>
                  <th className="px-4 py-2">Pages</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">
                      <Link href={`/preview/${p.slug}`} className="hover:text-brand-700">{p.brief.companyName}</Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{p.brief.industry}</td>
                    <td className="px-4 py-2 text-slate-600">{p.brief.kind}</td>
                    <td className="px-4 py-2 text-slate-600">{p.engine}</td>
                    <td className="px-4 py-2 text-slate-600">{p.spec.pages.length}</td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">No projects yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-3xl font-extrabold text-brand-700">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}
