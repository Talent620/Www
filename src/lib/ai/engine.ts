import type { GenerationProvider, ProviderName } from './provider';
import type { Brief, SiteSpec, QualityReport } from './types';
import { DeterministicProvider } from './deterministic';
import { AnthropicProvider } from './anthropic';
import { buildSitemap } from './seo';
import { auditAndFix } from './quality';

export interface PhaseLog {
  phase: string;
  durationMs: number;
  ok: boolean;
  message?: string;
}

export interface GenerationResult {
  spec: SiteSpec;
  engine: string;
  report: QualityReport;
  phases: PhaseLog[];
}

/** Resolve which provider to use from configuration + available credentials. */
export function selectProvider(preference?: ProviderName): GenerationProvider {
  const pref = preference || (process.env.AI_PROVIDER as ProviderName) || 'auto';
  const key = process.env.ANTHROPIC_API_KEY;
  if (pref === 'deterministic') return new DeterministicProvider();
  if (pref === 'anthropic') {
    if (!key) throw new Error('AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set');
    return new AnthropicProvider(key);
  }
  // auto
  return key ? new AnthropicProvider(key) : new DeterministicProvider();
}

async function timed<T>(phase: string, phases: PhaseLog[], fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    phases.push({ phase, durationMs: Date.now() - start, ok: true });
    return result;
  } catch (err) {
    phases.push({
      phase,
      durationMs: Date.now() - start,
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * The Aurea generation engine. Runs the full autonomous pipeline:
 * analyse → design → structure/author → SEO → store → legal → i18n →
 * quality gate (self-improvement) → assemble SiteSpec.
 */
export async function generateSite(
  brief: Brief,
  preference?: ProviderName,
): Promise<GenerationResult> {
  const provider = selectProvider(preference);
  const phases: PhaseLog[] = [];

  const analysis = await timed('analyze', phases, () => provider.analyze(brief));
  const design = await timed('design', phases, () => provider.design(brief, analysis));
  const pages = await timed('author-pages', phases, () => provider.authorPages(brief, analysis, design));
  const blog = await timed('author-blog', phases, () => provider.authorBlog(brief, analysis));
  const store = await timed('build-store', phases, () => provider.buildStore(brief, analysis));
  const legal = await timed('author-legal', phases, () => provider.authorLegal(brief));
  const locales = await timed('localize', phases, () => provider.localize(brief, pages));

  const partial: Omit<SiteSpec, 'sitemap'> = {
    brief,
    analysis,
    design,
    pages,
    blog,
    store,
    legal,
    locales,
    generatedAt: new Date().toISOString(),
  };
  const sitemap = buildSitemap(partial);
  const spec: SiteSpec = { ...partial, sitemap };

  const { spec: audited, report } = await timed('quality-gate', phases, async () => auditAndFix(spec));

  return { spec: audited, engine: provider.name, report, phases };
}
