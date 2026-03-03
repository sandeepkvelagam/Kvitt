-- Kvitt Enterprise Schema
-- Migration: 004_enterprise_games_settlements
-- Enhanced games and settlements with enterprise features

-- ============================================
-- ENUMS
-- ============================================
DO $$ BEGIN
    CREATE TYPE game_status AS ENUM ('draft', 'scheduled', 'active', 'closed', 'settled', 'void', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE game_type AS ENUM ('cash', 'tournament', 'sit_and_go');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('buyin', 'rebuy', 'add_on', 'cashout', 'adjustment');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_source AS ENUM ('manual', 'import', 'ai_suggested', 'system');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE settlement_status AS ENUM ('proposed', 'accepted', 'executed', 'canceled', 'disputed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE settlement_method AS ENUM ('off_app', 'in_app_wallet', 'stripe', 'venmo', 'cash');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE settlement_line_status AS ENUM ('pending', 'paid', 'failed', 'disputed', 'forgiven');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- GAMES TABLE (Enhanced)
-- ============================================
ALTER TABLE game_nights ADD COLUMN IF NOT EXISTS game_type game_type DEFAULT 'cash';
ALTER TABLE game_nights ADD COLUMN IF NOT EXISTS currency CHAR(3) DEFAULT 'USD';
ALTER TABLE game_nights ADD COLUMN IF NOT EXISTS rake_amount DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE game_nights ADD COLUMN IF NOT EXISTS created_by VARCHAR(32) REFERENCES users(user_id);

CREATE INDEX IF NOT EXISTS idx_game_nights_created_at ON game_nights(group_id, created_at DESC);

-- ============================================
-- GAME PLAYERS (Enhanced)
-- ============================================
ALTER TABLE players ADD COLUMN IF NOT EXISTS seat INT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

-- ============================================
-- GAME TRANSACTIONS (Append-only, enhanced)
-- ============================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by VARCHAR(32) REFERENCES users(user_id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source transaction_source DEFAULT 'manual';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);

-- ============================================
-- SETTLEMENTS TABLE (New)
-- ============================================
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id VARCHAR(32) UNIQUE NOT NULL,
    game_id VARCHAR(32) REFERENCES game_nights(game_id),
    group_id VARCHAR(32) NOT NULL REFERENCES groups(group_id),
    status settlement_status DEFAULT 'proposed',
    method settlement_method DEFAULT 'off_app',
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_by VARCHAR(32) NOT NULL REFERENCES users(user_id),
    approved_by VARCHAR(32) REFERENCES users(user_id),
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_game ON settlements(game_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

-- ============================================
-- SETTLEMENT LINES TABLE (New)
-- ============================================
CREATE TABLE IF NOT EXISTS settlement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id VARCHAR(32) UNIQUE NOT NULL,
    settlement_id VARCHAR(32) NOT NULL REFERENCES settlements(settlement_id) ON DELETE CASCADE,
    from_user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    to_user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    amount DECIMAL(12, 2) NOT NULL,
    status settlement_line_status DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    paid_via settlement_method,
    reference VARCHAR(255),
    idempotency_key VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT settlement_from_to_different CHECK (from_user_id != to_user_id),
    CONSTRAINT settlement_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_settlement_lines_settlement ON settlement_lines(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_lines_from ON settlement_lines(from_user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_lines_to ON settlement_lines(to_user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_lines_status ON settlement_lines(status);
