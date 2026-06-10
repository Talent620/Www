import Anthropic from '@anthropic-ai/sdk';
import type { GenerationProvider } from './provider';
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
import { DeterministicProvider } from './deterministic';
import { buildPageSeo } from './seo';

const PRIMARY_MODEL = process.env.AI_MODEL_PRIMARY || 'claude-opus-4-8';

/**
 * Live, multi-model provider. It uses Claude for the language-heavy, strategic
 * work (market analysis, page copy) and reuses the deterministic provider for
 * deterministic structure (design tokens, SEO assembly, i18n, legal). Every
 * model call degrades gracefully to the deterministic result on error, so a
 * transient API failure can never break a generation.
 */
export class AnthropicProvider implements GenerationProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly fallback = new DeterministicProvider();

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  private async json<T>(system: string, user: string, schema: Record<string, unknown>): Promise<T> {
    // Adaptive thinking + output_config (structured outputs) are newer than the
    // pinned SDK's static types, so the request body is built untyped and cast.
    const params = {
      model: PRIMARY_MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: user }],
    };
    const res = await this.client.messages.create(
      params as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );
    const text = res.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') throw new Error('No text block in model response');
    return JSON.parse(text.text) as T;
  }

  async analyze(brief: Brief): Promise<MarketAnalysis> {
    try {
      const schema = {
        type: 'object',
        additionalProperties: false,
        required: [
          'industrySummary',
          'targetAudience',
          'competitors',
          'uniqueValueProposition',
          'marketingStrategy',
          'keywords',
        ],
        properties: {
          industrySummary: { type: 'string' },
          targetAudience: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['segment', 'needs', 'objections'],
              properties: {
                segment: { type: 'string' },
                needs: { type: 'array', items: { type: 'string' } },
                objections: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          competitors: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'positioning', 'weaknessToExploit'],
              properties: {
                name: { type: 'string' },
                positioning: { type: 'string' },
                weaknessToExploit: { type: 'string' },
              },
            },
          },
          uniqueValueProposition: { type: 'string' },
          marketingStrategy: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['channel', 'tactic'],
              properties: { channel: { type: 'string' }, tactic: { type: 'string' } },
            },
          },
          keywords: { type: 'array', items: { type: 'string' } },
        },
      };
      return await this.json<MarketAnalysis>(
        'You are a senior market strategist and SEO expert. Respond with a rigorous, specific analysis. No fluff.',
        `Analyze this business and return the JSON analysis.\nCompany: ${brief.companyName}\nIndustry: ${brief.industry}\nDescription: ${brief.description}\nType: ${brief.kind}`,
        schema,
      );
    } catch {
      return this.fallback.analyze(brief);
    }
  }

  // Design tokens are deterministic by design — consistent, accessible, and
  // reproducible — so we reuse the reference implementation.
  async design(brief: Brief, analysis: MarketAnalysis): Promise<DesignSystem> {
    return this.fallback.design(brief, analysis);
  }

  async authorPages(brief: Brief, analysis: MarketAnalysis, design: DesignSystem): Promise<Page[]> {
    // Start from the deterministic page structure (guaranteed valid + complete),
    // then upgrade the hero copy with the model when available.
    const pages = await this.fallback.authorPages(brief, analysis, design);
    try {
      const schema = {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'subheading', 'ctaLabel'],
        properties: {
          heading: { type: 'string' },
          subheading: { type: 'string' },
          ctaLabel: { type: 'string' },
        },
      };
      const hero = await this.json<{ heading: string; subheading: string; ctaLabel: string }>(
        'You are a world-class conversion copywriter. Write punchy, specific, benefit-led copy.',
        `Write a homepage hero for "${brief.companyName}" in the ${brief.industry} industry, ${brief.style} style. UVP: ${analysis.uniqueValueProposition}`,
        schema,
      );
      const home = pages[0];
      if (home && home.sections[0]?.kind === 'hero') {
        home.sections[0].heading = hero.heading;
        home.sections[0].subheading = hero.subheading;
        if (home.sections[0].cta) home.sections[0].cta.label = hero.ctaLabel;
        home.seo = buildPageSeo(brief, '/', 'Home', truncate(hero.subheading, 155), analysis.keywords);
      }
    } catch {
      /* keep deterministic copy */
    }
    return pages;
  }

  async authorBlog(brief: Brief, analysis: MarketAnalysis): Promise<BlogPost[]> {
    // Blog bodies are long-form; the deterministic author produces solid,
    // SEO-structured posts. The live model can be layered in later per-post.
    return this.fallback.authorBlog(brief, analysis);
  }

  async buildStore(brief: Brief, analysis: MarketAnalysis): Promise<StoreSpec | undefined> {
    return this.fallback.buildStore(brief, analysis);
  }

  async authorLegal(brief: Brief): Promise<LegalDoc[]> {
    return this.fallback.authorLegal(brief);
  }

  async localize(brief: Brief, pages: Page[]): Promise<LocaleBundle[]> {
    return this.fallback.localize(brief, pages);
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}
