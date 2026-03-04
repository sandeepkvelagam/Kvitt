# Game Scheduler Implementation Plan

Based on the approved spec in `docs/game-scheduler-spec.md`, this plan covers **Phase 1** (one-time scheduling + basic invites + RSVP + push) since the spec explicitly phases the work and Phase 1 is the foundation everything else depends on.

> **CLAUDE.md compliance**: Phase 1 touches more than 3 files, so we break it into sub-tasks of ≤3 files each. Tests are written alongside each sub-task.

---

## Sub-task 1: Database Migration
**Files**: `supabase/migrations/015_game_scheduler.sql` (1 new file)

Create the migration file with:
- 6 new ENUMs: `event_status`, `recurrence_type`, `invite_status`, `proposal_status`, `game_category`
- 8 new tables: `game_templates`, `scheduled_events`, `event_occurrences`, `event_invites`, `rsvp_history`, `time_proposals`, `event_series_overrides`, `user_notification_settings`, `notification_outbox`
- All indexes from the spec (9 indexes)
- `ALTER TABLE game_nights ADD COLUMN event_occurrence_id VARCHAR(32) REFERENCES event_occurrences(occurrence_id)`
- Seed system game templates (poker, rummy, blackjack, spades, hearts, bridge)

No RLS policies in this migration (backend uses service-role key; RLS can be added later).

---

## Sub-task 2: Scheduling Engine
**Files**: `backend/scheduling_engine.py` (1 new), `backend/tests/test_scheduling_engine.py` (1 new)

Create `scheduling_engine.py` with:
- `generate_occurrences(event, from_date, weeks_ahead=8)` — generates occurrence dicts from recurrence rules
- `local_to_utc(local_date, local_time, tzid)` — DST-safe timezone conversion using `zoneinfo`
- `create_invites_for_occurrence(occurrence_id, group_id, invite_scope, selected_invitees)` — creates invite rows
- `get_rsvp_stats(occurrence_id)` — returns `{accepted, declined, maybe, invited, no_response, total}` counts

Tests:
- One-time event generates exactly 1 occurrence
- Weekly event generates 8 occurrences (8-week window)
- Biweekly event generates 4 occurrences
- DST boundary handling (spring forward / fall back)
- `local_to_utc` correctness for EST and EDT

---

## Sub-task 3: Backend API Endpoints (Core CRUD)
**Files**: `backend/server.py` (modify — add Pydantic models + 8 endpoints)

Add Pydantic models:
- `CreateEventRequest`, `EventRSVPRequest`, `ProposeTimeRequest`, `DecideProposalRequest`, `OccurrenceOverrideRequest`

Add endpoints:
1. `POST /api/events` — create event + single occurrence + invites + push notifications
2. `GET /api/events` — list upcoming events for user (via their group memberships)
3. `GET /api/events/{event_id}` — event detail with occurrences
4. `POST /api/occurrences/{occurrence_id}/rsvp` — RSVP (accept/decline/maybe) + log to rsvp_history + notify host
5. `GET /api/occurrences/{occurrence_id}/invites` — invite status list for dashboard
6. `POST /api/occurrences/{occurrence_id}/start-game` — create game_night linked to occurrence
7. `GET /api/templates` — list game templates
8. `GET /api/groups/{group_id}/calendar` — calendar data (occurrences in date range)

Each endpoint follows existing patterns:
- `user: User = Depends(get_current_user)` for auth
- Group membership verification
- `from db.pg import get_pool` for direct SQL
- Push notifications via existing `send_push_notification` helper
- Socket.IO emits for real-time updates

---

## Sub-task 4: WebSocket Event Emitters
**Files**: `backend/websocket_manager.py` (modify — add event room management + 5 emitters)

Add:
- `event_rooms: dict[str, set[str]]` tracking dict
- `join_event` / `leave_event` Socket.IO event handlers (with group membership auth)
- `emit_event_created(group_id, event_data)` → emits to group room
- `emit_rsvp_updated(group_id, occurrence_id, user_id, status, stats)` → emits to group room
- `emit_occurrence_updated(group_id, occurrence_id, changes)` → emits to group room
- `emit_occurrence_reminder(user_id, occurrence, hours_until)` → emits to specific user
- `emit_time_proposed(host_id, proposal_data)` → emits to host

---

## Sub-task 5: Backend Tests
**Files**: `backend/tests/test_scheduler_api.py` (1 new)

Integration tests (using `@pytest.mark.skipif` for server dependency):
- Create event → verify occurrence + invites created
- RSVP → verify invite status updated + rsvp_history logged
- Get invites → verify stats returned
- Start game → verify game_night created with event_occurrence_id link
- Calendar endpoint → verify date range filtering
- Auth: non-member cannot create event in group
- Auth: non-member cannot RSVP
- Duplicate RSVP → returns current status (409 or idempotent update)

---

## Sub-task 6: Mobile — Design Tokens + DateStrip Component
**Files**: `mobile/src/styles/liquidGlass.ts` (modify), `mobile/src/components/DateStrip.tsx` (1 new)

Add to `liquidGlass.ts`:
- `SCHEDULE_COLORS` object (invited, accepted, declined, maybe, proposed, noResponse)
- `SCHEDULE_STYLES` object (rsvpDot, dateStrip, rsvpButton styles)

Create `DateStrip.tsx`:
- Horizontal scrollable week calendar strip
- Props: `selectedDate`, `onSelectDate`, `eventDates` (dates with events)
- Uses `FlatList` horizontal with 44x64pt day cells
- Orange highlight on selected day, dots for days with events
- `accessibilityRole="list"` on container, `accessibilityRole="button"` on each day

---

## Sub-task 7: Mobile — SchedulerScreen
**Files**: `mobile/src/screens/SchedulerScreen.tsx` (1 new)

Full-screen with:
- `PageHeader` with title "Schedule"
- `DateStrip` component at top
- Upcoming events list using `GlassSurface` cards
- Each card shows: title, date/time, group name, RSVP stats (colored dots + counts)
- Tapping card → navigate to `EventDashboard` (host) or `RSVP` (invitee)
- FAB button "Schedule Game" → navigate to `CreateEvent`
- Fetches data from `GET /api/events` and `GET /api/groups/{groupId}/calendar`
- Spring entrance animations

---

## Sub-task 8: Mobile — CreateEventScreen (Wizard)
**Files**: `mobile/src/screens/CreateEventScreen.tsx` (1 new)

Multi-step wizard with animated transitions (Phase 1 = steps 1,2,4,5 — skip recurrence):
- **Step 1**: Group selection (radio list from user's groups)
- **Step 2**: Date & Time pickers (native iOS/Android pickers)
- **Step 4**: Game details (game type dropdown, title input, location input, buy-in)
- **Step 5**: Review & confirm → calls `POST /api/events`
- Uses `BottomSheetScreen` wrapper, `GlassInput`, `GlassButton`, `GlassSurface`
- Step indicator at top
- "Next" / "Back" navigation between steps
- Haptic feedback on "Schedule & Invite" confirmation

---

## Sub-task 9: Mobile — EventDashboardScreen + RSVPScreen
**Files**: `mobile/src/screens/EventDashboardScreen.tsx` (1 new), `mobile/src/screens/RSVPScreen.tsx` (1 new)

**EventDashboardScreen** (host view):
- RSVP stats summary (accepted/maybe/declined/waiting counts with colored dots)
- Scrollable list of invitees with status badges
- "Send Reminder" button → push to non-responders
- "Start Game" button → calls `POST /api/occurrences/{id}/start-game`
- "Cancel" button
- Fetches from `GET /api/occurrences/{id}/invites`

**RSVPScreen** (invitee view):
- Event details card (title, date, location, buy-in, attendee count)
- 2×2 grid of RSVP buttons: Accept (green), Decline (red), Maybe (amber), Propose Time (blue)
- Haptic feedback on tap (`Haptics.impactAsync(Medium)`)
- Calls `POST /api/occurrences/{id}/rsvp`
- Uses `BottomSheetScreen` wrapper

---

## Sub-task 10: Mobile — Navigation + Deep Links + Translations
**Files**: `mobile/src/navigation/RootNavigator.tsx` (modify), `mobile/src/i18n/translations.ts` (modify), `mobile/src/services/pushNotifications.ts` (modify)

**RootNavigator.tsx**:
- Add to `RootStackParamList`: `Scheduler`, `CreateEvent`, `EventDashboard`, `RSVP`
- Register 4 new `Stack.Screen` entries
- Add deep link cases for `event_invite`, `event_reminder` notification types

**translations.ts**:
- Add `scheduler` section with keys for all 7 languages: title, selectDate, selectTime, upcoming, createEvent, rsvp (accept/decline/maybe/propose), inviteStatus labels, review step labels

**pushNotifications.ts**:
- Add handler for `event_invite` and `event_reminder` notification types → navigate to RSVP screen

---

## Execution Order

```
Sub-task 1 (Migration)
    ↓
Sub-task 2 (Scheduling Engine) ← can start in parallel with 1
    ↓
Sub-task 3 (API Endpoints) ← depends on 1 + 2
    ↓
Sub-task 4 (WebSocket) ← depends on 3
    ↓
Sub-task 5 (Backend Tests) ← depends on 3 + 4
    ↓
Sub-task 6 (Design Tokens + DateStrip) ← can start in parallel with backend work
    ↓
Sub-task 7 (SchedulerScreen) ← depends on 6
    ↓
Sub-task 8 (CreateEventScreen) ← depends on 6
    ↓
Sub-task 9 (Dashboard + RSVP) ← depends on 6
    ↓
Sub-task 10 (Navigation + i18n + Deep Links) ← depends on 7, 8, 9
```

## Verification (per CLAUDE.md)

After each sub-task:
- `python -c "import ast; ast.parse(open('file.py').read())"` on all modified Python files
- `npx tsc --noEmit` from `mobile/` on all modified TypeScript files
- `pytest backend/tests/test_scheduling_engine.py backend/tests/test_scheduler_api.py` for backend tests

## Edge Cases to Test (post-implementation)

1. Creating event with `starts_at` in the past → should reject (422)
2. RSVP on cancelled occurrence → should reject (400)
3. Non-member trying to RSVP → should reject (403)
4. Duplicate RSVP → should update (not create duplicate)
5. Start game from occurrence → game_night linked via event_occurrence_id
6. Calendar query with no events → empty array, not error
7. Event with `invite_scope: "selected"` → only selected users get invites
