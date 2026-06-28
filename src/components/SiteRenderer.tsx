import type { SiteSpec, Page, Section } from '@/lib/ai/types';
import { ContactForm } from './ContactForm';
import { BuyButton } from './BuyButton';

/**
 * Renders a generated SiteSpec into a live page using the spec's own design
 * tokens (color, typography, radius) injected as CSS variables. This is the
 * preview surface; the same data drives an eventual static export.
 *
 * When `slug` is supplied (live preview) the contact form posts to the project's
 * leads API; without it the form renders inert (static export).
 */
export function SiteRenderer({ spec, page, slug }: { spec: SiteSpec; page: Page; slug?: string }) {
  const d = spec.design;
  const styleVars = {
    '--bg': d.colors.background,
    '--surface': d.colors.surface,
    '--text': d.colors.text,
    '--muted': d.colors.muted,
    '--primary': d.colors.primary,
    '--accent': d.colors.accent,
    '--radius': `${d.radiusRem}rem`,
    '--heading-font': d.typography.headingFont,
    '--body-font': d.typography.bodyFont,
  } as React.CSSProperties;

  const navPages = spec.pages.filter((p) => p.showInNav);

  return (
    <div className="aurea-preview min-h-screen" style={styleVars}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--bg) 85%, transparent)', borderBottom: '1px solid var(--surface)' }}
      >
        <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--text)' }}>
          <span
            className="grid h-8 w-8 place-items-center text-sm font-bold"
            style={{ background: 'var(--primary)', color: 'var(--bg)', borderRadius: 'calc(var(--radius) * .7)' }}
            dangerouslySetInnerHTML={{ __html: d.logo.svg }}
          />
          {spec.brief.companyName}
        </div>
        <nav className="hidden gap-5 text-sm sm:flex" style={{ color: 'var(--muted)' }}>
          {navPages.map((p) => (
            <span key={p.path}>{p.navLabel}</span>
          ))}
        </nav>
      </header>

      <main>
        {page.sections.map((section, i) => (
          <SectionView key={i} section={section} spec={spec} slug={slug} />
        ))}
      </main>

      <footer className="px-6 py-10 text-center text-sm" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>
        © {new Date().getFullYear()} {spec.brief.companyName}. All rights reserved.
        <div className="mt-2 flex justify-center gap-4">
          {spec.legal.map((l) => (
            <span key={l.kind}>{l.title}</span>
          ))}
        </div>
      </footer>
    </div>
  );
}

function SectionView({ section, spec, slug }: { section: Section; spec: SiteSpec; slug?: string }) {
  switch (section.kind) {
    case 'hero':
      return (
        <section className="px-6 py-24 text-center animate-fade-up">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold sm:text-5xl" style={{ color: 'var(--text)' }}>
            {section.heading}
          </h1>
          {section.subheading && (
            <p className="mx-auto mt-5 max-w-2xl text-lg" style={{ color: 'var(--muted)' }}>
              {section.subheading}
            </p>
          )}
          {section.cta && <CtaButton label={section.cta.label} />}
        </section>
      );
    case 'features':
      return (
        <Block heading={section.heading} subheading={section.subheading}>
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
            {(section.items ?? []).map((item, i) => (
              <Card key={i}>
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>{item.title}</h3>
                <p className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>{item.body}</p>
              </Card>
            ))}
          </div>
        </Block>
      );
    case 'stats':
      return (
        <section className="px-6 py-14" style={{ background: 'var(--surface)' }}>
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-6 text-center">
            {(section.items ?? []).map((item, i) => (
              <div key={i}>
                <div className="text-3xl font-extrabold" style={{ color: 'var(--primary)' }}>{item.title}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>{item.body}</div>
              </div>
            ))}
          </div>
        </section>
      );
    case 'testimonials':
      return (
        <Block heading={section.heading}>
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
            {(section.items ?? []).map((item, i) => (
              <Card key={i}>
                <p className="text-sm italic" style={{ color: 'var(--text)' }}>&ldquo;{item.body}&rdquo;</p>
                <p className="mt-3 text-xs font-semibold" style={{ color: 'var(--muted)' }}>— {item.title}</p>
              </Card>
            ))}
          </div>
        </Block>
      );
    case 'pricing':
      return (
        <Block heading={section.heading}>
          <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
            {(section.items ?? []).map((item, i) => (
              <Card key={i}>
                <h3 className="font-bold" style={{ color: 'var(--primary)' }}>{item.title}</h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{item.body}</p>
              </Card>
            ))}
          </div>
        </Block>
      );
    case 'faq':
      return (
        <Block heading={section.heading}>
          <div className="mx-auto max-w-2xl space-y-3">
            {(section.faqs ?? []).map((f, i) => (
              <details key={i} className="rounded-lg p-4" style={{ background: 'var(--surface)' }}>
                <summary className="cursor-pointer font-semibold" style={{ color: 'var(--text)' }}>{f.q}</summary>
                <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </Block>
      );
    case 'contactForm':
      return (
        <Block heading={section.heading} subheading={section.subheading}>
          <ContactForm slug={slug} fields={section.fields ?? []} submitLabel="Send message" />
        </Block>
      );
    case 'productGrid':
      return (
        <Block heading={section.heading} subheading={section.subheading}>
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(spec.store?.products ?? []).slice(0, 8).map((p) => (
              <Card key={p.sku}>
                <div className="mb-3 aspect-square rounded-lg" style={{ background: 'var(--surface)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{p.name}</h3>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{p.category}</p>
                <p className="mt-1 font-bold" style={{ color: 'var(--primary)' }}>
                  ${(p.priceCents / 100).toFixed(2)}
                </p>
                <BuyButton slug={slug} sku={p.sku} />
              </Card>
            ))}
          </div>
        </Block>
      );
    case 'cta':
      return (
        <section className="px-6 py-20 text-center" style={{ background: 'var(--primary)' }}>
          <h2 className="text-3xl font-bold" style={{ color: 'var(--bg)' }}>{section.heading}</h2>
          {section.body && <p className="mx-auto mt-3 max-w-xl" style={{ color: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}>{section.body}</p>}
          {section.cta && (
            <span
              className="mt-6 inline-block rounded-lg px-6 py-3 font-semibold"
              style={{ background: 'var(--bg)', color: 'var(--primary)', borderRadius: 'var(--radius)' }}
            >
              {section.cta.label}
            </span>
          )}
        </section>
      );
    case 'logoCloud':
      return (
        <section className="px-6 py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
          {section.heading}
          <div className="mt-4 flex flex-wrap justify-center gap-8 opacity-60">
            {['Acme', 'Globex', 'Initech', 'Umbra', 'Stark'].map((b) => (
              <span key={b} className="font-bold">{b}</span>
            ))}
          </div>
        </section>
      );
    case 'richText':
      return (
        <Block heading={section.heading}>
          <div className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
            {(section.body ?? '').split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </Block>
      );
    default:
      return null;
  }
}

function Block({ heading, subheading, children }: { heading?: string; subheading?: string; children: React.ReactNode }) {
  return (
    <section className="px-6 py-16">
      {heading && (
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text)' }}>{heading}</h2>
          {subheading && <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{subheading}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="p-5 transition hover:-translate-y-0.5"
      style={{ background: 'var(--surface)', borderRadius: 'var(--radius)' }}
    >
      {children}
    </div>
  );
}

function CtaButton({ label }: { label: string }) {
  return (
    <span
      className="mt-8 inline-block px-7 py-3 font-semibold"
      style={{ background: 'var(--primary)', color: 'var(--bg)', borderRadius: 'var(--radius)' }}
    >
      {label}
    </span>
  );
}
