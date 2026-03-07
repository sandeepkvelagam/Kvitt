-- Migration 021: Add missing columns to feedback_surveys
-- Backend's _submit_survey() inserts rating, comment, and rating_context
-- but these columns were never added to the table.

ALTER TABLE feedback_surveys ADD COLUMN IF NOT EXISTS rating INT;
ALTER TABLE feedback_surveys ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE feedback_surveys ADD COLUMN IF NOT EXISTS rating_context JSONB;
