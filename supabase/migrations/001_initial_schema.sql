-- Kvitt Database Schema for Supabase PostgreSQL
-- Migration: 001_initial_schema
-- Run this in Supabase SQL Editor or via supabase db push

-- ============================================
-- CORE TABLES
-- ============================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(32) UNIQUE NOT NULL,
    supabase_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    picture TEXT,
    level VARCHAR(20) DEFAULT 'Rookie',
    total_games INT DEFAULT 0,
    total_profit DECIMAL(10, 2) DEFAULT 0,
    badges TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_premium BOOLEAN DEFAULT FALSE,
    premium_plan VARCHAR(32),
    premium_until TEXT,
    premium_started_at TEXT,
    premium_cancelled_at TEXT,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(32) REFERENCES users(user_id),
    default_buy_in DECIMAL(10, 2) DEFAULT 20.0,
    currency VARCHAR(3) DEFAULT 'USD',
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Members
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id VARCHAR(32) UNIQUE NOT NULL,
    group_id VARCHAR(32) NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    nickname VARCHAR(255),
    mongo_id TEXT UNIQUE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Game Nights
CREATE TABLE IF NOT EXISTS game_nights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id VARCHAR(32) UNIQUE NOT NULL,
    group_id VARCHAR(32) REFERENCES groups(group_id),
    host_id VARCHAR(32) REFERENCES users(user_id),
    title VARCHAR(255),
    location TEXT,
    status VARCHAR(20) DEFAULT 'scheduled',
    chip_value DECIMAL(10, 2) DEFAULT 1.0,
    chips_per_buy_in INT DEFAULT 20,
    buy_in_amount DECIMAL(10, 2) DEFAULT 20.0,
    total_chips_distributed INT DEFAULT 0,
    total_chips_returned INT DEFAULT 0,
    is_finalized BOOLEAN DEFAULT FALSE,
    cancelled_by VARCHAR(32),
    cancel_reason TEXT,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Players
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id VARCHAR(32) UNIQUE NOT NULL,
    game_id VARCHAR(32) NOT NULL REFERENCES game_nights(game_id) ON DELETE CASCADE,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    total_buy_in DECIMAL(10, 2) DEFAULT 0,
    total_chips INT DEFAULT 0,
    chips_returned INT,
    cash_out DECIMAL(10, 2),
    net_result DECIMAL(10, 2),
    rsvp_status VARCHAR(20) DEFAULT 'pending',
    mongo_id TEXT UNIQUE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    cashed_out_at TIMESTAMPTZ,
    UNIQUE(game_id, user_id)
);

-- Transactions (Game Buy-ins/Cash-outs)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(32) UNIQUE NOT NULL,
    game_id VARCHAR(32) NOT NULL REFERENCES game_nights(game_id),
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2),
    chips INT,
    chip_value DECIMAL(10, 2),
    notes TEXT,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger Entries (Settlement) - Single source of truth
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id VARCHAR(32) UNIQUE NOT NULL,
    group_id VARCHAR(32) NOT NULL REFERENCES groups(group_id),
    game_id VARCHAR(32) NOT NULL REFERENCES game_nights(game_id),
    from_user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    to_user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    paid_via VARCHAR(32),
    stripe_session_id VARCHAR(255),
    is_locked BOOLEAN DEFAULT FALSE,
    reminder_count INT DEFAULT 0,
    last_reminder_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ,
    source_collection VARCHAR(32),
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT from_to_different CHECK (from_user_id != to_user_id),
    CONSTRAINT amount_positive CHECK (amount > 0)
);

-- ============================================
-- WALLET TABLES (Payment Critical)
-- ============================================

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32) UNIQUE REFERENCES users(user_id),
    balance_cents BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    pin_hash VARCHAR(60),
    version INT DEFAULT 1,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT balance_non_negative CHECK (balance_cents >= 0)
);

-- Wallet Transactions (Immutable Ledger)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(32) UNIQUE NOT NULL,
    wallet_id VARCHAR(32) REFERENCES wallets(wallet_id),
    type VARCHAR(30) NOT NULL,
    amount_cents BIGINT NOT NULL,
    direction VARCHAR(10) NOT NULL,
    balance_before_cents BIGINT NOT NULL,
    balance_after_cents BIGINT NOT NULL,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    counterparty_wallet_id VARCHAR(32),
    counterparty_user_id VARCHAR(32),
    description TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT amount_positive CHECK (amount_cents > 0)
);

-- Wallet Audit (Compliance)
CREATE TABLE IF NOT EXISTS wallet_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id VARCHAR(32) UNIQUE NOT NULL,
    wallet_id VARCHAR(32) NOT NULL REFERENCES wallets(wallet_id),
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    action VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    risk_score SMALLINT CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_flags TEXT[],
    ip_address INET,
    user_agent TEXT,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STRIPE PAYMENT TABLES
-- ============================================

-- Payment Transactions (Premium subscriptions)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(64) UNIQUE NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    user_email VARCHAR(255),
    plan_id VARCHAR(32),
    plan_name VARCHAR(255),
    amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'usd',
    status VARCHAR(32) DEFAULT 'pending',
    payment_status VARCHAR(32) DEFAULT 'initiated',
    completed_at TIMESTAMPTZ,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debt Payments (Game settlement via Stripe)
CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id VARCHAR(64) UNIQUE NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    ledger_id VARCHAR(32) NOT NULL,
    from_user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    from_user_email VARCHAR(255),
    to_user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    to_user_name VARCHAR(255),
    game_id VARCHAR(32) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    status VARCHAR(32) DEFAULT 'pending',
    payment_status VARCHAR(32) DEFAULT 'initiated',
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet Deposits (Stripe checkout for wallet top-up)
CREATE TABLE IF NOT EXISTS wallet_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deposit_id VARCHAR(64) UNIQUE NOT NULL,
    wallet_id VARCHAR(32) NOT NULL REFERENCES wallets(wallet_id),
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    amount_cents BIGINT NOT NULL,
    stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(32) DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATION & MESSAGING TABLES
-- ============================================

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    message TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Messages (Chat)
CREATE TABLE IF NOT EXISTS group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(32) UNIQUE NOT NULL,
    group_id VARCHAR(32) NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'user',
    reply_to VARCHAR(32),
    metadata JSONB,
    edited_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT FALSE,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Invites
CREATE TABLE IF NOT EXISTS group_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_id VARCHAR(32) UNIQUE NOT NULL,
    group_id VARCHAR(32) NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invited_by VARCHAR(32) NOT NULL REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'pending',
    accepted_at TIMESTAMPTZ,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SESSION & AUTH TABLES
-- ============================================

-- User Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI & AUTOMATION TABLES
-- ============================================

-- Polls
CREATE TABLE IF NOT EXISTS polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id VARCHAR(32) UNIQUE NOT NULL,
    group_id VARCHAR(32) NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    game_id VARCHAR(32),
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    votes JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    group_id VARCHAR(32) REFERENCES groups(group_id),
    game_id VARCHAR(32),
    type VARCHAR(50) NOT NULL,
    content TEXT,
    rating INT,
    status VARCHAR(20) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'normal',
    resolved_at TIMESTAMPTZ,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Engagement Settings
CREATE TABLE IF NOT EXISTS engagement_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settings_id VARCHAR(32) UNIQUE NOT NULL,
    group_id VARCHAR(32) UNIQUE REFERENCES groups(group_id) ON DELETE CASCADE,
    nudge_enabled BOOLEAN DEFAULT TRUE,
    reminder_frequency VARCHAR(20) DEFAULT 'weekly',
    quiet_hours_start INT DEFAULT 22,
    quiet_hours_end INT DEFAULT 8,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Settings
CREATE TABLE IF NOT EXISTS payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settings_id VARCHAR(32) UNIQUE NOT NULL,
    group_id VARCHAR(32) UNIQUE REFERENCES groups(group_id) ON DELETE CASCADE,
    reminder_enabled BOOLEAN DEFAULT TRUE,
    reminder_days INT[] DEFAULT ARRAY[1, 3, 7],
    escalation_days INT DEFAULT 14,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id VARCHAR(32) UNIQUE NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(32) NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by VARCHAR(32) NOT NULL,
    reason TEXT,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Logs (AI orchestrator)
CREATE TABLE IF NOT EXISTS event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(32) UNIQUE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    user_id VARCHAR(32),
    group_id VARCHAR(32),
    game_id VARCHAR(32),
    data JSONB,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled Jobs
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id VARCHAR(32) UNIQUE NOT NULL,
    job_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(32),
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    data JSONB,
    executed_at TIMESTAMPTZ,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Reminders Log
CREATE TABLE IF NOT EXISTS payment_reminders_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id VARCHAR(32) UNIQUE NOT NULL,
    ledger_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    reminder_type VARCHAR(32) NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Reconciliation Log
CREATE TABLE IF NOT EXISTS payment_reconciliation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id VARCHAR(32) UNIQUE NOT NULL,
    ledger_id VARCHAR(32),
    stripe_payment_id VARCHAR(255),
    match_type VARCHAR(50),
    confidence DECIMAL(3, 2),
    auto_marked BOOLEAN DEFAULT FALSE,
    data JSONB,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto Fix Log
CREATE TABLE IF NOT EXISTS auto_fix_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fix_id VARCHAR(32) UNIQUE NOT NULL,
    fix_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(32),
    status VARCHAR(20) DEFAULT 'pending',
    result JSONB,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Engagement Events
CREATE TABLE IF NOT EXISTS engagement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    group_id VARCHAR(32) REFERENCES groups(group_id),
    event_type VARCHAR(50) NOT NULL,
    data JSONB,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Host Updates
CREATE TABLE IF NOT EXISTS host_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    update_id VARCHAR(32) UNIQUE NOT NULL,
    host_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    game_id VARCHAR(32),
    group_id VARCHAR(32),
    update_type VARCHAR(50) NOT NULL,
    content TEXT,
    read BOOLEAN DEFAULT FALSE,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback Surveys
CREATE TABLE IF NOT EXISTS feedback_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    group_id VARCHAR(32) REFERENCES groups(group_id),
    game_id VARCHAR(32),
    questions JSONB NOT NULL,
    responses JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate Limits
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    count INT DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Counters (for sequential IDs)
CREATE TABLE IF NOT EXISTS counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) UNIQUE NOT NULL,
    value BIGINT DEFAULT 0,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pay Net Plans (debt consolidation)
CREATE TABLE IF NOT EXISTS pay_net_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    group_id VARCHAR(32) REFERENCES groups(group_id),
    total_amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    ledger_ids TEXT[],
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id VARCHAR(32) UNIQUE NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    template VARCHAR(50),
    status VARCHAR(20) DEFAULT 'sent',
    error TEXT,
    mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_mongo_id ON users(mongo_id);

-- Groups
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_groups_mongo_id ON groups(mongo_id);

-- Group Members
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_mongo_id ON group_members(mongo_id);

-- Game Nights
CREATE INDEX IF NOT EXISTS idx_game_nights_group_id ON game_nights(group_id);
CREATE INDEX IF NOT EXISTS idx_game_nights_host_id ON game_nights(host_id);
CREATE INDEX IF NOT EXISTS idx_game_nights_status ON game_nights(status);
CREATE INDEX IF NOT EXISTS idx_game_nights_mongo_id ON game_nights(mongo_id);

-- Players
CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_mongo_id ON players(mongo_id);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_game_id ON transactions(game_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_mongo_id ON transactions(mongo_id);

-- Ledger Entries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_game_id ON ledger_entries(game_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_group_id ON ledger_entries(group_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_from_user_id ON ledger_entries(from_user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_to_user_id ON ledger_entries(to_user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_status ON ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_mongo_id ON ledger_entries(mongo_id);

-- Wallets
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_mongo_id ON wallets(mongo_id);

-- Wallet Transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_mongo_id ON wallet_transactions(mongo_id);

-- Payment Transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_session ON payment_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_mongo_id ON payment_transactions(mongo_id);

-- Debt Payments
CREATE INDEX IF NOT EXISTS idx_debt_payments_session ON debt_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_ledger_id ON debt_payments(ledger_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_mongo_id ON debt_payments(mongo_id);

-- Wallet Deposits
CREATE INDEX IF NOT EXISTS idx_wallet_deposits_session ON wallet_deposits(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_wallet_deposits_wallet_id ON wallet_deposits(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_deposits_mongo_id ON wallet_deposits(mongo_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_mongo_id ON notifications(mongo_id);

-- Group Messages
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_user_id ON group_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_mongo_id ON group_messages(mongo_id);

-- Group Invites
CREATE INDEX IF NOT EXISTS idx_group_invites_group_id ON group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_email ON group_invites(email);
CREATE INDEX IF NOT EXISTS idx_group_invites_mongo_id ON group_invites(mongo_id);

-- Polls
CREATE INDEX IF NOT EXISTS idx_polls_group_id ON polls(group_id);
CREATE INDEX IF NOT EXISTS idx_polls_game_id ON polls(game_id);
CREATE INDEX IF NOT EXISTS idx_polls_mongo_id ON polls(mongo_id);

-- Feedback
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_group_id ON feedback(group_id);
CREATE INDEX IF NOT EXISTS idx_feedback_mongo_id ON feedback(mongo_id);

-- Engagement Events
CREATE INDEX IF NOT EXISTS idx_engagement_events_user_id ON engagement_events(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_group_id ON engagement_events(group_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_mongo_id ON engagement_events(mongo_id);

-- Scheduled Jobs
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_for ON scheduled_jobs(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_mongo_id ON scheduled_jobs(mongo_id);
