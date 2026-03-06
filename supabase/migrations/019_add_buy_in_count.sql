-- Migration 019: Add buy_in_count column to players table
-- This column is referenced by multiple handlers (add_player, approve_buy_in, etc.)
-- but was never created in the schema, causing UndefinedColumnError → 500s.

ALTER TABLE players ADD COLUMN IF NOT EXISTS buy_in_count INT DEFAULT 0;
