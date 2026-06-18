import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/verify-key
 * Makes one tiny live call to confirm the configured ANTHROPIC_API_KEY works.
 * Lets you verify "the API works" without running a full generation.
 */
export async function GET(request: Request) {
  // This endpoint spends real API tokens — rate-limit it tightly.
  const limited = enforceRateLimit(request, 'verify-key', 5, 60_000);
  if (limited) return limited;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, reason: 'no_key', message: 'ANTHROPIC_API_KEY is not set. The deterministic engine is active.' },
      { status: 200 },
    );
  }

  const model = process.env.AI_MODEL_PRIMARY || 'claude-opus-4-8';
  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);
    const text = res.content.find((b) => b.type === 'text');
    return NextResponse.json({
      ok: true,
      model,
      sample: text && text.type === 'text' ? text.text.trim().slice(0, 40) : '',
    });
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status ?? 500 : 500;
    const message = err instanceof Error ? err.message : 'verification failed';
    return NextResponse.json({ ok: false, reason: 'api_error', model, message }, { status: 200 });
  }
}
