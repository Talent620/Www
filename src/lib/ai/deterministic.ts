import type { GenerationProvider } from './provider';
import type {
  Brief,
  MarketAnalysis,
  DesignSystem,
  Page,
  Section,
  BlogPost,
  StoreSpec,
  CatalogProduct,
  LegalDoc,
  LocaleBundle,
} from './types';
import { buildDesignSystem } from './palette';
import { buildPageSeo, buildArticleSeo, slugify, baseUrl } from './seo';

/**
 * The deterministic provider authors a complete, coherent site from a brief
 * using template-driven natural-language composition. It is fully offline,
 * idempotent, and serves as the engine's reference implementation and as the
 * fallback whenever a live model is unavailable.
 */
export class DeterministicProvider implements GenerationProvider {
  readonly name = 'deterministic';

  async analyze(brief: Brief): Promise<MarketAnalysis> {
    const ind = brief.industry.trim();
    const product = noun(brief);
    return {
      industrySummary: `The ${ind} sector rewards companies that combine a trustworthy brand with a frictionless digital experience. ${brief.companyName} can win by pairing clear positioning with fast, conversion-focused pages and measurable follow-up.`,
      targetAudience: [
        {
          segment: `Decision-makers seeking ${product}`,
          needs: ['A credible, professional first impression', 'Clear pricing and outcomes', 'Fast answers to common questions'],
          objections: ['Uncertain about quality or reliability', 'Worried about cost vs. value', 'No time to evaluate options'],
        },
        {
          segment: `Returning and referred customers`,
          needs: ['Easy re-engagement', 'Self-service information', 'Confidence the company is established'],
          objections: ['Inertia with a current provider', 'Need a reason to act now'],
        },
      ],
      competitors: [
        {
          name: `Established ${ind} incumbents`,
          positioning: 'Broad, generic, slow to respond',
          weaknessToExploit: 'Impersonal experience and dated websites',
        },
        {
          name: `Low-cost ${ind} alternatives`,
          positioning: 'Cheapest option, thin on trust',
          weaknessToExploit: 'Lack of social proof and clear guarantees',
        },
      ],
      uniqueValueProposition: `${brief.companyName} delivers ${product} with the speed of a startup and the reliability customers expect — clearly explained, fairly priced, and easy to start.`,
      marketingStrategy: [
        { channel: 'SEO', tactic: `Rank for "${ind} ${product}" and long-tail buyer queries with the blog and structured data.` },
        { channel: 'Conversion', tactic: 'Single primary CTA above the fold, repeated after proof and FAQ.' },
        { channel: 'Email/CRM', tactic: 'Capture leads via the contact form and nurture toward a first purchase.' },
        { channel: 'Social proof', tactic: 'Lead with testimonials and outcome stats to reduce perceived risk.' },
      ],
      keywords: dedupe([
        ind.toLowerCase(),
        product,
        `${ind.toLowerCase()} ${product}`,
        `best ${ind.toLowerCase()}`,
        `${brief.companyName.toLowerCase()}`,
        `${ind.toLowerCase()} services`,
        `affordable ${ind.toLowerCase()}`,
        `${ind.toLowerCase()} near me`,
      ]),
    };
  }

  async design(brief: Brief, _analysis?: MarketAnalysis): Promise<DesignSystem> {
    return buildDesignSystem(brief);
  }

  async authorPages(brief: Brief, analysis: MarketAnalysis, _design?: DesignSystem): Promise<Page[]> {
    const product = noun(brief);
    const primaryCta = { label: brief.kind === 'STORE' ? 'Shop now' : 'Get started', href: brief.kind === 'STORE' ? '/shop' : '/contact' };

    const home: Page = {
      path: '/',
      title: 'Home',
      navLabel: 'Home',
      showInNav: true,
      sections: [
        {
          kind: 'hero',
          heading: analysis.uniqueValueProposition,
          subheading: `${capitalize(product)} for the ${brief.industry} sector — built around what your customers actually need.`,
          cta: primaryCta,
        },
        { kind: 'logoCloud', heading: 'Trusted by teams that value their time' },
        {
          kind: 'features',
          heading: `Why ${brief.companyName}`,
          subheading: analysis.industrySummary,
          items: analysis.marketingStrategy.slice(0, 3).map((s) => ({
            title: s.channel,
            body: s.tactic,
            icon: 'spark',
          })),
        },
        {
          kind: 'stats',
          items: [
            { title: '98%', body: 'customer satisfaction' },
            { title: '2x', body: 'faster onboarding' },
            { title: '24/7', body: 'support availability' },
          ],
        },
        {
          kind: 'testimonials',
          heading: 'What customers say',
          items: testimonialItems(brief),
        },
        {
          kind: 'cta',
          heading: `Ready to start with ${brief.companyName}?`,
          body: 'Tell us what you need and get a tailored answer in minutes.',
          cta: primaryCta,
        },
      ],
      seo: buildPageSeo(brief, '/', 'Home', truncate(analysis.uniqueValueProposition, 155), analysis.keywords),
    };

    const about: Page = {
      path: '/about',
      title: 'About',
      navLabel: 'About',
      showInNav: true,
      sections: [
        {
          kind: 'richText',
          heading: `About ${brief.companyName}`,
          body: `${brief.description}\n\n${analysis.industrySummary}\n\nOur mission is simple: ${analysis.uniqueValueProposition}`,
        },
        {
          kind: 'features',
          heading: 'What we value',
          items: [
            { title: 'Clarity', body: 'No jargon. You always know what you get and what it costs.' },
            { title: 'Speed', body: 'We respect your time with fast answers and quick delivery.' },
            { title: 'Trust', body: 'We do what we say, and we stand behind it.' },
          ],
        },
        { kind: 'cta', heading: 'Work with us', cta: primaryCta },
      ],
      seo: buildPageSeo(brief, '/about', `About ${brief.companyName}`, truncate(brief.description, 155), analysis.keywords),
    };

    const services: Page = {
      path: brief.kind === 'STORE' ? '/collections' : '/services',
      title: brief.kind === 'STORE' ? 'Collections' : 'Services',
      navLabel: brief.kind === 'STORE' ? 'Collections' : 'Services',
      showInNav: true,
      sections: [
        {
          kind: 'features',
          heading: brief.kind === 'STORE' ? 'Browse our collections' : 'How we help',
          subheading: `Tailored ${product} for every stage.`,
          items: analysis.targetAudience.flatMap((a) =>
            a.needs.slice(0, 2).map((need) => ({ title: a.segment, body: need })),
          ),
        },
        {
          kind: 'pricing',
          heading: 'Simple, transparent pricing',
          items: pricingTiers(brief),
        },
        {
          kind: 'faq',
          heading: 'Frequently asked questions',
          faqs: faqItems(brief, product),
        },
        { kind: 'cta', heading: 'Get a tailored quote', cta: primaryCta },
      ],
      seo: buildPageSeo(
        brief,
        brief.kind === 'STORE' ? '/collections' : '/services',
        brief.kind === 'STORE' ? 'Collections' : 'Services',
        `Explore ${product} from ${brief.companyName} — tailored to your goals, clearly priced, and easy to start today.`,
        analysis.keywords,
      ),
    };

    const contact: Page = {
      path: '/contact',
      title: 'Contact',
      navLabel: 'Contact',
      showInNav: true,
      sections: [
        {
          kind: 'contactForm',
          heading: `Talk to ${brief.companyName}`,
          subheading: 'We typically respond within one business day.',
          fields: [
            { name: 'name', label: 'Full name', type: 'text', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'company', label: 'Company', type: 'text', required: false },
            { name: 'message', label: 'How can we help?', type: 'textarea', required: true },
          ],
        },
        {
          kind: 'faq',
          heading: 'Before you reach out',
          faqs: faqItems(brief, product).slice(0, 3),
        },
      ],
      seo: buildPageSeo(
        brief,
        '/contact',
        'Contact',
        `Get in touch with ${brief.companyName} — we typically reply within one business day and are glad to help you start.`,
        analysis.keywords,
      ),
    };

    const pages = [home, about, services, contact];
    if (brief.kind === 'STORE') {
      pages.splice(3, 0, this.storefrontPage(brief, analysis));
    }
    return pages;
  }

  private storefrontPage(brief: Brief, analysis: MarketAnalysis): Page {
    return {
      path: '/shop',
      title: 'Shop',
      navLabel: 'Shop',
      showInNav: true,
      sections: [
        {
          kind: 'productGrid',
          heading: 'Featured products',
          subheading: 'Hand-picked items our customers love.',
        } satisfies Section,
        { kind: 'cta', heading: 'Free shipping over $50', cta: { label: 'Browse all', href: '/shop' } },
      ],
      seo: buildPageSeo(
        brief,
        '/shop',
        'Shop',
        `Shop ${noun(brief)} from ${brief.companyName} — hand-picked, fairly priced, and ready to ship to your door.`,
        analysis.keywords,
      ),
    };
  }

  async authorBlog(brief: Brief, analysis: MarketAnalysis): Promise<BlogPost[]> {
    const product = noun(brief);
    const topics = [
      `How to choose the right ${product} in ${brief.industry}`,
      `5 mistakes to avoid when buying ${product}`,
      `The ${brief.industry} buyer's checklist for 2026`,
    ];
    return topics.map((title) => {
      const slug = slugify(title);
      const excerpt = `A practical guide from ${brief.companyName} on getting the most from ${product}.`;
      const body = [
        `# ${title}`,
        ``,
        `${analysis.industrySummary}`,
        ``,
        `## What matters most`,
        analysis.targetAudience[0]!.needs.map((n) => `- ${n}`).join('\n'),
        ``,
        `## Common pitfalls`,
        analysis.targetAudience[0]!.objections.map((o) => `- ${o}`).join('\n'),
        ``,
        `## How ${brief.companyName} approaches it`,
        analysis.uniqueValueProposition,
      ].join('\n');
      const base: Omit<BlogPost, 'seo'> = { slug, title, excerpt, body, tags: analysis.keywords.slice(0, 4) };
      return { ...base, seo: buildArticleSeo(brief, base) };
    });
  }

  async buildStore(brief: Brief, analysis: MarketAnalysis): Promise<StoreSpec | undefined> {
    if (brief.kind !== 'STORE') return undefined;
    const categories = analysis.targetAudience.map((a) => shortLabel(a.segment));
    const products: CatalogProduct[] = [];
    const product = noun(brief);
    for (let i = 0; i < 8; i++) {
      const category = categories[i % categories.length] ?? 'General';
      const tier = ['Essential', 'Pro', 'Premium', 'Signature'][i % 4]!;
      products.push({
        sku: `SKU-${String(i + 1).padStart(3, '0')}`,
        name: `${tier} ${capitalize(product)} ${i + 1}`,
        description: `${tier}-grade ${product} from ${brief.companyName}, ideal for ${category.toLowerCase()}.`,
        priceCents: 1900 + i * 1500,
        currency: 'USD',
        category,
        imagePrompt: `studio product photo of ${tier.toLowerCase()} ${product} for ${brief.industry}, ${brief.style} style, soft lighting`,
      });
    }
    return {
      currency: 'USD',
      categories: dedupe(categories),
      products,
      checkoutSteps: ['Cart review', 'Shipping details', 'Payment', 'Confirmation'],
    };
  }

  async authorLegal(brief: Brief): Promise<LegalDoc[]> {
    const company = brief.companyName;
    const site = baseUrl();
    return [
      {
        kind: 'privacy',
        title: 'Privacy Policy',
        body: `${company} ("we") respects your privacy. This policy explains what data we collect through ${site}, why we collect it, and your rights.\n\n## Data we collect\nContact details you submit through forms, and anonymous analytics about how the site is used.\n\n## How we use it\nTo respond to enquiries, fulfil orders, and improve our services. We do not sell your data.\n\n## Your rights\nYou may request access, correction, or deletion of your data at any time by contacting us.\n\n## Retention\nWe retain personal data only as long as necessary for the purposes above.`,
      },
      {
        kind: 'terms',
        title: 'Terms of Service',
        body: `These terms govern your use of ${site}, operated by ${company}.\n\n## Use of the site\nYou agree to use the site lawfully and not to disrupt its operation.\n\n## Orders and payments\nAll prices are shown at checkout. Orders are subject to acceptance and availability.\n\n## Liability\nThe site is provided "as is". To the extent permitted by law, ${company} is not liable for indirect damages.\n\n## Changes\nWe may update these terms; continued use constitutes acceptance.`,
      },
      {
        kind: 'cookies',
        title: 'Cookie Policy',
        body: `${site} uses essential cookies to operate and optional analytics cookies to understand usage.\n\n## Managing cookies\nYou can control cookies through your browser settings. Disabling some cookies may affect functionality.`,
      },
    ];
  }

  async localize(brief: Brief, _pages: Page[]): Promise<LocaleBundle[]> {
    const year = new Date().getFullYear();
    const ctaKey = brief.kind === 'STORE' ? 'cta.shop' : 'cta.start';
    return brief.locales.map((locale) => {
      const dict = UI_DICTIONARIES[locale];
      const base = dict ?? UI_DICTIONARIES.en!;
      const strings: Record<string, string> = {
        'nav.home': base['nav.home']!,
        'nav.contact': base['nav.contact']!,
        'cta.primary': base[ctaKey]!,
        'form.submit': base['form.submit']!,
        'footer.rights': `© ${year} ${brief.companyName}. ${base['footer.rights']!}`,
      };
      // Locales without a shipped dictionary get tagged English strings so the
      // gap is visible and a live model can replace them later.
      if (!dict && locale !== 'en') {
        for (const k of Object.keys(strings)) strings[k] = `${strings[k]} [${locale}]`;
      }
      return { locale, strings };
    });
  }
}

/** Shipped UI translations. Keys absent here fall back to tagged English. */
const UI_DICTIONARIES: Record<string, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.contact': 'Contact',
    'cta.shop': 'Shop now',
    'cta.start': 'Get started',
    'form.submit': 'Send message',
    'footer.rights': 'All rights reserved.',
  },
  pl: {
    'nav.home': 'Strona główna',
    'nav.contact': 'Kontakt',
    'cta.shop': 'Kup teraz',
    'cta.start': 'Rozpocznij',
    'form.submit': 'Wyślij wiadomość',
    'footer.rights': 'Wszelkie prawa zastrzeżone.',
  },
  de: {
    'nav.home': 'Startseite',
    'nav.contact': 'Kontakt',
    'cta.shop': 'Jetzt einkaufen',
    'cta.start': 'Loslegen',
    'form.submit': 'Nachricht senden',
    'footer.rights': 'Alle Rechte vorbehalten.',
  },
  fr: {
    'nav.home': 'Accueil',
    'nav.contact': 'Contact',
    'cta.shop': 'Acheter',
    'cta.start': 'Commencer',
    'form.submit': 'Envoyer le message',
    'footer.rights': 'Tous droits réservés.',
  },
  es: {
    'nav.home': 'Inicio',
    'nav.contact': 'Contacto',
    'cta.shop': 'Comprar ahora',
    'cta.start': 'Empezar',
    'form.submit': 'Enviar mensaje',
    'footer.rights': 'Todos los derechos reservados.',
  },
};

/* ----------------------------- text helpers ------------------------------ */

function noun(brief: Brief): string {
  return brief.kind === 'STORE' ? 'products' : 'solutions';
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function shortLabel(s: string): string {
  return capitalize(s.split(/\s+/).slice(0, 3).join(' '));
}

function testimonialItems(brief: Brief): { title: string; body: string }[] {
  return [
    { title: 'Operations Lead', body: `${brief.companyName} made the whole process effortless. Exactly what we hoped for.` },
    { title: 'Founder', body: `Fast, clear, and reliable. We saw results in the first week.` },
    { title: 'Marketing Manager', body: `The best decision we made this quarter. Highly recommended.` },
  ];
}

function pricingTiers(brief: Brief): { title: string; body: string }[] {
  const unit = brief.kind === 'STORE' ? 'order' : 'month';
  return [
    { title: `Starter — $29/${unit}`, body: 'Everything you need to get going. Cancel anytime.' },
    { title: `Growth — $79/${unit}`, body: 'For teams ready to scale, with priority support.' },
    { title: `Enterprise — Custom`, body: 'Tailored to your requirements with a dedicated contact.' },
  ];
}

function faqItems(brief: Brief, product: string): { q: string; a: string }[] {
  return [
    { q: `How quickly can I get started with ${brief.companyName}?`, a: 'Most customers are up and running the same day. Reach out and we will guide you.' },
    { q: `What does ${product} cost?`, a: 'Pricing is transparent and shown on the pricing section. No hidden fees.' },
    { q: 'Do you offer support?', a: 'Yes — support is available and responsive. We are here when you need us.' },
    { q: 'Can I change or cancel later?', a: 'Absolutely. There are no long lock-ins; you stay in control.' },
  ];
}
