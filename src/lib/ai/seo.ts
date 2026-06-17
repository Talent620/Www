import type { Brief, Page, BlogPost, SeoMeta, SiteSpec } from './types';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'item';
}

export function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}

/** Build SEO metadata + Open Graph + Twitter + JSON-LD for a page. */
export function buildPageSeo(
  brief: Brief,
  path: string,
  title: string,
  description: string,
  keywords: string[],
): SeoMeta {
  const canonical = `${baseUrl()}${path === '/' ? '' : path}`;
  const fullTitle = path === '/' ? `${brief.companyName} — ${title}` : `${title} | ${brief.companyName}`;
  const jsonLd: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': brief.kind === 'STORE' ? 'Store' : 'Organization',
      name: brief.companyName,
      description,
      url: baseUrl(),
      knowsAbout: keywords.slice(0, 8),
    },
  ];
  if (path === '/') {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: brief.companyName,
      url: baseUrl(),
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl()}/search?q={query}`,
        'query-input': 'required name=query',
      },
    });
  }
  return {
    title: fullTitle,
    description,
    canonical,
    openGraph: { title: fullTitle, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: fullTitle, description },
    jsonLd,
  };
}

export function buildArticleSeo(brief: Brief, post: Omit<BlogPost, 'seo'>): SeoMeta {
  const canonical = `${baseUrl()}/blog/${post.slug}`;
  return {
    title: `${post.title} | ${brief.companyName}`,
    description: post.excerpt,
    canonical,
    openGraph: { title: post.title, description: post.excerpt, type: 'article' },
    twitter: { card: 'summary_large_image', title: post.title, description: post.excerpt },
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt,
        keywords: post.tags.join(', '),
        author: { '@type': 'Organization', name: brief.companyName },
      },
    ],
  };
}

/** Derive the sitemap from every renderable resource in the spec. */
export function buildSitemap(spec: Omit<SiteSpec, 'sitemap'>): string[] {
  const paths = new Set<string>();
  for (const page of spec.pages) paths.add(page.path);
  const publishedPosts = spec.blog.filter((post) => !post.draft);
  if (publishedPosts.length > 0) paths.add('/blog');
  for (const post of publishedPosts) paths.add(`/blog/${post.slug}`);
  if (spec.store) {
    paths.add('/shop');
    for (const product of spec.store.products) paths.add(`/shop/${product.sku.toLowerCase()}`);
  }
  for (const doc of spec.legal) paths.add(`/legal/${doc.kind}`);
  return [...paths].sort();
}

/** Render a robots.txt + sitemap.xml-ready URL list. */
export function sitemapXml(paths: string[]): string {
  const urls = paths
    .map((p) => `  <url><loc>${baseUrl()}${p === '/' ? '' : p}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}
