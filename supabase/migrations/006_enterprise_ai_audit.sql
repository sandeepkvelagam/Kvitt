-- Kvitt Enterprise Schema
-- Migration: 006_enterprise_ai_audit
-- AI interactions tracking and audit logging for compliance

-- ============================================
-- ENUMS
-- ============================================
DO $$ BEGIN
    CREATE TYPE ai_feature AS ENUM (
        'assistant_chat', 
        'settlement_suggestion', 
        'recap', 
        'insights',
        'game_summary',
        'player_analysis',
        'automation'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_status AS ENUM ('success', 'error', 'timeout', 'rate_limited');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- AI INTERACTIONS (Model governance)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interaction_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    group_id VARCHAR(32) REFERENCES groups(group_id),
    game_id VARCHAR(32) REFERENCES game_nights(game_id),
    feature ai_feature NOT NULL,
    prompt_hash VARCHAR(64) NOT NULL,
    response_hash VARCHAR(64),
    model VARCHAR(64) NOT NULL,
    model_version VARCHAR(32),
    latency_ms INT,
    input_tokens INT,
    output_tokens INT,
    status ai_status DEFAULT 'success',
    error_message TEXT,
    confidence_score DECIMAL(5, 4),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_user ON ai_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_feature ON ai_interactions(feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_model ON ai_interactions(model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_status ON ai_interactions(status) WHERE status != 'success';

-- ============================================
-- AUDIT LOG (Compliance + forensics)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id VARCHAR(32) UNIQUE NOT NULL,
    actor_user_id VARCHAR(32) REFERENCES users(user_id),
    actor_type VARCHAR(32) DEFAULT 'user',
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_hash VARCHAR(64),
    user_agent_hash VARCHAR(64),
    device_id VARCHAR(64),
    session_id VARCHAR(64),
    request_id VARCHAR(64),
    risk_score INT DEFAULT 0,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_risk ON audit_log(risk_score DESC) WHERE risk_score > 0;
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- Prevent updates/deletes on audit_log (immutable)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is immutable - updates and deletes are not allowed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();
