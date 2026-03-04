-- 015_game_scheduler.sql
-- Game Scheduler + Invites System: tables, enums, indexes
-- Phase 1: One-time scheduling + invites + RSVP + push

-- ============== ENUMS ==============

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE recurrence_type AS ENUM ('none', 'weekly', 'biweekly', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM (
    'invited', 'accepted', 'declined', 'maybe',
    'proposed_new_time', 'no_response'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE proposal_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE game_category AS ENUM (
    'poker', 'rummy', 'blackjack', 'spades',
    'hearts', 'bridge', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============== TABLES ==============

-- Game templates (reusable presets per game type)
CREATE TABLE IF NOT EXISTS game_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  game_category game_category NOT NULL,
  default_duration_minutes INT DEFAULT 180,
  min_players INT DEFAULT 2,
  max_players INT,
  default_buy_in DECIMAL(10,2),
  default_chips_per_buy_in INT,
  ruleset_json JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled events (one row per event series or one-time event)
CREATE TABLE IF NOT EXISTS scheduled_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(32) UNIQUE NOT NULL,
  group_id VARCHAR(32) NOT NULL,
  host_id VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location TEXT,
  game_category game_category DEFAULT 'poker',
  template_id VARCHAR(32),

  -- Scheduling (store local intent + UTC)
  starts_at TIMESTAMPTZ NOT NULL,
  local_start_time TIME NOT NULL,
  duration_minutes INT DEFAULT 180,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/New_York',

  -- Recurrence (RRULE-lite)
  recurrence recurrence_type DEFAULT 'none',
  rrule_weekdays INT[],
  rrule_interval INT DEFAULT 1,
  rrule_until DATE,
  rrule_count INT,

  -- Game defaults
  default_buy_in DECIMAL(10,2),
  default_chips_per_buy_in INT,
  ruleset_json JSONB DEFAULT '{}',

  -- Meta
  status event_status DEFAULT 'draft',
  invite_scope VARCHAR(20) DEFAULT 'group',
  selected_invitees TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_events_group ON scheduled_events(group_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_sched_events_host ON scheduled_events(host_id);
CREATE INDEX IF NOT EXISTS idx_sched_events_status ON scheduled_events(status);

-- Event occurrences (materialized dates from recurrence)
CREATE TABLE IF NOT EXISTS event_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id VARCHAR(32) UNIQUE NOT NULL,
  event_id VARCHAR(32) NOT NULL REFERENCES scheduled_events(event_id) ON DELETE CASCADE,
  occurrence_index INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  location TEXT,
  is_exception BOOLEAN DEFAULT FALSE,
  is_override BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'upcoming',
  game_id VARCHAR(32),
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_2h_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, occurrence_index)
);

CREATE INDEX IF NOT EXISTS idx_occurrences_event ON event_occurrences(event_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_occurrences_upcoming ON event_occurrences(starts_at) WHERE status = 'upcoming';
CREATE INDEX IF NOT EXISTS idx_occurrences_game ON event_occurrences(game_id) WHERE game_id IS NOT NULL;

-- Event invites (per-occurrence RSVP tracking)
CREATE TABLE IF NOT EXISTS event_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id VARCHAR(32) UNIQUE NOT NULL,
  occurrence_id VARCHAR(32) NOT NULL REFERENCES event_occurrences(occurrence_id) ON DELETE CASCADE,
  user_id VARCHAR(32) NOT NULL,
  status invite_status DEFAULT 'invited',
  responded_at TIMESTAMPTZ,
  reminder_count INT DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(occurrence_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_invites_occurrence ON event_invites(occurrence_id, status);
CREATE INDEX IF NOT EXISTS idx_event_invites_user ON event_invites(user_id, status);

-- RSVP history (immutable audit trail)
CREATE TABLE IF NOT EXISTS rsvp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id VARCHAR(32) UNIQUE NOT NULL,
  invite_id VARCHAR(32) NOT NULL REFERENCES event_invites(invite_id),
  old_status invite_status,
  new_status invite_status NOT NULL,
  changed_by VARCHAR(32) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_history_invite ON rsvp_history(invite_id, created_at);

-- Time proposals (invitee proposes alternate time)
CREATE TABLE IF NOT EXISTS time_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id VARCHAR(32) UNIQUE NOT NULL,
  occurrence_id VARCHAR(32) NOT NULL REFERENCES event_occurrences(occurrence_id),
  proposed_by VARCHAR(32) NOT NULL,
  proposed_starts_at TIMESTAMPTZ NOT NULL,
  proposed_duration_minutes INT,
  proposed_location TEXT,
  note TEXT,
  status proposal_status DEFAULT 'pending',
  decided_by VARCHAR(32),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_occurrence ON time_proposals(occurrence_id, status);

-- Event series overrides (edit single occurrence in a series)
CREATE TABLE IF NOT EXISTS event_series_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id VARCHAR(32) UNIQUE NOT NULL,
  event_id VARCHAR(32) NOT NULL REFERENCES scheduled_events(event_id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  override_starts_at TIMESTAMPTZ,
  override_local_time TIME,
  override_duration_minutes INT,
  override_location TEXT,
  override_title VARCHAR(255),
  status VARCHAR(20) DEFAULT 'rescheduled',
  reason TEXT,
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_overrides_event ON event_series_overrides(event_id);
CREATE INDEX IF NOT EXISTS idx_overrides_date ON event_series_overrides(occurrence_date);

-- User notification settings
CREATE TABLE IF NOT EXISTS user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(32) UNIQUE NOT NULL,
  event_reminders BOOLEAN DEFAULT TRUE,
  rsvp_follow_ups BOOLEAN DEFAULT TRUE,
  ai_scheduling_nudges BOOLEAN DEFAULT TRUE,
  low_attendance_alerts BOOLEAN DEFAULT TRUE,
  proposal_notifications BOOLEAN DEFAULT TRUE,
  quiet_hours_start INT DEFAULT 22,
  quiet_hours_end INT DEFAULT 8,
  timezone VARCHAR(64) DEFAULT 'America/New_York',
  expo_push_token TEXT,
  push_token_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification outbox (idempotent delivery)
CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  type VARCHAR(50) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  body TEXT,
  payload JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON notification_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_user ON notification_outbox(user_id, notification_type);

-- ============== ALTER EXISTING TABLES ==============

-- Link game_nights to event occurrences
ALTER TABLE game_nights ADD COLUMN IF NOT EXISTS event_occurrence_id VARCHAR(32);

-- ============== SEED SYSTEM TEMPLATES ==============

INSERT INTO game_templates (template_id, name, game_category, default_duration_minutes, min_players, max_players, default_buy_in, default_chips_per_buy_in, is_system)
VALUES
  ('tpl_poker_standard', 'Texas Hold''em', 'poker', 180, 2, 10, 20.00, 20, TRUE),
  ('tpl_poker_tournament', 'Poker Tournament', 'poker', 240, 4, 20, 50.00, 50, TRUE),
  ('tpl_rummy_standard', 'Rummy', 'rummy', 120, 2, 6, 10.00, NULL, TRUE),
  ('tpl_blackjack', 'Blackjack', 'blackjack', 120, 2, 7, 20.00, 20, TRUE),
  ('tpl_spades', 'Spades', 'spades', 120, 4, 4, 10.00, NULL, TRUE),
  ('tpl_hearts', 'Hearts', 'hearts', 90, 4, 4, 5.00, NULL, TRUE),
  ('tpl_bridge', 'Bridge', 'bridge', 150, 4, 4, 10.00, NULL, TRUE)
ON CONFLICT (template_id) DO NOTHING;
