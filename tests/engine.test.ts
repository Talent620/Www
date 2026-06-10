import { describe, it, expect } from 'vitest';
import { generateSite } from '@/lib/ai/engine';
import { DeterministicProvider } from '@/lib/ai/deterministic';
import type { Brief } from '@/lib/ai/types';

const websiteBrief: Brief = {
  companyName: 'Northwind Studio',
  industry: 'Interior design',
  description: 'We design calm, functional living spaces for busy families.',
  style: 'elegant',
  locales: ['en', 'pl'],
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

describe('generateSite (deterministic)', () => {
  it('produces a complete website spec', async () => {
    const { spec, engine, report } = await generateSite(websiteBrief, 'deterministic');
    expect(engine).toBe('deterministic');
    expect(spec.pages.length).toBeGreaterThanOrEqual(4);
    expect(spec.pages.some((p) => p.path === '/')).toBe(true);
    expect(spec.pages.some((p) => p.path === '/contact')).toBe(true);
    expect(spec.blog.length).toBeGreaterThan(0);
    expect(spec.legal.some((l) => l.kind === 'privacy')).toBe(true);
    expect(spec.legal.some((l) => l.kind === 'terms')).toBe(true);
    expect(spec.store).toBeUndefined();
    expect(report.passed).toBe(true);
  });

  it('generates a store catalog for STORE briefs', async () => {
    const { spec } = await generateSite(storeBrief, 'deterministic');
    expect(spec.store).toBeDefined();
    expect(spec.store!.products.length).toBeGreaterThanOrEqual(4);
    expect(spec.pages.some((p) => p.path === '/shop')).toBe(true);
    expect(spec.sitemap.some((u) => u.startsWith('/shop/'))).toBe(true);
  });

  it('is deterministic — identical briefs yield identical designs', async () => {
    const a = await generateSite(websiteBrief, 'deterministic');
    const b = await generateSite(websiteBrief, 'deterministic');
    expect(a.spec.design.colors).toEqual(b.spec.design.colors);
    expect(a.spec.design.typography).toEqual(b.spec.design.typography);
  });

  it('produces one locale bundle per requested locale', async () => {
    const { spec } = await generateSite(websiteBrief, 'deterministic');
    expect(spec.locales.map((l) => l.locale).sort()).toEqual(['en', 'pl']);
  });

  it('emits SEO metadata and structured data for every page', async () => {
    const { spec } = await generateSite(websiteBrief, 'deterministic');
    for (const page of spec.pages) {
      expect(page.seo.title.length).toBeGreaterThan(0);
      expect(page.seo.title.length).toBeLessThanOrEqual(60);
      expect(page.seo.description.length).toBeGreaterThanOrEqual(50);
      expect(page.seo.jsonLd.length).toBeGreaterThan(0);
    }
  });
});

describe('DeterministicProvider analysis', () => {
  it('returns audience, competitors, strategy, and keywords', async () => {
    const provider = new DeterministicProvider();
    const analysis = await provider.analyze(websiteBrief);
    expect(analysis.targetAudience.length).toBeGreaterThan(0);
    expect(analysis.competitors.length).toBeGreaterThan(0);
    expect(analysis.marketingStrategy.length).toBeGreaterThan(0);
    expect(analysis.keywords.length).toBeGreaterThan(3);
    expect(new Set(analysis.keywords).size).toBe(analysis.keywords.length);
  });
});
