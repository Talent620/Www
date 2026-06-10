import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { engineStatus } from '@/lib/ai/status';

const ENV_KEYS = ['AI_PROVIDER', 'ANTHROPIC_API_KEY', 'AI_MODEL_PRIMARY', 'AI_MODEL_FAST'] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('engineStatus', () => {
  it('reports deterministic when no key is present (auto)', () => {
    const s = engineStatus();
    expect(s.hasApiKey).toBe(false);
    expect(s.activeEngine).toBe('deterministic');
    expect(s.liveAvailable).toBe(false);
    expect(s.models.primary).toBe('claude-opus-4-8');
  });

  it('reports anthropic when a key is present (auto)', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const s = engineStatus();
    expect(s.hasApiKey).toBe(true);
    expect(s.activeEngine).toBe('anthropic');
    expect(s.liveAvailable).toBe(true);
  });

  it('forces deterministic when AI_PROVIDER=deterministic even with a key', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.AI_PROVIDER = 'deterministic';
    expect(engineStatus().activeEngine).toBe('deterministic');
  });

  it('degrades to deterministic when AI_PROVIDER=anthropic but no key', () => {
    process.env.AI_PROVIDER = 'anthropic';
    const s = engineStatus();
    expect(s.activeEngine).toBe('deterministic');
    expect(s.configuredProvider).toBe('anthropic');
  });

  it('honors custom model env vars', () => {
    process.env.AI_MODEL_PRIMARY = 'claude-fable-5';
    expect(engineStatus().models.primary).toBe('claude-fable-5');
  });
});
