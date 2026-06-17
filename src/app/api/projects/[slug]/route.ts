import { NextResponse } from 'next/server';
import type { SiteSpec } from '@/lib/ai/types';
import { getProject, updateProject } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Minimal structural guard — the editor sends a full, already-typed SiteSpec. */
function isSiteSpec(value: unknown): value is SiteSpec {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.pages) && typeof v.design === 'object' && typeof v.brief === 'object';
}

/** GET the stored spec for a project (used by the editor to load). */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ slug: project.slug, spec: project.spec });
}

/** PATCH the project with an edited SiteSpec. */
export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const spec = (body as { spec?: unknown })?.spec;
  if (!isSiteSpec(spec)) {
    return NextResponse.json({ error: 'Body must contain a valid spec' }, { status: 422 });
  }
  const updated = await updateProject(params.slug, spec);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, slug: updated.slug, previewUrl: `/preview/${updated.slug}` });
}
