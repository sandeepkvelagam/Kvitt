-- Kvitt Security Remediation: Phase 3 — Least-Privileged Backend Role
-- Migration: 011_create_kvitt_backend_role
-- Replace postgres superuser with kvitt_backend for backend connection.
--
-- AFTER RUNNING THIS MIGRATION:
-- 1. Set password (run in SQL Editor, do NOT commit):
--    ALTER ROLE kvitt_backend PASSWORD 'your_strong_password';
--    (Generate: openssl rand -base64 32)
-- 2. Update SUPABASE_DB_URL in backend/.env:
--    postgresql://kvitt_backend:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres
-- 3. Restart backend and verify endpoints

-- Create role (skip if already exists — run as postgres in Supabase SQL Editor)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kvitt_backend') THEN
    -- BYPASSRLS: backend needs to read/write all tables despite RLS being enabled
    -- Password must be set via ALTER ROLE after migration (never commit real passwords)
    CREATE ROLE kvitt_backend LOGIN BYPASSRLS PASSWORD 'REPLACE_VIA_ALTER_ROLE_AFTER_MIGRATION';
    RAISE NOTICE 'Role kvitt_backend created. Run: ALTER ROLE kvitt_backend PASSWORD ''...'' before connecting.';
  ELSE
    RAISE NOTICE 'Role kvitt_backend already exists';
  END IF;
END $$;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO kvitt_backend;

-- Grant table access (SELECT, INSERT, UPDATE, DELETE) on all public tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO kvitt_backend', r.tablename);
    RAISE NOTICE 'Granted CRUD on public.%', r.tablename;
  END LOOP;
END $$;

-- Grant sequence usage (for serial/uuid defaults)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kvitt_backend;

-- Default privileges for future tables created by postgres
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kvitt_backend;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kvitt_backend;
