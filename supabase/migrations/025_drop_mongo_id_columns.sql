-- Migration 025: Drop all mongo_id columns and their indexes
-- These columns are remnants from the MongoDB-to-PostgreSQL migration
-- and are no longer referenced by any application code.

BEGIN;

-- Drop indexes first (faster than dropping with column)
DROP INDEX IF EXISTS idx_users_mongo_id;
DROP INDEX IF EXISTS idx_groups_mongo_id;
DROP INDEX IF EXISTS idx_group_members_mongo_id;
DROP INDEX IF EXISTS idx_game_nights_mongo_id;
DROP INDEX IF EXISTS idx_players_mongo_id;
DROP INDEX IF EXISTS idx_transactions_mongo_id;
DROP INDEX IF EXISTS idx_ledger_entries_mongo_id;
DROP INDEX IF EXISTS idx_wallets_mongo_id;
DROP INDEX IF EXISTS idx_wallet_transactions_mongo_id;
DROP INDEX IF EXISTS idx_payment_transactions_mongo_id;
DROP INDEX IF EXISTS idx_debt_payments_mongo_id;
DROP INDEX IF EXISTS idx_wallet_deposits_mongo_id;
DROP INDEX IF EXISTS idx_notifications_mongo_id;
DROP INDEX IF EXISTS idx_group_messages_mongo_id;
DROP INDEX IF EXISTS idx_group_invites_mongo_id;
DROP INDEX IF EXISTS idx_polls_mongo_id;
DROP INDEX IF EXISTS idx_feedback_mongo_id;
DROP INDEX IF EXISTS idx_engagement_events_mongo_id;
DROP INDEX IF EXISTS idx_scheduled_jobs_mongo_id;

-- Drop mongo_id columns from all tables that have them
ALTER TABLE users DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE groups DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE group_members DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE game_nights DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE players DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE transactions DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE ledger_entries DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE wallets DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE payment_transactions DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE debt_payments DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE wallet_deposits DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE group_messages DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE group_invites DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE polls DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE feedback DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE engagement_events DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE scheduled_jobs DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE engagement_settings DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE engagement_preferences DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE host_decisions DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE host_persona_settings DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE host_updates DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE rate_limits DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE user_automations DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE subscribers DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE engagement_alerts DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE settlement_disputes DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE pay_net_plans DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE event_occurrences DROP COLUMN IF EXISTS mongo_id;
ALTER TABLE feedback_surveys DROP COLUMN IF EXISTS mongo_id;

COMMIT;
