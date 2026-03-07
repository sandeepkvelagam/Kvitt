-- Create engagement_jobs table for the engagement scheduler job queue
CREATE TABLE IF NOT EXISTS engagement_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,
    group_id VARCHAR(32),
    user_id VARCHAR(32),
    priority INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result JSONB,
    error TEXT,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3
);

CREATE INDEX IF NOT EXISTS idx_engagement_jobs_status_run_at
    ON engagement_jobs (status, run_at)
    WHERE status = 'pending';
