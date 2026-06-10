import { describe, it, expect } from 'vitest';
import { auditAndFix } from '@/lib/ai/quality';
import { generateSite } from '@/lib/ai/engine';
import type { Brief } from '@/lib/ai/types';

const brief: Brief = {
  companyName: 'Acme Co',
  industry: 'Logistics',
  description: 'Reliable same-day delivery for local businesses across the region.',
  style: 'corporate',
  locales: ['en'],
  kind: 'WEBSITE',
};

describe('auditAndFix quality gate', () => {
  it('passes a freshly generated, well-formed spec', async () => {
    const { spec } = await generateSite(brief, 'deterministic');
    const { report } = auditAndFix(spec);
    expect(report.seo).toBeGreaterThanOrEqual(80);
    expect(report.accessibility).toBeGreaterThanOrEqual(80);
    expect(report.security).toBeGreaterThanOrEqual(80);
    expect(report.passed).toBe(true);
  });

  it('flags and auto-fixes an over-long SEO title', async () => {
    const { spec } = await generateSite(brief, 'deterministic');
    spec.pages[0]!.seo.title = 'x'.repeat(120);
    const { spec: fixed, report } = auditAndFix(spec);
    expect(fixed.pages[0]!.seo.title.length).toBeLessThanOrEqual(60);
    expect(report.findings.some((f) => f.area === 'seo')).toBe(true);
  });

  it('detects a missing privacy policy as a security issue', async () => {
    const { spec } = await generateSite(brief, 'deterministic');
    spec.legal = spec.legal.filter((d) => d.kind !== 'privacy');
    const { report } = auditAndFix(spec);
    expect(report.security).toBeLessThan(100);
    expect(report.findings.some((f) => f.area === 'security')).toBe(true);
  });
});
