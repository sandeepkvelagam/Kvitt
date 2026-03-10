# Kvitt — Full Application Architecture Review

## What is Kvitt?

Kvitt is a **poker game tracking and settlement platform** — a full-stack app (web + mobile) that lets friend groups organize poker nights, track buy-ins/cash-outs in real-time, calculate settlements (who owes whom), process payments, and chat — all enhanced with an AI assistant.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                      │
│                                                                     │
│   ┌──────────────┐              ┌──────────────────┐                │
│   │  Web (React) │              │ Mobile (Expo/RN)  │               │
│   │  CRA + Tailwind             │ React Native 0.81 │               │
│   │  Shadcn UI   │              │ Liquid Glass UI   │               │
│   └──────┬───────┘              └────────┬──────────┘               │
│          │                               │                          │
│          │  HTTP (axios) + Socket.IO     │                          │
└──────────┼───────────────────────────────┼──────────────────────────┘
           │                               │
           ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI + Python)                        │
│                                                                     │
│   ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐        │
│   │  server.py   │  │ WebSocket    │  │  AI Service        │        │
│   │  (100+ API   │  │ Manager      │  │  ├─ Orchestrator   │        │
│   │   endpoints) │  │ (Socket.IO)  │  │  ├─ 13 Agents      │        │
│   └──────┬───────┘  └──────┬───────┘  │  ├─ 24+ Tools      │        │
│          │                 │          │  └─ Schedulers      │        │
│          │                 │          └────────┬───────────┘        │
│          ▼                 ▼                   ▼                    │
│   ┌──────────────────────────────────────────────────────┐         │
│   │              db/ (asyncpg)                            │         │
│   │  pg.py (pool) + queries.py (150+ typed SQL helpers)   │         │
│   └───────────────────────┬──────────────────────────────┘         │
└───────────────────────────┼─────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PostgreSQL (Supabase) — 86 tables                      │
│              + Supabase Auth (JWT)                                   │
└─────────────────────────────────────────────────────────────────────┘

External Services:
  ├─ Stripe (payments, subscriptions)
  ├─ Resend (transactional email)
  ├─ Claude API + OpenAI GPT-4o (AI)
  ├─ Spotify Web API (music playback)
  └─ Expo Push Notifications (mobile)
```

---

## Backend (FastAPI)

### Entry Point & Structure
- **server.py** — monolithic 405KB / ~10,400 lines containing all 100+ API endpoints
- **db/** — asyncpg connection pool + 150+ typed SQL helper functions
- **ai_service/** — orchestrator pattern with 13 agents, 24+ tools, background schedulers
- **Supporting services**: email, websocket, wallet, stripe, analytics, scheduling, poker evaluator

### API Endpoint Groups (~100+ total)

| Domain | Endpoints | Key Operations |
|--------|-----------|----------------|
| Auth & Users | 6 | Session, profile, search |
| Groups & Invites | 8 | CRUD, invite, transfer admin |
| Games | 40+ | Create → start → buy-in → cash-out → settle → dispute |
| Settlement & Ledger | 5 | Mark paid, request payment, confirm, edit |
| Messaging & Polls | 10 | Group chat, polls, AI settings |
| AI Assistant | 2 | Ask (tiered: quick → Claude → GPT-4o), usage stats |
| Engagement | 10 | Scores, nudges, inactive detection |
| Feedback | 15 | Submit, resolve, auto-fix, surveys |
| Automations | 12 | CRUD, templates, triggers, run/replay |
| Spotify | 10+ | Auth, playback control, search |
| Wallet & Stripe | 4 | Webhooks for deposits, subscriptions |
| Scheduling | 2+ | Suggest times, events |
| Admin (super admin) | 30+ | Overview, health, alerts, incidents, user mgmt |
| Analytics | 6 | Stats, game history, badges, levels |

### Database (PostgreSQL/Supabase) — 86 Tables

**Core domain**: users, groups, group_members, group_invites, game_nights, players, transactions, ledger_entries, settlements
**Wallet**: wallets, wallet_transactions, wallet_audit, wallet_deposits, wallet_withdrawals, debt_payments
**Messaging**: group_messages, notifications, notification_preferences
**AI/Feedback**: feedback, feedback_surveys, ai_interactions, polls
**Scheduling**: scheduled_events, event_occurrences, event_invites, time_proposals, reminders
**Automations**: user_automations, automation_runs
**Analytics/Admin**: analytics_events, analytics_sessions, api_metrics, funnel_events, admin_alerts, incidents, audit_logs, app_errors
**Integrations**: spotify_tokens, subscribers, devices, counters

### AI Service Architecture

```
User Query → Intent Router → Tier Check
  ├─ Tier 0: Quick answers (keyword match, no API call)
  ├─ Tier 1: AI-assisted (Claude orchestrator with tool use)
  ├─ Tier 2: Premium (full Claude reasoning)
  └─ Fallback: GPT-4o if Claude unavailable

Orchestrator → Tool Registry (24+ deterministic functions)
            → Agent Registry (13 specialized agents)
            → LLM (Claude/GPT-4o for reasoning)
```

**13 Agents**: GameSetup, Notification, Analytics, HostPersona, GroupChat, GamePlanner, Engagement, Feedback, PaymentReconciliation, UserAutomation, + more

**Background Schedulers**: ProactiveScheduler (game suggestions, RSVP reminders, settlement reminders), EngagementScheduler (nudges, weekly digests), EventListener (@kvitt mentions in chat), OpsScheduler (admin health/security monitoring)

### Real-Time (Socket.IO)
- JWT-authenticated connections
- Room-based: game rooms, group rooms
- Events: game_update, player_joined, buy_in, cash_out, chips_edited, group_message, notification

---

## Web Frontend (React/CRA)

### Tech Stack
- React (CRA) + Tailwind CSS + Shadcn UI (40+ components)
- Routing: React Router (35+ routes)
- State: Context API (Auth, Language, Navigation)
- API: Axios with Supabase JWT interceptor
- Real-time: Socket.IO hooks
- i18n: 7 languages (en, es, fr, de, hi, pt, zh)

### Page Map

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Stats, active games, groups, invites |
| `/groups` | Groups | List + create groups |
| `/groups/:id` | GroupHub | Group details, members, game history (41KB) |
| `/chats` / `/chats/:id` | Chats | Group messaging |
| `/games/:id` | GameNight | **Core page (82KB)** — live game tracking, buy-in/cash-out, poker hand ref, Spotify, settlement calc |
| `/games/:id/settlement` | Settlement | Who owes whom, Stripe pay, disputes, surveys |
| `/history` | History | Settlement history |
| `/pending-requests` | Requests | Accept/decline invites |
| `/ai` | AI Assistant | Full-page AI chat |
| `/wallet` | Wallet | Balance management |
| `/request-pay` | Request & Pay | Payment requests |
| `/schedule` | Scheduler | Event scheduling + RSVP |
| `/automations` | Automations | Smart Flows rules |
| `/feedback` | Feedback | Issue reporting |
| `/profile` | Profile | Stats, badges, achievements |
| `/premium` | Premium | Subscription page |
| `/settings/*` | Settings | Notifications, appearance, language, voice, billing |
| `/admin/*` | Admin | Super admin dashboard, alerts, incidents, feedback (lazy loaded) |

### Key Components
- **AppLayout** — Sidebar (desktop) + Navbar (mobile) + content area
- **AIAssistant** — Floating chat bubble (always visible, bottom-right)
- **SpotifyPlayer** — In-game music widget (43KB)
- **OnboardingGuide** — First-time user walkthrough

---

## Mobile App (React Native / Expo)

### Tech Stack
- React Native 0.81 + Expo 54 + TypeScript
- Navigation: React Navigation v7 (stack-based, 31 screens)
- State: Context API (6 providers: Auth, Theme, Language, Haptics, PokerAI, Drawer)
- Design: Custom "Liquid Glass" design system (frosted glass, spring animations)
- Real-time: Socket.IO
- Push: Expo Push Notifications with deep linking (12+ notification types)
- Storage: expo-secure-store (auth), AsyncStorage (preferences)

### Screen Map (31 screens)

| Screen | Description |
|--------|-------------|
| LoginScreen | Email/password auth |
| DashboardScreenV2 | Stats, balances, recent games |
| GroupsScreen | List groups |
| GroupHubScreen | Group details + management |
| GroupChatScreen | Real-time messaging |
| ChatsScreen | Chat list |
| GameNightScreen | Live game tracking |
| SettlementScreen | Settlement details |
| SettlementHistoryScreen | Past settlements |
| WalletScreen | Balance, transactions, deposits |
| SchedulerScreen | Event scheduling |
| CreateEventScreen | New event creation |
| EventDashboardScreen | Event details |
| RSVPScreen | RSVP interface |
| AIAssistantScreen | AI chat |
| PokerAIScreen | **Mobile-exclusive** hand analysis |
| AIToolkitScreen | **Mobile-exclusive** AI tools |
| AutomationsScreen | Smart Flows |
| FeedbackScreen | Issue reporting |
| RequestAndPayScreen | Payment requests |
| PendingRequestsScreen | Invites |
| ProfileScreen | User profile |
| SettingsScreen | Settings hub |
| NotificationsScreen | Notification list |
| LanguageScreen | Language picker |
| BillingScreen | Subscription management |
| PrivacyScreen | Privacy settings |

### Liquid Glass Design System
- Dark-first palette: jet (#282B2B), charcoal (#1a1a1a), brand orange (#EE6C29)
- Frosted glass surfaces with blur + translucency
- Spring physics animations (Reanimated, 60fps UI-thread)
- Component presets: GlassButton, GlassInput, GlassHeader, GlassSurface, GlassModal
- Haptic feedback (light/medium/heavy/selection/success/warning/error)
- Accessibility: reduced motion detection, min 44px tap targets

---

## Feature Parity: Web vs Mobile

| Feature | Web | Mobile | Notes |
|---------|-----|--------|-------|
| Dashboard | Yes | Yes | |
| Groups CRUD | Yes | Yes | |
| Group Chat | Yes | Yes | Socket.IO on both |
| Game Night (live) | Yes | Yes | Core feature, real-time |
| Settlement | Yes | Yes | |
| Settlement History | Yes | Yes | |
| Pending Requests | Yes | Yes | |
| AI Assistant | Yes (floating + page) | Yes (screen) | Web has floating widget everywhere |
| Poker AI / Hand Analysis | Partial (in-game ref) | Yes (dedicated screen) | Mobile-exclusive dedicated screen |
| Wallet | Yes | Yes | |
| Scheduler / Events | Yes | Yes | |
| Automations | Yes | Yes | |
| Feedback | Yes | Yes | |
| Spotify Integration | Yes (43KB widget) | No | **Web-only** |
| Profile / Badges | Yes | Yes | |
| Premium / Billing | Yes | Yes | |
| Multi-language (7 langs) | Yes | Yes | |
| Push Notifications | N/A | Yes | Mobile-only (Expo Push) |
| Haptic Feedback | N/A | Yes | Mobile-only |
| QR Code Scan/Display | No | Yes | Mobile-only |
| Super Admin Panel | Yes (lazy loaded) | No | **Web-only** |
| Onboarding Guide | Yes | Yes | Different implementations |
| Dark/Light Theme | Partial | Yes (system-aware) | Mobile has full theme toggle |

---

## Identified Gaps & Observations

### Architecture Gaps

1. **Monolithic server.py (405KB, 10K+ lines)** — All 100+ endpoints in a single file. This is the biggest structural issue. Should be split into FastAPI routers (auth, groups, games, settlement, ai, admin, etc.).

2. **No API versioning** — All endpoints are under `/api/`. No `/v1/` prefix for future-proofing.

3. **86 database tables** — Many appear to be overlapping/redundant (e.g., `audit_logs` vs `audit_log`, `wallet_ledger` vs `wallet_transactions`). Schema could benefit from consolidation.

4. **No OpenAPI/Swagger documentation strategy** — FastAPI auto-generates it, but with 100+ endpoints in one file, it's likely overwhelming. Router-based splitting would help.

5. **No shared API types/contracts** — Web and mobile each define their own API response types independently. No shared schema (e.g., generated from OpenAPI spec).

### Feature Gaps

6. **Spotify integration is web-only** — Mobile has no Spotify player. Could be a deliberate choice (background audio complexity on mobile) but is a gap.

7. **Super Admin panel is web-only** — No admin functionality on mobile. Admins must use web.

8. **Web lacks push notifications** — No Web Push API integration. Mobile has full Expo Push.

9. **Web theme support is partial** — Mobile has full dark/light/system theme toggle; web has limited theme support via CSS variables but no user-facing toggle.

10. **No offline support on either platform** — No service worker (web) or offline queue (mobile). All operations require connectivity.

### Code Quality Observations

11. **GameNight.jsx is 82KB** — The largest single page component. Likely contains too much logic that should be extracted into hooks and sub-components.

12. **Duplicate component libraries** — Web has both Shadcn UI (`/components/ui/`) and a custom "reui" library (`/components/reui/`). Purpose overlap unclear.

13. **Inconsistent API wrapper patterns on mobile** — Some endpoints have typed wrapper functions (`api/groups.ts`, `api/games.ts`), while many are called directly with raw axios. Should be consistent.

14. **No E2E testing visible** — Unit tests exist but no Cypress/Playwright (web) or Detox (mobile) E2E tests found.

15. **No CI/CD configuration visible** — No GitHub Actions, CircleCI, or similar config files found in the repo.

16. **Socket.IO event handling is split** — Some socket events handled in hooks, some inline in components. Could benefit from a centralized event bus pattern.

### Security Observations

17. **Rate limiting is middleware-based** — Good, but patterns are hardcoded in `security_middleware.py`. Should be configurable.

18. **Wallet PIN verification** — Good security practice with bcrypt + rate limiting + fraud detection.

19. **Admin audit trail** — Comprehensive, which is excellent for compliance.

---

## Key Data Flows

### Game Lifecycle
```
Create Group → Invite Members → Schedule Game → Players RSVP
→ Start Game → Players Buy-in (real-time updates via Socket.IO)
→ Play (track chips, additional buy-ins) → Cash-out
→ End Game → Auto-calculate settlement (who owes whom)
→ Ledger entries created → Notifications sent
→ Players mark payments → Optional disputes → Resolution
→ Post-game survey → Stats/badges updated
```

### Payment Flow
```
Stripe Checkout → Webhook → Wallet credited (integer cents)
→ In-app transfers (idempotency keys) → Atomic debit/credit
→ Full audit trail in wallet_transactions + wallet_audit
```

### AI Assistant Flow
```
User query → Rate limit check → Quick answer attempt (Tier 0)
→ If not quick: Claude orchestrator with tools (Tier 1/2)
→ Tool execution (game data, stats, scheduling)
→ Response stored in ai_interactions → Returned to user
→ Fallback to GPT-4o if Claude unavailable
```

---

## Summary

Kvitt is a feature-rich, production-grade poker game management platform with:
- **100+ API endpoints** across 15+ domains
- **86 database tables** with comprehensive data modeling
- **Real-time** game tracking and messaging
- **AI-powered** assistant with 13 specialized agents
- **Payment processing** via Stripe with wallet system
- **Multi-platform** (web + mobile) with good feature parity
- **Internationalization** supporting 7 languages

The primary architectural improvement opportunity is **splitting the monolithic server.py** into modular FastAPI routers — this would improve maintainability, testing, and developer experience significantly.
