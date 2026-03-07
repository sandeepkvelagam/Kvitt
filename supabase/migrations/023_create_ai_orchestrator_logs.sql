-- Migration 023: Create ai_orchestrator_logs table
-- The orchestrator has been trying to insert into this table via generic_insert
-- but it never existed, causing silent failures on every AI request.

CREATE TABLE IF NOT EXISTS ai_orchestrator_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(36),
    user_id VARCHAR(32) REFERENCES users(user_id),
    user_input TEXT,
    context JSONB,
    result JSONB,
    error TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_orchestrator_logs_user
    ON ai_orchestrator_logs(user_id, timestamp DESC);
