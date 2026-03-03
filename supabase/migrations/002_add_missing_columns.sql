-- Kvitt Database Schema Update
-- Migration: 002_add_missing_columns
-- Adds columns that exist in Pydantic models but were missing from initial schema

-- ============================================
-- GROUPS TABLE - Add missing columns
-- ============================================
ALTER TABLE groups ADD COLUMN IF NOT EXISTS default_chip_value DECIMAL(10, 2) DEFAULT 1.0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS chips_per_buy_in INT DEFAULT 20;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS max_players INT DEFAULT 20;

-- ============================================
-- TRANSACTIONS TABLE - Add timestamp alias
-- ============================================
-- The model uses 'timestamp' but schema uses 'created_at'
-- Adding timestamp as alias column for compatibility
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- Create user_automations table if missing
-- ============================================
CREATE TABLE IF NOT EXISTS user_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger JSONB NOT NULL,
    actions JSONB NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    run_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_automations_user_id ON user_automations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_automations_enabled ON user_automations(user_id, enabled);

-- ============================================
-- Create automation_runs table if missing
-- ============================================
CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(32) UNIQUE NOT NULL,
    automation_id VARCHAR(32) NOT NULL REFERENCES user_automations(automation_id),
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'pending',
    trigger_data JSONB,
    result JSONB,
    error TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_id ON automation_runs(user_id);

-- ============================================
-- Create engagement_nudges_log table if missing
-- ============================================
CREATE TABLE IF NOT EXISTS engagement_nudges_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nudge_id VARCHAR(32) UNIQUE NOT NULL,
    target_id VARCHAR(32) NOT NULL,
    group_id VARCHAR(32) REFERENCES groups(group_id),
    nudge_type VARCHAR(50) NOT NULL,
    message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_engagement_nudges_target ON engagement_nudges_log(target_id, nudge_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_nudges_group ON engagement_nudges_log(group_id, sent_at DESC);

-- ============================================
-- Create subscribers table if missing
-- ============================================
CREATE TABLE IF NOT EXISTS subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    source VARCHAR(50) DEFAULT 'landing',
    interests TEXT[] DEFAULT ARRAY[]::TEXT[],
    verified BOOLEAN DEFAULT FALSE,
    unsubscribed BOOLEAN DEFAULT FALSE,
    unsubscribed_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT,
    subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
