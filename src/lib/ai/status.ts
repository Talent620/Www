import { selectProvider } from './engine';

export interface EngineStatus {
  /** What AI_PROVIDER is configured to ("auto" | "anthropic" | "deterministic"). */
  configuredProvider: string;
  /** Whether an Anthropic API key is present in the environment. */
  hasApiKey: boolean;
  /** The engine that will actually run a generation right now. */
  activeEngine: 'anthropic' | 'deterministic';
  /** True when live Claude generation is available. */
  liveAvailable: boolean;
  models: { primary: string; fast: string };
}

/**
 * Reports how the AI engine is configured and which provider is active. Pure
 * over `process.env`, so it powers both the /api/health endpoint and the
 * in-app engine badge, and is unit-testable.
 */
export function engineStatus(): EngineStatus {
  const configuredProvider = process.env.AI_PROVIDER || 'auto';
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  let activeEngine: 'anthropic' | 'deterministic';
  try {
    activeEngine = selectProvider().name === 'anthropic' ? 'anthropic' : 'deterministic';
  } catch {
    // selectProvider throws if AI_PROVIDER=anthropic but no key is set.
    activeEngine = 'deterministic';
  }

  return {
    configuredProvider,
    hasApiKey,
    activeEngine,
    liveAvailable: activeEngine === 'anthropic',
    models: {
      primary: process.env.AI_MODEL_PRIMARY || 'claude-opus-4-8',
      fast: process.env.AI_MODEL_FAST || 'claude-haiku-4-5',
    },
  };
}
