-- Migration 031: Feature Requests system
-- Users can submit, browse, search, and vote on feature requests

CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    vote_count INT NOT NULL DEFAULT 0,
    comment_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_request_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(feature_request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fr_vote_count ON feature_requests(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_fr_created_at ON feature_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fr_status ON feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_frv_request ON feature_request_votes(feature_request_id);
CREATE INDEX IF NOT EXISTS idx_frv_user ON feature_request_votes(user_id);
