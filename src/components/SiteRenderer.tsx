'use client';

import { createContext, useContext, useRef } from 'react';
import type { SiteSpec, Page, Section } from '@/lib/ai/types';
import { effectsCss, googleFontsHref } from '@/lib/export/effects';
import { PreviewEffects } from './PreviewEffects';

/**
 * Renders a generated SiteSpec into a live page using the spec's own design
 * tokens (color, typography, radius) injected as CSS variables. This is the
 * preview surface; the same data drives the static export. The hi-level visual
 * layer (animated WebGL hero, 3D tilt, scroll-reveal) is shared with the export
 * via `effectsCss()` + `PreviewEffects`.
 *
 * In `editable` mode (used by the editor) text becomes inline click-to-edit and
 * the immersive 3D/scroll effects are replaced by a calm CSS backdrop so they
 * never fight the cursor.
 */
type EditCtx = { editable: boolean; onEdit: (path: string, value: string) => void };
const EditContext = createContext<EditCtx | null>(null);

export function SiteRenderer({
  spec,
  page,
  pageIndex = 0,
  editable = false,
  onEdit,
}: {
  spec: SiteSpec;
  page: Page;
  pageIndex?: number;
  editable?: boolean;
  onEdit?: (path: string, value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
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
    <EditContext.Provider value={{ editable, onEdit: onEdit ?? (() => {}) }}>
      <div ref={rootRef} className="aurea-preview min-h-screen" style={styleVars}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={googleFontsHref(d.typography.headingFont, d.typography.bodyFont)} />
        <style dangerouslySetInnerHTML={{ __html: effectsCss() }} />
        {editable && <style dangerouslySetInnerHTML={{ __html: EDITABLE_CSS }} />}
        {!editable && <PreviewEffects scope={rootRef} />}
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
            <Ed path="brief.companyName">{spec.brief.companyName}</Ed>
          </div>
          <nav className="hidden gap-5 text-sm sm:flex" style={{ color: 'var(--muted)' }}>
            {navPages.map((p) => (
              <span key={p.path}>{p.navLabel}</span>
            ))}
          </nav>
        </header>

        <main>
          {page.sections.map((section, i) => (
            <SectionView key={i} section={section} spec={spec} base={`pages.${pageIndex}.sections.${i}`} editable={editable} />
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
    </EditContext.Provider>
  );
}

const EDITABLE_CSS = `.aurea-ed{outline:1px dashed color-mix(in srgb,var(--primary) 45%,transparent);outline-offset:3px;border-radius:4px;cursor:text;transition:outline-color .15s}
.aurea-ed:hover{outline-color:var(--primary)}
.aurea-ed:focus{outline:2px solid var(--primary);background:color-mix(in srgb,var(--primary) 7%,transparent)}`;

/** Inline-editable text node. Renders plain markup unless editing is active. */
function Ed({
  as: Tag = 'span',
  path,
  className,
  style,
  children,
}: {
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3';
  path: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ctx = useContext(EditContext);
  if (!ctx?.editable) {
    return (
      <Tag className={className} style={style}>
        {children}
      </Tag>
    );
  }
  return (
    <Tag
      className={`${className ?? ''} aurea-ed`.trim()}
      style={style}
      contentEditable
      suppressContentEditableWarning
      data-edit-path={path}
      onBlur={(e: React.FocusEvent<HTMLElement>) => ctx.onEdit(path, e.currentTarget.textContent ?? '')}
    >
      {children}
    </Tag>
  );
}

function SectionView({
  section,
  spec,
  base,
  editable,
}: {
  section: Section;
  spec: SiteSpec;
  base: string;
  editable: boolean;
}) {
  switch (section.kind) {
    case 'hero':
      return (
        <section
          className={`hero reveal relative px-6 py-32 text-center${editable ? ' no-webgl' : ''}`}
        >
          {!editable && <canvas className="hero-canvas" aria-hidden="true" />}
          <span className="eyebrow">{spec.brief.industry}</span>
          <Ed as="h1" path={`${base}.heading`} className="mx-auto block max-w-3xl text-4xl font-extrabold sm:text-6xl" style={{ color: 'var(--text)' }}>
            {section.heading}
          </Ed>
          {section.subheading && (
            <Ed as="p" path={`${base}.subheading`} className="mx-auto mt-5 block max-w-2xl text-lg" style={{ color: 'var(--muted)' }}>
              {section.subheading}
            </Ed>
          )}
          {section.cta && <CtaButton label={section.cta.label} path={`${base}.cta.label`} />}
        </section>
      );
    case 'features':
      return (
        <Block heading={section.heading} subheading={section.subheading} base={base}>
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
            {(section.items ?? []).map((item, i) => (
              <Card key={i}>
                <Ed as="h3" path={`${base}.items.${i}.title`} className="block font-semibold" style={{ color: 'var(--text)' }}>{item.title}</Ed>
                <Ed as="p" path={`${base}.items.${i}.body`} className="mt-1.5 block text-sm" style={{ color: 'var(--muted)' }}>{item.body}</Ed>
              </Card>
            ))}
          </div>
        </Block>
      );
    case 'stats':
      return (
        <section className="reveal px-6 py-14" style={{ background: 'var(--surface)' }}>
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-6 text-center">
            {(section.items ?? []).map((item, i) => (
              <div key={i}>
                <Ed as="div" path={`${base}.items.${i}.title`} className="text-3xl font-extrabold" style={{ color: 'var(--primary)' }}>{item.title}</Ed>
                <Ed as="div" path={`${base}.items.${i}.body`} className="text-sm" style={{ color: 'var(--muted)' }}>{item.body}</Ed>
              </div>
            ))}
          </div>
        </section>
      );
    case 'testimonials':
      return (
        <Block heading={section.heading} base={base}>
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
            {(section.items ?? []).map((item, i) => (
              <Card key={i}>
                <Ed as="p" path={`${base}.items.${i}.body`} className="block text-sm italic" style={{ color: 'var(--text)' }}>{item.body}</Ed>
                <Ed as="p" path={`${base}.items.${i}.title`} className="mt-3 block text-xs font-semibold" style={{ color: 'var(--muted)' }}>— {item.title}</Ed>
              </Card>
            ))}
          </div>
        </Block>
      );
    case 'pricing':
      return (
        <Block heading={section.heading} base={base}>
          <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
            {(section.items ?? []).map((item, i) => (
              <Card key={i}>
                <Ed as="h3" path={`${base}.items.${i}.title`} className="block font-bold" style={{ color: 'var(--primary)' }}>{item.title}</Ed>
                <Ed as="p" path={`${base}.items.${i}.body`} className="mt-2 block text-sm" style={{ color: 'var(--muted)' }}>{item.body}</Ed>
              </Card>
            ))}
          </div>
        </Block>
      );
    case 'faq':
      return (
        <Block heading={section.heading} base={base}>
          <div className="mx-auto max-w-2xl space-y-3">
            {(section.faqs ?? []).map((f, i) => (
              <details key={i} className="rounded-lg p-4" style={{ background: 'var(--surface)' }}>
                <summary className="cursor-pointer font-semibold" style={{ color: 'var(--text)' }}>
                  <Ed path={`${base}.faqs.${i}.q`}>{f.q}</Ed>
                </summary>
                <Ed as="p" path={`${base}.faqs.${i}.a`} className="mt-2 block text-sm" style={{ color: 'var(--muted)' }}>{f.a}</Ed>
              </details>
            ))}
          </div>
        </Block>
      );
    case 'contactForm':
      return (
        <Block heading={section.heading} subheading={section.subheading} base={base}>
          <form className="mx-auto max-w-lg space-y-4">
            {(section.fields ?? []).map((field) => (
              <div key={field.name}>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {field.label}
                  {field.required && <span style={{ color: 'var(--accent)' }}> *</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea rows={4} className="w-full rounded-lg border p-2.5 text-sm" style={{ borderColor: 'var(--surface)' }} />
                ) : (
                  <input type={field.type} className="w-full rounded-lg border p-2.5 text-sm" style={{ borderColor: 'var(--surface)' }} />
                )}
              </div>
            ))}
            <CtaButton label="Send message" />
          </form>
        </Block>
      );
    case 'productGrid':
      return (
        <Block heading={section.heading} subheading={section.subheading} base={base}>
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(spec.store?.products ?? []).slice(0, 8).map((p) => (
              <Card key={p.sku}>
                <div className="mb-3 aspect-square rounded-lg" style={{ background: 'var(--surface)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{p.name}</h3>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{p.category}</p>
                <p className="mt-1 font-bold" style={{ color: 'var(--primary)' }}>
                  ${(p.priceCents / 100).toFixed(2)}
                </p>
              </Card>
            ))}
          </div>
        </Block>
      );
    case 'cta':
      return (
        <section className="reveal px-6 py-20 text-center" style={{ background: 'var(--primary)' }}>
          <Ed as="h2" path={`${base}.heading`} className="block text-3xl font-bold" style={{ color: 'var(--bg)' }}>{section.heading}</Ed>
          {section.body && <Ed as="p" path={`${base}.body`} className="mx-auto mt-3 block max-w-xl" style={{ color: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}>{section.body}</Ed>}
          {section.cta && (
            <span
              className="mt-6 inline-block rounded-lg px-6 py-3 font-semibold"
              style={{ background: 'var(--bg)', color: 'var(--primary)', borderRadius: 'var(--radius)' }}
            >
              <Ed path={`${base}.cta.label`}>{section.cta.label}</Ed>
            </span>
          )}
        </section>
      );
    case 'logoCloud':
      return (
        <section className="reveal px-6 py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
          <Ed path={`${base}.heading`}>{section.heading}</Ed>
          <div className="mt-4 flex flex-wrap justify-center gap-8 opacity-60">
            {['Acme', 'Globex', 'Initech', 'Umbra', 'Stark'].map((b) => (
              <span key={b} className="font-bold">{b}</span>
            ))}
          </div>
        </section>
      );
    case 'richText':
      return (
        <Block heading={section.heading} base={base}>
          <Ed
            as="div"
            path={`${base}.body`}
            className="mx-auto block max-w-2xl text-sm leading-relaxed"
            style={{ color: 'var(--text)', whiteSpace: 'pre-line' }}
          >
            {section.body ?? ''}
          </Ed>
        </Block>
      );
    default:
      return null;
  }
}

function Block({
  heading,
  subheading,
  base,
  children,
}: {
  heading?: string;
  subheading?: string;
  base: string;
  children: React.ReactNode;
}) {
  return (
    <section className="reveal px-6 py-16">
      {heading && (
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <Ed as="h2" path={`${base}.heading`} className="block text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text)' }}>{heading}</Ed>
          {subheading && <Ed as="p" path={`${base}.subheading`} className="mt-2 block text-sm" style={{ color: 'var(--muted)' }}>{subheading}</Ed>}
        </div>
      )}
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="card p-5" style={{ borderRadius: 'var(--radius)' }}>
      {children}
    </div>
  );
}

function CtaButton({ label, path }: { label: string; path?: string }) {
  return (
    <span
      className="btn mt-8 inline-block px-7 py-3 font-semibold"
      style={{ background: 'var(--primary)', color: 'var(--bg)', borderRadius: 'var(--radius)' }}
    >
      {path ? <Ed path={path}>{label}</Ed> : label}
    </span>
  );
}
