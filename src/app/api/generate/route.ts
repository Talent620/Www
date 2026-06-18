import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { parseBrief } from '@/lib/validation';
import { generateSite } from '@/lib/ai';
import { saveProject } from '@/lib/store';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/generate
 * Body: { companyName, industry, description, style, locales[], kind }
 * Runs the autonomous generation engine and persists the result.
 */
export async function POST(request: Request) {
  // Generation is the most expensive operation (esp. with live AI) — cap it.
  const limited = enforceRateLimit(request, 'generate', 20, 60_000);
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const brief = parseBrief(payload);
    // Optional per-request engine override; otherwise resolved from config.
    const raw = (payload as { provider?: unknown })?.provider;
    const provider =
      raw === 'anthropic' || raw === 'deterministic' || raw === 'auto' ? raw : undefined;
    const result = await generateSite(brief, provider);
    const project = await saveProject({
      brief,
      spec: result.spec,
      engine: result.engine,
      report: result.report,
    });

    return NextResponse.json(
      {
        id: project.id,
        slug: project.slug,
        engine: result.engine,
        report: result.report,
        phases: result.phases,
        previewUrl: `/preview/${project.slug}`,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
