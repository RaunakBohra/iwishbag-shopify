-- Application database roles for multi-tenant access
-- Usage:
--   psql $DATABASE_URL -f prisma/rls/app_roles.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'DevAppUser!2024';
  ELSE
    RAISE NOTICE 'Role app_user already exists. Skipping creation.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin LOGIN PASSWORD 'DevAppAdmin!2024';
  ELSE
    RAISE NOTICE 'Role app_admin already exists. Skipping creation.';
  END IF;
END;
$$;

-- Restrict public access
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE neondb FROM PUBLIC;

-- Grant usage to application roles
GRANT CONNECT ON DATABASE neondb TO app_user, app_admin;
GRANT USAGE ON SCHEMA public TO app_user, app_admin;

-- Grant existing tables/types/sequences
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user, app_admin;

-- Ensure future tables/sequences inherit permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user, app_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user, app_admin;

-- Grant access to helper schema if present
DO $$
BEGIN
  EXECUTE 'GRANT USAGE ON SCHEMA app TO app_user, app_admin';
  EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_user, app_admin';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT EXECUTE ON FUNCTIONS TO app_user, app_admin';
EXCEPTION
  WHEN invalid_schema_name THEN
    RAISE NOTICE 'Schema app does not exist; skipping schema grants.';
END;
$$;

-- Allow admin role to bypass row level security for maintenance
ALTER ROLE app_admin SET row_security = off;
