-- Tenant isolation RLS policies
-- Usage:
--   1. psql $DATABASE_URL -f prisma/rls/tenant_isolation.sql
--   2. Ensure application sets `app.tenant_id` via `SELECT app.set_tenant('<tenant-id>');`

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.set_tenant(tenant text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.tenant_id', tenant, true);
END;
$$;

CREATE OR REPLACE FUNCTION app.clear_tenant()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.tenant_id', '', true);
END;
$$;

-- Helper predicates
CREATE OR REPLACE FUNCTION app.current_tenant()
RETURNS text
LANGUAGE sql
AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')
$$;

-- RLS for Tenant table (self lookup)
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_self_isolation ON "Tenant";
CREATE POLICY tenant_self_isolation ON "Tenant"
USING ("id" = app.current_tenant());

ALTER TABLE "TenantSubscription" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_subscription_isolation ON "TenantSubscription";
CREATE POLICY tenant_subscription_isolation ON "TenantSubscription"
USING ("tenantId" = app.current_tenant())
WITH CHECK ("tenantId" = app.current_tenant());

ALTER TABLE "TenantUsage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_usage_isolation ON "TenantUsage";
CREATE POLICY tenant_usage_isolation ON "TenantUsage"
USING ("tenantId" = app.current_tenant())
WITH CHECK ("tenantId" = app.current_tenant());

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_audit_isolation ON "AuditLog";
CREATE POLICY tenant_audit_isolation ON "AuditLog"
USING ("tenantId" IS NULL OR "tenantId" = app.current_tenant())
WITH CHECK ("tenantId" IS NULL OR "tenantId" = app.current_tenant());

-- Generic helper to apply RLS to tables with tenantId column
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'tenantId'
  ) LOOP
    EXECUTE format('ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY;', rec.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON "%s";', rec.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON "%1$s" USING (("tenantId" IS NULL) OR ("tenantId" = app.current_tenant())) WITH CHECK (("tenantId" IS NULL) OR ("tenantId" = app.current_tenant()));',
      rec.table_name
    );
  END LOOP;
END;
$$;

-- Enforce WITH CHECK for tables without tenantId but referencing tenant data via foreign key name "tenantId"
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_isolation ON "User";
CREATE POLICY user_isolation ON "User"
USING ("tenantId" IS NULL OR "tenantId" = app.current_tenant())
WITH CHECK ("tenantId" IS NULL OR "tenantId" = app.current_tenant());

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_isolation ON "Role";
CREATE POLICY role_isolation ON "Role"
USING ("tenantId" IS NULL OR "tenantId" = app.current_tenant())
WITH CHECK ("tenantId" IS NULL OR "tenantId" = app.current_tenant());

ALTER TABLE "Invite" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invite_isolation ON "Invite";
CREATE POLICY invite_isolation ON "Invite"
USING ("tenantId" = app.current_tenant())
WITH CHECK ("tenantId" = app.current_tenant());

ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN EXECUTE 'ALTER TABLE "TenantSubscription" FORCE ROW LEVEL SECURITY;'; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE "TenantUsage" FORCE ROW LEVEL SECURITY;'; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Verify helper (optional)
COMMENT ON FUNCTION app.set_tenant(text) IS 'Set current tenant context for RLS policies.';
COMMENT ON FUNCTION app.clear_tenant() IS 'Clear tenant context.';
