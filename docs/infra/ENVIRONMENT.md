# 🌐 Environment Configuration Guide

> Covers every environment variable/binding used across the monorepo so teammates can wire Cloudflare Workers, Neon, and Next.js apps without guesswork.

---

## 1. Files, Secrets, and Owners

| Workspace / Tool | Local file(s) | Deployment target | Notes |
|------------------|---------------|-------------------|-------|
| API (Cloudflare Worker + Prisma) | `api/.env.local`, `api/.env.dev`, `.dev.vars` | Cloudflare Worker secrets + Wrangler KV/R2 bindings | Required for Prisma, mail, telemetry (`api/src/types.ts`). |
| Admin (Next.js) | `admin/.env.local` | Cloudflare Pages → Project Variables / Secrets | Client + server vars (PostHog, API base, feature toggles). |
| Storefront (Next.js) | `frontend/.env.local` | Cloudflare Pages → Project Variables / Secrets | Mostly `NEXT_PUBLIC_*` values for storefront API access. |
| Workers (`workers/*`) | `<worker>/.env.local` | Cloudflare Worker secrets | Queue producers share API secrets (`workers/catalog-events`, `workers/inventory-alerts`). |
| Tooling / scripts | `scripts/.env.local` | GitHub Actions secrets | Holds `CLOUDFLARE_API_TOKEN`, `NEON_API_KEY`, etc. |
| Playwright / CI | Root `.env.ci`, repo secrets | GitHub Actions → env / secrets | Variables such as `PLAYWRIGHT_TENANT_SLUG`, `NEXT_PUBLIC_API_URL` (see `frontend/playwright.config.ts`). |

When adding a secret:
1. Update the relevant `.env.example`.
2. Store locally in the file above.
3. Push to GitHub / Cloudflare secrets via `pnpm secrets:sync` (see `docs/secrets/README.md`).

---

## 2. Neon / Database URLs

| Variable | Used by | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Prisma client + Workers (`api/prisma/schema.prisma`, `api/src/types.ts`) | Primary connection with full privileges for migrations, queue workers, and tests. |
| `DATABASE_URL_APP_ADMIN` | Tests + Workers needing elevated access (`api/src/services/__tests__/*`) | Role with `SET ROLE app_admin` rights; bypasses RLS when provisioning tenants. |
| `DATABASE_URL_APP_USER` | Hono worker runtime + tenant isolation tests (`api/src/services/__tests__/tenant-isolation.test.ts`) | Least-privileged role subject to RLS; used for regular API traffic. |
| `DATABASE_POOLED_URL` | Future PgBouncer connections (`docs/architecture/SYSTEM-ARCHITECTURE.md:707`) | Optional connection string when Neon pooling is enabled. |
| `DATABASE_SHADOW_URL` / `DATABASE_URL_SHADOW` | Prisma Migrate shadow DB (`docs/guides/TESTING-STRATEGY.md:37`) | Required when running `prisma migrate dev`. |
| `TEST_DATABASE_URL` | Vitest / Playwright DB spins (`docs/guides/DEVELOPMENT-SETUP.md:612`) | Disposable DB per test suite. |

Store these in `api/.env.local` for dev, `api/.env.dev` for deploy pipelines, and mirror them as Cloudflare/GitHub secrets.

---

## 3. Cloudflare Worker Bindings (API)

Bindings defined in `api/wrangler.toml` plus runtime secrets (`api/src/types.ts`):

| Binding / Secret | Type | Description |
|------------------|------|-------------|
| `SESSIONS` | KV Namespace | Shopper/auth session store. |
| `RATE_LIMIT` | KV Namespace | Shared throttling counters. |
| `TEMP` | KV Namespace | Scratch space for flows (OTP, password reset). Replace placeholder ID before deploy. |
| `PRODUCT_MEDIA_BUCKET` | R2 Bucket | Merchant asset uploads. |
| `PROOF_OF_DELIVERY_BUCKET` | R2 Bucket | Signed delivery images. |
| `BACKUPS_BUCKET` | R2 Bucket | Nightly DB + config exports. |
| `CATALOG_EVENTS`, `INVENTORY_ALERTS`, `TENANT_PROVISIONING` | Queue producers | Feed downstream workers (`workers/catalog-events`, etc.). |
| `PRODUCT_MEDIA_PUBLIC_BASE_URL` | Secret (string) | Base URL for media CDN links. |
| `BETTERSTACK_LOGS_TOKEN` / `BETTERSTACK_LOGS_ENDPOINT` | Secrets | OBS logging (see `api/src/lib/logging.ts`). |
| `POSTHOG_API_KEY` / `POSTHOG_HOST` | Secrets | Server-side telemetry (mirrors admin/frontend public key). |
| `JWT_SECRET` | Secret | Session token signing (`api/src/lib/tokens.ts`). |
| `POSTMARK_API_TOKEN`, `PASSWORD_RESET_EMAIL_FROM` | Secrets | Transactional email provider + sender identity. |
| `FRONTEND_URL` | Secret | Absolute URL used in email templates + redirects. |

Provision these bindings via `wrangler publish` or the Cloudflare dashboard. KV/R2 IDs live in `wrangler.toml`; secrets require `npx wrangler secret put <NAME>`.

---

## 4. Next.js Runtime Variables

### Shared (Admin + Storefront)

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_API_URL` | Client + server | Base REST endpoint for storefront/admin calls (`frontend/lib/api.ts`, `admin/lib/api.ts`). |
| `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY` | Client | Analytics instrumentation (`admin/lib/posthog.ts`, `docs/examples/env/web.env.local`). |
| `NEXT_PUBLIC_STATUS_PAGE_URL` | Client | Link to Better Stack status embed (docs/examples). |
| `NEXT_PUBLIC_DEFAULT_TENANT` | Client (storefront) | Auto-redirect from `/` to `/{tenant}/products` (`frontend/app/page.tsx`). |
| `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_ENVIRONMENT` | Client | Observability settings for Pages deploys (`docs/deployment/DEPLOYMENT-CICD.md:859`). |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_R2_PUBLIC_URL` | Client (marketing/admin) | Used in setup docs for asset URLs (`docs/guides/DEVELOPMENT-SETUP.md:98`). |

### Server-only (Admin)

| Variable | Purpose |
|----------|---------|
| `ALLOW_DEV_ACCESS` | Bypass Cloudflare Access locally (`admin/middleware.ts`). |
| `ADMIN_PORT`, `ADMIN_BASE_URL` | Customize Playwright dev server commands (`admin/playwright.config.ts`). |

### Storefront / Playwright

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_TENANT_SLUG` | Which tenant slug test flows use (`frontend/tests/storefront.spec.ts`). |
| `PLAYWRIGHT_PORT`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_WEB_SERVER_COMMAND` | Override Next dev server command/port for tests (`frontend/playwright.config.ts`). |

Set all client-facing `NEXT_PUBLIC_*` values both locally (`.env.local`) and in Cloudflare Pages → Settings → Environment Variables.

---

## 5. Worker & Notification Secrets

| Worker | Variables | Description |
|--------|-----------|-------------|
| `workers/catalog-events` | `DATABASE_URL`, `POSTHOG_API_KEY`, queue bindings | Emits analytics events to PostHog. |
| `workers/inventory-alerts` | `POSTMARK_API_TOKEN`, `INVENTORY_ALERT_EMAIL_FROM`, `INVENTORY_ALERT_EMAIL_TO`, `SPARROW_SMS_TOKEN`, `INVENTORY_ALERT_WEBHOOK_URL` | Sends low-stock notifications via Postmark/SMS/webhook. |
| `workers/tenant-provisioning` | `DATABASE_URL_APP_ADMIN`, `TENANT_PROVISIONING` queue | Automates tenant scaffolding + R2/KV setup. |

Each worker has its own `wrangler.toml`; keep secrets mirrored with the API worker when values overlap (e.g., `DATABASE_URL`).

---

## 6. Tooling & CI Variables

| Variable | Location | Use |
|----------|----------|-----|
| `CLOUDFLARE_API_TOKEN` | `scripts/.env.local`, GitHub secret | Required for wrangler deploy + preview (`docs/deployment/DEPLOYMENT-CICD.md`). |
| `NEON_API_KEY` | `scripts/.env.local` | Provision Neon branches (scripts). |
| `SES_SMTP_USER`, `SES_SMTP_PASS` | `api/.env.local`, GitHub/Workers | AWS email transport. |
| `SPARROW_SMS_TOKEN` | `workers/inventory-alerts/.env.local`, GitHub/Workers | Nepal SMS provider. |
| `BETTERSTACK_TOKEN` | `scripts/.env.local`, GitHub secret | Observability automation. |
| `PAGERDUTY_INTEGRATION_KEY` | `scripts/.env.local` | Incident routing. |

CI pipelines pull these from GitHub → Settings → Secrets (see `docs/deployment/DEPLOYMENT-CICD.md` matrices).

---

## 7. Setup Checklist (New Developer)

1. **Copy env examples**  
   - `cp api/.env.dev.example api/.env.local` (fill DB + email fields).  
   - `cp docs/examples/env/web.env.local.example admin/.env.local` and `frontend/.env.local` (update API + analytics values).
2. **Configure Neon**  
   - Create dev branch, generate App Admin/User roles, and paste URLs into `.env.local`.  
   - Export `DATABASE_URL_APP_USER` to `wrangler secret put` if running Workers locally.
3. **Wrangler bindings**  
   - Run `npx wrangler kv namespace create SESSIONS` etc. and update IDs in `api/wrangler.toml`.  
   - Populate secrets: `npx wrangler secret put JWT_SECRET`, `BETTERSTACK_LOGS_TOKEN`, etc.
4. **Frontend/Admin**  
   - Set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8787` for local dev and update analytics keys.  
   - Toggle `ALLOW_DEV_ACCESS=true` when bypassing Cloudflare Access locally.
5. **Testing**  
   - Provide `PLAYWRIGHT_TENANT_SLUG` and `TEST_DATABASE_URL` in `.env.test` before running `pnpm test`.

Keep this guide in sync whenever a new binding or environment variable is introduced. Cross-reference `docs/secrets/SECRETS-MATRIX.md` for rotation policies.
