-- Kvitt Security Remediation: Phase 2 — Revoke Public Grants
-- Migration: 010_lockdown_grants
-- Locks down anon/authenticated access. Belt-and-suspenders with RLS.

-- Revoke schema usage (blocks PostgREST from accessing public tables)
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

-- Revoke on all existing tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Revoke on sequences (often forgotten)
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Revoke on functions (if any exist)
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Ensure future objects created by postgres are locked down by default
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
