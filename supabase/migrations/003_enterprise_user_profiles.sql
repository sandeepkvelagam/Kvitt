-- Kvitt Enterprise Schema
-- Migration: 003_enterprise_user_profiles
-- Adds user_profiles table and extends users for enterprise compliance

-- ============================================
-- ENUMS
-- ============================================
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'locked', 'deleted', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE consent_status AS ENUM ('granted', 'denied', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- EXTEND USERS TABLE
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS status user_status DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS region_country CHAR(2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale VARCHAR(16) DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_e164 VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_region ON users(region_country);

-- ============================================
-- USER PROFILES (Separated for privacy)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(32) UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    dob DATE,
    marketing_opt_in BOOLEAN DEFAULT FALSE,
    consent_version VARCHAR(32),
    consent_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- ============================================
-- CONSENTS TABLE (Versioned consent records)
-- ============================================
DO $$ BEGIN
    CREATE TYPE consent_type AS ENUM ('terms', 'privacy', 'analytics', 'crash_reporting', 'location', 'marketing');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    consent_type consent_type NOT NULL,
    version VARCHAR(32) NOT NULL,
    status consent_status NOT NULL DEFAULT 'granted',
    ip_address INET,
    user_agent_hash VARCHAR(64),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, consent_type, version)
);

CREATE INDEX IF NOT EXISTS idx_consents_user_id ON consents(user_id);
CREATE INDEX IF NOT EXISTS idx_consents_type_status ON consents(consent_type, status);

-- ============================================
-- ORGANIZATIONS (Optional, for team scale)
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    owner_user_id VARCHAR(32) REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);

-- Add org_id to groups for enterprise hierarchy
ALTER TABLE groups ADD COLUMN IF NOT EXISTS org_id VARCHAR(32) REFERENCES organizations(org_id);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS privacy VARCHAR(20) DEFAULT 'private';

-- ============================================
-- INVITES TABLE (Enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_id VARCHAR(32) UNIQUE NOT NULL,
    group_id VARCHAR(32) NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    invited_by VARCHAR(32) NOT NULL REFERENCES users(user_id),
    invitee_contact VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_group_id ON invites(group_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_invites_expires ON invites(expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;
