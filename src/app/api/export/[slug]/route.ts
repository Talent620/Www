import { getProject } from '@/lib/store';
import { exportSiteZip } from '@/lib/export/html';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/export/:slug
 * Renders the generated project to a standalone static site and streams it as a
 * downloadable ZIP. This is the "own your code, no lock-in" capability that
 * hosted competitors withhold.
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);
  if (!project) {
    return new Response('Not found', { status: 404 });
  }
  const zip = exportSiteZip(project.spec);
  const filename = `${project.slug}.zip`;
  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zip.length),
      'Cache-Control': 'no-store',
    },
  });
}
