# Aurea — Progress Log

Running record of the senior-architect review. See `AUDIT.md` for the full
findings and the "DO MOJEJ DECYZJI" list.

## Status: Phase 2 complete (safe high-impact fixes shipped)

- Tests: **40 passing** (7 suites). Typecheck ✓, lint ✓, production build ✓.
- Verified live: security headers + rate limiting on the running server.

## Done — fixed & improved

### Feature work (prior to the audit, completed this session)
- **Commerce**: server-side cart pricing (`src/lib/commerce/cart.ts`) +
  `POST /api/sites/:slug/cart`. Discounts, free-shipping threshold, qty caps;
  never trusts client prices.
- **Lead capture**: `POST/GET /api/sites/:slug/leads` with Zod validation,
  honeypot spam defense, owner-only listing; `ContactForm` wired into the live
  preview; Prisma `Lead` model.
- **Real i18n**: shipped en/pl/de/fr/es UI dictionaries replacing placeholders.

### Audit fixes (Phase 2)
- **F1 — Rate limiting** (`src/lib/security/rate-limit.ts`): fixed-window,
  in-memory limiter with injectable clock. Applied: generate 20/min,
  verify-key 5/min, leads 10/min. Returns 429 + `Retry-After`. _Verified live:
  6th verify-key hit → 429._
- **F2 — Bounded memory stores** (`src/lib/store.ts`): projects refactored to an
  id-keyed map + slug index with FIFO eviction (cap 500); leads capped at 2000.
  Removes the unbounded-growth leak; also simplified `listProjects` dedupe.
- **F3 — Security headers** (`next.config.mjs`): added HSTS and a conservative
  CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`,
  scoped img/font/style/script/connect/form-action). _Verified live in response
  headers; app still renders._
- **F4 — Constant-time auth** (`leads` GET): bearer token compared with
  `crypto.timingSafeEqual` to remove the timing oracle.

### Tests added
- `tests/rate-limit.test.ts` (6), `tests/cart.test.ts` (8), `tests/i18n.test.ts`
  (5). Suite grew 21 → 40.

## To your decision (not implemented — see AUDIT.md)
- **F5** Persist the quality report in Postgres (needs a Prisma migration).
- **F6** Strict CSP with per-request nonces (Next middleware; can break
  hydration if mis-tuned — wanted for production, but a behavioral change).
- **F7** Async generation via a job queue (architecture change; only at scale).

## TOP 5 next steps (by priority)
1. **Stripe checkout** against the existing `CartQuote` (env already wired) —
   turns the store from catalog to transactable.
2. **F5**: persist the quality report (small migration) so the DB read path is
   complete.
3. **HTTP route-level tests** (mock `Request`) for generate/cart/leads to cover
   the handler layer, not just the libs.
4. **Live-AI authoring** for blog bodies + product copy (provider methods
   already exist; wire model calls with graceful fallback).
5. **F6**: production-grade CSP with nonces via middleware.
