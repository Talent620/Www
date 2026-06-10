import type { SiteSpec, QualityReport } from './types';

/**
 * Automated quality gate. Audits a generated SiteSpec across SEO, accessibility,
 * performance, and security, applies safe auto-fixes in place, and returns a
 * scored report. This is the "analyse → detect → fix → re-check" loop the
 * engine runs after authoring.
 */
export function auditAndFix(spec: SiteSpec): { spec: SiteSpec; report: QualityReport } {
  const findings: QualityReport['findings'] = [];
  // Severity-weighted penalties: a hard error costs the full weight, an
  // auto-fixed warning costs half (the spec is corrected in place), and info
  // is advisory only. This keeps the score honest after the fix loop runs.
  const WEIGHT = { error: 1, warn: 0.5, info: 0 } as const;

  // --- SEO -----------------------------------------------------------------
  let seoPenalty = 0;
  for (const page of spec.pages) {
    if (page.seo.title.length > 60) {
      page.seo.title = `${page.seo.title.slice(0, 57).trimEnd()}…`;
      findings.push({ area: 'seo', severity: 'warn', message: `Trimmed long title on ${page.path}` });
      seoPenalty += WEIGHT.warn;
    }
    if (page.seo.description.length < 50) {
      page.seo.description = `${page.seo.description} Learn more about ${spec.brief.companyName}.`.slice(0, 160);
      findings.push({ area: 'seo', severity: 'warn', message: `Padded thin meta description on ${page.path}` });
      seoPenalty += WEIGHT.warn;
    }
    if (page.seo.jsonLd.length === 0) {
      findings.push({ area: 'seo', severity: 'error', message: `Missing structured data on ${page.path}` });
      seoPenalty += WEIGHT.error;
    }
  }
  const seo = score(spec.pages.length * 2, seoPenalty);

  // --- Accessibility -------------------------------------------------------
  let a11yPenalty = 0;
  for (const page of spec.pages) {
    const hasHeading = page.sections.some((s) => s.heading);
    if (!hasHeading) {
      a11yPenalty += WEIGHT.error;
      findings.push({ area: 'accessibility', severity: 'error', message: `No heading landmark on ${page.path}` });
    }
    for (const section of page.sections) {
      if (section.kind === 'contactForm' && section.fields) {
        for (const f of section.fields) {
          if (!f.label) {
            a11yPenalty += WEIGHT.error;
            findings.push({ area: 'accessibility', severity: 'error', message: `Form field "${f.name}" missing label` });
          }
        }
      }
    }
  }
  const accessibility = score(spec.pages.length + 2, a11yPenalty);

  // --- Performance (heuristic) --------------------------------------------
  const heavyPages = spec.pages.filter((p) => p.sections.length > 9);
  for (const p of heavyPages) {
    findings.push({ area: 'performance', severity: 'info', message: `Page ${p.path} has many sections; consider lazy-loading` });
  }
  const performance = score(spec.pages.length + 3, heavyPages.length * WEIGHT.info);

  // --- Security ------------------------------------------------------------
  let secPenalty = 0;
  const hasPrivacy = spec.legal.some((d) => d.kind === 'privacy');
  const hasTerms = spec.legal.some((d) => d.kind === 'terms');
  if (!hasPrivacy) {
    secPenalty += WEIGHT.error;
    findings.push({ area: 'security', severity: 'error', message: 'Missing privacy policy' });
  }
  if (!hasTerms) {
    secPenalty += WEIGHT.warn;
    findings.push({ area: 'security', severity: 'warn', message: 'Missing terms of service' });
  }
  const security = score(4, secPenalty);

  const passed = [seo, accessibility, performance, security].every((s) => s >= 80);
  return {
    spec,
    report: { seo, accessibility, performance, security, findings, passed },
  };
}

/** Convert a weighted penalty over a denominator into a 0–100 score. */
function score(denominator: number, penalty: number): number {
  if (denominator <= 0) return 100;
  const value = Math.max(0, 1 - penalty / denominator);
  return Math.round(value * 100);
}
