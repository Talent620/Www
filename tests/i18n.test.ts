import { describe, it, expect } from 'vitest';
import { DeterministicProvider } from '@/lib/ai/deterministic';
import type { Brief } from '@/lib/ai/types';

const provider = new DeterministicProvider();

function brief(locales: string[], kind: Brief['kind'] = 'WEBSITE'): Brief {
  return {
    companyName: 'Acme',
    industry: 'SaaS',
    description: 'We build developer tools for teams everywhere.',
    style: 'modern',
    locales,
    kind,
  };
}

describe('localize', () => {
  it('returns real translations for shipped locales', async () => {
    const bundles = await provider.localize(brief(['en', 'pl', 'de']), []);
    const pl = bundles.find((b) => b.locale === 'pl')!;
    const de = bundles.find((b) => b.locale === 'de')!;
    expect(pl.strings['nav.home']).toBe('Strona główna');
    expect(pl.strings['form.submit']).toBe('Wyślij wiadomość');
    expect(de.strings['nav.contact']).toBe('Kontakt');
  });

  it('uses the store CTA for store briefs', async () => {
    const bundles = await provider.localize(brief(['pl'], 'STORE'), []);
    expect(bundles[0]!.strings['cta.primary']).toBe('Kup teraz');
  });

  it('uses the website CTA for website briefs', async () => {
    const bundles = await provider.localize(brief(['fr'], 'WEBSITE'), []);
    expect(bundles[0]!.strings['cta.primary']).toBe('Commencer');
  });

  it('tags untranslated locales instead of silently shipping English', async () => {
    const bundles = await provider.localize(brief(['en', 'it']), []);
    const it = bundles.find((b) => b.locale === 'it')!;
    expect(it.strings['nav.home']).toContain('[it]');
  });

  it('embeds the company name in the footer notice', async () => {
    const bundles = await provider.localize(brief(['en']), []);
    expect(bundles[0]!.strings['footer.rights']).toContain('Acme');
  });
});
