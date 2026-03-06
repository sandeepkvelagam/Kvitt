-- Kvitt Enterprise Schema
-- Migration: 013_super_admin_ops
-- Super Admin roles, alerts, incidents, and service health rollups for Ops Copilot

-- ============================================
-- ENUMS
-- ============================================

-- App-level role for staff (Super Admin)
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('user', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Alert severity levels (P0 = critical, P1 = high, P2 = medium)
DO $$ BEGIN
    CREATE TYPE alert_severity AS ENUM ('P0', 'P1', 'P2');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Alert categories
DO $$ BEGIN
    CREATE TYPE alert_category AS ENUM ('health', 'security', 'product', 'cost', 'report');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Alert status
DO $$ BEGIN
    CREATE TYPE alert_status AS ENUM ('open', 'acknowledged', 'resolved');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Incident status
DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM ('open', 'mitigating', 'resolved');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Incident timeline event types
DO $$ BEGIN
    CREATE TYPE incident_event_type AS ENUM ('detected', 'updated', 'mitigated', 'resolved', 'postmortem');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Notification channels
DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('email', 'in_app', 'push', 'slack');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Rollup time windows
DO $$ BEGIN
    CREATE TYPE rollup_window AS ENUM ('1m', '5m', '1h', '1d');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- EXTEND USERS TABLE WITH APP ROLE
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS app_role app_role DEFAULT 'user';
CREATE INDEX IF NOT EXISTS idx_users_app_role ON users(app_role);

-- ============================================
-- ADMIN ALERTS (Created by Ops Agents)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id VARCHAR(32) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    severity alert_severity NOT NULL,
    category alert_category NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    fingerprint VARCHAR(128) NOT NULL,
    status alert_status DEFAULT 'open',
    acknowledged_by VARCHAR(32) REFERENCES users(user_id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by VARCHAR(32) REFERENCES users(user_id),
    resolved_at TIMESTAMPTZ,
    incident_id UUID,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_status ON admin_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity ON admin_alerts(severity, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_category ON admin_alerts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_fingerprint ON admin_alerts(fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_created ON admin_alerts(created_at DESC);

-- ============================================
-- INCIDENTS (P0/P1 incident tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id VARCHAR(32) UNIQUE NOT NULL,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    severity alert_severity NOT NULL,
    status incident_status DEFAULT 'open',
    title VARCHAR(255) NOT NULL,
    current_summary TEXT,
    root_cause TEXT,
    owner_admin_id VARCHAR(32) REFERENCES users(user_id),
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity, status);
CREATE INDEX IF NOT EXISTS idx_incidents_owner ON incidents(owner_admin_id) WHERE owner_admin_id IS NOT NULL;

-- Add FK from admin_alerts to incidents (idempotent)
DO $$ BEGIN
    ALTER TABLE admin_alerts
        ADD CONSTRAINT fk_admin_alerts_incident
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- INCIDENT TIMELINE EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS incident_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    event_type incident_event_type NOT NULL,
    message TEXT NOT NULL,
    actor_user_id VARCHAR(32) REFERENCES users(user_id),
    data JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident ON incident_timeline_events(incident_id, created_at ASC);

-- ============================================
-- ALERT NOTIFICATIONS LOG (Anti-spam + Audit)
-- ============================================

CREATE TABLE IF NOT EXISTS alert_notifications_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id VARCHAR(32) NOT NULL,
    channel notification_channel NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(32) DEFAULT 'sent',
    provider_message_id VARCHAR(128),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert ON alert_notifications_log(alert_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_recipient ON alert_notifications_log(recipient, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_channel ON alert_notifications_log(channel, sent_at DESC);

-- ============================================
-- SERVICE HEALTH ROLLUPS (Fast Dashboard Loads)
-- ============================================

CREATE TABLE IF NOT EXISTS service_health_rollups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_start TIMESTAMPTZ NOT NULL,
    "window" rollup_window NOT NULL,
    requests_total INT DEFAULT 0,
    errors_5xx INT DEFAULT 0,
    errors_4xx INT DEFAULT 0,
    latency_p50_ms INT,
    latency_p95_ms INT,
    latency_p99_ms INT,
    crashes_total INT DEFAULT 0,
    active_users INT DEFAULT 0,
    active_sessions INT DEFAULT 0,
    jobs_failed INT DEFAULT 0,
    rate_limit_hits INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bucket_start, "window")
);

CREATE INDEX IF NOT EXISTS idx_health_rollups_bucket ON service_health_rollups(bucket_start DESC, "window");
CREATE INDEX IF NOT EXISTS idx_health_rollups_window ON service_health_rollups("window", bucket_start DESC);

-- ============================================
-- ADMIN ACCESS LOG (Audit trail for admin actions)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    action VARCHAR(128) NOT NULL,
    endpoint VARCHAR(256),
    filters JSONB DEFAULT '{}',
    ip_hash VARCHAR(64),
    user_agent_hash VARCHAR(64),
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_access_user ON admin_access_log(admin_user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_action ON admin_access_log(action, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_time ON admin_access_log(accessed_at DESC);

-- Prevent updates/deletes on admin_access_log (immutable)
CREATE OR REPLACE FUNCTION prevent_admin_access_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'admin_access_log is immutable - updates and deletes are not allowed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_access_log_immutable ON admin_access_log;
CREATE TRIGGER admin_access_log_immutable
    BEFORE UPDATE OR DELETE ON admin_access_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_admin_access_log_modification();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE admin_alerts IS 'Alerts created by Ops Copilot agents for platform health, security, and product issues';
COMMENT ON TABLE incidents IS 'P0/P1 incident records with timeline tracking';
COMMENT ON TABLE incident_timeline_events IS 'Chronological events for incident response tracking';
COMMENT ON TABLE alert_notifications_log IS 'Audit trail of all alert notifications sent (anti-spam + compliance)';
COMMENT ON TABLE service_health_rollups IS 'Pre-aggregated metrics for fast dashboard loads - the secret sauce';
COMMENT ON TABLE admin_access_log IS 'Immutable audit trail of all Super Admin access (Fortune 500 compliance)';
COMMENT ON COLUMN users.app_role IS 'Global app role: user (default) or super_admin (staff)';
