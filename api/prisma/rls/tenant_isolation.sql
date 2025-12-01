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
  PERFORM set_config('app.tenant_id', tenant, false);
END;
$$;

CREATE OR REPLACE FUNCTION app.clear_tenant()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.tenant_id', '', false);
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
DROP POLICY IF EXISTS tenant_self_isolation_select ON "Tenant";
DROP POLICY IF EXISTS tenant_self_isolation_insert ON "Tenant";
DROP POLICY IF EXISTS tenant_self_isolation_update ON "Tenant";

CREATE POLICY tenant_self_isolation_select ON "Tenant"
  FOR SELECT
  USING ("id" = app.current_tenant());

CREATE POLICY tenant_self_isolation_insert ON "Tenant"
  FOR INSERT
  WITH CHECK ("id" = app.current_tenant());

CREATE POLICY tenant_self_isolation_update ON "Tenant"
  FOR UPDATE
  USING ("id" = app.current_tenant())
  WITH CHECK ("id" = app.current_tenant());

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

DO $$ BEGIN EXECUTE 'ALTER TABLE "TenantSubscription" FORCE ROW LEVEL SECURITY;'; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE "TenantUsage" FORCE ROW LEVEL SECURITY;'; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE "StaffMember" FORCE ROW LEVEL SECURITY;'; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Force RLS for all tenant-scoped tables so owner connections cannot bypass policies
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'tenantId'
  ) LOOP
    EXECUTE format('ALTER TABLE "%s" FORCE ROW LEVEL SECURITY;', rec.table_name);
  END LOOP;
END;
$$;

-- Plan usage enforcement (products + staff counts)
CREATE OR REPLACE FUNCTION app.plan_limit_value(p_tenant text, p_field text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  limit_value integer;
BEGIN
  SELECT
    CASE p_field
      WHEN 'products' THEN COALESCE(t."maxProducts", sp."maxProducts")
      WHEN 'staff' THEN COALESCE(t."maxStaff", sp."maxStaff")
      WHEN 'orders' THEN COALESCE(t."maxOrdersPerMonth", sp."maxOrdersPerMonth")
      ELSE NULL
    END
  INTO limit_value
  FROM "Tenant" t
  LEFT JOIN "SubscriptionPlan" sp ON sp."id" = t."planId"
  WHERE t."id" = p_tenant;

  IF limit_value IS NULL OR limit_value < 0 THEN
    RETURN NULL;
  END IF;

  RETURN limit_value;
END;
$$;

CREATE OR REPLACE FUNCTION app.enforce_tenant_usage_limits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  product_limit integer;
  staff_limit integer;
BEGIN
  product_limit := app.plan_limit_value(NEW."tenantId", 'products');
  IF product_limit IS NOT NULL AND NEW."products" > product_limit THEN
    RAISE EXCEPTION 'Plan limit exceeded for products (limit %, attempted %)', product_limit, NEW."products"
      USING ERRCODE = 'P0001';
  END IF;

  staff_limit := app.plan_limit_value(NEW."tenantId", 'staff');
  IF staff_limit IS NOT NULL AND NEW."staff" > staff_limit THEN
    RAISE EXCEPTION 'Plan limit exceeded for staff (limit %, attempted %)', staff_limit, NEW."staff"
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_usage_plan_limits ON "TenantUsage";
CREATE TRIGGER tenant_usage_plan_limits
  BEFORE INSERT OR UPDATE ON "TenantUsage"
  FOR EACH ROW EXECUTE FUNCTION app.enforce_tenant_usage_limits();

-- Verify helper (optional)
COMMENT ON FUNCTION app.set_tenant(text) IS 'Set current tenant context for RLS policies.';
COMMENT ON FUNCTION app.clear_tenant() IS 'Clear tenant context.';
