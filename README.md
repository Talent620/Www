# Aurea — Autonomous AI Website & Store Builder

Aurea turns a four-field business brief into a complete, production-ready
website or online store. It autonomously researches the market, designs a
brand, writes every page, builds a store catalog, generates SEO and legal
content, and runs an automated quality gate — then renders a live preview.

It competes with Wix AI / Shopify AI / Framer AI / Lovable / Bolt, with a focus
on **end-to-end autonomy**: you describe, it builds.

---

## What it generates, autonomously

From `{ companyName, industry, description, style, locales, kind }` the engine produces:

- **Market analysis** — industry summary, target audience (needs + objections), competitors, UVP, marketing strategy, keywords
- **Design system** — accessible color palette, typography, radius, animations, and an AI-generated SVG logo (deterministic from the brief)
- **Full structure** — sitemap, navigation, and every sub-page (home, about, services/collections, contact, shop)
- **Copy** — headlines, subheadings, CTAs, features, testimonials, pricing, FAQ, contact form
- **Blog** — SEO-structured posts with excerpts and tags
- **Store** — catalog, categories, product copy, pricing, and checkout flow (for `STORE` briefs)
- **SEO** — meta tags, Open Graph, Twitter cards, JSON-LD structured data, sitemap.xml
- **i18n** — a localized string bundle per requested locale
- **Legal** — privacy policy, terms of service, cookie policy
- **Quality report** — automated SEO / accessibility / performance / security audit with auto-fixes
- **Static export (no lock-in)** — one-click download of the whole site as a
  standalone ZIP: semantic HTML, a single token-driven stylesheet, zero
  JavaScript, full meta/OG/JSON-LD per page. Host it anywhere — you own it.

### Why Aurea (competitive positioning)

A 2026 review of the market (Wix Harmony, Framer AI, Lovable, Bolt, Durable)
found the recurring complaints are **platform lock-in, code bloat, and generic
output**: hosted builders keep your site on their servers in proprietary code,
and "export" often still depends on their runtime. Aurea is built the other
way around — every site is a plain `SiteSpec` that renders to **clean,
ownable, dependency-free HTML** you can take and host anywhere, while still
giving you the full one-click autonomous generation experience.

## Architecture

| Layer        | Technology                                  |
| ------------ | ------------------------------------------- |
| Frontend     | Next.js 14 (App Router), React 18, TypeScript, Tailwind |
| Backend      | Next.js Route Handlers (Node runtime)       |
| Database     | PostgreSQL + Prisma                          |
| AI engine    | Multi-provider (Anthropic Claude + deterministic fallback) |
| Payments     | Stripe-ready (env wired)                     |
| Infra        | Docker, docker-compose, GitHub Actions CI   |

The **AI engine** (`src/lib/ai`) is the core. It defines a `GenerationProvider`
interface implemented by two providers:

- **`DeterministicProvider`** — a full, offline reference engine. The platform
  runs and is fully testable with **zero external dependencies or API keys**.
- **`AnthropicProvider`** — uses `claude-opus-4-8` (adaptive thinking +
  structured outputs) for strategy and copy, and **degrades gracefully** to the
  deterministic engine on any error.

Selection is automatic: with `ANTHROPIC_API_KEY` set it uses Claude, otherwise
the deterministic engine. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick start (no database, no API key)

```bash
npm install
npm run dev
# open http://localhost:3000 → Generate → preview
```

With no `DATABASE_URL`, projects are stored in-memory so you can try the full
flow immediately. With no `ANTHROPIC_API_KEY`, the deterministic engine runs.

## Full stack with Docker

```bash
cp .env.example .env          # optionally add ANTHROPIC_API_KEY
docker compose up --build
# web on http://localhost:3000, Postgres on :5432
```

## Local development with Postgres

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run prisma:generate
npm run prisma:migrate     # creates the schema
npm run db:seed            # optional example projects
npm run dev
```

## Scripts

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Start the dev server                     |
| `npm run build`         | Production build                         |
| `npm run typecheck`     | TypeScript, no emit                      |
| `npm run lint`          | ESLint (next/core-web-vitals)            |
| `npm run test`          | Vitest unit tests (engine + quality gate)|
| `npm run verify`        | typecheck + lint + test                  |
| `npm run prisma:migrate`| Apply database migrations                |
| `npm run db:seed`       | Seed example projects                    |

## API

`POST /api/generate`

```json
{
  "companyName": "Northwind Studio",
  "industry": "Interior design",
  "description": "We design calm, functional living spaces for busy families.",
  "style": "elegant",
  "locales": ["en", "pl"],
  "kind": "WEBSITE"
}
```

Returns `{ id, slug, engine, report, phases, previewUrl }`. Open `previewUrl`
to see the rendered site.

- `GET /api/sites/:slug/sitemap.xml` — the project's sitemap.
- `GET /api/export/:slug` — downloads the project as a standalone static-site
  ZIP (`src/lib/export`), rendered with a zero-dependency HTML + ZIP writer.

## Project layout

```
src/
  app/                     Next.js routes (landing, generate, preview, dashboard, admin, api)
  components/SiteRenderer  Renders a SiteSpec into a live, themed site
  lib/ai/                  The generation engine
    types.ts               SiteSpec contract (the source of truth)
    provider.ts            GenerationProvider interface
    deterministic.ts       Offline reference engine
    anthropic.ts           Live Claude provider (graceful fallback)
    palette.ts             Design-system synthesis
    seo.ts                 SEO + JSON-LD + sitemap
    quality.ts             Automated quality gate (audit + auto-fix)
    engine.ts              Pipeline orchestrator
  lib/export/             Static-site exporter
    html.ts               SiteSpec → standalone HTML + CSS
    zip.ts                Zero-dependency ZIP/CRC-32 writer
  lib/store.ts             Persistence (Postgres or in-memory)
  lib/validation.ts        Zod brief validation
prisma/schema.prisma       Data model
tests/                     Vitest suites
```

## License

MIT — see [LICENSE](LICENSE).
