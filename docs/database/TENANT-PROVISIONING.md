# 🧩 Tenant Provisioning Flow

> Goal: create a repeatable, idempotent pipeline that provisions new tenants, seeds baseline resources, and reports success/failure within minutes.

---

## 1. API Transaction (`tenant.service.ts`)

- **Function**: `provisionTenant(dto, actor)` returning `{ tenantId, adminUserId, jobId }`.
- **Steps (single transaction)**  
  1. Insert `Tenant` + `TenantSubscription` + `TenantUsage` with plan defaults.  
  2. Create `Role` entries (`Owner`, `Staff`, `Support`) and attach permissions (reuse seed helper).  
  3. Create primary `User` (owner) with hashed password or pending invite token.  
  4. Upsert `Store` shell (name, slug, theme placeholder).  
  5. Record audit log `tenant.provision.started` with actor metadata.
- **Guards**  
  - Enforce unique slug, email, and plan availability.  
  - Wrap in `SERIALIZABLE` isolation; on conflict, raise `409`.  
  - Use `app.set_tenant` at statement start to satisfy RLS (but clear before commit).

---

## 2. Queue Contract (`tenant-provisioning`)

- **Queue payload**
  ```json
  {
    "tenantId": "<uuid>",
    "adminUserId": "<uuid>",
    "tasks": ["seed-demo-products", "seed-theme", "seed-feature-flags"],
    "trigger": "api|import|backfill",
    "attempt": 1
  }
  ```
- **Metadata**  
  - `traceId` for telemetry correlation.  
  - `requestedAt` timestamp.  
  - `deadline` (ISO string) to abort long runs.
- **Retry/backoff**  
  - Max 5 attempts, exponential backoff starting 30s.  
  - Dead-letter queue `tenant-provisioning-failed`.

---

## 3. Worker Implementation (`workers/tenant-provisioning`)

- **Setup**  
  - Fetch Prisma client configured for Neon pooled URL.  
  - Apply `app.set_tenant(tenantId)` before each task; `app.clear_tenant()` in `finally`.
- **Tasks**  
  1. `seed-theme`: assign default theme, copy configuration overrides.  
  2. `seed-demo-products`: optional (only when `env.ALLOW_DEMO_SEED === '1'`).  
  3. `seed-integrations`: create placeholder records for logistics/payment providers.  
  4. `seed-notifications`: enqueue welcome email/SMS.  
  5. Future: `seed-geography` (once Province/District in schema) for shipping zones.
- **Current scaffold**  
  - `workers/tenant-provisioning` consumes the `tenant-provisioning` queue, validates payloads, and logs to Better Stack.  
  - Queue handler currently assigns default theme, enables feature flags, and upserts baseline logistics integrations; extend with catalog/demo seeders as they land.
- **Observability**  
  - Emit Better Stack log per task with `{tenantId, task, status, durationMs}`.  
  - Track success/failure in `TenantProvisioningRun` table (`status`, `step`, `error`).
  - Fire PostHog events `tenant_provisioning_completed` / `tenant_provisioning_failed` for analytics dashboards.

---

## 4. Telemetry & Alerts

- PostHog event `tenant_provisioning_completed` with properties `{tenantId, durationMs, tasks}`.  
- Better Stack alert on `tenant-provisioning-failed` queue depth > 0.  
- PagerDuty integration for consecutive failures (`>=3` within 30 minutes).
- Run the queue integration suite via `npm run --workspace api test:queue`. For production readiness, execute it against a Neon shadow branch created for the run, then drop the branch after verification.

---

## 5. Testing Strategy

- **Unit**: mock Prisma to ensure transaction builds correct writes.  
- **Integration**:  
  - Use Neon branch per test (`neonctl branches create test-<uuid>`).  
  - Run API transaction + worker tasks; assert seeded data.  
  - Drop branch at teardown.  
- **Smoke**: CLI script `npm run provisioning:smoke -- --tenant demo` triggers flow on staging.

---

## 6. Implementation Order

1. Extract shared seeding helpers (`createTenantRoles`, `createTenantStore`) from demo seed.  
2. Implement API transaction with Vitest unit coverage.  
3. Create worker scaffold + queue bindings (`wrangler.toml`).  
4. Add telemetry/logging + Better Stack dashboards.  
5. Deliver integration test harness with Neon branching utility.  
6. Document runbook in `docs/ops/PLATFORM-SETUP.md`.
