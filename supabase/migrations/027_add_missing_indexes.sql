-- 027_add_missing_indexes.sql
-- Add missing indexes for common query patterns identified during schema audit.

BEGIN;

-- Notifications: fast unread count per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id) WHERE read = FALSE;

-- Ledger entries: pending balance lookups by user
CREATE INDEX IF NOT EXISTS idx_ledger_entries_from_status
  ON ledger_entries(from_user_id, status);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_to_status
  ON ledger_entries(to_user_id, status);

-- Wallet transactions: user-based lookups (user_id column added in migration 018)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id
  ON wallet_transactions(user_id) WHERE user_id IS NOT NULL;

-- Group messages: paginated chat queries
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON group_messages(group_id, created_at DESC);

-- Game nights: active games per group
CREATE INDEX IF NOT EXISTS idx_game_nights_group_status
  ON game_nights(group_id, status);

COMMIT;
