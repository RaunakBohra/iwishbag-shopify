## RLS Policy Plan

1. Collect tenant-scoped tables via script (`prisma-inspect`).
2. Generate SQL:
   ```sql
   ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON ${table}
     USING (tenant_id = current_setting('app.tenant_id')::uuid)
     WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
   ```
3. Shared/global tables get either no policies or separate policies (e.g., read-only).
4. Add helper stored procedure to set tenant context: `SELECT set_config('app.tenant_id', $1, true);`
5. Testing strategy:
   - Integration test seeds two tenants, sets context via `$executeRaw` before queries, ensures cross-tenant selects fail.
   - Use Vitest with Prisma to assert RLS enforcement.
