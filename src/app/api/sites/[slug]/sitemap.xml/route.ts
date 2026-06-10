import { getProject } from '@/lib/store';
import { sitemapXml } from '@/lib/ai';

export const dynamic = 'force-dynamic';

/** GET /api/sites/:slug/sitemap.xml — sitemap for a generated project. */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);
  if (!project) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(sitemapXml(project.spec.sitemap), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
