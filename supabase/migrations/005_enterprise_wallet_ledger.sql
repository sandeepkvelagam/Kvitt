-- Kvitt Enterprise Schema
-- Migration: 005_enterprise_wallet_ledger
-- Immutable wallet ledger for financial integrity

-- ============================================
-- ENUMS
-- ============================================
DO $$ BEGIN
    CREATE TYPE wallet_status AS ENUM ('active', 'frozen', 'closed', 'pending_verification');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE wallet_ledger_type AS ENUM (
        'deposit', 
        'withdrawal', 
        'transfer_in', 
        'transfer_out', 
        'fee', 
        'adjustment',
        'settlement_credit',
        'settlement_debit',
        'refund'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- WALLET ACCOUNTS (Enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(32) UNIQUE NOT NULL,
    user_id VARCHAR(32) UNIQUE NOT NULL REFERENCES users(user_id),
    currency CHAR(3) DEFAULT 'USD',
    status wallet_status DEFAULT 'active',
    balance_cents BIGINT DEFAULT 0,
    pending_cents BIGINT DEFAULT 0,
    lifetime_in_cents BIGINT DEFAULT 0,
    lifetime_out_cents BIGINT DEFAULT 0,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT wallet_balance_non_negative CHECK (balance_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user ON wallet_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_status ON wallet_accounts(status);

-- ============================================
-- WALLET LEDGER (Immutable, append-only)
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_entry_id VARCHAR(32) UNIQUE NOT NULL,
    wallet_account_id VARCHAR(32) NOT NULL REFERENCES wallet_accounts(account_id),
    type wallet_ledger_type NOT NULL,
    amount_cents BIGINT NOT NULL,
    balance_before_cents BIGINT NOT NULL,
    balance_after_cents BIGINT NOT NULL,
    external_ref VARCHAR(255),
    counterparty_account_id VARCHAR(32) REFERENCES wallet_accounts(account_id),
    settlement_line_id VARCHAR(32),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    idempotency_key VARCHAR(64) UNIQUE,
    created_by VARCHAR(32) REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ledger_amount_positive CHECK (amount_cents > 0)
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_account ON wallet_ledger(wallet_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_type ON wallet_ledger(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_external ON wallet_ledger(external_ref) WHERE external_ref IS NOT NULL;

-- Prevent updates/deletes on wallet_ledger (immutable)
CREATE OR REPLACE FUNCTION prevent_wallet_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'wallet_ledger is immutable - updates and deletes are not allowed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wallet_ledger_immutable ON wallet_ledger;
CREATE TRIGGER wallet_ledger_immutable
    BEFORE UPDATE OR DELETE ON wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION prevent_wallet_ledger_modification();
