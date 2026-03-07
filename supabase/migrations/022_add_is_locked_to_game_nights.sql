-- Migration 022: Add is_locked column to game_nights
-- auto_generate_settlement() sets is_locked = TRUE but the column
-- only existed on ledger_entries, not game_nights.

ALTER TABLE game_nights ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
