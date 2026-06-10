import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProject } from '@/lib/store';
import { SiteRenderer } from '@/components/SiteRenderer';

export const dynamic = 'force-dynamic';

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { page?: string };
}) {
  const project = await getProject(params.slug);
  if (!project) notFound();

  const spec = project.spec;
  const pagePath = searchParams.page || '/';
  const page = spec.pages.find((p) => p.path === pagePath) ?? spec.pages[0];
  if (!page) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-5 py-3 text-sm text-white">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="font-semibold text-brand-300">← Aurea</Link>
          <span className="text-slate-400">Preview · {project.brief.companyName}</span>
          <span className="rounded bg-slate-700 px-2 py-0.5 text-xs">{project.engine}</span>
        </div>
        <nav className="flex flex-wrap gap-1">
          {spec.pages.map((p) => (
            <Link
              key={p.path}
              href={`/preview/${project.slug}?page=${encodeURIComponent(p.path)}`}
              className={`rounded px-2.5 py-1 text-xs transition ${
                p.path === page.path ? 'bg-brand-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {p.navLabel}
            </Link>
          ))}
        </nav>
      </div>
      <SiteRenderer spec={spec} page={page} />
    </div>
  );
}
