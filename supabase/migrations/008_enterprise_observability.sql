-- Kvitt Enterprise Schema
-- Migration: 008_enterprise_observability
-- Observability: app errors, API metrics, security events

-- ============================================
-- ENUMS
-- ============================================
DO $$ BEGIN
    CREATE TYPE error_severity AS ENUM ('fatal', 'error', 'warn', 'info');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE security_event_type AS ENUM (
        'auth_failed',
        'auth_success',
        'token_reuse',
        'token_refresh',
        'rate_limited',
        'suspicious_geo',
        'device_change',
        'privilege_change',
        'password_change',
        'mfa_enabled',
        'mfa_disabled',
        'account_locked',
        'account_unlocked',
        'data_export',
        'data_deletion'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- APP ERRORS
-- ============================================
CREATE TABLE IF NOT EXISTS app_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_id VARCHAR(64) UNIQUE NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    user_id VARCHAR(32),
    session_id VARCHAR(64),
    device_id VARCHAR(64),
    platform VARCHAR(16),
    app_version VARCHAR(32),
    severity error_severity DEFAULT 'error',
    error_type VARCHAR(128) NOT NULL,
    error_message TEXT,
    stack_trace TEXT,
    breadcrumbs JSONB DEFAULT '[]',
    fingerprint VARCHAR(64),
    occurrence_count INT DEFAULT 1,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_app_errors_occurred ON app_errors(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_user ON app_errors(user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_errors_type ON app_errors(error_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_severity ON app_errors(severity, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_fingerprint ON app_errors(fingerprint, occurred_at DESC);

-- ============================================
-- API METRICS
-- ============================================
CREATE TABLE IF NOT EXISTS api_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_id VARCHAR(64) UNIQUE NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    endpoint VARCHAR(256) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT NOT NULL,
    latency_ms INT NOT NULL,
    user_id VARCHAR(32),
    request_id VARCHAR(64),
    ip_hash VARCHAR(64),
    user_agent_hash VARCHAR(64),
    request_size_bytes INT,
    response_size_bytes INT,
    error_type VARCHAR(64),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_api_metrics_occurred ON api_metrics(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON api_metrics(endpoint, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_status ON api_metrics(status_code, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_latency ON api_metrics(latency_ms DESC) WHERE latency_ms > 1000;
CREATE INDEX IF NOT EXISTS idx_api_metrics_errors ON api_metrics(error_type, occurred_at DESC) WHERE error_type IS NOT NULL;

-- ============================================
-- SECURITY EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(64) UNIQUE NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    event_type security_event_type NOT NULL,
    user_id VARCHAR(32),
    ip_hash VARCHAR(64),
    device_id VARCHAR(64),
    session_id VARCHAR(64),
    geo_country CHAR(2),
    geo_region VARCHAR(64),
    risk_score INT DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_factors TEXT[],
    blocked BOOLEAN DEFAULT FALSE,
    details JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_security_events_occurred ON security_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_risk ON security_events(risk_score DESC) WHERE risk_score > 50;
CREATE INDEX IF NOT EXISTS idx_security_events_blocked ON security_events(blocked, occurred_at DESC) WHERE blocked = TRUE;
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_hash, occurred_at DESC) WHERE ip_hash IS NOT NULL;

-- ============================================
-- RATE LIMIT TRACKING (Enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    key VARCHAR(255) NOT NULL,
    endpoint VARCHAR(256),
    user_id VARCHAR(32),
    ip_hash VARCHAR(64),
    limit_type VARCHAR(32) NOT NULL,
    limit_value INT NOT NULL,
    current_count INT NOT NULL,
    blocked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit_events(key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked ON rate_limit_events(blocked, occurred_at DESC) WHERE blocked = TRUE;

-- Partition hint for time-series data (for future optimization)
COMMENT ON TABLE api_metrics IS 'Consider partitioning by occurred_at for high-volume deployments';
COMMENT ON TABLE analytics_events IS 'Consider partitioning by occurred_at for high-volume deployments';
COMMENT ON TABLE security_events IS 'Consider partitioning by occurred_at for high-volume deployments';
