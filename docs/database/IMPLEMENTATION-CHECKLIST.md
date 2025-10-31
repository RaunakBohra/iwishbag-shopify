# 🗄️ Database Delivery Checklist

> Use this playbook to drive the remaining database & multi-tenancy tasks to completion.

## 1. Prisma Baseline Migration
- [x] Run `pnpm prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script > prisma/migrations/000_init/migration.sql` (output stored at `prisma/migrations/000_init/migration.sql`).
- [x] Review generated SQL against `docs/database/DATA-MODELS.md` (indexes, constraints, enums). *(2025-10-15 review notes below)*
- [x] Apply baseline to `dev` branch (`npx prisma migrate deploy --schema prisma/schema.prisma` with `api/.env.dev`).
- [ ] Promote baseline to `staging` and `main` Neon branches; record migration SHA in release notes. *(dev ✅, staging ✅, production pending)*
- [ ] Update `docs/database/DATABASE-SCHEMA.md` with any deviations captured during review.

**Baseline review – 2025-10-15**
- Current `schema.prisma` scope covers tenants, users, roles/permissions, invites, catalog core (products, variants, media, tags, collections, inventory), tenant subscription/usage, and audit logs.
- Missing relative to `DATA-MODELS.md`: tenant settings + provisioning tables, subscription plan definitions, store/navigation/content tables, orders/customers/cart/payment/fulfillment stack, pricing & promotions, logistics integrations, marketing/communications, analytics, compliance/localization, configuration, and background job tables.
- Index/constraint gaps: composite `(tenant_id, email)` on users, per-tenant SKU uniqueness, audit log ordering index, soft-delete guards, generated search vector, and other constraints enumerated in the data model doc.
- Action: capture the gaps in `docs/database/DATABASE-SCHEMA.md`, raise tickets per capability area, and extend Prisma models before promoting baseline beyond dev/staging.

**Promotion game plan**
1. Update `.env.staging` and `.env.prod` with the official Neon URLs (see `docs/secrets/SECRETS-MATRIX.md`) and verify `DATABASE_URL`/`DATABASE_POOLED_URL` connectivity via `psql`.
2. Run `npx prisma migrate deploy --schema prisma/schema.prisma` for staging (already applied) and production; capture the migration SHA + timestamp in the release log.
3. Execute smoke checklist (health endpoint, sample catalog CRUD, catalog-events worker enqueue, `npm run test`) immediately after each promotion.
4. Announce the production migration window in Slack (`#platform`) at least 24h ahead and confirm on-call coverage.

**Week 1 prep actions**
- [x] Ensure `prisma/migrations/000_init/` directory exists with `.keep` to avoid accidental commits before SQL review.
- [x] Capture current Neon branch state (`prisma/migrations/STATE.md`) so diff can be audited before apply.
- [x] Draft checklist for smoke tests post-migration (API health check, basic catalog query, worker queue insert). *(See `docs/ops/RELEASE-CHECKLIST.md` for detailed steps, owners, and expected outputs.)*
- **Smoke test outline (fill in owners before run):**
  - [ ] Hit `/health` on Store API (expect `ok: true`). *(Owner: Platform Eng — record response payload + timestamp in release log.)*
  - [ ] Create & read a product via `/v1/products` (ensures CRUD + variant relations). *(Owner: API Eng — capture request/response IDs for audit.)*
  - [ ] Trigger catalog event worker with sample queue message; confirm inventory snapshot update/log entries. *(Owner: Worker Eng — link Better Stack log + queue message ID.)*
  - [ ] Run `npm run --workspace iwishbag-store-api test` to ensure Prisma client generation/integration tests still pass. *(Owner: QE — attach test report artifact screenshot/hash.)*
- [x] Coordinate with Platform lead to schedule a migration window (target: Week 1 Thu 10:00 NPT) and announce in engineering Slack channel. *(Scheduled: **2025-10-16 10:00–10:30 NPT**. Calendar invite `NepShop Prisma Prod Migration #000_init` sent; Platform Eng + SRE confirmed. Slack announcement drafted using template below and queued for posting 24h prior.)*

**Slack template**
```
:warning: Prisma migration (environment) scheduled for <date/time NPT>.
Window: <start> → <end>
Scope: Apply migration <sha>; run release smoke checklist.
On-call: <name> | Rollback owner: <name>
Impact: brief read-only (<5m) during apply.
Checklist: https://github.com/.../docs/ops/RELEASE-CHECKLIST.md
Please avoid manual deploys during the window. We'll update this thread when complete.
```
- [x] Verify `.env.dev`, `.env.staging`, and `.env.prod` hold Neon URLs listed in `docs/secrets/SECRETS-MATRIX.md` prior to running deploy commands. *(Verified 2025-10-15 — entries match hosts `ep-fragrant-lake-a12tu03e` (dev), `ep-billowing-sea-a1x8aric` (staging), `ep-long-mud-a1yxup9r` (prod).)*
  - Tip: copy `api/.env.dev.example` and `api/.env.staging.example` to create the real files, then replace the placeholder URLs before running migrations. *(Log verification date + reviewer in this checklist.)*

## 2. Neon RLS & Roles
- [x] Generate SQL script from `docs/database/NEON-MULTI-TENANT.md` (table list + policy template). *(See `api/prisma/rls/tenant_isolation.sql` for the canonical version.)*
- [x] Execute script against `dev` branch; verify `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` applied to tenant tables.
- [x] Create application roles (`app_user`, `app_admin`) and grant privileges. *(Scripted via `api/prisma/rls/app_roles.sql`.)*
- [x] Add automated test in `api/src/services/__tests__/tenant-isolation.test.ts` to confirm cross-tenant access is blocked.
- [x] Commit SQL script under `prisma/rls/` for version control.

**Execution notes**
- `api/prisma/rls/tenant_isolation.sql` enables RLS on all tenant-scoped tables, creates `app.set_tenant/app.clear_tenant`, and applies tenant policies.
- Application code must call `SELECT app.set_tenant('<tenant-id>');` before Prisma queries (and `app.clear_tenant()` afterwards) to gain access.
- `api/src/services/__tests__/tenant-isolation.test.ts` verifies isolation when helpers are installed; ensure script is applied before running the test.

## 3. Seed Data Automation
- [x] Author `prisma/seeds/index.js` to insert subscription plans, permissions matrix, provinces/districts, and demo tenant.
- [x] Wire seed runner into package.json (`npm run seed:dev`, `npm run seed:staging`).
- [x] Ensure seeds are idempotent (use Prisma upserts and safe deletes).
- [x] Document seed outputs in `docs/database/DATA-MODELS.md` (teal callouts).

**Execution notes**
- Break seed steps into reusable modules (`seedPlans`, `seedPermissions`, `seedGeography`, `seedDemoTenant`) and gate by environment (avoid demo tenant in production).
- Source authoritative province/district list from `docs/database/DATA-MODELS.md` appendix; keep CSV in `prisma/seeds/data/`.
- Expose `SEED_DRY_RUN=1` flag to log intended changes without executing writes for review.
- Orchestrator: `prisma/seeds/index.js` invokes modules (`plans.js`, `permissions.js`, `geography.js`, `themes.js`, `feature-flags.js`, `demo-tenant.js`).
- Each module exports `run(prisma, env)` returning summary counts; orchestrator handles transactions where needed.

## 4. Tenant Provisioning Worker
- Reference design: `docs/database/TENANT-PROVISIONING.md`.
- [ ] Design transaction in `api/src/services/tenant.service.ts` to create tenant + default entities atomically.
- [x] Emit provisioning job to `tenant-provisioning` queue with retry/backoff config.
- [x] Implement worker handler (Cloudflare Worker) to run seed extensions (themes, sample products).
- [x] Add telemetry (PostHog event + Better Stack log) for success/failure states.
- [x] Cover flow with integration test using Neon shadow branch.*

**Execution notes**
- Transaction should call shared seeding helpers (roles, permissions, usage counters) so duplicate logic is avoided between synchronous API and async worker.
- Queue payload contract: `{ tenantId, adminUserId, tasks: string[] }`; worker iterates idempotent tasks and records progress in `tenant_provisioning_runs`.
- Integration test: spin up Neon branch with `neon-cli`, run provisioning path, assert demo data presence, then drop branch to avoid residue. *(Current repo includes a Vitest integration exercising the queue against the dev branch; migrate to Neon shadow branches when available.)*
- Integration test: spin up Neon branch with `neon-cli`, run provisioning path, assert demo data presence, then drop branch to avoid residue. *(Current repo includes a Vitest integration exercising the queue via `npm run --workspace api test:queue`; migrate the same command to Neon shadow branches when available.)*
- Worker now assigns the default theme, enables active feature flags, and seeds placeholder logistics integrations before logging completion.

## 5. Monitoring & Snapshots - skip for now 
- Reference plan: `docs/database/MONITORING-SNAPSHOTS.md`.
- [ ] Configure Neon scheduled function or external cron to capture nightly branch snapshots; retain 7 days.
- [ ] Add Grafana/Better Stack dashboard tracking connection count, slow queries, RLS violations.
- [ ] Document snapshot restore procedure in `docs/database/NEON-MULTI-TENANT.md`.
- [ ] Schedule quarterly review to prune stale snapshots and update monitoring thresholds.

**Execution notes** 
- Snapshot automation: `neonctl branches snapshot create main --retention 7d`; wrap in GitHub Action or external cron job.
- Metrics: ingest Neon `stats` API into Better Stack; alert when connection utilisation >70% or when RLS policy errors >0.
- Restore runbook should include `neonctl branches fork snapshot-id rescue-<timestamp>` and subsequent migration drift check.

## 6. Sign-off
- [ ] Update `docs/PROJECT-TODO.md` section 2 checkboxes.
- [ ] Link migration/RLS scripts and seed runner in tracker tickets.
- [ ] Notify Platform + SRE teams that database hardening milestone is complete.
