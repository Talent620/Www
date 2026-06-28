# Aurea — Progress Log

Running record of the senior-architect review. See `AUDIT.md` for the full
findings and the "DO MOJEJ DECYZJI" list.

## Status: Phase 3 — Stripe checkout shipped

- Tests: **54 passing** (8 suites). Typecheck ✓, lint ✓.
- Verified live (prior phase): security headers + rate limiting on the server.

### Stripe checkout (this phase)
- **`src/lib/commerce/stripe.ts`** — dependency-free Stripe integration: talks to
  the REST API over `fetch` and verifies webhook signatures with Node `crypto`
  (no SDK). Pure, tested helpers: `buildCheckoutSessionParams` (quote → session
  params), `encodeForm` (Stripe bracket form-encoding), `verifyWebhookSignature`
  (HMAC-SHA256 + constant-time compare + replay-tolerance). Keeps the
  "runs with zero infra" promise: no key → store still renders.
- **`POST /api/sites/:slug/checkout`** — re-prices the cart server-side via
  `quoteCart` (client prices never trusted), creates a Stripe Checkout Session,
  returns the hosted-checkout URL. Rate-limited (10/min). Replies 503 with
  `STRIPE_NOT_CONFIGURED` when no key is set. Discount codes flow through a
  single-use `amount_off` coupon so the charged total matches the quote exactly.
- **`POST /api/stripe/webhook`** — verifies the signature against
  `STRIPE_WEBHOOK_SECRET` over the raw body, acknowledges `checkout.session.completed`.
- **`BuyButton`** wired into the product grid: one-click single-SKU checkout in
  the live preview, graceful inline message when payments are off.
- Tests: `tests/stripe.test.ts` (14). Suite grew 40 → 54.

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

## TOP next steps (by priority)
1. **Order persistence**: add a Prisma `Order` model and persist
   `checkout.session.completed` in the webhook (currently logged only).
2. **F5**: persist the quality report (small migration) so the DB read path is
   complete.
3. **HTTP route-level tests** (mock `Request`) for generate/cart/leads/checkout
   to cover the handler layer, not just the libs.
4. **Live-AI authoring** for blog bodies + product copy (provider methods
   already exist; wire model calls with graceful fallback).
5. **F6**: production-grade CSP with nonces via middleware.

> Note: the **production CSP** (`next.config.mjs`) currently restricts
> `connect-src`/`form-action` to `'self'`. Stripe Checkout redirects the browser
> to `checkout.stripe.com` (a full navigation, not fetch/XHR), so the current
> server-side redirect flow is unaffected. If a future client-side Stripe.js
> integration is added, allowlist the Stripe origins in the CSP.
