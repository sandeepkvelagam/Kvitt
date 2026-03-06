-- 018: Fix missing columns and tables found during code-schema audit
-- Addresses discrepancies between queries.py / route code and migration schema

-- 1. wallets: add updated_at and daily_transferred_cents
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS daily_transferred_cents BIGINT DEFAULT 0;

-- 2. game_nights: add players JSONB column for player tracking
ALTER TABLE game_nights ADD COLUMN IF NOT EXISTS players JSONB DEFAULT '[]';

-- 3. wallet_transactions: add user_id for aggregate queries
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS user_id VARCHAR(32);

-- 4. Missing tables referenced in ALLOWED_TABLES

CREATE TABLE IF NOT EXISTS automation_event_dedupe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id VARCHAR(32),
    event_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(automation_id, event_key)
);

CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32),
    group_id VARCHAR(32),
    type VARCHAR(50),
    message TEXT,
    scheduled_for TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32),
    group_id VARCHAR(32),
    type VARCHAR(50),
    message TEXT,
    cron_expression VARCHAR(100),
    next_run_at TIMESTAMPTZ,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32),
    group_id VARCHAR(32),
    game_id VARCHAR(32),
    action VARCHAR(50),
    amount DECIMAL(10,2),
    status VARCHAR(20),
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
