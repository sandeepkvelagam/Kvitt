-- Kvitt Enterprise Schema
-- Migration: 007_enterprise_analytics
-- Analytics event store (append-only), sessions, and devices

-- ============================================
-- ENUMS
-- ============================================
DO $$ BEGIN
    CREATE TYPE platform_type AS ENUM ('ios', 'android', 'web');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- DEVICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(64) UNIQUE NOT NULL,
    platform platform_type NOT NULL,
    os_version VARCHAR(32),
    device_model VARCHAR(128),
    locale VARCHAR(16),
    timezone VARCHAR(64),
    app_version VARCHAR(32),
    build_number VARCHAR(32),
    push_token_hash VARCHAR(64),
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_platform ON devices(platform);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at DESC);

-- ============================================
-- SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(32) REFERENCES users(user_id),
    anonymous_id VARCHAR(64),
    device_id VARCHAR(64) REFERENCES devices(device_id),
    platform platform_type,
    app_version VARCHAR(32),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INT,
    event_count INT DEFAULT 0,
    crash_flag BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON analytics_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON analytics_sessions(device_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON analytics_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_crash ON analytics_sessions(crash_flag) WHERE crash_flag = TRUE;

-- ============================================
-- ANALYTICS EVENTS (Append-only)
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(64) UNIQUE NOT NULL,
    event_name VARCHAR(128) NOT NULL,
    event_version INT DEFAULT 1,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    user_id VARCHAR(32),
    anonymous_id VARCHAR(64),
    session_id VARCHAR(64),
    device_id VARCHAR(64),
    platform platform_type,
    app_version VARCHAR(32),
    properties JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time ON analytics_events(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON analytics_events(user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id, occurred_at DESC) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred ON analytics_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics_events USING GIN (properties);

-- Prevent updates/deletes on analytics_events (append-only)
CREATE OR REPLACE FUNCTION prevent_analytics_events_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'analytics_events is append-only - updates and deletes are not allowed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS analytics_events_immutable ON analytics_events;
CREATE TRIGGER analytics_events_immutable
    BEFORE UPDATE OR DELETE ON analytics_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_analytics_events_modification();

-- ============================================
-- CONVERSION FUNNEL TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS funnel_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(32) REFERENCES users(user_id),
    anonymous_id VARCHAR(64),
    device_id VARCHAR(64),
    funnel_step VARCHAR(64) NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_funnel_user ON funnel_events(user_id, funnel_step);
CREATE INDEX IF NOT EXISTS idx_funnel_step ON funnel_events(funnel_step, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_anon ON funnel_events(anonymous_id, funnel_step) WHERE anonymous_id IS NOT NULL;
