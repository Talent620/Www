import { describe, it, expect } from 'vitest';
import { buildZip, crc32, readZipEntryCount } from '@/lib/export/zip';
import {
  exportSiteFiles,
  exportSiteZip,
  renderPageHtml,
  renderProductHtml,
  esc,
} from '@/lib/export/html';
import { generateSite } from '@/lib/ai/engine';
import type { Brief } from '@/lib/ai/types';

const websiteBrief: Brief = {
  companyName: 'Northwind <Studio> & Co',
  industry: 'Interior design',
  description: 'We design calm, functional living spaces for busy families.',
  style: 'elegant',
  locales: ['en'],
  kind: 'WEBSITE',
};

const storeBrief: Brief = {
  companyName: 'Bean & Bloom',
  industry: 'Specialty coffee',
  description: 'Single-origin coffee roasted weekly and shipped to your door.',
  style: 'natural',
  locales: ['en'],
  kind: 'STORE',
};

describe('zip writer', () => {
  it('computes a known CRC-32', () => {
    // CRC-32 of the ASCII bytes "123456789" is the standard check value.
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('builds a parseable archive with the right entry count', () => {
    const zip = buildZip([
      { name: 'a.txt', data: 'hello' },
      { name: 'dir/b.txt', data: 'world' },
    ]);
    // Local file header + EOCD signatures present.
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(readZipEntryCount(zip)).toBe(2);
  });
});

describe('static HTML export', () => {
  it('escapes HTML-significant characters', () => {
    expect(esc('<b>"x" & y</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
  });

  it('exports an index.html plus every page, blog, and legal doc', async () => {
    const { spec } = await generateSite(websiteBrief, 'deterministic');
    const files = exportSiteFiles(spec);
    const names = files.map((f) => f.name);

    expect(names).toContain('index.html');
    expect(names).toContain('styles.css');
    expect(names).toContain('sitemap.xml');
    expect(names).toContain('robots.txt');
    expect(names).toContain('logo.svg');
    for (const post of spec.blog) expect(names).toContain(`blog/${post.slug}/index.html`);
    for (const doc of spec.legal) expect(names).toContain(`legal/${doc.kind}/index.html`);
  });

  it('produces valid, escaped, SEO-complete page HTML', async () => {
    const { spec } = await generateSite(websiteBrief, 'deterministic');
    const html = renderPageHtml(spec, spec.pages[0]!);

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('<link rel="canonical"');
    // The unsafe company name must never appear unescaped.
    expect(html).not.toContain('Northwind <Studio>');
    expect(html).toContain('Northwind &lt;Studio&gt;');
  });

  it('emits product pages with Product JSON-LD for stores', async () => {
    const { spec } = await generateSite(storeBrief, 'deterministic');
    const files = exportSiteFiles(spec);
    const productFiles = files.filter((f) => f.name.startsWith('shop/sku-'));
    expect(productFiles.length).toBe(spec.store!.products.length);

    const html = renderProductHtml(spec, spec.store!.products[0]!);
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"availability":"https://schema.org/InStock"');
  });

  it('packages the whole site into a downloadable zip', async () => {
    const { spec } = await generateSite(storeBrief, 'deterministic');
    const zip = exportSiteZip(spec);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(readZipEntryCount(zip)).toBe(exportSiteFiles(spec).length);
    expect(zip.length).toBeGreaterThan(1000);
  });
});
