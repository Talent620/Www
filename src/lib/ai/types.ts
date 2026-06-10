/**
 * Aurea generation contract.
 *
 * A `Brief` is the small amount of information a user provides. The AI engine
 * autonomously expands it into a complete `SiteSpec` — the single source of
 * truth that the renderer, CMS, store, and SEO layers all consume.
 */

export type ProjectKind = 'WEBSITE' | 'STORE';

/** The minimal input a user supplies. Everything else is inferred. */
export interface Brief {
  companyName: string;
  industry: string;
  description: string;
  /** e.g. "modern", "minimal", "bold", "elegant", "playful". */
  style: string;
  /** BCP-47 codes. First entry is the primary locale. */
  locales: string[];
  kind: ProjectKind;
}

/** Strategic analysis the engine performs before authoring anything. */
export interface MarketAnalysis {
  industrySummary: string;
  targetAudience: {
    segment: string;
    needs: string[];
    objections: string[];
  }[];
  competitors: {
    name: string;
    positioning: string;
    weaknessToExploit: string;
  }[];
  uniqueValueProposition: string;
  marketingStrategy: {
    channel: string;
    tactic: string;
  }[];
  keywords: string[];
}

export interface ColorSystem {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
}

export interface TypographySystem {
  headingFont: string;
  bodyFont: string;
  scale: { name: string; sizeRem: number; weight: number }[];
}

export interface DesignSystem {
  colors: ColorSystem;
  typography: TypographySystem;
  radiusRem: number;
  /** Named, declarative animation presets applied to components. */
  animations: string[];
  logo: {
    /** Inline SVG markup for an AI-generated wordmark/monogram. */
    svg: string;
    monogram: string;
  };
}

export type SectionKind =
  | 'hero'
  | 'features'
  | 'cta'
  | 'faq'
  | 'testimonials'
  | 'pricing'
  | 'contactForm'
  | 'productGrid'
  | 'richText'
  | 'logoCloud'
  | 'stats';

export interface Section {
  kind: SectionKind;
  heading?: string;
  subheading?: string;
  body?: string;
  cta?: { label: string; href: string };
  items?: { title: string; body: string; icon?: string }[];
  faqs?: { q: string; a: string }[];
  fields?: { name: string; label: string; type: string; required: boolean }[];
}

export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  openGraph: { title: string; description: string; type: string; image?: string };
  twitter: { card: string; title: string; description: string };
  /** JSON-LD structured data objects. */
  jsonLd: Record<string, unknown>[];
}

export interface Page {
  path: string;
  title: string;
  navLabel: string;
  showInNav: boolean;
  sections: Section[];
  seo: SeoMeta;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  seo: SeoMeta;
}

export interface CatalogProduct {
  sku: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  category: string;
  imagePrompt: string;
}

export interface StoreSpec {
  currency: string;
  categories: string[];
  products: CatalogProduct[];
  /** Declarative checkout flow steps for the storefront. */
  checkoutSteps: string[];
}

export interface LegalDoc {
  kind: 'privacy' | 'terms' | 'cookies';
  title: string;
  body: string;
}

/** Localised string bundle for a single locale. */
export interface LocaleBundle {
  locale: string;
  strings: Record<string, string>;
}

/** The complete, renderable specification produced by the engine. */
export interface SiteSpec {
  brief: Brief;
  analysis: MarketAnalysis;
  design: DesignSystem;
  pages: Page[];
  blog: BlogPost[];
  store?: StoreSpec;
  legal: LegalDoc[];
  locales: LocaleBundle[];
  /** Sitemap entries (paths) derived from pages + blog + store. */
  sitemap: string[];
  generatedAt: string;
}

/** Report from the automated quality gate run after generation. */
export interface QualityReport {
  seo: number;
  accessibility: number;
  performance: number;
  security: number;
  /** Human-readable findings, each tied to a fix the engine applied. */
  findings: { area: string; severity: 'info' | 'warn' | 'error'; message: string }[];
  passed: boolean;
}
