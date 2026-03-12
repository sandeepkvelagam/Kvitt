-- Fix: relax NOT NULL constraint on feedback_surveys.questions
-- The simplified survey flow (migration 021) uses rating/comment columns
-- and doesn't populate questions, causing NOT NULL violation on insert.

ALTER TABLE feedback_surveys ALTER COLUMN questions DROP NOT NULL;
ALTER TABLE feedback_surveys ALTER COLUMN questions SET DEFAULT '[]'::jsonb;
