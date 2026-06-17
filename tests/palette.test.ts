import { describe, it, expect } from 'vitest';
import { buildColorSystem, buildDesignSystem, buildTypography } from '@/lib/ai/palette';
import type { Brief } from '@/lib/ai/types';

const brief = (style: string): Brief => ({
  companyName: 'Nova Studio',
  industry: '3D visualization',
  description: 'Realistic, modern 3D visualizations for premium interiors.',
  style,
  locales: ['en'],
  kind: 'WEBSITE',
});

const HEX = /^#[0-9a-f]{6}$/;
const STYLES = ['modern', 'minimal', 'bold', 'elegant', 'playful', 'corporate', 'natural', 'luxury', 'free-text style'];

describe('buildColorSystem', () => {
  it.each(STYLES)('produces valid 6-digit hex colors for every token (%s)', (style) => {
    const colors = buildColorSystem(brief(style));
    for (const value of Object.values(colors)) {
      expect(value, `${style}: ${value}`).toMatch(HEX);
    }
  });

  it('yields distinct palettes for distinct named styles', () => {
    const modern = buildColorSystem(brief('modern'));
    const bold = buildColorSystem(brief('bold'));
    expect(modern.primary).not.toBe(bold.primary);
  });
});

describe('buildTypography', () => {
  // Hash seeds with bit 31 set previously produced a negative font index
  // (signed >>) and an undefined font. Sweep many names to guard against it.
  const names = [
    'Aurelia Atelier', 'Nova Studio', 'Bean & Bloom', 'Northwind', 'Zephyr Labs',
    'Quanta', 'Vireo', 'Orbit', 'Lumen & Co', 'Helios', 'Atlas Works', 'Nimbus',
  ];
  it.each(names)('always resolves defined heading + body fonts (%s)', (name) => {
    for (const style of STYLES) {
      const t = buildTypography({ ...brief(style), companyName: name });
      expect(typeof t.headingFont, `${name}/${style} heading`).toBe('string');
      expect(typeof t.bodyFont, `${name}/${style} body`).toBe('string');
      expect(t.headingFont.length).toBeGreaterThan(0);
      expect(t.bodyFont.length).toBeGreaterThan(0);
    }
  });
});

describe('buildDesignSystem', () => {
  it('emits valid hex throughout the design system', () => {
    const d = buildDesignSystem(brief('elegant'));
    for (const value of Object.values(d.colors)) expect(value).toMatch(HEX);
    expect(d.radiusRem).toBeGreaterThan(0);
    expect(d.logo.svg).toContain('<svg');
  });
});
