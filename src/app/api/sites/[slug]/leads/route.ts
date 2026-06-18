import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProject, saveLead, listLeads } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const leadSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  company: z.string().max(120).optional(),
  message: z.string().min(5).max(4000),
  /** Honeypot: real users never fill this; bots do. Must stay empty. */
  website: z.string().max(0).optional().or(z.literal('')),
});

/**
 * POST /api/sites/:slug/leads
 * Public endpoint backing every generated contact form. Validates input,
 * applies a honeypot spam check, and stores the lead for the project owner.
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Bots that filled the honeypot get a success response but the lead is
  // flagged and never surfaced — don't teach them what failed.
  const honeypotFilled =
    typeof payload === 'object' &&
    payload !== null &&
    'website' in payload &&
    typeof (payload as { website: unknown }).website === 'string' &&
    (payload as { website: string }).website.length > 0;

  const parsed = leadSchema.safeParse(
    honeypotFilled ? { ...(payload as object), website: '' } : payload,
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const lead = await saveLead({
    projectId: project.id,
    name: parsed.data.name,
    email: parsed.data.email,
    company: parsed.data.company,
    message: parsed.data.message,
    spam: honeypotFilled,
  });

  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}

/**
 * GET /api/sites/:slug/leads
 * Owner-only listing, protected by a bearer token (AUTH_SECRET). Spam-flagged
 * leads are excluded.
 */
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const secret = process.env.AUTH_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const leads = (await listLeads(project.id)).filter((l) => !l.spam);
  return NextResponse.json({ leads, count: leads.length });
}
