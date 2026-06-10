import type {
  Brief,
  MarketAnalysis,
  DesignSystem,
  Page,
  BlogPost,
  StoreSpec,
  LegalDoc,
  LocaleBundle,
} from './types';

/**
 * A generation provider implements the discrete authoring capabilities the
 * engine orchestrates. This is the seam that lets Aurea run a multi-model
 * architecture: each capability can be served by a different model, and the
 * deterministic provider serves all of them with no external dependency.
 */
export interface GenerationProvider {
  /** Stable identifier persisted on each project ("deterministic" | "anthropic"). */
  readonly name: string;

  analyze(brief: Brief): Promise<MarketAnalysis>;
  design(brief: Brief, analysis: MarketAnalysis): Promise<DesignSystem>;
  authorPages(brief: Brief, analysis: MarketAnalysis, design: DesignSystem): Promise<Page[]>;
  authorBlog(brief: Brief, analysis: MarketAnalysis): Promise<BlogPost[]>;
  buildStore(brief: Brief, analysis: MarketAnalysis): Promise<StoreSpec | undefined>;
  authorLegal(brief: Brief): Promise<LegalDoc[]>;
  localize(brief: Brief, pages: Page[]): Promise<LocaleBundle[]>;
}

export type ProviderName = 'auto' | 'anthropic' | 'deterministic';
