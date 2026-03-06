-- Migration 017: Fix group_invites, feedback, and rate_limits schema
-- Adds missing columns that backend code expects but were never created

-- === group_invites: add missing columns ===
ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS invited_user_id VARCHAR(32) REFERENCES users(user_id);
ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_group_invites_invited_user ON group_invites(invited_user_id);

-- Backfill invited_user_id from email match for existing invites
UPDATE group_invites gi
SET invited_user_id = u.user_id
FROM users u
WHERE gi.email = u.email AND gi.invited_user_id IS NULL;

-- === feedback: add columns required by feedback_collector v3 ===
-- All nullable with sensible defaults. No NOT NULL constraints on new columns.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS context_refs JSONB DEFAULT '{}';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '[]';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS classification VARCHAR(50);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) DEFAULT 'system';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS owner_id VARCHAR(32);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS auto_fix_attempted BOOLEAN DEFAULT FALSE;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS auto_fix_result TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS resolution_code VARCHAR(50);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS linked_feedback_id VARCHAR(32);
-- idempotency_key: add column WITHOUT unique constraint inline to avoid issues with NULLs
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);

-- Partial unique index: only enforce uniqueness for non-NULL keys
CREATE INDEX IF NOT EXISTS idx_feedback_idempotency
  ON feedback(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Index for duplicate detection queries
CREATE INDEX IF NOT EXISTS idx_feedback_content_hash ON feedback(content_hash, group_id);

-- === rate_limits: add missing columns used by wallet_service ===
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS endpoint VARCHAR(100);
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
