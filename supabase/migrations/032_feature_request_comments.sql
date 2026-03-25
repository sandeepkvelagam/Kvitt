-- Feature request comments (public discussion thread per request)

CREATE TABLE IF NOT EXISTS feature_request_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT feature_request_comments_body_len CHECK (char_length(body) >= 1 AND char_length(body) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_frc_request_created ON feature_request_comments(feature_request_id, created_at ASC);
