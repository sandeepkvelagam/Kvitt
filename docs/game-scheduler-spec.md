# Game Scheduler + Invites System — Full Design Spec

## Context

Kvitt currently supports one-time game creation (`POST /api/games`) with basic RSVP (`POST /api/games/{game_id}/rsvp`) and an AI-powered `SmartSchedulerService` that suggests times. However, there is no recurring scheduling, no formal invite/RSVP lifecycle, no reschedule-proposal workflow, and no event calendar view. This spec designs a production-grade scheduling system that plugs into the existing architecture.

**Decision: Separate `scheduled_events` table** — the existing `game_nights` table manages game state (buy-ins, chips, settlements). Scheduling/recurrence is a different domain. A `scheduled_events` table owns the calendar lifecycle; when a game actually starts, it creates a `game_nights` row linked via `event_id`.

### Realtime Strategy: Socket.IO Primary + Supabase Realtime for Replay

The codebase already uses Socket.IO extensively (`websocket_manager.py` with 10+ emit functions). We keep Socket.IO as the **primary realtime channel** for live updates (RSVP ticks, proposals, presence). However, we add **Supabase Realtime subscriptions** on `event_invites` and `event_occurrences` as a **secondary channel** for:
- Offline reconnect / missed-event replay
- DB-as-truth: clients can always re-subscribe and get current state from Postgres
- No Socket.IO dependency for correctness — sockets are for speed, DB is for truth

### Tech Stack (existing)
- **Mobile**: React Native StyleSheet (not NativeWind) + Liquid Glass design tokens in `mobile/src/styles/liquidGlass.ts`
- **Web**: Tailwind CSS in `frontend/src/`
- **Backend**: FastAPI + Socket.IO in `backend/server.py`
- **DB**: Supabase Postgres with Motor-compatible wrapper in `backend/db/`

---

# A) Product Spec

## Primary User Stories

### Host
1. **As a host**, I can schedule a one-time game by picking group → date/time → game type → details → send invites.
2. **As a host**, I can create a recurring schedule (every Saturday, biweekly Friday, custom) so games auto-appear on members' calendars.
3. **As a host**, I see a live dashboard of who accepted, declined, is tentative, or hasn't responded.
4. **As a host**, I receive AI suggestions for best times based on group history and attendance patterns.
5. **As a host**, when attendance is low, I get a prompt to reschedule or send follow-ups.
6. **As a host**, when an invitee proposes a new time, I can accept (broadcasting the change) or decline the proposal.
7. **As a host**, I can cancel a single occurrence or the entire series, with members notified.
8. **As a host**, I can edit a single occurrence (override) or the whole series going forward.

### Invitee
1. **As an invitee**, I receive a push notification and in-app invite when a game is scheduled.
2. **As an invitee**, I can RSVP: Accept, Decline, Maybe, or Propose New Time — in ≤2 taps.
3. **As an invitee**, I can propose an alternate date/time with an optional note.
4. **As an invitee**, I see all upcoming games on a calendar/list view.
5. **As an invitee**, I get a reminder 24h and 2h before the game if I haven't responded.
6. **As an invitee**, I'm notified when a game is rescheduled, cancelled, or updated.

## Core Flows

1. **Create Schedule**: Group select → Date/Time picker → (optional) Recurrence picker → Game type & details → Review → Confirm & Send Invites
2. **Invite**: On event creation, all group members (or selected subset) receive push + in-app notification. Player rows created with `rsvp_status = 'invited'`.
3. **RSVP**: Invitee taps notification → RSVP screen → Accept/Decline/Maybe/Propose Time → status updated, host notified in real-time via WebSocket.
4. **Reschedule**: Invitee proposes new time → host sees proposal in dashboard → Accept (broadcasts update) or Decline (proposer notified).
5. **Recurring Management**: Series created with RRULE → occurrences generated on rolling 8-week window → exceptions (skip date) and overrides (change one occurrence) tracked separately.

## UX Principles
- **Fast**: Create a game in ≤5 taps from dashboard. RSVP in ≤2 taps from notification.
- **Minimal memory load**: Progressive disclosure — simple by default, advanced options (recurrence, game templates) revealed on demand.
- **Clear states**: Every invite shows one of 6 statuses with distinct colors and icons.
- **Premium feel**: Liquid Glass design, spring animations, haptic feedback on RSVP actions.

---

# B) Data Model (Supabase Postgres)

## New Enums

```sql
CREATE TYPE event_status AS ENUM (
  'draft', 'published', 'cancelled', 'completed'
);

CREATE TYPE recurrence_type AS ENUM (
  'none', 'weekly', 'biweekly', 'custom'
);

CREATE TYPE invite_status AS ENUM (
  'invited', 'accepted', 'declined', 'maybe',
  'proposed_new_time', 'no_response'
);

CREATE TYPE proposal_status AS ENUM (
  'pending', 'accepted', 'declined', 'expired'
);

CREATE TYPE game_category AS ENUM (
  'poker', 'rummy', 'blackjack', 'spades',
  'hearts', 'bridge', 'other'
);
```

## Table: `scheduled_events`

The core scheduling entity. One row per event series (or one-time event).

```sql
CREATE TABLE scheduled_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(32) UNIQUE NOT NULL,
  group_id VARCHAR(32) NOT NULL REFERENCES groups(group_id),
  host_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location TEXT,
  game_category game_category DEFAULT 'poker',
  template_id VARCHAR(32) REFERENCES game_templates(template_id),

  -- Scheduling (CRITICAL: store local intent + UTC)
  starts_at TIMESTAMPTZ NOT NULL,          -- UTC (computed from local_start_time + timezone)
  local_start_time TIME NOT NULL,          -- e.g., 19:00 — the "human intent" time
  duration_minutes INT DEFAULT 180,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/New_York',  -- IANA tzid

  -- Recurrence (RRULE-lite)
  -- Occurrences generated from local_start_time + timezone per-date (DST-safe)
  recurrence recurrence_type DEFAULT 'none',
  rrule_weekdays INT[],          -- 0=Mon..6=Sun (for weekly/biweekly)
  rrule_interval INT DEFAULT 1,  -- every N weeks
  rrule_until DATE,              -- end date (NULL = forever)
  rrule_count INT,               -- max occurrences (NULL = unlimited)

  -- Game defaults (carried to game_nights on start)
  default_buy_in DECIMAL(10,2),
  default_chips_per_buy_in INT,
  ruleset_json JSONB DEFAULT '{}',

  -- Meta
  status event_status DEFAULT 'draft',
  invite_scope VARCHAR(20) DEFAULT 'group', -- 'group' | 'selected'
  selected_invitees TEXT[],                  -- user_ids if invite_scope='selected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sched_events_group ON scheduled_events(group_id, starts_at);
CREATE INDEX idx_sched_events_host ON scheduled_events(host_id);
CREATE INDEX idx_sched_events_status ON scheduled_events(status);
```

## Table: `event_occurrences`

Materialized occurrences generated from the recurrence rule. One row per actual date.

```sql
CREATE TABLE event_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id VARCHAR(32) UNIQUE NOT NULL,
  event_id VARCHAR(32) NOT NULL REFERENCES scheduled_events(event_id) ON DELETE CASCADE,
  occurrence_index INT NOT NULL,          -- 0-based position in series
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  location TEXT,                          -- override per occurrence
  is_exception BOOLEAN DEFAULT FALSE,    -- TRUE = skipped
  is_override BOOLEAN DEFAULT FALSE,     -- TRUE = date/time/location changed from parent
  status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, active, completed, cancelled, skipped
  game_id VARCHAR(32) REFERENCES game_nights(game_id), -- linked when game actually starts
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_2h_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, occurrence_index)
);

CREATE INDEX idx_occurrences_event ON event_occurrences(event_id, starts_at);
CREATE INDEX idx_occurrences_upcoming ON event_occurrences(starts_at) WHERE status = 'upcoming';
CREATE INDEX idx_occurrences_game ON event_occurrences(game_id) WHERE game_id IS NOT NULL;
```

## Table: `event_invites`

Per-occurrence RSVP tracking with audit trail.

```sql
CREATE TABLE event_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id VARCHAR(32) UNIQUE NOT NULL,
  occurrence_id VARCHAR(32) NOT NULL REFERENCES event_occurrences(occurrence_id) ON DELETE CASCADE,
  user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
  status invite_status DEFAULT 'invited',
  responded_at TIMESTAMPTZ,
  reminder_count INT DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  notes TEXT,                            -- invitee's note (e.g., "running late")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(occurrence_id, user_id)
);

CREATE INDEX idx_event_invites_occurrence ON event_invites(occurrence_id, status);
CREATE INDEX idx_event_invites_user ON event_invites(user_id, status);
```

## Table: `rsvp_history`

Immutable audit trail of all RSVP changes.

```sql
CREATE TABLE rsvp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id VARCHAR(32) UNIQUE NOT NULL,
  invite_id VARCHAR(32) NOT NULL REFERENCES event_invites(invite_id),
  old_status invite_status,
  new_status invite_status NOT NULL,
  changed_by VARCHAR(32) NOT NULL REFERENCES users(user_id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rsvp_history_invite ON rsvp_history(invite_id, created_at);
```

## Table: `time_proposals`

When an invitee proposes an alternate time.

```sql
CREATE TABLE time_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id VARCHAR(32) UNIQUE NOT NULL,
  occurrence_id VARCHAR(32) NOT NULL REFERENCES event_occurrences(occurrence_id),
  proposed_by VARCHAR(32) NOT NULL REFERENCES users(user_id),
  proposed_starts_at TIMESTAMPTZ NOT NULL,
  proposed_duration_minutes INT,
  proposed_location TEXT,
  note TEXT,
  status proposal_status DEFAULT 'pending',
  decided_by VARCHAR(32) REFERENCES users(user_id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proposals_occurrence ON time_proposals(occurrence_id, status);
```

## Table: `event_series_overrides`

When a host edits a single occurrence ("just this one"), we don't mutate the generated occurrence directly. Instead, an override row is created. The occurrence generation and display layer reads overrides and applies them on top of the base occurrence.

```sql
CREATE TABLE event_series_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id VARCHAR(32) UNIQUE NOT NULL,
  event_id VARCHAR(32) NOT NULL REFERENCES scheduled_events(event_id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,            -- the original local date being overridden
  override_starts_at TIMESTAMPTZ,           -- new UTC start time (NULL = use original)
  override_local_time TIME,                 -- new local time intent (NULL = use original)
  override_duration_minutes INT,            -- NULL = use original
  override_location TEXT,                   -- NULL = use original
  override_title VARCHAR(255),              -- NULL = use original
  status VARCHAR(20) DEFAULT 'rescheduled', -- rescheduled | cancelled | normal
  reason TEXT,
  created_by VARCHAR(32) NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, occurrence_date)         -- one override per date per series
);

CREATE INDEX idx_overrides_event ON event_series_overrides(event_id);
CREATE INDEX idx_overrides_date ON event_series_overrides(occurrence_date);
```

**Precedence rules**: When rendering an occurrence:
1. Check `event_series_overrides` for matching `(event_id, occurrence_date)`
2. If found with `status='cancelled'` → skip this occurrence
3. If found with `status='rescheduled'` → use override fields (non-NULL overrides win)
4. If not found → use base occurrence from `event_occurrences`

## Table: `user_notification_settings`

Per-user consent toggles for AI-driven notifications. Stored separately from `engagement_settings` (which is per-group).

```sql
CREATE TABLE user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(32) UNIQUE NOT NULL REFERENCES users(user_id),
  event_reminders BOOLEAN DEFAULT TRUE,        -- 24h/2h reminders
  rsvp_follow_ups BOOLEAN DEFAULT TRUE,        -- "you haven't responded" nudges
  ai_scheduling_nudges BOOLEAN DEFAULT TRUE,    -- AI-generated follow-ups
  low_attendance_alerts BOOLEAN DEFAULT TRUE,   -- host: "only 3 confirmed" alerts
  proposal_notifications BOOLEAN DEFAULT TRUE,  -- time proposal notifications
  quiet_hours_start INT DEFAULT 22,            -- 10 PM (local hour, 0-23)
  quiet_hours_end INT DEFAULT 8,               -- 8 AM
  timezone VARCHAR(64) DEFAULT 'America/New_York',
  expo_push_token TEXT,                         -- Expo push token for this user
  push_token_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Table: `game_templates`

Reusable templates per game type.

```sql
CREATE TABLE game_templates (
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
  is_system BOOLEAN DEFAULT TRUE,      -- system templates vs user-created
  created_by VARCHAR(32) REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Table: `notification_outbox`

Guarantees idempotent notification delivery. Background jobs write to outbox first; a delivery worker drains it. Retries never produce duplicates.

```sql
CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,  -- e.g., "remind:24h:{occurrence_id}:{user_id}"
  user_id VARCHAR(32) NOT NULL REFERENCES users(user_id),
  type VARCHAR(50) NOT NULL,                     -- push | in_app | email
  notification_type VARCHAR(50) NOT NULL,        -- event_invite | reminder_24h | reminder_2h | rsvp_nudge | etc.
  title VARCHAR(255),
  body TEXT,
  payload JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',          -- pending | sent | failed | cancelled
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outbox_status ON notification_outbox(status, created_at);
CREATE INDEX idx_outbox_user ON notification_outbox(user_id, notification_type);
```

**How it works**: Every background job (reminders, nudges, follow-ups) writes to `notification_outbox` with a deterministic `idempotency_key`. A separate drain loop (`process_outbox`) polls `status='pending'` rows and sends via Expo Push / Socket.IO / in-app notification table. If the job retries (crash, timeout), the `UNIQUE` constraint on `idempotency_key` prevents duplicate rows.

---

## Row Level Security (RLS) Guidance

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `scheduled_events` | Members of event's group | Group members (host creates) | Host only | Host only |
| `event_occurrences` | Members of event's group | System (backend) | System (backend) | Never (cancel instead) |
| `event_invites` | Own user_id OR host of event | System (backend) | Own user_id (RSVP) OR host | Never |
| `rsvp_history` | Own user_id OR host | System (backend) | Never (immutable) | Never |
| `time_proposals` | Members of event's group | Own user_id | Host (decide) | Never |
| `notification_outbox` | Own user_id | System (backend) | System (backend) | Never |
| `game_templates` | All authenticated | Admin only | Admin only | Admin only |

**Implementation**: RLS policies on Supabase. The FastAPI backend uses a service-role key (bypasses RLS) for writes; mobile clients use the user JWT for direct Supabase Realtime subscriptions (RLS enforced).

---

### Status Enum Definitions

| Status | Meaning |
|--------|---------|
| `invited` | Invite sent, no response yet |
| `accepted` | Player confirmed attendance |
| `declined` | Player cannot attend |
| `maybe` | Player is tentative |
| `proposed_new_time` | Player wants a different time (links to `time_proposals`) |
| `no_response` | Marked after reminder window expires (system-set) |

### Linking to Existing Tables

- `event_occurrences.game_id` → `game_nights.game_id` (set when host starts the actual game from an occurrence)
- `game_nights` gains: `ALTER TABLE game_nights ADD COLUMN event_occurrence_id VARCHAR(32) REFERENCES event_occurrences(occurrence_id);`
- Existing `players.rsvp_status` continues to work for in-game RSVPs; `event_invites` handles pre-game scheduling RSVPs.

---

# C) API & Realtime Contract

## REST Endpoints (added to `api_router` in `backend/server.py`)

### Scheduled Events
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/events` | Create scheduled event (one-time or recurring) |
| `GET` | `/api/events` | List upcoming events for current user (across all groups) |
| `GET` | `/api/events/{event_id}` | Get event details + occurrences |
| `PUT` | `/api/events/{event_id}` | Edit event series (future occurrences) |
| `DELETE` | `/api/events/{event_id}` | Cancel entire series |

### Occurrences
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events/{event_id}/occurrences` | List occurrences (with pagination) |
| `PUT` | `/api/occurrences/{occurrence_id}` | Override single occurrence (date/time/location) |
| `POST` | `/api/occurrences/{occurrence_id}/skip` | Mark occurrence as skipped (exception) |
| `POST` | `/api/occurrences/{occurrence_id}/cancel` | Cancel single occurrence |
| `POST` | `/api/occurrences/{occurrence_id}/start-game` | Create game_night from occurrence |

### RSVP
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/occurrences/{occurrence_id}/rsvp` | RSVP to occurrence |
| `GET` | `/api/occurrences/{occurrence_id}/invites` | Get invite statuses (host dashboard) |

### Time Proposals
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/occurrences/{occurrence_id}/propose-time` | Invitee proposes new time |
| `POST` | `/api/proposals/{proposal_id}/decide` | Host accepts/declines proposal |

### Utility
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/templates` | List game templates |
| `GET` | `/api/groups/{group_id}/calendar` | Calendar view (all occurrences for group) |
| `POST` | `/api/groups/{group_id}/suggest-schedule` | AI best-time suggestion |

## Request/Response Schemas (Pydantic)

```python
class CreateEventRequest(BaseModel):
    group_id: str
    title: str
    starts_at: datetime
    duration_minutes: int = 180
    location: Optional[str] = None
    game_category: str = "poker"
    template_id: Optional[str] = None
    recurrence: str = "none"           # none | weekly | biweekly | custom
    rrule_weekdays: Optional[List[int]] = None
    rrule_interval: int = 1
    rrule_until: Optional[date] = None
    rrule_count: Optional[int] = None
    default_buy_in: Optional[float] = None
    default_chips_per_buy_in: Optional[int] = None
    invite_scope: str = "group"        # group | selected
    selected_invitees: Optional[List[str]] = None
    notes: Optional[str] = None

class RSVPRequest(BaseModel):
    status: str  # accepted | declined | maybe
    note: Optional[str] = None

class ProposeTimeRequest(BaseModel):
    proposed_starts_at: datetime
    proposed_duration_minutes: Optional[int] = None
    proposed_location: Optional[str] = None
    note: Optional[str] = None

class DecideProposalRequest(BaseModel):
    decision: str  # accepted | declined
```

## API Request/Response JSON Examples

### POST /api/events — Create Event

**Request:**
```json
{
  "group_id": "grp_abc123",
  "title": "Friday Night Poker",
  "starts_at": "2026-03-13T19:00:00-05:00",
  "duration_minutes": 180,
  "location": "Jake's place",
  "game_category": "poker",
  "recurrence": "weekly",
  "rrule_weekdays": [4],
  "rrule_interval": 1,
  "rrule_until": null,
  "default_buy_in": 20.00,
  "default_chips_per_buy_in": 20,
  "invite_scope": "group",
  "notes": "BYOB"
}
```

**Response (201):**
```json
{
  "event_id": "evt_x7k9m2",
  "group_id": "grp_abc123",
  "title": "Friday Night Poker",
  "starts_at": "2026-03-14T00:00:00Z",
  "starts_at_local": "2026-03-13T19:00:00",
  "timezone": "America/New_York",
  "recurrence": "weekly",
  "status": "published",
  "occurrences_generated": 8,
  "invites_sent": 5,
  "next_occurrence": {
    "occurrence_id": "occ_a1b2c3",
    "starts_at": "2026-03-14T00:00:00Z",
    "starts_at_local": "2026-03-13T19:00:00"
  }
}
```

### POST /api/occurrences/{id}/rsvp — RSVP

**Request:**
```json
{
  "status": "accepted",
  "note": "I'll bring chips"
}
```

**Response (200):**
```json
{
  "invite_id": "inv_q8w3e5",
  "occurrence_id": "occ_a1b2c3",
  "status": "accepted",
  "responded_at": "2026-03-11T15:30:00Z",
  "stats": {
    "accepted": 4,
    "declined": 1,
    "maybe": 1,
    "invited": 0,
    "total": 6
  }
}
```

### POST /api/occurrences/{id}/proposals — Propose New Time

**Request:**
```json
{
  "proposed_starts_at": "2026-03-14T18:00:00-05:00",
  "proposed_duration_minutes": 240,
  "note": "Saturday works better for me"
}
```

**Response (201):**
```json
{
  "proposal_id": "prp_m4n5o6",
  "occurrence_id": "occ_a1b2c3",
  "proposed_by": "usr_jane42",
  "proposed_starts_at": "2026-03-14T23:00:00Z",
  "proposed_starts_at_local": "2026-03-14T18:00:00",
  "status": "pending",
  "expires_at": "2026-03-13T23:00:00Z"
}
```

### POST /api/proposals/{id}/accept — Host Accepts Proposal

**Request:**
```json
{}
```

**Response (200):**
```json
{
  "proposal_id": "prp_m4n5o6",
  "status": "accepted",
  "occurrence_id": "occ_a1b2c3",
  "new_starts_at": "2026-03-14T23:00:00Z",
  "new_starts_at_local": "2026-03-14T18:00:00",
  "invitees_notified": 5,
  "rsvps_reset": true
}
```

### GET /api/occurrences?from=2026-03-10&to=2026-04-07&group_id=grp_abc123

**Response (200):**
```json
{
  "occurrences": [
    {
      "occurrence_id": "occ_a1b2c3",
      "event_id": "evt_x7k9m2",
      "title": "Friday Night Poker",
      "starts_at": "2026-03-14T00:00:00Z",
      "starts_at_local": "2026-03-13T19:00:00",
      "duration_minutes": 180,
      "location": "Jake's place",
      "game_category": "poker",
      "status": "upcoming",
      "is_override": false,
      "my_rsvp": "accepted",
      "stats": { "accepted": 4, "declined": 1, "maybe": 1, "invited": 0 },
      "game_id": null,
      "group": { "group_id": "grp_abc123", "name": "High Rollers" },
      "host": { "user_id": "usr_jake77", "name": "Jake" }
    }
  ],
  "total": 4,
  "from": "2026-03-10",
  "to": "2026-04-07"
}
```

### Error Responses

```json
// 403 — Not a group member
{ "detail": "Not a member of this group" }

// 404 — Resource not found
{ "detail": "Occurrence not found" }

// 409 — Conflict (e.g., duplicate RSVP race condition)
{ "detail": "RSVP already recorded", "current_status": "accepted" }

// 422 — Validation error
{ "detail": [{ "loc": ["body", "starts_at"], "msg": "Must be in the future", "type": "value_error" }] }
```

### Idempotency Headers

For mutating endpoints, clients should send `Idempotency-Key: <uuid>`. The backend:
1. Checks `notification_outbox.idempotency_key` / relevant unique constraints
2. If key exists and request succeeded → return cached response (no re-processing)
3. If key doesn't exist → process normally and store result
4. Keys expire after 24h

## Realtime Channels (Socket.IO)

Extend existing `websocket_manager.py`:

| Event | Direction | Payload | When |
|-------|-----------|---------|------|
| `event_created` | server→group | `{event, occurrences}` | New event scheduled |
| `rsvp_updated` | server→group | `{occurrence_id, user_id, status, stats}` | Someone RSVPs |
| `time_proposed` | server→host | `{proposal, occurrence_id}` | Invitee proposes new time |
| `proposal_decided` | server→group | `{proposal, new_starts_at?}` | Host accepts/declines proposal |
| `occurrence_updated` | server→group | `{occurrence_id, changes}` | Occurrence edited/cancelled |
| `event_cancelled` | server→group | `{event_id, reason}` | Entire series cancelled |
| `occurrence_reminder` | server→user | `{occurrence, hours_until}` | 24h/2h reminder |

## Supabase Realtime Subscriptions (Secondary Channel)

Mobile clients subscribe to Supabase Realtime for **reconnect replay**:

```typescript
// In mobile, after Socket.IO connects:
const channel = supabase.channel(`event:${occurrenceId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'event_invites',
    filter: `occurrence_id=eq.${occurrenceId}`
  }, (payload) => {
    // Merge into local state (in case Socket.IO missed it)
    updateInviteStatus(payload.new);
  })
  .subscribe();
```

This ensures: if a user's phone was offline when Socket.IO emitted `rsvp_updated`, the Supabase Realtime subscription catches up on reconnect from the DB source of truth.

## Idempotency Strategy
- `event_invites` has `UNIQUE(occurrence_id, user_id)` — duplicate invite attempts are no-ops.
- RSVP endpoint uses upsert on `event_invites` + append to `rsvp_history`.
- Occurrence generation uses `UNIQUE(event_id, occurrence_index)` — re-running generation is safe.
- All mutations log to `audit_logs` with `entity_type = 'scheduled_event'`.

---

# D) Scheduling Engine Design

## Occurrence Generation

**Strategy: Rolling window materialization**

When an event is created or updated:
1. Generate `event_occurrences` rows for the next **8 weeks** (or until `rrule_until`/`rrule_count`).
2. A daily background job extends the window — generates new occurrences as dates approach.
3. Each occurrence gets invites auto-created (copying from `invite_scope`).

**Generation algorithm (Python pseudocode):**
```python
def generate_occurrences(event, from_date, weeks_ahead=8):
    if event.recurrence == 'none':
        yield Occurrence(starts_at=event.starts_at, index=0)
        return

    current = event.starts_at
    end = from_date + timedelta(weeks=weeks_ahead)
    if event.rrule_until:
        end = min(end, event.rrule_until)

    index = 0
    while current <= end:
        if event.rrule_count and index >= event.rrule_count:
            break
        yield Occurrence(starts_at=current, index=index)
        index += 1
        current += timedelta(weeks=event.rrule_interval)
```

**Overrides & Exceptions:**
- **Exception (skip)**: Set `is_exception = TRUE` on the occurrence. Invites are not sent. UI shows "Skipped" state.
- **Override (change one)**: Set `is_override = TRUE`, update `starts_at`/`location`/`duration_minutes`. Existing invites are notified of change.
- **Series edit**: When host edits the series, only **future unstarted** occurrences are regenerated. Past/active occurrences are untouched.

## Background Jobs

Leveraging existing `scheduled_jobs` table:

| Job Type | Schedule | Action |
|----------|----------|--------|
| `extend_occurrences` | Daily 3am UTC | Generate occurrences for events entering the 8-week window |
| `send_reminder_24h` | Hourly | Find occurrences starting in 23-25h, send reminders to non-responders |
| `send_reminder_2h` | Every 15min | Find occurrences starting in 1.75-2.25h, send final reminder |
| `detect_low_attendance` | Daily 6pm UTC | For occurrences in next 48h with <50% accepted, notify host |
| `mark_no_response` | Hourly | For occurrences starting in <1h, flip remaining `invited` → `no_response` |
| `expire_proposals` | Hourly | Expire pending proposals older than 48h |
| `followup_non_responders` | Daily 10am UTC | Send follow-up to users who haven't responded 48h+ after invite |

Implementation: Add job entries via `scheduled_jobs` table. A lightweight cron runner (`backend/ai_service/proactive_scheduler.py` pattern) polls and executes.

**All notification-producing jobs write to `notification_outbox`** (not directly to push). A separate `drain_outbox` loop (runs every 30s) processes pending entries, sends via Expo Push API, and marks as `sent`. This guarantees:
- Crash recovery: pending entries survive restarts
- No duplicates: `idempotency_key` constraint
- Retry with backoff: `attempts` counter + exponential delay
- Audit trail: every notification attempt is logged

## Timezone Handling (Critical — DST-Safe)

**Core principle**: Store the human's intent (`local_start_time` + `timezone`), then derive UTC per-occurrence-date.

- `scheduled_events.local_start_time` = `TIME` (e.g., `19:00`) — what the host *means*.
- `scheduled_events.timezone` = IANA tzid (e.g., `America/New_York`).
- `event_occurrences.starts_at` = `TIMESTAMPTZ` (UTC) — computed at generation time.

**DST handling in occurrence generation**:
```python
import zoneinfo

def local_to_utc(local_date: date, local_time: time, tzid: str) -> datetime:
    tz = zoneinfo.ZoneInfo(tzid)
    local_dt = datetime.combine(local_date, local_time, tzinfo=tz)
    return local_dt.astimezone(timezone.utc)
```
This means "every Saturday at 7pm ET" generates:
- Mar 8 (EST): 7:00 PM → **00:00 UTC Mar 9**
- Mar 15 (EDT after spring forward): 7:00 PM → **23:00 UTC Mar 15**

The UTC times differ because of DST, but the local time stays 7pm. This is correct.

- API responses include both `starts_at` (UTC) and `starts_at_local` (re-derived from event timezone) for display.
- Invitee sees times in their own timezone (client-side conversion). The mobile app converts using `Intl.DateTimeFormat` or a date library.
- **Edge case**: If a DST transition makes a time ambiguous (e.g., 1:30 AM during fall-back), use the *first* occurrence of that time (standard time behavior in `zoneinfo`).

## Conflict Detection (Optional, Phase 4)

- Before confirming RSVP, check if user has another accepted occurrence at the same time.
- Query: `SELECT * FROM event_invites ei JOIN event_occurrences eo ON ... WHERE ei.user_id = ? AND ei.status = 'accepted' AND eo.starts_at BETWEEN ? AND ?`
- If conflict found, show warning (not blocking).

---

# E) UI/UX Design System + Screens

## Design Tokens (Extending Liquid Glass)

All new screens use existing tokens from `mobile/src/styles/liquidGlass.ts`. New additions:

```typescript
// Add to COLORS
export const SCHEDULE_COLORS = {
  invited: COLORS.text.muted,        // #8E8E8E (gray dot)
  accepted: COLORS.status.success,   // #22C55E (green dot)
  declined: COLORS.status.danger,    // #EF4444 (red dot)
  maybe: COLORS.status.warning,      // #F59E0B (amber dot)
  proposed: COLORS.trustBlue,        // #3B82F6 (blue dot)
  noResponse: COLORS.text.muted,     // #8E8E8E (gray outline dot)
};
```

**Accessibility**: All RSVP status colors pass WCAG AA contrast on dark backgrounds. Touch targets ≥44pt. Labels accompany all color indicators.

## Screens

### 1. Scheduler Entry Point — `SchedulerScreen.tsx`

**Location**: New tab or accessible from Dashboard + GroupHub.

**Layout**:
```
┌──────────────────────────┐
│  PageHeader "Schedule"    │
├──────────────────────────┤
│  [Month Calendar Strip]  │  ← horizontal scrollable week view
│  Mo Tu We Th Fr Sa Su    │
│  ·  ·  ●  ·  ●  ·  ·   │  ← dots = events on that day
├──────────────────────────┤
│  Upcoming                │
│  ┌────────────────────┐  │
│  │ GlassSurface       │  │
│  │ 🃏 Friday Night     │  │
│  │ Mar 7 · 7:00 PM    │  │
│  │ High Rollers        │  │
│  │ ● 4 going · ○ 2 ?  │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ ...next event...   │  │
│  └────────────────────┘  │
├──────────────────────────┤
│  [+ Schedule Game] FAB   │  ← orange gradient, bottom right
└──────────────────────────┘
```

**Components**: PageHeader, horizontal DateStrip (new), GlassSurface event cards, FAB.

### 2. Create Game Wizard — `CreateEventScreen.tsx`

Multi-step wizard using a single screen with animated step transitions.

**Step 1: Group Selection**
```
┌──────────────────────────┐
│  ← New Game              │
│                          │
│  Which group?            │
│  ┌────────────────────┐  │
│  │ ○ High Rollers     │  │
│  │ ○ Friday Crew      │  │
│  │ ○ Family Game Night │  │
│  └────────────────────┘  │
│                          │
│  [Next →]                │
└──────────────────────────┘
```

**Step 2: Date & Time**
```
┌──────────────────────────┐
│  ← When?                 │
│                          │
│  [Date Picker]           │
│  [Time Picker]           │
│                          │
│  💡 "Your group usually  │
│     plays Saturdays at   │
│     7 PM"                │  ← AI suggestion chip
│                          │
│  [Next →]                │
└──────────────────────────┘
```

**Step 3: Recurrence (optional)**
```
┌──────────────────────────┐
│  ← Repeat?               │
│                          │
│  ○ Just this once        │
│  ○ Every week            │
│  ○ Every 2 weeks         │
│  ○ Custom...             │
│                          │
│  Ends: ○ Never           │
│        ○ After __ games  │
│        ○ On [date]       │
│                          │
│  [Next →]                │
└──────────────────────────┘
```

**Step 4: Game Details**
```
┌──────────────────────────┐
│  ← Details               │
│                          │
│  Game type               │
│  [Poker ▾]               │
│                          │
│  Title                   │
│  [GlassInput: "Friday    │
│   Night Poker"]          │
│                          │
│  Location (optional)     │
│  [GlassInput]            │
│                          │
│  Buy-in                  │
│  [$20 ▾]                 │
│                          │
│  [Next →]                │
└──────────────────────────┘
```

**Step 5: Review & Send**
```
┌──────────────────────────┐
│  ← Review                │
│                          │
│  GlassSurface:           │
│  🃏 Friday Night Poker   │
│  📅 Sat Mar 8, 7:00 PM  │
│  🔁 Every week           │
│  📍 Jake's place         │
│  💰 $20 buy-in           │
│  👥 High Rollers (6)     │
│                          │
│  [Schedule & Invite]     │  ← primary orange GlassButton
└──────────────────────────┘
```

### 3. Recurrence Picker — embedded in Step 3

Uses radio buttons + conditional inputs. Custom mode reveals:
- Day-of-week multi-select chips (Mon–Sun)
- Interval stepper ("Every ___ weeks")
- End condition toggle

### 4. Invite Status Dashboard — `EventDashboardScreen.tsx`

Host sees this after creating an event or tapping an event card.

```
┌──────────────────────────┐
│  PageHeader "Mar 8"      │
│  Friday Night Poker      │
├──────────────────────────┤
│  ● 4 Accepted            │
│  ◐ 1 Maybe               │
│  ✕ 1 Declined            │
│  ○ 2 Waiting             │
├──────────────────────────┤
│  GlassSurface: Responses │
│  ┌────────────────────┐  │
│  │ ● Jake    Accepted │  │
│  │ ● Sarah   Accepted │  │
│  │ ◐ Mike    Maybe    │  │
│  │ ✕ Amy     Declined │  │
│  │ ○ Tom     Invited  │  │  ← "Nudge" button
│  │ ○ Chris   Invited  │  │
│  └────────────────────┘  │
├──────────────────────────┤
│  Proposals (1)           │
│  ┌────────────────────┐  │
│  │ 🕐 Amy suggests    │  │
│  │ Sun Mar 9, 6 PM    │  │
│  │ [Accept] [Decline] │  │
│  └────────────────────┘  │
├──────────────────────────┤
│ [Send Reminder] [Cancel] │
│ [Start Game]             │  ← appears when starts_at passed
└──────────────────────────┘
```

### 5. Invitee RSVP Screen — `RSVPScreen.tsx`

Reached via push notification deep link or from event card.

```
┌──────────────────────────┐
│  You're invited!         │
│                          │
│  🃏 Friday Night Poker   │
│  📅 Sat Mar 8, 7:00 PM  │
│  📍 Jake's place         │
│  💰 $20 buy-in           │
│  👥 4 going · 2 waiting  │
│                          │
│  ┌──────────┬──────────┐ │
│  │ ✓ I'm in │ ✕ Can't  │ │
│  └──────────┴──────────┘ │
│  ┌──────────┬──────────┐ │
│  │ ? Maybe  │ 🕐 Suggest│ │
│  │          │  new time │ │
│  └──────────┴──────────┘ │
└──────────────────────────┘
```

**4 buttons in a 2×2 grid**: Accept (green), Decline (red), Maybe (amber), Propose Time (blue). Each is a GlassButton with icon. Haptic feedback on tap.

### 6. Propose New Time Flow

Tapping "Suggest new time" opens a bottom sheet:

```
┌──────────────────────────┐
│  Suggest a better time   │
│                          │
│  [Date Picker]           │
│  [Time Picker]           │
│                          │
│  Note (optional)         │
│  [GlassInput: "Sunday    │
│   works better for me"]  │
│                          │
│  [Send Suggestion]       │
└──────────────────────────┘
```

### Microcopy Examples

- Invite notification: **"Jake scheduled Friday Night Poker — Sat Mar 8 at 7 PM. You in?"**
- RSVP confirmation: **"You're in! See you Saturday."**
- Decline: **"Got it. We'll miss you!"**
- Maybe: **"Noted. We'll keep your spot."**
- Reminder (24h): **"Game night tomorrow at 7 PM. Still coming?"**
- Low attendance: **"Only 3 confirmed for Saturday. Want to reschedule?"**
- Proposal accepted: **"Jake moved the game to Sunday 6 PM based on your suggestion."**

### Navigation Updates

Add to `RootStackParamList`:
```typescript
Scheduler: undefined;
CreateEvent: { groupId?: string };
EventDashboard: { occurrenceId: string };
RSVP: { occurrenceId: string };
```

Add to `RootNavigator.tsx` (inside authenticated stack):
```tsx
<Stack.Screen name="Scheduler" component={SchedulerScreen} options={{ headerShown: false }} />
<Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
<Stack.Screen name="EventDashboard" component={EventDashboardScreen} options={{ headerShown: false }} />
<Stack.Screen name="RSVP" component={RSVPScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
```

---

# F) Tools + Agents (AI Control Layer)

## Tools (callable by AI orchestrator)

These extend the existing tool registry in `backend/ai_service/tools/`.

### `suggest_best_time`
```python
{
  "name": "suggest_best_time",
  "description": "Suggest optimal time slots for a game based on group history and patterns",
  "parameters": {
    "group_id": "string (required)",
    "game_category": "string (optional, default: poker)",
    "constraints": {
      "earliest_date": "ISO date (optional)",
      "latest_date": "ISO date (optional)",
      "preferred_days": "int[] (optional, 0=Mon..6=Sun)",
      "avoid_conflicts": "bool (default: true)"
    }
  },
  "returns": "TimeSuggestion[] (top 3, scored)"
}
```
**Implementation**: Extends existing `SmartSchedulerService.suggest_times()`.

### `detect_low_attendance`
```python
{
  "name": "detect_low_attendance",
  "description": "Check if an upcoming occurrence has low RSVP acceptance rate",
  "parameters": {
    "occurrence_id": "string (required)"
  },
  "returns": {
    "is_low": "bool",
    "accepted_count": "int",
    "total_invited": "int",
    "acceptance_rate": "float",
    "recommendation": "string (reschedule | send_reminder | proceed)"
  }
}
```

### `draft_followup_message`
```python
{
  "name": "draft_followup_message",
  "description": "Draft a follow-up message for non-responders",
  "parameters": {
    "occurrence_id": "string (required)",
    "tone": "string (optional: casual | urgent, default: casual)"
  },
  "returns": {
    "message": "string",
    "target_user_ids": "string[]"
  }
}
```

### `propose_alternate_slots`
```python
{
  "name": "propose_alternate_slots",
  "description": "Generate alternate time slots when attendance is low",
  "parameters": {
    "occurrence_id": "string (required)",
    "range_days": "int (default: 7)"
  },
  "returns": "TimeSuggestion[] (top 3, optimized for declined/maybe users' patterns)"
}
```

### `summarize_responses`
```python
{
  "name": "summarize_responses",
  "description": "Generate a human-readable summary of RSVP responses",
  "parameters": {
    "occurrence_id": "string (required)"
  },
  "returns": {
    "summary": "string",
    "stats": { "accepted": "int", "declined": "int", "maybe": "int", "invited": "int" },
    "notable": "string[] (e.g., 'Amy proposed Sunday instead')"
  }
}
```

## Agents

### Host Copilot Agent
**When**: During event creation and when viewing the dashboard.
**Actions**: Suggests best times, auto-fills game details from templates, warns about conflicts.
**Extends**: Existing `GamePlannerAgent` in `backend/ai_service/agents/game_planner_agent.py`.

### RSVP Nudge Agent
**When**: Background job triggers when non-responders detected 48h+ after invite.
**Actions**: Sends personalized follow-up notifications. Escalates to host if no response after 2nd nudge.
**Extends**: Existing `RSVPTrackerService.send_rsvp_reminders()` in `backend/ai_service/rsvp_tracker.py`.

### Reschedule Negotiator Agent
**When**: Triggered when a time proposal is submitted, or when low attendance is detected.
**Actions**: Analyzes proposal against other members' patterns, drafts recommendation to host, finds compromise slots.
**New**: `backend/ai_service/agents/reschedule_agent.py`.

## Safety & Guardrails

- **Draft-first pattern**: Every AI-generated message (nudges, follow-ups, reschedule suggestions) is created as a **draft**. The host sees it and can:
  - **One-tap approve** → sends immediately
  - **Edit + approve** → sends modified version
  - **Auto-send** → opt-in setting per event series (`auto_send_nudges: boolean` on `scheduled_events`). Even with auto-send, the host sees a log of what was sent.
- **Rate limits**: Max 2 nudges per user per occurrence. Max 1 follow-up per day per user across all events. Enforced via `notification_outbox.idempotency_key`.
- **Quiet hours**: Respect `engagement_settings.quiet_hours_start/end` — no notifications during quiet hours. Outbox entries created but delivery deferred.
- **User consent**: Users can toggle `ai_scheduling_nudges` in notification preferences. If disabled, they get invites and manual reminders but no AI-generated follow-ups.
- **No spam**: AI never sends messages to group chat without host approval. Nudges are direct push notifications only.
- **Deterministic fallback**: All scheduling, RSVP, and invite features work fully without AI. AI only adds suggestions, follow-ups, and smart defaults. If Claude API is unavailable, the system degrades gracefully — no features break. Reminder jobs are deterministic (no AI needed).

---

# G) Notification System

## Push Token Storage

Expo push tokens are stored on `user_notification_settings.expo_push_token`. Updated via:
- `PUT /api/users/me/push-token` — called on app launch and token refresh
- Token rotation: if Expo returns `DeviceNotRegistered`, clear the token and prompt re-registration

## Delivery Flow

```
Background Job (e.g., send_reminder_24h)
  │
  ▼
notification_outbox INSERT
  (idempotency_key: "remind:24h:{occ_id}:{user_id}")
  (status: 'pending')
  │
  ▼
drain_outbox loop (runs every 30s)
  │
  ├─── Check quiet hours (user_notification_settings.quiet_hours_start/end)
  │    └─── If in quiet hours → set status='deferred', skip
  │
  ├─── Check consent toggle (e.g., event_reminders = false → skip)
  │
  ├─── Resolve push token from user_notification_settings.expo_push_token
  │
  ├─── Send via Expo Push API (batch up to 100 per request)
  │    └─── On success → status='sent', sent_at=NOW()
  │    └─── On failure → attempts++, last_attempt_at=NOW()
  │         └─── If attempts >= max_attempts → status='failed'
  │         └─── Else → stays 'pending' (retried next cycle with backoff)
  │
  └─── Simultaneously: INSERT into notifications table (in-app)
       + Socket.IO emit to user's room
```

## Idempotency Key Patterns

| Notification Type | Key Pattern | Example |
|-------------------|-------------|---------|
| Event invite | `invite:{occ_id}:{user_id}` | `invite:occ_a1b2c3:usr_jane42` |
| 24h reminder | `remind:24h:{occ_id}:{user_id}` | `remind:24h:occ_a1b2c3:usr_jane42` |
| 2h reminder | `remind:2h:{occ_id}:{user_id}` | `remind:2h:occ_a1b2c3:usr_jane42` |
| RSVP nudge | `nudge:{occ_id}:{user_id}:{attempt}` | `nudge:occ_a1b2c3:usr_jane42:1` |
| RSVP to host | `rsvp_notify:{occ_id}:{user_id}` | `rsvp_notify:occ_a1b2c3:usr_jane42` |
| Proposal to host | `proposal:{proposal_id}` | `proposal:prp_m4n5o6` |
| Reschedule notice | `reschedule:{occ_id}:{user_id}` | `reschedule:occ_a1b2c3:usr_jane42` |

## Failure Handling

- **Expo ticket errors**: Check `ExpoPushTicket.status`. If `error` with `DeviceNotRegistered`, clear the push token.
- **Receipt polling**: After sending, poll receipts after 15min. If receipt shows failure, log and potentially retry.
- **Retry backoff**: Attempts at 30s, 2min, 10min (3 attempts total). After 3 failures, mark as `failed` and log to `audit_logs`.
- **Deferred (quiet hours)**: Deferred notifications re-enter the queue when quiet hours end. The drain loop checks: `WHERE status IN ('pending', 'deferred') AND (deferred_until IS NULL OR deferred_until <= NOW())`.

## In-App Notifications

Every outbox entry also creates a row in the existing `notifications` table:
```sql
INSERT INTO notifications (notification_id, user_id, type, title, message, data)
VALUES ('ntf_...', 'usr_jane42', 'event_reminder', 'Game tonight!',
        'Friday Night Poker starts in 2 hours', '{"occurrence_id": "occ_a1b2c3"}');
```
Plus a Socket.IO emit: `emit_notification(user_id, payload)` — already supported.

---

# H) Unified Design Tokens (Mobile RN + Web Tailwind)

The existing `mobile/src/styles/liquidGlass.ts` is the source of truth for mobile tokens. We define a unified JSON token set and generate both an RN adapter and Tailwind CSS variables from it. New scheduler screens consume these tokens.

## Token JSON (Source of Truth)

```json
{
  "colors": {
    "background": "#0a0a0a",
    "surface": "#282B2B",
    "surfaceAlt": "#323535",
    "glass": {
      "bg": "rgba(255, 255, 255, 0.06)",
      "border": "rgba(255, 255, 255, 0.12)",
      "inner": "rgba(255, 255, 255, 0.03)"
    },
    "brand": { "orange": "#EE6C29", "orangeDark": "#C45A22" },
    "accent": { "blue": "#3B82F6", "moonstone": "#7AA6B3" },
    "text": { "primary": "#F5F5F5", "secondary": "#B8B8B8", "muted": "#8E8E8E" },
    "status": {
      "success": "#22C55E", "danger": "#EF4444",
      "warning": "#F59E0B", "info": "#3B82F6"
    },
    "schedule": {
      "invited": "#8E8E8E",
      "accepted": "#22C55E",
      "declined": "#EF4444",
      "maybe": "#F59E0B",
      "proposed": "#3B82F6",
      "noResponse": "#8E8E8E"
    }
  },
  "typography": {
    "sizes": { "h1": 28, "h2": 24, "h3": 18, "body": 16, "bodySmall": 14, "caption": 12, "micro": 11 },
    "weights": { "regular": "400", "medium": "500", "semiBold": "600", "bold": "700" },
    "lineHeights": { "tight": 1.2, "normal": 1.5, "relaxed": 1.6 }
  },
  "spacing": { "xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 20, "xxl": 24, "xxxl": 28 },
  "radii": { "sm": 8, "md": 12, "lg": 16, "xl": 20, "xxl": 24, "full": 9999 },
  "shadows": {
    "card": { "color": "rgba(255,255,255,0.1)", "offset": [0, 2], "opacity": 0.8, "radius": 4 },
    "floating": { "color": "#000", "offset": [0, 20], "opacity": 0.4, "radius": 40 },
    "button": { "color": "#000", "offset": [0, 4], "opacity": 0.2, "radius": 8 }
  },
  "motion": {
    "springs": {
      "bouncy": { "damping": 12, "stiffness": 120, "mass": 0.8 },
      "press": { "damping": 8, "stiffness": 200, "mass": 0.5 },
      "layout": { "damping": 14, "stiffness": 150, "mass": 0.6 }
    },
    "durations": { "fast": 100, "normal": 200, "slow": 300 }
  },
  "accessibility": {
    "minTouchTarget": 44,
    "minBodyFontSize": 16,
    "minContrastRatio": 4.5
  }
}
```

## React Native Adapter (extends liquidGlass.ts)

Add to `mobile/src/styles/liquidGlass.ts`:

```typescript
// Schedule-specific RSVP status colors
export const SCHEDULE_COLORS = {
  invited: COLORS.text.muted,
  accepted: COLORS.status.success,
  declined: COLORS.status.danger,
  maybe: COLORS.status.warning,
  proposed: COLORS.trustBlue,
  noResponse: COLORS.text.muted,
} as const;

// Schedule-specific component styles
export const SCHEDULE_STYLES = {
  rsvpDot: (status: keyof typeof SCHEDULE_COLORS) => ({
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SCHEDULE_COLORS[status],
  }),
  dateStrip: {
    dayCell: {
      width: 44,
      height: 64,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: RADIUS.md,
    },
    dayText: {
      fontSize: TYPOGRAPHY.sizes.caption,
      color: COLORS.text.muted,
    },
    dateText: {
      fontSize: TYPOGRAPHY.sizes.body,
      fontWeight: TYPOGRAPHY.weights.semiBold,
      color: COLORS.text.primary,
    },
    selected: {
      backgroundColor: COLORS.orange,
    },
    eventDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: COLORS.orange,
      marginTop: 2,
    },
  },
  rsvpButton: {
    accept: { backgroundColor: COLORS.status.success },
    decline: { backgroundColor: COLORS.status.danger },
    maybe: { backgroundColor: COLORS.status.warning },
    propose: { backgroundColor: COLORS.trustBlue },
  },
} as const;
```

## Web Tailwind CSS Variables

Add to `frontend/src/index.css` (or global CSS):

```css
:root {
  /* Schedule status colors */
  --schedule-invited: #8E8E8E;
  --schedule-accepted: #22C55E;
  --schedule-declined: #EF4444;
  --schedule-maybe: #F59E0B;
  --schedule-proposed: #3B82F6;
  --schedule-no-response: #8E8E8E;
}
```

Add to `tailwind.config.js`:
```js
extend: {
  colors: {
    schedule: {
      invited: 'var(--schedule-invited)',
      accepted: 'var(--schedule-accepted)',
      declined: 'var(--schedule-declined)',
      maybe: 'var(--schedule-maybe)',
      proposed: 'var(--schedule-proposed)',
    }
  }
}
```

## Accessibility Rules (Scheduler-Specific)

- All RSVP buttons: min 44x44pt touch targets
- Status colors always paired with text labels (never color-only)
- Date strip: horizontal scroll with `accessibilityRole="list"`, each day `accessibilityRole="button"`
- Time displays: use `accessibilityLabel` with full date/time (e.g., "Saturday March 8th at 7:00 PM Eastern")
- Haptic feedback: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` on RSVP tap
- Dynamic type: all text sizes scale with system accessibility settings

---

# I) Implementation Plan (Phased)

## Phase 1: One-Time Scheduling + Basic Invites + RSVP + Push

### Database Migration
- File: `supabase/migrations/015_game_scheduler.sql`
- Creates: `game_templates`, `scheduled_events`, `event_occurrences`, `event_invites`, `rsvp_history`, `time_proposals` tables + enums + indexes
- Alters: `game_nights` add `event_occurrence_id` column

### API Endpoints
- `POST /api/events` — create one-time event + generate single occurrence + create invites
- `GET /api/events` — list upcoming events for user
- `GET /api/events/{event_id}` — event detail
- `POST /api/occurrences/{id}/rsvp` — RSVP (accept/decline/maybe)
- `GET /api/occurrences/{id}/invites` — invite status list
- `POST /api/occurrences/{id}/start-game` — create game_night from occurrence
- `GET /api/templates` — list game templates
- `GET /api/groups/{group_id}/calendar` — calendar data

### UI Screens
- `SchedulerScreen.tsx` — calendar strip + upcoming list
- `CreateEventScreen.tsx` — wizard (steps 1-2, 4-5; skip recurrence)
- `EventDashboardScreen.tsx` — invite status dashboard
- `RSVPScreen.tsx` — invitee RSVP view
- Navigation updates in `RootNavigator.tsx`
- Deep link handler for `event_invite` notification type

### Push Notifications
- On event creation: push to all invitees
- On RSVP: push to host
- 24h and 2h reminders via `scheduled_jobs`

### Test Plan
- Unit: occurrence generation, RSVP state machine, invite creation
- Integration: create event → invite → RSVP → start game flow
- E2E: push notification delivery, deep link to RSVP screen

### Analytics Events
- `event_created`, `event_rsvp`, `event_started`, `event_cancelled`

---

## Phase 2: Recurring Schedules + Occurrence Engine

### Database Migration
- Seed system `game_templates` (poker, rummy, blackjack, etc.)

### API Endpoints
- `PUT /api/events/{event_id}` — edit series
- `PUT /api/occurrences/{id}` — override single occurrence
- `POST /api/occurrences/{id}/skip` — exception
- `DELETE /api/events/{event_id}` — cancel series

### Backend Engine
- Occurrence generator function (RRULE-lite) in `backend/scheduling_engine.py`
- Daily `extend_occurrences` background job
- DST-aware timezone conversion for occurrence dates
- Series edit logic: regenerate future occurrences only

### UI Screens
- Add recurrence picker (Step 3) to `CreateEventScreen.tsx`
- Series management in `EventDashboardScreen.tsx` (edit series / edit this one / cancel series)
- Recurring event badge on calendar strip

### Test Plan
- Unit: RRULE generation for weekly, biweekly, custom patterns
- Unit: DST boundary handling (spring forward, fall back)
- Unit: Exception and override behavior
- Integration: create recurring → skip one → override one → edit series

### Analytics Events
- `recurring_event_created`, `occurrence_skipped`, `occurrence_overridden`, `series_edited`

---

## Phase 3: Reschedule Proposals + Host Approval + Realtime

### API Endpoints
- `POST /api/occurrences/{id}/propose-time` — invitee proposes
- `POST /api/proposals/{id}/decide` — host accepts/declines

### WebSocket Events
- `rsvp_updated`, `time_proposed`, `proposal_decided`, `occurrence_updated`
- Extend `websocket_manager.py` with event room management

### Backend
- Proposal acceptance flow: update occurrence `starts_at`, notify all invitees, reset RSVPs to `invited`
- Proposal expiry job (48h timeout)

### UI Screens
- Propose Time bottom sheet in `RSVPScreen.tsx`
- Proposals section in `EventDashboardScreen.tsx` with Accept/Decline buttons
- Real-time RSVP counter updates via Socket.IO

### Test Plan
- Unit: proposal state machine (pending → accepted/declined/expired)
- Integration: propose → accept → occurrence updated → invitees re-notified
- E2E: real-time RSVP counter updates in host dashboard

### Analytics Events
- `time_proposed`, `proposal_accepted`, `proposal_declined`

---

## Phase 4: AI Tools/Agents + Smart Suggestions

### Backend
- `backend/ai_service/tools/schedule_tools.py` — implement 5 tools (suggest_best_time, detect_low_attendance, draft_followup, propose_alternates, summarize_responses)
- `backend/ai_service/agents/reschedule_agent.py` — Reschedule Negotiator
- Extend `game_planner_agent.py` for Host Copilot scheduling features
- Extend `rsvp_tracker.py` for smart nudge logic
- Background jobs: `detect_low_attendance`, `followup_non_responders`

### UI
- AI suggestion chip in `CreateEventScreen.tsx` date picker step
- "AI suggests" banner in `EventDashboardScreen.tsx` when attendance is low
- Smart defaults in game creation (prefill from template + group patterns)

### Test Plan
- Unit: each tool with mock data
- Integration: low attendance detection → host notification → AI suggestion
- E2E: create event → 48h passes (simulated) → AI follow-up sent

### Analytics Events
- `ai_time_suggested`, `ai_followup_sent`, `ai_reschedule_suggested`

---

# J) Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Scheduler │ │CreateEvt │ │EventDash │ │  RSVP     │  │
│  │Screen    │ │Screen    │ │Screen    │ │  Screen   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │             │            │              │        │
│  ┌────┴─────────────┴────────────┴──────────────┴────┐  │
│  │              API Client + Socket.IO               │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │           Expo Push Notifications                  │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS + WSS
                           ▼
┌──────────────────────────────────────────────────────────┐
│               BACKEND (FastAPI + Socket.IO)               │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Event API   │  │  RSVP API    │  │ Proposal API  │  │
│  │  /api/events │  │  /api/../rsvp│  │ /api/proposals│  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│  ┌──────┴─────────────────┴───────────────────┴───────┐  │
│  │              Scheduling Engine                      │  │
│  │  (occurrence gen, RRULE, TZ, overrides/exceptions) │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────┴─────────────────────────────┐  │
│  │            WebSocket Manager (Socket.IO)            │  │
│  │  rsvp_updated · time_proposed · occurrence_updated  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              AI Service Layer                       │  │
│  │  ┌────────────┐ ┌────────────┐ ┌───────────────┐  │  │
│  │  │Host Copilot│ │RSVP Nudge │ │Reschedule     │  │  │
│  │  │Agent       │ │Agent       │ │Negotiator     │  │  │
│  │  └────────────┘ └────────────┘ └───────────────┘  │  │
│  │  Tools: suggest_best_time, detect_low_attendance,  │  │
│  │         draft_followup, propose_alternates,        │  │
│  │         summarize_responses                        │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                 SUPABASE (PostgreSQL)                     │
│                                                          │
│  ┌─────────────────┐  ┌──────────────────┐              │
│  │scheduled_events  │  │event_occurrences  │              │
│  │(series/one-time) │──│(materialized dates)│              │
│  └─────────────────┘  └────────┬─────────┘              │
│                                │                         │
│  ┌──────────────┐  ┌──────────┴───────┐  ┌───────────┐ │
│  │event_invites  │  │time_proposals    │  │rsvp_history│ │
│  │(per-user RSVP)│  │(reschedule reqs) │  │(audit log) │ │
│  └──────────────┘  └──────────────────┘  └───────────┘ │
│                                                          │
│  Existing: game_nights · players · groups · users ·     │
│            notifications · scheduled_jobs · polls        │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Supabase Auth                       │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│            BACKGROUND JOB RUNNER (Cron)                   │
│                                                          │
│  Daily:  extend_occurrences · detect_low_attendance      │
│          followup_non_responders                         │
│  Hourly: send_reminder_24h · mark_no_response            │
│          expire_proposals                                │
│  15min:  send_reminder_2h                                │
│                                                          │
│  Implementation: proactive_scheduler.py polls            │
│  scheduled_jobs table                                    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│            NOTIFICATION SERVICE                           │
│                                                          │
│  Expo Push API → iOS/Android push notifications          │
│  In-app: notifications table + Socket.IO emit            │
│  Email: Resend (for event summaries, optional)           │
└──────────────────────────────────────────────────────────┘
```

---

# K) Edge Cases Addressed

| Edge Case | Handling |
|-----------|----------|
| **DST change** | Occurrences generated per-date with timezone conversion; "7pm ET" stays 7pm across DST |
| **User timezone travel** | Invitee sees times in their `users.timezone`; host's timezone is the event's canonical TZ |
| **Host edits series vs one** | UI asks "This event only" or "This and future events"; series edit regenerates future only |
| **User removed from group** | On `group_members` delete, cascade to cancel their pending `event_invites` (set `status='declined'`, `reason='removed_from_group'`) |
| **User re-invited** | If user was removed then re-added, new invites are created for future occurrences |
| **Duplicate notifications** | `UNIQUE(occurrence_id, user_id)` on invites prevents duplicates; reminder flags prevent re-sending |
| **Offline mode** | RSVP queued locally, synced on reconnect; optimistic UI updates |
| **Proposal after game started** | Proposals auto-expire when occurrence `status = 'active'` |
| **All decline** | If 100% declined, AI suggests cancelling or rescheduling to host |
| **Host cancels during RSVPs** | All invitees notified; occurrence marked `cancelled`; no game_night created |

---

# Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/015_game_scheduler.sql` | All new tables, enums, indexes |
| `backend/scheduling_engine.py` | Occurrence generation, RRULE logic, TZ handling |
| `backend/ai_service/tools/schedule_tools.py` | 5 AI tools for scheduling |
| `backend/ai_service/agents/reschedule_agent.py` | Reschedule Negotiator agent |
| `mobile/src/screens/SchedulerScreen.tsx` | Calendar + upcoming list |
| `mobile/src/screens/CreateEventScreen.tsx` | Multi-step event creation wizard |
| `mobile/src/screens/EventDashboardScreen.tsx` | Host invite dashboard |
| `mobile/src/screens/RSVPScreen.tsx` | Invitee RSVP view |
| `mobile/src/components/DateStrip.tsx` | Horizontal week calendar strip |
| `docs/game-scheduler-spec.md` | This spec (committed to repo) |

### Modified Files
| File | Changes |
|------|---------|
| `backend/server.py` | Add ~12 new API endpoints, Pydantic models |
| `backend/websocket_manager.py` | Add event room management, 6 new emit functions |
| `backend/ai_service/agents/game_planner_agent.py` | Extend for Host Copilot |
| `backend/ai_service/rsvp_tracker.py` | Extend for smart nudge with new tables |
| `backend/ai_service/tools/registry.py` | Register 5 new tools |
| `backend/ai_service/agents/registry.py` | Register reschedule agent |
| `mobile/src/navigation/RootNavigator.tsx` | Add 4 new screens to stack |
| `mobile/src/styles/liquidGlass.ts` | Add `SCHEDULE_COLORS` |
| `mobile/src/i18n/translations.ts` | Add scheduler translation keys |
| `mobile/src/services/pushNotifications.ts` | Add deep link handlers for event notifications |

### Existing Code to Reuse
| File | What to reuse |
|------|---------------|
| `backend/ai_service/smart_scheduler.py` | `SmartSchedulerService` for time suggestions |
| `backend/ai_service/rsvp_tracker.py` | `RSVPTrackerService` patterns for backup suggestions |
| `backend/ai_service/agents/game_planner_agent.py` | `GamePlannerAgent` patterns and context gathering |
| `backend/ai_service/proactive_scheduler.py` | Job polling pattern for background cron |
| `mobile/src/components/ui/*` | All existing Liquid Glass components |
| `mobile/src/styles/liquidGlass.ts` | Full design system tokens |

---

# Verification Plan

1. **Migration**: Run `supabase db push` or apply migration SQL. Verify tables created with `\dt` in psql.
2. **API smoke test**: `pytest backend/tests/test_scheduler.py` — create event, RSVP, start game flow.
3. **Recurrence test**: Generate occurrences for weekly/biweekly, verify DST handling, test exceptions/overrides.
4. **Mobile type check**: `npx tsc --noEmit` from `mobile/` — verify no new type errors.
5. **E2E**: Create event → receive push → RSVP → host sees update → start game → verify game_nights row created.
6. **Syntax check**: `python -c "import ast; ast.parse(open('file.py').read())"` on all modified Python files.
