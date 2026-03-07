# AI Assistant and API Verification Guide

## Summary of Fixes Applied

1. **anthropic package** - Added to `requirements.txt`. The Claude orchestrator requires it for Tier 2 (LLM-powered) AI responses. Without it, the orchestrator falls back to keyword matching only.

2. **Orchestrator timestamp** - Fixed `datetime.utcnow()` to `datetime.now(timezone.utc)` for asyncpg TIMESTAMPTZ compatibility.

3. **Verification script** - `backend/scripts/verify_ai_and_apis.py` for quick API checks.

## AI Assistant Flow

```
User asks question
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ 1. Quick Answer (no API) - e.g. "how do I create a group"   │
│    → Returns from QUICK_ANSWERS dict                          │
└──────────────────────────────────────────────────────────────┘
       │ (if no match)
       ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Flow continuation - e.g. issue report flow               │
└──────────────────────────────────────────────────────────────┘
       │ (if no flow_event)
       ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. IntentRouter + FastAnswerEngine (Tier 0)                   │
│    → Local classification, DB-backed answers (free)           │
└──────────────────────────────────────────────────────────────┘
       │ (if confidence < 0.75 or requires_llm)
       ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Orchestrator (Tier 2) - Claude tool-use routing           │
│    → Requires ANTHROPIC_API_KEY + anthropic package          │
│    → Falls back to keyword matching if Claude unavailable     │
└──────────────────────────────────────────────────────────────┘
       │ (if orchestrator fails)
       ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. OpenAI fallback (ai_assistant.get_ai_response)           │
│    → Requires OPENAI_API_KEY                                  │
└──────────────────────────────────────────────────────────────┘
```

## Key Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/assistant/usage` | Yes | Usage limits for current user |
| `POST /api/assistant/ask` | Yes | Ask AI assistant (message, context, conversation_history) |
| `GET /api/health` | No | Health check |

## @kvitt in Group Chat

- Handled by `EventListenerService` + `GroupChatAgent`
- Triggered when user mentions `@kvitt` in a group message
- Requires orchestrator (same as assistant)
- Event flow: group message → event_logs → event listener → group chat agent

## Deployment Checklist (Lightsail)

1. **Install anthropic**: `pip install anthropic` (or redeploy with updated requirements.txt)
2. **Env vars**: `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in `.env`
3. **Restart**: `sudo systemctl restart kvitt`

## Run Verification

```bash
cd backend
python scripts/verify_ai_and_apis.py --url https://kvitt.duckdns.org
# With auth (get token from app login):
python scripts/verify_ai_and_apis.py --url https://kvitt.duckdns.org --token YOUR_JWT
```
