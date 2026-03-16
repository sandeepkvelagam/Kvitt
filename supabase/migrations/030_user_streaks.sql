-- Migration 030: Add streak tracking columns to users table
-- Supports daily activity streaks for the Milestones feature

ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_start_date TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_date DATE;
