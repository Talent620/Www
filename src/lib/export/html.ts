import type { SiteSpec, Page, Section, SeoMeta, BlogPost, LegalDoc, CatalogProduct } from '../ai/types';
import { buildZip, type ZipEntry } from './zip';
import { sitemapXml } from '../ai/seo';
import { effectsCss, effectsJs, googleFontsHref } from './effects';

/**
 * Static HTML exporter.
 *
 * Renders a generated SiteSpec into a standalone, dependency-free static site:
 * semantic HTML, a single small stylesheet built from the spec's design tokens,
 * no JavaScript, full meta/Open Graph/JSON-LD on every page. The output can be
 * hosted on any static host — no platform lock-in.
 */

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Serialize JSON-LD safely for inline <script> — prevents </script> breakout. */
function jsonLdScript(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${json}</script>`;
}

function head(spec: SiteSpec, seo: SeoMeta): string {
  const jsonLd = seo.jsonLd.map(jsonLdScript).join('\n  ');
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(seo.title)}</title>
  <meta name="description" content="${esc(seo.description)}">
  <link rel="canonical" href="${esc(seo.canonical)}">
  <meta property="og:title" content="${esc(seo.openGraph.title)}">
  <meta property="og:description" content="${esc(seo.openGraph.description)}">
  <meta property="og:type" content="${esc(seo.openGraph.type)}">
  <meta name="twitter:card" content="${esc(seo.twitter.card)}">
  <meta name="twitter:title" content="${esc(seo.twitter.title)}">
  <meta name="twitter:description" content="${esc(seo.twitter.description)}">
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${esc(googleFontsHref(spec.design.typography.headingFont, spec.design.typography.bodyFont))}">
  <link rel="stylesheet" href="/styles.css">
  ${jsonLd}
  <script src="/app.js" defer></script>
</head>`;
}

/** Relative href for an internal path (export uses directory-style URLs). */
function href(path: string): string {
  return path === '/' ? '/' : `${path}/`;
}

function nav(spec: SiteSpec, activePath: string): string {
  const links = spec.pages
    .filter((p) => p.showInNav)
    .map(
      (p) =>
        `<a href="${href(p.path)}"${p.path === activePath ? ' aria-current="page"' : ''}>${esc(p.navLabel)}</a>`,
    );
  // Surface the blog in the main nav when it has published posts.
  if (spec.blog.some((post) => !post.draft)) {
    const active = activePath === '/blog' ? ' aria-current="page"' : '';
    links.push(`<a href="/blog/"${active}>Blog</a>`);
  }
  return `<header class="site-header">
  <a class="brand" href="/"><span class="brand-logo">${spec.design.logo.svg}</span>${esc(spec.brief.companyName)}</a>
  <nav aria-label="Main">${links.join('')}</nav>
</header>`;
}

function footer(spec: SiteSpec): string {
  const legalLinks = spec.legal
    .map((l) => `<a href="/legal/${l.kind}/">${esc(l.title)}</a>`)
    .join('');
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <p>© ${year} ${esc(spec.brief.companyName)}. All rights reserved.</p>
  <nav aria-label="Legal">${legalLinks}</nav>
</footer>`;
}

function sectionHtml(section: Section, spec: SiteSpec): string {
  switch (section.kind) {
    case 'hero':
      return `<section class="hero reveal">
  <canvas class="hero-canvas" aria-hidden="true"></canvas>
  <span class="eyebrow">${esc(spec.brief.industry)}</span>
  <h1>${esc(section.heading ?? '')}</h1>
  ${section.subheading ? `<p class="sub">${esc(section.subheading)}</p>` : ''}
  ${section.cta ? `<a class="btn" href="${href(section.cta.href)}">${esc(section.cta.label)}</a>` : ''}
</section>`;
    case 'features':
    case 'pricing':
      return `<section class="block reveal">
  ${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}
  ${section.subheading ? `<p class="sub">${esc(section.subheading)}</p>` : ''}
  <div class="grid">${(section.items ?? [])
    .map((i) => `<div class="card"><h3>${esc(i.title)}</h3><p>${esc(i.body)}</p></div>`)
    .join('')}</div>
</section>`;
    case 'stats':
      return `<section class="stats reveal">${(section.items ?? [])
        .map((i) => `<div><strong>${esc(i.title)}</strong><span>${esc(i.body)}</span></div>`)
        .join('')}</section>`;
    case 'testimonials':
      return `<section class="block reveal">
  ${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}
  <div class="grid">${(section.items ?? [])
    .map((i) => `<figure class="card"><blockquote>“${esc(i.body)}”</blockquote><figcaption>— ${esc(i.title)}</figcaption></figure>`)
    .join('')}</div>
</section>`;
    case 'faq':
      return `<section class="block reveal">
  ${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}
  <div class="faq">${(section.faqs ?? [])
    .map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
    .join('')}</div>
</section>`;
    case 'contactForm':
      return `<section class="block reveal">
  ${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}
  ${section.subheading ? `<p class="sub">${esc(section.subheading)}</p>` : ''}
  <form class="contact" method="post" action="#contact">
    ${(section.fields ?? [])
      .map((f) => {
        const required = f.required ? ' required' : '';
        const control =
          f.type === 'textarea'
            ? `<textarea id="${esc(f.name)}" name="${esc(f.name)}" rows="4"${required}></textarea>`
            : `<input id="${esc(f.name)}" name="${esc(f.name)}" type="${esc(f.type)}"${required}>`;
        return `<p><label for="${esc(f.name)}">${esc(f.label)}${f.required ? ' *' : ''}</label>${control}</p>`;
      })
      .join('')}
    <button class="btn" type="submit">Send message</button>
  </form>
</section>`;
    case 'productGrid':
      return `<section class="block reveal">
  ${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}
  ${section.subheading ? `<p class="sub">${esc(section.subheading)}</p>` : ''}
  <div class="grid products">${(spec.store?.products ?? [])
    .map(
      (p) => `<a class="card product" href="/shop/${p.sku.toLowerCase()}/">
      <span class="thumb" aria-hidden="true"></span>
      <h3>${esc(p.name)}</h3><p class="cat">${esc(p.category)}</p>
      <p class="price">$${(p.priceCents / 100).toFixed(2)}</p></a>`,
    )
    .join('')}</div>
</section>`;
    case 'cta':
      return `<section class="cta-band reveal">
  <h2>${esc(section.heading ?? '')}</h2>
  ${section.body ? `<p>${esc(section.body)}</p>` : ''}
  ${section.cta ? `<a class="btn invert" href="${href(section.cta.href)}">${esc(section.cta.label)}</a>` : ''}
</section>`;
    case 'logoCloud':
      return `<section class="logocloud"><p>${esc(section.heading ?? '')}</p></section>`;
    case 'richText':
      return `<section class="block prose reveal">
  ${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}
  ${(section.body ?? '')
    .split('\n\n')
    .map((p) => `<p>${esc(p)}</p>`)
    .join('')}
</section>`;
    default:
      return '';
  }
}

function document(spec: SiteSpec, seo: SeoMeta, activePath: string, main: string): string {
  return `<!DOCTYPE html>
<html lang="${esc(spec.brief.locales[0] ?? 'en')}">
${head(spec, seo)}
<body>
${nav(spec, activePath)}
<main>
${main}
</main>
${footer(spec)}
</body>
</html>`;
}

export function renderPageHtml(spec: SiteSpec, page: Page): string {
  const main = page.sections.map((s) => sectionHtml(s, spec)).join('\n');
  return document(spec, page.seo, page.path, main);
}

/** Blog index: a listing of all published posts. */
export function renderBlogIndexHtml(spec: SiteSpec): string {
  const posts = spec.blog.filter((p) => !p.draft);
  const cards = posts
    .map(
      (p) => `<a class="card" href="/blog/${p.slug}/">
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.excerpt)}</p>
      ${p.tags.length ? `<p class="cat">${p.tags.map(esc).join(' · ')}</p>` : ''}</a>`,
    )
    .join('');
  const main = `<section class="block reveal">
  <h2>Blog</h2>
  <p class="sub">Insights and guides from ${esc(spec.brief.companyName)}.</p>
  <div class="grid">${cards}</div>
</section>`;
  const base = spec.pages[0]!.seo;
  const seo: SeoMeta = {
    ...base,
    title: `Blog | ${spec.brief.companyName}`.slice(0, 60),
    description: `Articles and guides from ${spec.brief.companyName}.`,
    canonical: `${base.canonical.replace(/\/$/, '')}/blog`,
  };
  return document(spec, seo, '/blog', main);
}

export function renderBlogPostHtml(spec: SiteSpec, post: BlogPost): string {
  const paragraphs = post.body
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${esc(line.slice(2))}</h1>`;
      if (line.startsWith('## ')) return `<h2>${esc(line.slice(3))}</h2>`;
      if (line.startsWith('- ')) return `<li>${esc(line.slice(2))}</li>`;
      return `<p>${esc(line)}</p>`;
    })
    .join('\n');
  const main = `<article class="block prose">\n${paragraphs}\n</article>`;
  return document(spec, post.seo, `/blog/${post.slug}`, main);
}

export function renderLegalHtml(spec: SiteSpec, doc: LegalDoc): string {
  const body = doc.body
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.startsWith('## ') ? `<h2>${esc(line.slice(3))}</h2>` : `<p>${esc(line)}</p>`))
    .join('\n');
  const seo: SeoMeta = {
    ...spec.pages[0]!.seo,
    title: `${doc.title} | ${spec.brief.companyName}`,
    description: `${doc.title} for ${spec.brief.companyName}.`,
    canonical: `${spec.pages[0]!.seo.canonical.replace(/\/$/, '')}/legal/${doc.kind}`,
  };
  const main = `<article class="block prose"><h1>${esc(doc.title)}</h1>\n${body}\n</article>`;
  return document(spec, seo, `/legal/${doc.kind}`, main);
}

export function renderProductHtml(spec: SiteSpec, product: CatalogProduct): string {
  const seo: SeoMeta = {
    title: `${product.name} | ${spec.brief.companyName}`,
    description: product.description.slice(0, 160),
    canonical: `${spec.pages[0]!.seo.canonical.replace(/\/$/, '')}/shop/${product.sku.toLowerCase()}`,
    openGraph: { title: product.name, description: product.description.slice(0, 160), type: 'product' },
    twitter: { card: 'summary_large_image', title: product.name, description: product.description.slice(0, 160) },
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        sku: product.sku,
        offers: {
          '@type': 'Offer',
          price: (product.priceCents / 100).toFixed(2),
          priceCurrency: product.currency,
          availability: 'https://schema.org/InStock',
        },
      },
    ],
  };
  const main = `<article class="block product-detail">
  <span class="thumb large" aria-hidden="true"></span>
  <h1>${esc(product.name)}</h1>
  <p class="cat">${esc(product.category)}</p>
  <p class="price">$${(product.priceCents / 100).toFixed(2)} ${esc(product.currency)}</p>
  <p>${esc(product.description)}</p>
  <a class="btn" href="/shop/">← Back to shop</a>
</article>`;
  return document(spec, seo, '/shop', main);
}

export function renderStylesheet(spec: SiteSpec): string {
  const c = spec.design.colors;
  const t = spec.design.typography;
  return `:root{--bg:${c.background};--surface:${c.surface};--text:${c.text};--muted:${c.muted};--primary:${c.primary};--accent:${c.accent};--radius:${spec.design.radiusRem}rem}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--text);font-family:'${t.bodyFont}',system-ui,sans-serif;line-height:1.6}
h1,h2,h3{font-family:'${t.headingFont}',system-ui,sans-serif;line-height:1.15}
a{color:inherit;text-decoration:none}
.site-header{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:1rem 1.5rem;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--surface)}
.brand{display:flex;align-items:center;gap:.55rem;font-weight:700}
.brand-logo svg{width:2rem;height:2rem;display:block;border-radius:calc(var(--radius)*.6)}
.site-header nav{display:flex;gap:1.1rem;font-size:.92rem;color:var(--muted)}
.site-header nav a[aria-current]{color:var(--primary);font-weight:600}
main{display:block}
.hero{padding:6rem 1.5rem;text-align:center}
.hero h1{max-width:46rem;margin:0 auto;font-size:clamp(2rem,5vw,3.4rem);font-weight:800}
.hero .sub{max-width:38rem;margin:1.2rem auto 0;color:var(--muted);font-size:1.12rem}
.btn{display:inline-block;margin-top:1.8rem;padding:.85rem 1.8rem;background:var(--primary);color:var(--bg);font-weight:600;border:0;border-radius:var(--radius);cursor:pointer}
.btn.invert{background:var(--bg);color:var(--primary)}
.block{padding:4rem 1.5rem;max-width:64rem;margin:0 auto}
.block h2{text-align:center;font-size:1.9rem;margin-bottom:.6rem}
.block .sub{text-align:center;color:var(--muted);max-width:38rem;margin:0 auto 2rem}
.grid{display:grid;gap:1.2rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));margin-top:2rem}
.card{background:var(--surface);padding:1.4rem;border-radius:var(--radius)}
.card h3{margin-bottom:.4rem}
.card p,.card blockquote{color:var(--muted);font-size:.95rem}
.card figcaption{margin-top:.7rem;font-size:.82rem;font-weight:600;color:var(--muted)}
.stats{display:flex;justify-content:center;gap:3.5rem;padding:3.2rem 1.5rem;background:var(--surface);text-align:center}
.stats strong{display:block;font-size:2rem;color:var(--primary)}
.stats span{color:var(--muted);font-size:.9rem}
.faq{max-width:42rem;margin:1.5rem auto 0}
.faq details{background:var(--surface);border-radius:calc(var(--radius)*.7);padding:1rem 1.2rem;margin-bottom:.7rem}
.faq summary{cursor:pointer;font-weight:600}
.faq p{margin-top:.6rem;color:var(--muted);font-size:.95rem}
.contact{max-width:30rem;margin:1.5rem auto 0}
.contact label{display:block;font-weight:600;font-size:.9rem;margin-bottom:.3rem}
.contact input,.contact textarea{width:100%;padding:.65rem .8rem;border:1px solid var(--surface);border-radius:calc(var(--radius)*.6);background:var(--bg);color:var(--text);font:inherit}
.contact p{margin-bottom:1rem}
.products .thumb{display:block;aspect-ratio:1;background:var(--bg);border-radius:calc(var(--radius)*.7);margin-bottom:.9rem}
.product .price{color:var(--primary);font-weight:700;margin-top:.3rem}
.product .cat,.product-detail .cat{color:var(--muted);font-size:.85rem}
.product-detail{text-align:center}
.product-detail .thumb.large{display:block;max-width:20rem;aspect-ratio:1;margin:0 auto 1.6rem;background:var(--surface);border-radius:var(--radius)}
.product-detail .price{font-size:1.4rem;color:var(--primary);font-weight:700;margin:.6rem 0 1rem}
.cta-band{padding:4.5rem 1.5rem;text-align:center;background:var(--primary);color:var(--bg)}
.cta-band h2{font-size:2rem}
.cta-band p{opacity:.85;margin-top:.7rem}
.logocloud{padding:2.5rem 1.5rem;text-align:center;color:var(--muted);font-size:.9rem}
.prose{max-width:42rem}
.prose h1{font-size:2.1rem;margin-bottom:1.2rem}
.prose h2{text-align:left;font-size:1.4rem;margin:1.6rem 0 .5rem}
.prose p{margin-bottom:.9rem}
.prose li{margin-left:1.2rem;color:var(--muted)}
.site-footer{padding:2.5rem 1.5rem;text-align:center;background:var(--surface);color:var(--muted);font-size:.88rem}
.site-footer nav{display:flex;justify-content:center;gap:1.2rem;margin-top:.7rem}
@media(max-width:640px){.site-header nav{display:none}.stats{flex-direction:column;gap:1.5rem}}
${effectsCss()}`;
}

/** File path inside the archive for an internal route. */
function fileFor(path: string): string {
  return path === '/' ? 'index.html' : `${path.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
}

/** Render the complete static site as named files. */
export function exportSiteFiles(spec: SiteSpec): ZipEntry[] {
  const entries: ZipEntry[] = [];

  for (const page of spec.pages) {
    entries.push({ name: fileFor(page.path), data: renderPageHtml(spec, page) });
  }
  const publishedPosts = spec.blog.filter((post) => !post.draft);
  if (publishedPosts.length > 0) {
    entries.push({ name: 'blog/index.html', data: renderBlogIndexHtml(spec) });
  }
  for (const post of publishedPosts) {
    entries.push({ name: `blog/${post.slug}/index.html`, data: renderBlogPostHtml(spec, post) });
  }
  for (const doc of spec.legal) {
    entries.push({ name: `legal/${doc.kind}/index.html`, data: renderLegalHtml(spec, doc) });
  }
  if (spec.store) {
    for (const product of spec.store.products) {
      entries.push({
        name: `shop/${product.sku.toLowerCase()}/index.html`,
        data: renderProductHtml(spec, product),
      });
    }
  }
  entries.push({ name: 'styles.css', data: renderStylesheet(spec) });
  entries.push({ name: 'app.js', data: effectsJs() });
  entries.push({ name: 'logo.svg', data: spec.design.logo.svg });
  entries.push({ name: 'sitemap.xml', data: sitemapXml(spec.sitemap) });
  entries.push({ name: 'robots.txt', data: 'User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml\n' });
  return entries;
}

/** Render and package the complete static site as a ZIP archive. */
export function exportSiteZip(spec: SiteSpec): Buffer {
  return buildZip(exportSiteFiles(spec));
}
