import { NextResponse } from 'next/server';
import { engineStatus } from '@/lib/ai/status';
import { hasDatabase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * Liveness + configuration report: which AI engine is active, whether a live
 * API key is present, configured models, and storage backend.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'aurea',
    version: '0.2.0',
    storage: hasDatabase() ? 'postgres' : 'memory',
    engine: engineStatus(),
  });
}
