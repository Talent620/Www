# Aurea — Architecture & Code Audit

_Senior-architect review. Phase 1 (findings, no code changes) followed by the
Phase 2 implementation log. Sorted by real impact._

## 1. Project map

| Module | Responsibility |
|---|---|
| `src/lib/ai/types.ts` | `SiteSpec` contract — the single source of truth every layer consumes. |
| `src/lib/ai/provider.ts` | `GenerationProvider` interface (multi-model seam). |
| `src/lib/ai/deterministic.ts` | Offline reference engine: analysis, pages, blog, store, legal, i18n. |
| `src/lib/ai/anthropic.ts` | Live Claude provider; per-call graceful fallback to deterministic. |
| `src/lib/ai/palette.ts` | Deterministic design-system + SVG logo synthesis. |
| `src/lib/ai/seo.ts` | SEO meta, JSON-LD, sitemap. |
| `src/lib/ai/quality.ts` | Quality gate: audit → severity-weighted score → in-place auto-fix. |
| `src/lib/ai/engine.ts` | Pipeline orchestrator + provider selection + phase timing. |
| `src/lib/ai/status.ts` | Engine/config status (powers `/api/health` + UI badge). |
| `src/lib/commerce/cart.ts` | Server-side cart pricing, discounts, shipping. |
| `src/lib/export/{html,zip}.ts` | Static-site export (HTML + zero-dep ZIP writer). |
| `src/lib/store.ts` | Persistence: Postgres/Prisma with in-memory fallback. |
| `src/lib/validation.ts` | Zod brief validation. |
| `src/app/api/*` | Route handlers: generate, health, verify-key, export, cart, leads, sitemap. |
| `src/app/{page,generate,preview,dashboard,admin}` | UI surfaces. |
| `src/components/{SiteRenderer,ContactForm}` | Spec → live themed site; interactive form. |

Flow: `Brief → validation → engine(provider) → quality gate → SiteSpec → store →
preview/export`. Clean separation; the engine has no framework or I/O coupling
(pure + unit-tested), which is the codebase's main strength.

## 2. Bugs & risks (location → why)

| # | Location | Severity | Issue |
|---|---|---|---|
| R1 | all `src/app/api/*` route handlers | **High** | No rate limiting. `/api/generate` and `/api/verify-key` are expensive (the latter burns live API tokens); `/api/leads` is a public write. Unauthenticated abuse → cost/DoS/spam. |
| R2 | `src/app/api/verify-key/route.ts` | **High** | Public + unauthenticated, yet makes a paid model call on every hit. A loop drains your Anthropic quota. |
| R3 | `src/lib/store.ts:21,170` | Medium | In-memory `memory` map and `leadsMemory` array grow unbounded (no eviction). Long-running instance without a DB leaks memory. |
| R4 | `next.config.mjs:13` | Medium | Good baseline headers but no `Strict-Transport-Security` and no `Content-Security-Policy`. |
| R5 | `src/lib/store.ts` (DB read path) | Low | `getProject` from Postgres reads `spec.report`, which is never persisted, so the quality report is empty when served from the DB (works from memory). Inconsistency, not a crash. |
| R6 | `src/app/api/sites/[slug]/leads/route.ts` (GET) | Low | Bearer comparison `auth !== \`Bearer ${secret}\`` is not constant-time. Marginal timing-oracle; low real risk. |
| R7 | `src/lib/ai/anthropic.ts` | Low | Relies on the installed SDK passing through `output_config`/`thinking:adaptive`. If the API rejects, `JSON.parse` throws — but this is caught and falls back, so failure is graceful (acceptable). |

## 3. Weak points

- **Performance**: generation is fully synchronous in the request. Deterministic
  is sub-millisecond, but live AI adds seconds — fine for now; a job queue would
  be needed at scale (see expansion).
- **Security**: covered by R1, R2, R4, R6 above. Input is uniformly Zod-validated
  and prices are server-resolved (good). SVG logo content is escaped (good).
- **Error handling**: consistent typed errors and graceful AI fallback. Solid.
- **Readability / tech debt**: low. Modules are small, single-purpose, commented
  at the "why" level. Test coverage is strong on pure logic (34 tests) but thin
  on the HTTP route layer.

## 4. Proposed fixes (impact / risk)

| ID | Fix | Impact | Risk | Decision |
|---|---|---|---|---|
| F1 | Shared in-memory **rate limiter**; apply to generate, verify-key, leads, cart, export. | High | Low | **Implement** |
| F2 | **Bound** the in-memory project/lead stores (cap + FIFO eviction). | Medium | Low | **Implement** |
| F3 | Add **HSTS** + a conservative **CSP** to `next.config`. | Medium | Low–Med | **Implement** (CSP kept compatible with the inline-styled preview). |
| F4 | **Constant-time** bearer comparison for the leads GET. | Low | Low | **Implement** |
| F5 | Persist the quality **report** alongside the spec so the DB read path returns it. | Low | Med (schema/migration) | **Decision** — see below. |
| F6 | Full **CSP with per-request nonces** (middleware) for inline scripts. | Med | High (can break hydration) | **Decision**. |
| F7 | **Job queue** + async generation for live-AI scale. | Med | High (architecture) | **Decision**. |

## 5. Expansion ideas (quick wins → ambitious)

1. Stripe checkout against the existing `CartQuote` (env already wired). _Quick._
2. Per-project `robots.txt` + `sitemap.xml` already exist in export — add an RSS feed for the blog. _Quick._
3. HTTP route-level tests (mock `Request`) to cover handlers, not just libs. _Quick._
4. Live-AI authoring for blog bodies and product copy (provider methods exist). _Medium._
5. One-click deploy target (Vercel/Netlify) from the export bundle. _Medium._
6. Multi-tenant auth + per-user dashboards; move leads behind real sessions. _Ambitious._
7. A/B variant generation + analytics-driven self-improvement loop. _Ambitious._

---

## DO MOJEJ DECYZJI (require your call before I implement)

- **F5 — persist quality report in the DB.** Needs a Prisma migration (add a
  `report Json?` column to `Project`, or a dedicated table). Safe but it's a
  schema change; tell me to proceed and I'll add the column + migration.
- **F6 — strict CSP with nonces.** Requires Next middleware injecting a nonce
  into every inline script and the preview's inline styles. High chance of
  breaking hydration/preview if mis-tuned; needs careful testing. Worth doing
  for production, but it's a behavioral change I don't want to ship blindly.
- **F7 — async generation via a job queue** (e.g. BullMQ/Redis). Real
  architecture change; only justified once live-AI traffic is significant.

---

## Phase 2 — implementation log

See `PROGRESS.md` for the running record. Implemented in this pass: **F1, F2,
F3, F4** (all high/medium-impact, low-risk), each with tests and a green
typecheck/lint/build.
