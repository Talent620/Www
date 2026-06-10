# Aurea Architecture

## Overview

Aurea is a Next.js application whose core is an autonomous generation engine.
The engine transforms a small `Brief` into a complete `SiteSpec` — a single,
serializable source of truth that every other layer consumes (renderer, CMS,
store, SEO, persistence).

```
Brief ──▶ Engine ──▶ SiteSpec ──▶ Renderer / Store / SEO / Persistence
            │
            ├─ analyze          (market, audience, competitors, UVP, keywords)
            ├─ design           (palette, type, logo, radius, animations)
            ├─ authorPages      (structure + sections + copy + SEO)
            ├─ authorBlog       (SEO-structured posts)
            ├─ buildStore       (catalog + categories + checkout)  [STORE]
            ├─ authorLegal      (privacy, terms, cookies)
            ├─ localize         (per-locale string bundles)
            └─ quality gate     (audit → auto-fix → score)
```

## The SiteSpec contract

`src/lib/ai/types.ts` defines `SiteSpec`. It is intentionally
presentation-agnostic: pages are arrays of typed `Section`s, design is a token
set, SEO is structured metadata + JSON-LD. Because the renderer is driven
entirely by this data, the same spec can be previewed, statically exported, or
fed to a headless CMS without change.

## Multi-model provider architecture

`GenerationProvider` (`src/lib/ai/provider.ts`) declares the discrete authoring
capabilities. Two implementations:

1. **DeterministicProvider** — pure functions, no I/O. Produces coherent,
   reproducible output (same brief → same design) and serves as both the
   reference implementation and the universal fallback. This is what makes the
   platform runnable and testable with zero infrastructure.

2. **AnthropicProvider** — calls `claude-opus-4-8` with adaptive thinking and
   structured JSON-schema outputs for the language- and strategy-heavy steps
   (market analysis, hero copy). Each model call is wrapped so any failure
   falls back to the deterministic result. Design tokens, SEO assembly,
   sitemap, i18n, and legal are delegated to the deterministic provider on
   purpose — they benefit from determinism, accessibility guarantees, and
   reproducibility rather than free-form generation.

`selectProvider()` resolves the active provider from `AI_PROVIDER` and the
presence of `ANTHROPIC_API_KEY`. The chosen provider name is persisted on every
project for auditability.

## Self-improvement loop (quality gate)

After authoring, `auditAndFix()` (`src/lib/ai/quality.ts`) runs the
analyse → detect → fix → re-check loop:

- **SEO**: title length, meta description length, presence of structured data
  (auto-trims/pads, flags missing JSON-LD).
- **Accessibility**: heading landmarks per page, labelled form fields.
- **Performance**: heuristic on section count (suggests lazy-loading).
- **Security**: presence of privacy policy and terms.

It mutates the spec with safe fixes and returns a scored `QualityReport`
(0–100 per area, `passed` when all ≥ 80). Each generation records phase timings
for observability.

## Persistence

`src/lib/store.ts` abstracts storage. With `DATABASE_URL` set it uses
PostgreSQL via Prisma (`prisma/schema.prisma`): `User`, `Project`, `Product`,
`GenerationRun`. Without it, an in-process store keeps the app fully functional
for demos, previews, and CI. The store transparently falls back to memory if
the database is unreachable.

## Request flow

1. `POST /api/generate` validates the body with Zod (`validation.ts`).
2. `generateSite()` runs the pipeline and quality gate.
3. `saveProject()` persists the spec and (for stores) the product catalog.
4. The client redirects to `/preview/:slug`, a server component that renders
   the spec via `SiteRenderer` using the spec's own design tokens (CSS
   variables), with page switching across the generated sitemap.

## Security posture

- Strict security headers in `next.config.mjs` (nosniff, frame options,
  referrer policy, permissions policy).
- All user input validated and normalised before use.
- No secrets in the client bundle; AI keys are server-only.
- Generated SVG logo content is escaped (`escapeXml`).
- Generated legal documents (privacy/terms/cookies) ship by default.

## Extending

- **New section types**: add to `SectionKind` + a case in `SiteRenderer`.
- **New providers** (e.g. a second model): implement `GenerationProvider` and
  wire into `selectProvider`.
- **Static export**: walk `spec.sitemap`, render each page server-side, and
  emit HTML — the renderer is already pure and data-driven.
- **Payments**: Stripe env vars are present; add checkout routes against the
  generated `StoreSpec`.
