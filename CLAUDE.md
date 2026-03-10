# CLAUDE.md - Development Guidelines

## Coding Workflow

1. Before writing any code, describe your approach and wait for approval.
2. If the requirements are ambiguous, ask clarifying questions before writing any code.
3. After finishing writing any code, list the edge cases and suggest test cases to cover them.
4. If a task requires changes to more than 3 files, stop and break it into smaller tasks first.
5. When there's a bug, start by writing a test that reproduces it, then fix it until the test passes.
6. Every time a mistake is made, reflect on what went wrong and come up with a plan to never make the same mistake again.

## Testing Requirements

- Always write tests for new features and bug fixes before marking work as complete.
- Run syntax checks (`python -c "import ast; ast.parse(open('file.py').read())"`) on all modified Python files.
- Run TypeScript type checking (`npx tsc --noEmit`) on all modified TypeScript files.
- Run `pytest` on the relevant test files to verify all tests pass before committing.
- Integration tests (those requiring a running server) should use `@pytest.mark.skipif` to skip gracefully when the server is unavailable.

## Tech Stack

- **Backend**: FastAPI (Python) with asyncpg/Supabase (PostgreSQL)
- **Frontend (Web)**: React (CRA) in `frontend/src/`
- **Mobile**: React Native (Expo) with TypeScript
- **Database**: PostgreSQL via Supabase, direct asyncpg queries via `backend/db/queries.py`
- **Push Notifications**: Expo Push API
- **Email**: Resend via `backend/email_service.py`
- **Real-time**: Socket.IO via `backend/websocket_manager.py`
- **AI**: Claude API via `backend/ai_service/`

## Database Architecture

- All data is stored in PostgreSQL/Supabase. There is **NO MongoDB** and **NO Motor wrapper**.
- All `mongo_id` columns have been dropped (migration 025).
- All MongoDB-style operators (`$set`, `$inc`, `$gte`, `$gt`) have been removed from `queries.py`.
- Orphaned enterprise tables (003-006, 015) and unused columns have been dropped (migration 026).
- Orphaned enum types (`wallet_status`, `wallet_ledger_type`, `settlement_status`, `settlement_method`, `settlement_line_status`, `ai_feature`, `ai_status`) dropped in migration 026.
- Missing performance indexes added (migration 027).
- Migrations live in `supabase/migrations/` (numbered 001–027).

### Authoritative Tables (Duplicate Resolution)

| Concept | Authoritative Table | Dropped Duplicate | Migration |
|---------|-------------------|-------------------|-----------|
| Wallets | `wallets` (001) | `wallet_accounts` (005) | Dropped in 026 |
| Wallet txns | `wallet_transactions` (001) | `wallet_ledger` (005) | Dropped in 026 |
| Settlements | `ledger_entries` (001) | `settlements` + `settlement_lines` (004) | Dropped in 026 |
| Group invites | `group_invites` (001) | `invites` (003) | Dropped in 026 |
| Notif prefs | `notification_preferences` (016) | `user_notification_settings` (015) | Dropped in 026 |
| AI logs | `ai_orchestrator_logs` (023) | `ai_interactions` (006) | Dropped in 026 |
| Audit (app) | `audit_logs` (001) | — | Used by queries.py |
| Audit (compliance) | `audit_log` (006) | — | Used by analytics_service.py |

### Module structure

| File | Purpose |
|------|---------|
| `backend/db/__init__.py` | Entry point: `init_db()`, `close_db()` — delegates to `pg.py` |
| `backend/db/pg.py` | asyncpg connection pool (`create_pool`, `get_pool`, `close_db`) |
| `backend/db/queries.py` | **All SQL queries** — 150+ typed helper functions |

### Key helpers in `queries.py`

| Function | Purpose |
|----------|---------|
| `_parse_dt(val)` | Converts ISO string → `datetime`. Pass-through for `datetime` objects. |
| `_coerce_timestamps(data)` | Auto-converts known timestamp columns in a dict before INSERT/UPDATE. |
| `_build_update_query(table, id_col, data)` | Builds parameterized `UPDATE ... SET` from a dict. |
| `_TIMESTAMP_COLUMNS` | Frozenset of column names that get auto-converted (e.g., `created_at`, `updated_at`, `joined_at`, etc.) |
| `generic_insert(table, data)` | Insert a dict into any `ALLOWED_TABLES` table. |
| `generic_find_one(table, where)` | Find one row by equality conditions. |
| `generic_count(table, where)` | Count rows by equality conditions (simple equality only). |
| `generic_find_one_and_update(table, where, update, ...)` | Atomic find+update with optional `increment` and `where_gte` params. |
| `fetch_raw(query, *args)` | Execute arbitrary SQL, return list of dicts. |
| `fetchrow_raw(query, *args)` | Execute arbitrary SQL, return single dict. |

### ALLOWED_TABLES

Generic functions (`generic_insert`, `generic_find_one`, `generic_count`, etc.) only work on tables listed in the `ALLOWED_TABLES` set in `queries.py`. If you add a new table, add it there too.

## Database Rules (Lessons Learned)

These rules exist because we hit real bugs. Follow them strictly.

1. **All timestamps → `_parse_dt()` before asyncpg.** asyncpg expects `datetime` objects for `TIMESTAMPTZ` columns, not ISO strings. Use `_parse_dt()` for individual values or `_coerce_timestamps()` for dicts.

2. **Every column in code MUST exist in the DB schema.** Before writing an INSERT/UPDATE that references a column, verify it exists in `supabase/migrations/`. If it doesn't, create a migration FIRST.

3. **Do NOT use MongoDB operators in generic query functions.** `generic_count()` and `generic_find()` only support simple `column = value` equality. For `!=`, `>=`, `<=`, `IN`, `IS NULL`, etc. — write explicit SQL using `fetch_raw()` or inline `pool.acquire()`.

4. **When adding columns, create a migration file.** Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `supabase/migrations/NNN_description.sql`. Use `IF NOT EXISTS` for safety. All new columns should be nullable unless there's a strong reason.

5. **One canonical column name per concept.** Never create a duplicate column (e.g., both `type` and `feedback_type`). Pick the existing column and map in code.

6. **Counter table columns are `name` / `value`** (not `counter_id` / `seq`). Always verify actual column names before writing queries.

7. **JSONB columns:** asyncpg handles Python dicts/lists natively for JSONB. No need for `json.dumps()` on insert. Use `json.dumps()` only for `@>` containment queries with `::jsonb` casts.

8. **Verify query column targets match the table.** A common bug: `WHERE email = $1` but passing `user_id`. Always check that the column name in the WHERE clause matches the parameter semantics.

9. **Check variable names after DB calls.** The return type of each query function varies: some return `int`, some return `dict`, some return `Optional[dict]`. Never assume `.deleted_count` or `.inserted_id` — those were MongoDB patterns.

## Frontend (Web)

- React app in `frontend/src/`, built with Create React App
- API base URL: `process.env.REACT_APP_BACKEND_URL + "/api"`
- API service layer: `frontend/src/api/` (client.js + per-feature modules: groups, games, notifications, wallet, users, ledger)
- Error boundary: `frontend/src/components/ErrorBoundary.jsx` wraps the entire app
- Routing: React Router in `frontend/src/App.js`
- Navigation: `Sidebar.jsx` (desktop), `Navbar.jsx` (mobile header + notification bell + Socket.IO real-time updates)
- Key pages and their routes:

| Route | Page | Notes |
|-------|------|-------|
| `/dashboard` | Dashboard | Main landing after login |
| `/groups` | Groups | List + create groups |
| `/chats` | Chats | Group messaging |
| `/history` | Settlements | Settlement history |
| `/pending-requests` | Requests | **View invites** and pending requests |
| `/ai` | AI Assistant | Calls `POST /api/assistant/ask` (NOT `/api/ai/chat`) |
| `/schedule` | Schedule | Game scheduling |
| `/settings` | Settings | User + notification preferences |
| `/admin` | Admin | Super admin only |

## Mobile Design System

- Uses Liquid Glass design system: `mobile/src/styles/liquidGlass.ts`
- UI components: `mobile/src/components/ui/` (PageHeader, GlassButton, GlassSurface, etc.)
- Screen wrappers: `BottomSheetScreen` for modal screens
- Theming: `useTheme()` from `mobile/src/context/ThemeContext.tsx`

## Common Pitfalls

Bugs we've hit in production. Read before making changes.

| Pitfall | What went wrong | How to avoid |
|---------|----------------|--------------|
| ISO strings to asyncpg | Passed `"2026-03-06T..."` string to TIMESTAMPTZ column → `DataError` | Always wrap with `_parse_dt()` |
| MongoDB operators in SQL | Used `{"$ne": True}` in `generic_count()` → passed dict as SQL param → crash | Write explicit SQL for anything beyond `=` |
| Wrong column in WHERE | `WHERE email = $1` but passed `user_id` → always returned empty | Double-check param matches column semantics |
| Variable name mismatch | `result.deleted_count` but variable was `result_count` (int) → `AttributeError` | Check return types of query functions |
| Missing DB columns | Code inserted into columns that don't exist in schema → `UndefinedColumnError` | Always check migrations before writing INSERT |
| Duplicate column names | Adding `feedback_type` when `type` already existed → confusion | Use canonical names, map in code |
| Wrong endpoint URL | Frontend called `/api/ai/chat`, backend has `/api/assistant/ask` → 404 | Grep backend for exact route before wiring frontend |
| Counter column names | Used `counter_id`/`seq` but table has `name`/`value` → crash | Verify actual column names in migration SQL |
| ALTER TABLE IF EXISTS | `ALTER TABLE t DROP COLUMN IF EXISTS c` — `IF EXISTS` only applies to the column, not the table → `42P01` if table doesn't exist | Verify the table exists before writing ALTER TABLE |
| Two audit tables | `audit_logs` (001) and `audit_log` (006) BOTH exist and are used | `audit_logs` = app-level (queries.py), `audit_log` = compliance (analytics_service.py) |
