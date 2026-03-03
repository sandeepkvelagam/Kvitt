-- Kvitt Security Remediation: Phase 1 — RLS Deny-by-Default
-- Migration: 009_enable_rls
-- Enables RLS on all public tables. No policies = deny-by-default for anon/authenticated.
-- Backend uses direct connection (postgres or kvitt_backend) and bypasses RLS.

-- Enable RLS on all existing public tables (dynamic — handles all current + future tables from prior migrations)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    RAISE NOTICE 'RLS enabled on public.%', r.tablename;
  END LOOP;
END $$;
