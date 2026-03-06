-- Migration 016: Add missing columns and tables
-- These are referenced in server.py but were not created in prior migrations.

-- ============================================
-- Missing columns on existing tables
-- ============================================

-- Users: push token (server.py reads/writes expo_push_token on users table)
ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- Players: cashed_out boolean (server.py uses player.get("cashed_out"))
ALTER TABLE players ADD COLUMN IF NOT EXISTS cashed_out BOOLEAN DEFAULT FALSE;

-- ============================================
-- Missing tables
-- ============================================

-- Poker hand analysis history
CREATE TABLE IF NOT EXISTS poker_analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id VARCHAR(36) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    user_name VARCHAR(255),
    game_id VARCHAR(32),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stage VARCHAR(50),
    hole_cards TEXT[],
    community_cards TEXT[],
    all_cards TEXT[],
    evaluation JSONB,
    ai_response JSONB,
    model VARCHAR(50) DEFAULT 'deterministic_v1',
    error TEXT
);
CREATE INDEX IF NOT EXISTS idx_poker_analysis_logs_user ON poker_analysis_logs(user_id, timestamp DESC);

-- AI assistant conversation events
CREATE TABLE IF NOT EXISTS assistant_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    message TEXT,
    intent VARCHAR(100),
    confidence DECIMAL(3, 2),
    tier VARCHAR(50),
    follow_ups_shown TEXT[],
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assistant_events_user ON assistant_events(user_id, timestamp DESC);

-- Game discussion threads
CREATE TABLE IF NOT EXISTS game_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(32) UNIQUE NOT NULL,
    game_id VARCHAR(32) NOT NULL REFERENCES game_nights(game_id) ON DELETE CASCADE,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_threads_game ON game_threads(game_id, created_at DESC);

-- Per-group AI configuration
CREATE TABLE IF NOT EXISTS group_ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id VARCHAR(32) UNIQUE NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    ai_enabled BOOLEAN DEFAULT TRUE,
    auto_suggest_games BOOLEAN DEFAULT TRUE,
    respond_to_chat BOOLEAN DEFAULT TRUE,
    weather_alerts BOOLEAN DEFAULT TRUE,
    holiday_alerts BOOLEAN DEFAULT TRUE,
    smart_scheduling BOOLEAN DEFAULT TRUE,
    auto_poll_suggestions BOOLEAN DEFAULT TRUE,
    chat_summaries BOOLEAN DEFAULT TRUE,
    safety_filters BOOLEAN DEFAULT TRUE,
    max_messages_per_hour INT DEFAULT 5,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(32) REFERENCES users(user_id)
);

-- AI host decision log
CREATE TABLE IF NOT EXISTS host_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id VARCHAR(36) UNIQUE NOT NULL,
    host_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    game_id VARCHAR(32) NOT NULL REFERENCES game_nights(game_id) ON DELETE CASCADE,
    decision_type VARCHAR(50) NOT NULL,
    context JSONB,
    recommendation TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    player_name VARCHAR(255),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_host_decisions_host ON host_decisions(host_id, status);

-- Host persona configuration
CREATE TABLE IF NOT EXISTS host_persona_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(32) UNIQUE NOT NULL REFERENCES users(user_id),
    auto_approve_standard_buyin BOOLEAN DEFAULT FALSE,
    auto_send_reminders BOOLEAN DEFAULT TRUE,
    auto_generate_settlement BOOLEAN DEFAULT TRUE,
    auto_send_summary BOOLEAN DEFAULT TRUE,
    payment_reminder_days INT[] DEFAULT ARRAY[1, 3, 7],
    notify_on_rsvp_change BOOLEAN DEFAULT TRUE,
    suggest_next_game BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ
);

-- User engagement preferences
CREATE TABLE IF NOT EXISTS engagement_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(32) UNIQUE NOT NULL REFERENCES users(user_id),
    muted_all BOOLEAN DEFAULT FALSE,
    muted_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
    preferred_channels TEXT[] DEFAULT ARRAY['push', 'in_app']::TEXT[],
    preferred_tone VARCHAR(50),
    timezone_offset_hours INT DEFAULT 0,
    quiet_start INT DEFAULT 22,
    quiet_end INT DEFAULT 8,
    updated_at TIMESTAMPTZ
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(32) UNIQUE NOT NULL REFERENCES users(user_id),
    push_enabled BOOLEAN DEFAULT TRUE,
    game_updates_enabled BOOLEAN DEFAULT TRUE,
    settlements_enabled BOOLEAN DEFAULT TRUE,
    group_invites_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ
);

-- Settlement dispute tracking
CREATE TABLE IF NOT EXISTS settlement_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id VARCHAR(32) UNIQUE NOT NULL,
    game_id VARCHAR(32) NOT NULL REFERENCES game_nights(game_id) ON DELETE CASCADE,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    category VARCHAR(50),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(32) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_settlement_disputes_game ON settlement_disputes(game_id, status);

-- Settlement run history
CREATE TABLE IF NOT EXISTS settlement_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(32) UNIQUE NOT NULL,
    game_id VARCHAR(32) NOT NULL REFERENCES game_nights(game_id) ON DELETE CASCADE,
    settlement_version INT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by VARCHAR(32) REFERENCES users(user_id),
    algorithm_version VARCHAR(50),
    input_snapshot JSONB,
    output_payments_count INT,
    output_total_amount_cents BIGINT,
    ledger_ids TEXT[],
    stats JSONB
);
CREATE INDEX IF NOT EXISTS idx_settlement_runs_game ON settlement_runs(game_id, generated_at DESC);

-- Spotify OAuth tokens
CREATE TABLE IF NOT EXISTS spotify_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(32) UNIQUE NOT NULL REFERENCES users(user_id),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    spotify_user_id VARCHAR(255),
    spotify_display_name VARCHAR(255),
    spotify_product VARCHAR(20),
    is_premium BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ
);

-- Wallet withdrawal records
CREATE TABLE IF NOT EXISTS wallet_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_id VARCHAR(32) UNIQUE NOT NULL,
    wallet_id VARCHAR(32) NOT NULL REFERENCES wallets(wallet_id),
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    amount_cents BIGINT NOT NULL,
    method VARCHAR(50),
    destination_details JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    note TEXT
);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_user ON wallet_withdrawals(user_id, created_at DESC);
