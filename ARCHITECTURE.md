# Kvitt — Architecture Review & 90-Day Roadmap

## What is Kvitt?

Kvitt is a **poker game tracking and settlement platform** — a full-stack app (web + mobile) that lets friend groups organize poker nights, track buy-ins/cash-outs in real-time, calculate settlements (who owes whom), process payments, and chat — all enhanced with an AI assistant.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                      │
│                                                                     │
│   ┌──────────────┐              ┌──────────────────┐                │
│   │  Web (React) │              │ Mobile (Expo/RN)  │               │
│   │  CRA + Tailwind             │ React Native 0.81 │               │
│   │  Shadcn UI   │              │ Liquid Glass UI   │               │
│   │  157+ raw    │              │ Partial typed API │               │
│   │  axios calls │              │ wrappers          │               │
│   └──────┬───────┘              └────────┬──────────┘               │
│          │                               │                          │
│          │  HTTP (axios) + Socket.IO     │                          │
└──────────┼───────────────────────────────┼──────────────────────────┘
           │                               │
           ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI + Python)                        │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │  server.py — 10,468 lines, 235 routes, 1 APIRouter     │       │
│   │  26 inline service functions, 0 sub-routers             │       │
│   │  522 queries.* calls + 41 direct pool.acquire()         │       │
│   └──────┬──────────────────────────────────────────────────┘       │
│          │                                                          │
│   ┌──────┴───────┐  ┌──────────────┐  ┌────────────────────┐       │
│   │ db/          │  │ WebSocket    │  │  AI Service        │       │
│   │ queries.py   │  │ Manager      │  │  ├─ Orchestrator   │       │
│   │ (150+ typed  │  │ (Socket.IO)  │  │  ├─ 13 Agents     │       │
│   │  SQL helpers)│  │              │  │  ├─ 24+ Tools     │       │
│   │ pg.py (pool) │  │              │  │  └─ 4 Schedulers  │       │
│   └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘       │
│          ▼                 ▼                    ▼                   │
│   ┌────────────────────────────────────────────────────────┐       │
│   │  Supporting: email, wallet, stripe, analytics,         │       │
│   │  security_middleware, poker evaluator, ops_agents       │       │
│   └────────────────────────────────────────────────────────┘       │
└───────────────────────────┬─────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│       PostgreSQL (Supabase) — 89 tables (9 unused, 7+ redundant)   │
│       + Supabase Auth (JWT)                                         │
│       46 in ALLOWED_TABLES, 43 require raw SQL only                 │
└─────────────────────────────────────────────────────────────────────┘

External Services:
  ├─ Stripe (payments, subscriptions, webhooks)
  ├─ Resend (transactional email)
  ├─ Claude API + OpenAI GPT-4o (AI, with fallback)
  ├─ Spotify Web API (music playback, web-only)
  └─ Expo Push Notifications (mobile-only)
```

---

## Part 1: Strengths

### 1. Real-time game operations — the moat

The live game flow (buy-ins, cash-outs, chips, settlement, updates across players via Socket.IO) is where the app feels genuinely differentiated. This is not a spreadsheet with a UI. It is a real operating system for poker nights.

### 2. Settlement and ledger model

The settlement/payments layer turns a casual poker tool into infrastructure for repeated game nights and ongoing trust. Integer-cent arithmetic, idempotency keys, audit trails, dispute resolution — this is commercially serious infrastructure.

### 3. Admin/audit/compliance thinking

Audit logs, incidents, admin alerts, fraud-aware wallet patterns, super admin tooling. Most early apps ignore this. Kvitt didn't.

### 4. AI as assistive layer, not gimmick

Tiered AI orchestration (Tier 0 quick answers, Tier 1 Claude orchestration, Tier 2 premium, GPT-4o fallback) is a sensible cost/performance structure. 13 specialized agents with 24+ deterministic tools. Background schedulers for proactive engagement.

### 5. Cross-platform parity

Web (35+ routes) and mobile (31 screens) cover nearly identical functionality. That is unusually strong for this stage.

---

## Part 2: Red Flags (Data-Backed)

### RED FLAG 1: Monolithic server.py (Critical)

**Hard numbers:**
- 10,468 lines in a single file
- 235 route handlers (109 GET, 94 POST, 25 PUT, 7 DELETE)
- 26 inline service functions (settlement optimization, poll resolution, AI helpers, push notification logic)
- 1 APIRouter, 0 sub-routers
- 41 direct `pool.acquire()` calls bypassing queries.py
- 11 routes use pool directly (all in admin/feedback domain)

**Routes by domain (top 10):**

| Domain | Routes | Line Range |
|--------|--------|------------|
| Games | 33 | 1429–3913 |
| Groups | 28 | 833–6418 |
| Admin | 23 | 9331–10159 |
| Spotify | 19 | 7676–8188 |
| Feedback | 17 | 8689–9970 |
| Wallet | 14 | 6461–6937 |
| Automations | 14 | 9100–9312 |
| Engagement | 13 | 8437–8613 |
| Ledger | 10 | 3660–7541 |
| Users | 8 | 1057–7044 |

This is the single biggest delivery risk. Not because it doesn't work — it clearly does — but because it makes reviews harder, onboarding slower, test isolation impossible, and accidental coupling inevitable.

### RED FLAG 2: Database schema entropy (High)

**Hard numbers:**
- 89 CREATE TABLE statements across 24 migrations
- 9 completely unused tables (zero code references): `settlement_lines`, `spotify_tokens`, `consents`, `organizations`, `user_profiles`, `user_sessions`, `time_proposals`, `event_series_overrides`, `assistant_events`
- 43 tables missing from ALLOWED_TABLES (can only be queried via raw SQL)

**Redundant table pairs:**

| Old System | New System | Status |
|------------|------------|--------|
| `audit_logs` (001) — 9 columns | `audit_log` (006) — 15 columns, immutable triggers | Both active |
| `wallets` (001) — basic balance | `wallet_accounts` (005) — pending_cents, lifetime tracking | Both active |
| `wallet_transactions` (001) — direction/counterparty | `wallet_ledger` (005) — immutable ledger with triggers | Both active |
| `notification_preferences` (015) | `user_notification_settings` (015) | Possibly duplicate |

The wallet domain is the worst: 7 tables across 2 parallel systems (old vs enterprise). Neither fully replaces the other.

### RED FLAG 3: No shared API contracts (High)

**Web frontend:** 157+ raw axios calls, no centralized API module, no TypeScript, no response types.

**Mobile:** Partial API wrappers (`api/groups.ts`, `api/games.ts`, `api/groupMessages.ts`) but 10+ screens still make direct `api.get/post` calls with hardcoded paths. Type definitions minimal — only `Group` and `Game` interfaces in `types.ts`.

**Active bug found:** Mobile analytics service calls `/api/analytics/*` but the base URL already includes `/api`, creating a double-prefix (`/api/api/analytics/*`) that will 404.

**No contract sharing mechanism:** Backend Pydantic models exist but nothing generates TypeScript types for frontend consumption.

### RED FLAG 4: Frontend component bloat (Medium)

| File | Size | Problem |
|------|------|---------|
| `GameNight.jsx` | 82KB | Settlement calc, Spotify player, poker hand ref, chat, admin controls — all in one component |
| `SpotifyPlayer.jsx` | 43KB | Massive standalone widget |
| `GroupHub.jsx` | 41KB | Group management kitchen sink |
| `Navbar.jsx` | 30KB | Notification polling, action handling, rendering all inline |

GameNight alone likely has 2000+ lines of JSX. That should be 8-10 focused sub-components with extracted hooks.

### RED FLAG 5: Dual component libraries on web (Low-Medium)

Web has both Shadcn UI (`/components/ui/`, 40+ components) and a custom "reui" library (`/components/reui/`). Purpose overlap is unclear and creates confusion about which to use.

---

## Part 3: Feature Parity Analysis

| Feature | Web | Mobile | Gap Severity |
|---------|-----|--------|-------------|
| Dashboard | Yes | Yes | — |
| Groups CRUD | Yes | Yes | — |
| Group Chat | Yes | Yes | — |
| Game Night (live) | Yes | Yes | — |
| Settlement + Disputes | Yes | Yes | — |
| AI Assistant | Floating + page | Screen | Web stronger (always visible) |
| Poker AI / Hand Analysis | In-game ref only | Dedicated screen | Mobile stronger |
| Wallet | Yes | Yes | — |
| Scheduler / Events | Yes | Yes | — |
| Automations | Yes | Yes | — |
| Feedback | Yes | Yes | — |
| Spotify | 43KB widget | No | **Web-only** |
| Profile / Badges | Yes | Yes | — |
| Premium / Billing | Yes | Yes | — |
| i18n (7 languages) | Yes | Yes | — |
| Push Notifications | No | Yes (Expo) | **Mobile-only** |
| Dark/Light Theme | Partial (CSS vars) | Full toggle | Mobile stronger |
| QR Code | No | Yes | Mobile-only |
| Super Admin Panel | Yes (lazy loaded) | No | **Web-only** (intentional) |
| Onboarding | Yes | Yes | Different implementations |
| Haptic Feedback | N/A | Yes | Mobile-only |
| E2E Tests | None | None | **Both missing** |
| CI/CD | None visible | None visible | **Both missing** |

---

## Part 4: The Product Question

The system is starting to look like three products inside one:

1. **Poker night operating system** — game lifecycle, real-time tracking, settlement
2. **Fintech wallet / settlements platform** — wallets, Stripe, payment reconciliation, disputes
3. **AI social assistant / automation platform** — 13 agents, proactive scheduling, engagement nudges, automations

That is both the strength and the danger.

### The core loop

```
Create game → Manage players/buy-ins → End game → Settle cleanly
```

Every feature should be ranked by how much it tightens this loop:

| Feature | Core Loop Impact | Verdict |
|---------|-----------------|---------|
| Real-time game tracking | Direct | Core |
| Settlement auto-calc | Direct | Core |
| Wallet/payments | Direct (settlement completion) | Core |
| Group management | Enables games | Core-adjacent |
| Chat | Coordination | Core-adjacent |
| AI host assistant | Helps plan games | Useful adjacent |
| Scheduler/RSVP | Increases game frequency | Useful adjacent |
| Badges/levels | Retention | Nice-to-have |
| Spotify | Fun atmosphere | Non-core |
| Automations | Power users | Non-core for now |
| Engagement nudges | Retention | Non-core for now |

---

## Part 5: 90-Day Refactor Roadmap

### Phase 1: Structural Foundation (Weeks 1-4)

#### P1.1 — Split server.py into domain routers

Target structure:
```
backend/
├── routers/
│   ├── auth.py          (3 routes)
│   ├── users.py         (8 routes)
│   ├── groups.py        (28 routes)
│   ├── games.py         (33 routes)
│   ├── settlements.py   (10 routes — ledger + settlement)
│   ├── wallet.py        (14 routes)
│   ├── chat.py          (group messages, polls)
│   ├── ai.py            (2 routes + AI helpers)
│   ├── feedback.py      (17 routes)
│   ├── automations.py   (14 routes)
│   ├── engagement.py    (13 routes)
│   ├── spotify.py       (19 routes)
│   ├── analytics.py     (8 routes)
│   ├── admin.py         (23 routes)
│   ├── events.py        (scheduling, 6 routes)
│   ├── webhooks.py      (Stripe, 3 routes)
│   └── premium.py       (4 routes)
├── services/
│   ├── settlement.py    (optimize_settlement, auto_generate_settlement)
│   ├── notifications.py (push helpers, preference checks)
│   ├── ai_helpers.py    (rate limit, navigation detect, input validate)
│   └── voice.py         (parse_voice_command)
├── dependencies.py      (verify_supabase_jwt, get_current_user)
└── server.py            (app factory, lifespan, mount routers)
```

**Estimated effort:** 35-45 hours. Mechanical but critical.

**Approach:** Move one domain at a time. Start with the most isolated (spotify, analytics, premium). End with games (most complex, most coupled).

#### P1.2 — Migrate 11 pool-only routes to queries.py

These routes bypass the query abstraction layer:
- `admin_update_user_role`, `admin_ack_alert`, `admin_resolve_alert`
- `admin_add_incident_timeline`, `admin_get_feedback_detail`
- `get_feedback_thread`, `admin_respond_to_feedback`, `user_reply_to_feedback`
- `generate_feedback_ai_draft`, `get_subscriber_stats`

Move their SQL into `queries.py` as typed helper functions.

#### P1.3 — Delete 9 unused tables

Create migration `025_cleanup_unused_tables.sql`:
```sql
DROP TABLE IF EXISTS settlement_lines;
DROP TABLE IF EXISTS spotify_tokens;
DROP TABLE IF EXISTS consents;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS time_proposals;
DROP TABLE IF EXISTS event_series_overrides;
DROP TABLE IF EXISTS assistant_events;
```

### Phase 2: API Contract Layer (Weeks 3-6)

#### P2.1 — Create shared API contract definitions

Backend: Define Pydantic response models for every endpoint (many already exist, standardize the rest).

Generate OpenAPI spec from FastAPI (automatic once routers are split cleanly).

#### P2.2 — Create typed API client for mobile

```
mobile/src/api/
├── client.ts          (existing — axios instance + interceptors)
├── types.ts           (generated or hand-written from OpenAPI)
├── groups.ts          (existing — expand)
├── games.ts           (existing — expand)
├── groupMessages.ts   (existing)
├── wallet.ts          (NEW — centralize 8 scattered wallet calls)
├── events.ts          (NEW — centralize scheduler calls)
├── automations.ts     (NEW — centralize automation calls)
├── feedback.ts        (NEW)
├── analytics.ts       (NEW — fix the /api double-prefix bug)
├── ai.ts              (NEW)
└── users.ts           (NEW)
```

#### P2.3 — Create API module for web

```
frontend/src/api/
├── client.js          (axios instance, interceptors — extract from App.js)
├── groups.js
├── games.js
├── wallet.js
├── ...
```

Replace all 157+ raw axios calls with typed wrapper functions.

#### P2.4 — Fix the analytics double-prefix bug

Mobile `analytics.ts` calls `/api/analytics/*` but base URL already includes `/api`. This will cause 404s in production. Fix immediately.

### Phase 3: Frontend Decomposition (Weeks 5-8)

#### P3.1 — Split GameNight.jsx (82KB)

Target:
```
pages/GameNight/
├── GameNight.jsx          (orchestrator, 200 lines max)
├── PlayerList.jsx         (player cards, chip counts)
├── BuyInDialog.jsx        (buy-in flow)
├── CashOutDialog.jsx      (cash-out flow)
├── AdminControls.jsx      (add player, edit chips, end game)
├── GameChat.jsx           (in-game chat thread)
├── PokerHandRef.jsx       (hand rankings reference)
├── useGameState.js        (hook: game data + mutations)
├── useGameSocket.js       (existing hook, move here)
└── useGameAdmin.js        (hook: admin-only actions)
```

#### P3.2 — Split GroupHub.jsx (41KB) and Navbar.jsx (30KB)

Same pattern: extract sub-components and hooks.

#### P3.3 — Resolve dual component library

Audit `components/reui/` vs `components/ui/` (Shadcn). Pick one as canonical. Migrate or delete the other.

### Phase 4: Schema Consolidation (Weeks 7-10)

#### P4.1 — Resolve wallet dual-system

Decide: `wallets` + `wallet_transactions` OR `wallet_accounts` + `wallet_ledger`. Migrate to one. Create migration to deprecate the other.

#### P4.2 — Resolve audit dual-system

`audit_logs` (simple, 9 cols) vs `audit_log` (enterprise, 15 cols, immutable). If enterprise is the future, migrate all writes to `audit_log` and drop `audit_logs`.

#### P4.3 — Resolve notification settings overlap

`notification_preferences` vs `user_notification_settings` — consolidate into one table.

#### P4.4 — Update ALLOWED_TABLES

43 tables are missing. Add the ones that need generic query access. This reduces raw SQL proliferation.

### Phase 5: Infrastructure (Weeks 9-12)

#### P5.1 — Add CI/CD

GitHub Actions for:
- Python lint + type check
- `pytest` on backend
- TypeScript type check on mobile
- Build verification for web and mobile

#### P5.2 — Add E2E test foundation

- Web: Playwright (covers core loop: login → create group → start game → buy-in → settle)
- Mobile: Consider Maestro or Detox for critical flows

#### P5.3 — Add API versioning

Prefix all routes with `/v1/`. Keep `/api/v1/` as the canonical prefix. This is low-effort now but expensive to add later.

---

## Part 6: What to Cut

These features exist but may not be earning their maintenance cost:

| Feature | Lines/Tables | Core Loop Impact | Recommendation |
|---------|-------------|-----------------|----------------|
| Spotify integration | ~43KB frontend + 19 routes | Atmosphere only | Freeze (no new work). Keep but don't expand. |
| Engagement nudges system | 13 routes + 3 tables + scheduler | Indirect retention | Simplify. Cut engagement_jobs, reduce to basic reminders. |
| Voice commands | 1 route + parser | Negligible usage likely | Freeze or remove. |
| Dual AI page + floating widget | Two separate implementations | Redundant | Merge into one reusable component. |
| Dashboard redesign + lab variants | 3 dashboard routes | Experimental | Delete unused variants. Ship one. |

---

## Part 7: What to Build Next (After Refactor)

Only after Phase 1-3 are complete. Pick ONE:

### Option A: Local game discovery (biggest growth bet)
New bounded domain — do NOT cram into existing tables:
- hosts, venues, listings, visibility rules, join requests, trust/reputation
- Major business shift: private coordination → public marketplace
- Requires moderation, abuse handling, geofencing
- Architecturally large. Only pursue if this is the strategic direction.

### Option B: Wallet expansion (most commercial value)
- Stripe Connect for real payouts
- Settlement auto-pay (auto-debit wallet on game end)
- Payment reminders with escalation
- Tightens the core loop directly.

### Option C: AI host assistant (differentiator)
- Proactive game scheduling based on group patterns
- Smart settlement reminders
- Post-game insights
- Already partially built. Polish and ship.

### Option D: Web push notifications
- Close the notification gap between web and mobile
- Increases engagement on web
- Moderate effort with immediate user-visible impact.

---

## Part 8: Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Product ambition | 9/10 | Massive scope, real vision |
| Feature richness | 9/10 | Covers game ops, payments, AI, social, admin |
| Core loop strength | 8/10 | Game → settle → pay works well |
| Architecture health | 5/10 | Monolith, schema entropy, no contracts |
| Maintainability trajectory | 4/10 | Will degrade fast without intervention |
| Cross-platform parity | 8/10 | Unusually strong for this stage |
| Test coverage | 3/10 | Unit tests exist but no E2E, no CI |
| Schema discipline | 4/10 | 9 dead tables, 7+ redundant, 43 unregistered |
| API contract safety | 3/10 | 157+ raw calls (web), active bug (mobile analytics) |
| Upside if refactored | 9/10 | The product is real; the architecture just needs to catch up |

---

## Bottom Line

**Stop rewarding yourself for adding surface area. Start rewarding yourself for reducing structural risk around the core loop.**

The product is real. The architecture needs to earn its next stage. The 90-day plan above is the bridge.
