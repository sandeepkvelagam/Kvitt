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
- **Mobile**: React Native (Expo) with TypeScript
- **Database**: PostgreSQL via Supabase (Motor-compatible wrapper in `backend/db/__init__.py`)
- **Push Notifications**: Expo Push API
- **Email**: Resend via `backend/email_service.py`
- **Real-time**: Socket.IO via `backend/websocket_manager.py`
- **AI**: Claude API via `backend/ai_service/`

## Database

- All data is stored in PostgreSQL/Supabase. There is NO MongoDB.
- The `backend/db/__init__.py` provides a Motor-compatible wrapper (`db.collection.find_one()`, `insert_one()`, etc.) that routes to PostgreSQL.
- Migrations live in `supabase/migrations/`.

## Mobile Design System

- Uses Liquid Glass design system: `mobile/src/styles/liquidGlass.ts`
- UI components: `mobile/src/components/ui/` (PageHeader, GlassButton, GlassSurface, etc.)
- Screen wrappers: `BottomSheetScreen` for modal screens
- Theming: `useTheme()` from `mobile/src/context/ThemeContext.tsx`
