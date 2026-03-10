-- 026_drop_orphaned_tables.sql
-- Drop orphaned enterprise tables and unused columns from migrations 003-006, 015
-- These tables were added in enterprise migrations but never integrated into backend code.
-- Verified via grep: zero queries against any of these tables in backend/.

BEGIN;

-- ============================================
-- 1. DROP TRIGGERS/FUNCTIONS FIRST (before dropping tables)
-- ============================================

DROP TRIGGER IF EXISTS wallet_ledger_immutable ON wallet_ledger;
DROP FUNCTION IF EXISTS prevent_wallet_ledger_modification();

-- ============================================
-- 2. DROP ORPHANED TABLES
-- ============================================

-- Enterprise duplicates from 004 (ledger_entries is used instead)
DROP TABLE IF EXISTS settlement_lines CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;

-- Enterprise duplicates from 005 (wallets + wallet_transactions are used instead)
DROP TABLE IF EXISTS wallet_ledger CASCADE;
DROP TABLE IF EXISTS wallet_accounts CASCADE;

-- Enterprise orphans from 003 (group_invites is used, not invites)
DROP TABLE IF EXISTS invites CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- organizations must be dropped after groups.org_id FK is removed
ALTER TABLE groups DROP COLUMN IF EXISTS org_id;
ALTER TABLE groups DROP COLUMN IF EXISTS privacy;
DROP TABLE IF EXISTS organizations CASCADE;

-- Enterprise orphan from 006 (replaced by ai_orchestrator_logs from 023)
DROP TABLE IF EXISTS ai_interactions CASCADE;

-- Scheduler orphans from 015 (never queried)
DROP TABLE IF EXISTS time_proposals CASCADE;
DROP TABLE IF EXISTS event_series_overrides CASCADE;
DROP TABLE IF EXISTS user_notification_settings CASCADE;

-- ============================================
-- 3. DROP UNUSED ENTERPRISE COLUMNS ON EXISTING TABLES
-- ============================================

-- From 004: enterprise game/player/transaction columns never queried
ALTER TABLE game_nights DROP COLUMN IF EXISTS game_type;
ALTER TABLE game_nights DROP COLUMN IF EXISTS currency;
ALTER TABLE game_nights DROP COLUMN IF EXISTS rake_amount;
ALTER TABLE players DROP COLUMN IF EXISTS seat;
ALTER TABLE players DROP COLUMN IF EXISTS left_at;
ALTER TABLE transactions DROP COLUMN IF EXISTS source;
ALTER TABLE transactions DROP COLUMN IF EXISTS idempotency_key;

-- From 003: enterprise user columns (Supabase handles auth, no org support)
ALTER TABLE users DROP COLUMN IF EXISTS region_country;
ALTER TABLE users DROP COLUMN IF EXISTS phone_e164;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- ============================================
-- 4. DROP ORPHANED ENUM TYPES (only used by dropped tables)
-- ============================================

DROP TYPE IF EXISTS wallet_status;
DROP TYPE IF EXISTS wallet_ledger_type;
DROP TYPE IF EXISTS settlement_status;
DROP TYPE IF EXISTS settlement_method;
DROP TYPE IF EXISTS settlement_line_status;
DROP TYPE IF EXISTS ai_feature;
DROP TYPE IF EXISTS ai_status;

COMMIT;
