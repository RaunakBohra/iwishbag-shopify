# 🛰️ Neon Multi-Tenancy Implementation Plan

> **Version:** 1.0
> **Status:** In Progress

Detailed tasks for configuring Neon PostgreSQL to support secure multi-tenant operations.

---

## 1. Prerequisites

- [ ] Neon project created with Production branch (`main`).
- [ ] `DATABASE_URL` (direct) and `DATABASE_POOLED_URL` (PgBouncer) stored in Cloudflare secrets.
- [ ] Prisma schema compiled without errors (`pnpm prisma validate`).

---

## 2. Schema Preparation

1. **Tenant Anchors**
   - [ ] Ensure every tenant-scoped table contains `tenant_id UUID NOT NULL` referencing `tenants(id)`.
   - [ ] Add `created_at`, `updated_at`, `deleted_at` (nullable) timestamps for auditing.

2. **Row-Level Security (RLS)**
   - [ ] Enable RLS globally:
     ```sql
     ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
     ```
   - [ ] Create policy template:
     ```sql
     CREATE POLICY tenant_isolation ON <table_name>
       USING (tenant_id = current_setting('app.tenant_id')::uuid)
       WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
     ```
   - [ ] Apply to every table (automation recommended via SQL generation script).

3. **Shared Tables**
   - [ ] Identify global tables (`subscription_plans`, `provinces`, etc.) and explicitly disable RLS or allow all tenants.
   - [ ] Create read-only role for shared lookups (`app_shared_reader`).

---

## 3. Roles & Permissions

- [ ] Create application roles:
  ```sql
  CREATE ROLE app_user LOGIN PASSWORD '<generated>';
  CREATE ROLE app_admin LOGIN PASSWORD '<generated>';
  GRANT USAGE ON SCHEMA public TO app_user, app_admin;
  ```
- [ ] Restrict default privileges:
  ```sql
  REVOKE ALL ON SCHEMA public FROM PUBLIC;
  REVOKE ALL ON DATABASE "nepshop" FROM PUBLIC;
  ```
- [ ] Grant table access:
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
  ```
- [ ] Allow admin role to bypass RLS for maintenance (`ALTER ROLE app_admin SET rls = off;`).

---

## 4. Connection Management

- [ ] Use Neon connection pooling (PgBouncer) for Workers to avoid connection exhaustion.
- [ ] Configure Prisma Datasource:
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
    directUrl = env("DATABASE_DIRECT_URL")
  }
  ```
- [ ] Implement middleware to set tenant context before query:
  ```sql
  SELECT set_config('app.tenant_id', $1, true);
  ```
- [ ] Ensure context reset after request (use `finally` block in API handler).

---

## 5. Provisioning Workflow

1. **Tenant Creation**
   - [ ] Insert record into `tenants` table.
   - [ ] Create default store, plan association, owner user inside same transaction.

2. **Context Injection**
   - [ ] On authenticated request, derive `tenantId` from JWT and call `set_config` before queries.
   - [ ] For background jobs, inject tenant ID from payload metadata.

3. **Seeding**
   - [ ] Seed baseline data per tenant (settings, default theme) via worker queue.

---

## 6. Observability & Maintenance

- [ ] Create monitoring query to detect RLS violations (using `pg_logical_info`).
- [ ] Schedule weekly vacuum/analyze job (Neon handles automatically but monitor stats).
- [ ] Enable query logging for slow queries (`log_min_duration_statement = 500`).
- [ ] Snapshot Neon branch nightly for backups; retain 7 days.

---

## 7. Testing Strategy

- [ ] Add integration test to ensure tenant `A` cannot read tenant `B` data.
- [ ] Use Neon branching to create ephemeral DB for test suites; destroy post-run.
- [ ] Simulate connection storms to validate pooling configuration.

---

## 8. Migration Workflow

- [ ] Use `pnpm prisma migrate deploy` for production; ensure migrations are idempotent.
- [ ] For risky migrations, create Neon branch (`neon branch create prelaunch-migration`) and test before production.
- [ ] Document rollback procedure via branch promotion.

---

## 9. Incident Response

- [ ] On suspected data leak: revoke credentials, rotate secrets, inspect audit logs.
- [ ] Restore from PITR snapshot if necessary; announce impact to affected merchants.
- [ ] Post-mortem template stored in `/docs/ops/postmortem-template.md`.

