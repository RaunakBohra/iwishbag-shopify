## RLS Policy Plan

1. `api/prisma/rls/tenant_isolation.sql` handles discovery of tenant-scoped tables via `information_schema` and applies policies in one go.
2. The script creates helper functions:
   ```sql
   CREATE SCHEMA IF NOT EXISTS app;
   CREATE OR REPLACE FUNCTION app.set_tenant(text) RETURNS void ...;
   CREATE OR REPLACE FUNCTION app.clear_tenant() RETURNS void ...;
   ```
3. For each table containing `tenantId`, RLS is enabled with `tenantId IS NULL OR tenantId = app.current_tenant()`; `Tenant` and audit logs have dedicated policies.
4. Apply with `psql $DATABASE_URL -f prisma/rls/tenant_isolation.sql` (run once per environment).
5. Application must set/clear context per request using the helper functions.
6. Testing strategy implemented in `api/src/services/__tests__/tenant-isolation.test.ts` (requires script applied beforehand).
