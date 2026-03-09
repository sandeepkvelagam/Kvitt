# Incidents & User Reports UI — Implementation Plan

## Context

The admin dashboard (`AdminDashboard.jsx`) already displays summary cards for **Open Incidents** and **User Reports** with "View All" links — but those link targets don't exist yet. There is no UI for admins to view a full report, respond to users, or manage incidents from a dedicated list. The backend is fully built (endpoints, tables, AI agents/tools all exist). This plan bridges the gap by building the missing frontend pages (web + mobile) and one new composite backend endpoint for admin responses with two-way threaded conversations.

**P95 latency (1395ms)** — Root causes identified (N+1 queries, no caching, missing indexes). Deferred to a separate follow-up task per user decision.

---

## What's Missing Today

| Gap | Dashboard links to... | But the target... |
|-----|----------------------|-------------------|
| User Reports list | `/admin/feedback` (line 589) | Does NOT exist |
| Report detail | `/admin/feedback/:id` (line 622) | Does NOT exist |
| Incidents list | No standalone page | Only `IncidentDetail` exists |
| Admin response to user | — | No endpoint to respond + notify |
| Mobile admin screens | — | None exist |

---

## Task 1: Backend — Admin Response Endpoint + Thread Support

**Files (2):**
- `backend/server.py` — Add `POST /admin/feedback/{feedback_id}/respond`
- `backend/server.py` — Add `GET /feedback/{feedback_id}/thread` (for two-way conversation)

### New endpoint: `POST /admin/feedback/{feedback_id}/respond`

```python
class AdminFeedbackResponse(BaseModel):
    message: str
    new_status: Optional[str] = None  # in_progress, resolved, needs_user_info, etc.
```

**Logic (wires existing AI tools):**
1. Fetch feedback via `GET /admin/feedback/{feedback_id}` query
2. `FeedbackCollectorTool` → `add_event(feedback_id, event_type="admin_response", message=data.message, actor_user_id=admin.user_id)`
3. If `new_status` provided → `update_status(feedback_id, new_status)`
4. `NotificationSenderTool` → send **in-app + push + email** to the reporter:
   - In-app: notification with type `feedback_response`, deep link to feedback detail
   - Push: via Expo Push API (existing tool)
   - Email: via Resend `email_sender` tool with response message
5. Return `{success: true, feedback_id, new_status, event_id}`

### New endpoint: `POST /feedback/{feedback_id}/reply` (user replies back)

Allows the reporting user to reply to an admin response (two-way thread).

```python
class UserFeedbackReply(BaseModel):
    message: str
```

**Logic:**
1. Verify `request.user.user_id == feedback.user_id` (only the reporter can reply)
2. `FeedbackCollectorTool` → `add_event(feedback_id, event_type="user_reply", message=data.message, actor_user_id=user.user_id)`
3. If status was `resolved`, auto-reopen to `needs_user_info`
4. Notify admin via in-app notification (notification type `feedback_user_reply`)
5. Return `{success: true}`

### New endpoint: `GET /feedback/{feedback_id}/thread`

Returns the full conversation thread for a feedback item (events where `event_type in ('admin_response', 'user_reply', 'status_change')`), ordered chronologically.

### Existing tools reused (no new tools needed):
| Tool | File | Usage |
|------|------|-------|
| `FeedbackCollectorTool` | `backend/ai_service/tools/feedback_collector.py` | add_event, update_status |
| `NotificationSenderTool` | `backend/ai_service/tools/notification_sender.py` | in_app + push delivery |
| `email_sender` tool | `backend/ai_service/tools/email_sender.py` | Email via Resend |
| `FeedbackPolicyTool` | `backend/ai_service/tools/feedback_policy.py` | Gates auto-fix actions |
| `AutoFixerTool` | `backend/ai_service/tools/auto_fixer.py` | Triggered from detail page |

---

## Task 2: Web — User Reports Pages (3 files)

### File 1: `frontend/src/pages/admin/UserReportsPage.jsx`

**Pattern:** Mirror `AlertsPage.jsx` structure.

- **Filters bar:** Status (open/classified/in_progress/needs_user_info/resolved/auto_fixed/wont_fix/duplicate), Type (bug/complaint/feature_request/ux_issue/praise/other), Priority (critical/high/medium/low)
- **List:** Cards with type badge, status badge, priority pill, content preview (200 chars), reporter name, date, SLA indicator
- **Pagination:** offset-based with Load More button
- **API:** `GET /admin/feedback?feedback_type=X&status=Y&days=30&limit=50&offset=0`
- **Click:** Navigate to `/admin/feedback/${report.feedback_id}`
- **Stats header:** Total / Open / Auto-fixed counts (from `GET /admin/feedback/stats`)

### File 2: `frontend/src/pages/admin/UserReportDetail.jsx`

**Pattern:** Mirror `IncidentDetail.jsx` layout (header → content → timeline → action form).

**Sections:**
1. **Header:** Type badge, status badge, priority badge, feedback_id ref, created date
2. **Reporter info:** Name, email (from detail endpoint)
3. **Content:** Full report text
4. **Classification:** AI-assigned category + auto-fix status (read-only)
5. **Conversation thread:** Chronological list of admin_response + user_reply events (vertical timeline like IncidentDetail). Each message shows actor name, timestamp, message text. Admin messages styled differently from user messages.
6. **Admin actions panel:**
   - Status dropdown (9 valid states)
   - Response textarea + "Send Response" button → `POST /admin/feedback/:id/respond`
   - "Trigger Auto-Fix" button → `POST /feedback/auto-fix`
   - "Mark Duplicate" input → `PUT /feedback/:id/status` with `linked_feedback_id`

### File 3: `frontend/src/App.js` — Add routes

Add lazy imports:
```js
const UserReportsPage = React.lazy(() => import('@/pages/admin/UserReportsPage'));
const UserReportDetail = React.lazy(() => import('@/pages/admin/UserReportDetail'));
const IncidentsPage = React.lazy(() => import('@/pages/admin/IncidentsPage'));
```

Add SuperAdminRoute entries:
- `/admin/feedback` → `<UserReportsPage />`
- `/admin/feedback/:feedbackId` → `<UserReportDetail />`
- `/admin/incidents` → `<IncidentsPage />`

---

## Task 3: Web — Incidents List Page (1 file)

### File: `frontend/src/pages/admin/IncidentsPage.jsx`

**Pattern:** Mirror `AlertsPage.jsx`.

- **Filters:** Status (open/mitigating/resolved), Severity (P0/P1/P2)
- **List:** Cards with severity badge (P0 red, P1 orange, P2 yellow), status badge, title, summary preview, opened_at, tags
- **API:** `GET /admin/incidents?status=X&limit=50`
- **Click:** Navigate to existing `/admin/incidents/${incident.incident_id}` (IncidentDetail.jsx)

---

## Task 4a: Mobile — Incidents Screens (3 files)

### File 1: `mobile/src/screens/AdminIncidentsScreen.tsx`
- `PageHeader` + `FlatList` inside safe area
- Filter toggle bar (open/mitigating/resolved) using pill buttons
- Each item: `GlassSurface` card with severity pill, status pill, title, date
- Tap → navigate to `AdminIncidentDetail`

### File 2: `mobile/src/screens/AdminIncidentDetailScreen.tsx`
- `PageHeader` + `ScrollView`
- Incident info header, summary, root cause sections
- Timeline: vertical step list with event type icons + timestamps
- Add-event form: event type selector row, TextInput, submit `GlassButton`

### File 3: `mobile/src/navigation/RootNavigator.tsx`
- Add `AdminIncidents`, `AdminIncidentDetail`, `AdminUserReports`, `AdminUserReportDetail` to `RootStackParamList`
- Add 4 `Stack.Screen` entries with `slide_from_bottom` animation
- Gate at screen level with `isSuperAdmin` check

---

## Task 4b: Mobile — User Reports Screens (2 files)

### File 1: `mobile/src/screens/AdminUserReportsScreen.tsx`
- Same pattern as `AdminIncidentsScreen` but for feedback
- Filter tabs: type + status
- `GlassListItem` cards with type/status badges, content preview, reporter name

### File 2: `mobile/src/screens/AdminUserReportDetailScreen.tsx`
- Reporter info section, content section, classification badges
- **Conversation thread:** Messages list (admin vs user styled differently, like a chat)
- Response form: status picker, message TextInput, "Send" GlassButton
- Auto-fix trigger button (when classification suggests a fix)

---

## Task 5: User-Facing Feedback Thread (2 files)

Update the user's own feedback view to show the conversation thread and allow replies.

### File 1: `frontend/src/pages/Feedback.jsx`
- In the "My Feedback" history section, when user clicks a feedback item, show a detail modal/expandable section with:
  - Full thread from `GET /feedback/{feedback_id}/thread`
  - Reply input + send button → `POST /feedback/{feedback_id}/reply`

### File 2: `mobile/src/screens/FeedbackScreen.tsx`
- Same: expand feedback item to show thread + reply input

---

## Internal Connections Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    ADMIN (Web / Mobile)                   │
│                                                          │
│  UserReportDetail / AdminUserReportDetailScreen          │
│    ├─ View report + thread ── GET /admin/feedback/:id    │
│    │                          GET /feedback/:id/thread   │
│    ├─ Send response ───────── POST /admin/feedback/:id/respond
│    ├─ Change status ───────── PUT /feedback/:id/status   │
│    ├─ Trigger auto-fix ────── POST /feedback/auto-fix    │
│    └─ Mark duplicate ──────── PUT /feedback/:id/status   │
│                                                          │
│  IncidentsPage / AdminIncidentsScreen                    │
│    ├─ List incidents ──────── GET /admin/incidents       │
│    └─ Click → IncidentDetail                             │
│         └─ Add timeline ──── POST /admin/incidents/:id/timeline
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                    BACKEND (server.py)                    │
│                                                          │
│  POST /admin/feedback/:id/respond                        │
│    ├─ FeedbackCollectorTool.add_event("admin_response")  │
│    ├─ FeedbackCollectorTool.update_status(new_status)    │
│    ├─ NotificationSenderTool (in_app + push)             │
│    └─ EmailSenderTool (Resend email to reporter)         │
│                                                          │
│  POST /feedback/:id/reply  (user replies back)           │
│    ├─ FeedbackCollectorTool.add_event("user_reply")      │
│    ├─ Auto-reopen if resolved → needs_user_info          │
│    └─ NotificationSenderTool → notify admin              │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                USER (Web / Mobile)                        │
│                                                          │
│  Feedback.jsx / FeedbackScreen.tsx                        │
│    ├─ View own reports ────── GET /feedback/my            │
│    ├─ View thread ─────────── GET /feedback/:id/thread   │
│    ├─ Reply to admin ──────── POST /feedback/:id/reply   │
│    └─ Submit new report ──── POST /feedback              │
│                                                          │
│  Notifications                                           │
│    └─ "Update on your report" → deep link to thread      │
└──────────────────────────────────────────────────────────┘
```

---

## Existing AI Agents/Tools Reuse Summary

| Agent/Tool | Already Exists | How We Use It |
|-----------|---------------|---------------|
| `FeedbackCollectorTool` | Yes (`tools/feedback_collector.py`) | add_event, update_status in respond endpoint |
| `FeedbackClassifierTool` | Yes (`tools/feedback_classifier.py`) | Display classification on detail page (data already in DB) |
| `AutoFixerTool` | Yes (`tools/auto_fixer.py`) | "Trigger Auto-Fix" button on detail page |
| `FeedbackPolicyTool` | Yes (`tools/feedback_policy.py`) | Server-side gate before auto-fix runs |
| `NotificationSenderTool` | Yes (`tools/notification_sender.py`) | Push + in-app notification on admin response |
| `EmailSenderTool` | Yes (`tools/email_sender.py`) | Email notification on admin response |
| `FeedbackAgent` | Yes (`agents/feedback_agent.py`) | Orchestrates classification pipeline (already running) |
| **New tools needed** | **None** | All capabilities exist |
| **New agents needed** | **None** | Existing FeedbackAgent covers the pipeline |

---

## Design Patterns to Follow

**Web pages:** Match the existing admin dark theme (`bg-[#060918]`, `border-white/[0.06]`, stagger animations, lucide-react icons, shadcn/ui Button). Reference `AlertsPage.jsx` for list pages and `IncidentDetail.jsx` for detail pages.

**Mobile screens:** Use `PageHeader`, `GlassSurface`, `GlassButton`, `GlassListItem` from `mobile/src/components/ui/`. Use `useTheme()` for colors. Use `BottomSheetScreen` for modal-style presentations.

**Thread UI:** Style admin messages with orange-tinted background (left-aligned), user messages with slate background (right-aligned) — similar to chat bubble pattern used in `GroupChat.jsx`.

---

## Verification

1. **Syntax check** all modified Python files: `python -c "import ast; ast.parse(open('file.py').read())"`
2. **TypeScript check** all new mobile `.tsx` files: `npx tsc --noEmit`
3. **Write tests** for `POST /admin/feedback/:id/respond` and `POST /feedback/:id/reply` in `backend/tests/`
4. **Manual flow test:**
   - Admin navigates Dashboard → "View All" on User Reports → sees list → clicks report → sees detail with thread
   - Admin types response + changes status to "in_progress" → clicks Send
   - Verify: event added to feedback, status updated, notification sent to user
   - User opens notification → sees thread with admin message → types reply → sends
   - Admin sees user reply appear in thread
5. **Route verification:** Navigate to `/admin/feedback`, `/admin/feedback/test-id`, `/admin/incidents` — all should render
6. Run `pytest` on new test files
