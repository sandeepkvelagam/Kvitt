"""AI Assistant endpoints: usage, ask (tiered Kvitt Brain).
Extracted from server.py — pure mechanical move, zero behavior changes."""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries
import wallet_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["assistant"])


# ── Pydantic models ──────────────────────────────────────────────

class AskAssistantRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, str]]] = None
    flow_event: Optional[Dict[str, Any]] = None


# ── Constants ─────────────────────────────────────────────────────

AI_DAILY_LIMIT_FREE = 10
AI_DAILY_LIMIT_PREMIUM = 50


# ── Rate Limiting Helpers ─────────────────────────────────────────

async def check_ai_rate_limit(user_id: str, daily_limit: int) -> bool:
    """Check AI request rate limit. Returns True if allowed."""
    return await wallet_service.check_rate_limit(
        key=f"ai:{user_id}",
        endpoint="assistant_ask",
        limit=daily_limit,
        window_seconds=86400
    )

async def get_ai_requests_remaining(user_id: str, daily_limit: int) -> int:
    """Get remaining AI requests for current period."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=86400)
    doc = await queries.find_rate_limit(f"ai:{user_id}", "assistant_ask", window_start)
    used = doc["count"] if doc else 0
    return max(0, daily_limit - used)

async def get_user_ai_limit(user_id: str) -> tuple:
    """Get daily limit and premium status for user."""
    user_doc = await queries.get_user(user_id)
    is_premium = user_doc.get("is_premium", False) if user_doc else False
    daily_limit = AI_DAILY_LIMIT_PREMIUM if is_premium else AI_DAILY_LIMIT_FREE
    return daily_limit, is_premium


# ── Navigation Detection ─────────────────────────────────────────

SCREEN_MAP = {
    "groups": {"screen": "Groups", "params": {}},
    "wallet": {"screen": "Wallet", "params": {}},
    "settings": {"screen": "Settings", "params": {}},
    "premium": {"screen": "Billing", "params": {}},
    "billing": {"screen": "Billing", "params": {}},
    "notifications": {"screen": "Notifications", "params": {}},
    "profile": {"screen": "Settings", "params": {}},
    "automations": {"screen": "Automations", "params": {}},
    "history": {"screen": "SettlementHistory", "params": {}},
}

NAV_TRIGGERS = {
    "groups": ["go to groups", "my groups", "see groups", "manage groups", "create a group", "show groups", "open groups"],
    "wallet": ["go to wallet", "my wallet", "check wallet", "wallet balance", "open wallet"],
    "settings": ["go to settings", "open settings", "my settings", "my profile"],
    "premium": ["upgrade", "go premium", "go pro", "billing", "subscription"],
    "automations": ["automations", "my automations"],
    "history": ["game history", "past games", "settlement history"],
    "notifications": ["my notifications", "check notifications"],
}

def detect_navigation(user_input: str, ai_response: str):
    """Detect if the response implies navigation to a screen."""
    combined = (user_input + " " + (ai_response or "")).lower()
    for key, triggers in NAV_TRIGGERS.items():
        for trigger in triggers:
            if trigger in combined:
                return SCREEN_MAP.get(key)
    return None


# ── Content Guardrails ────────────────────────────────────────────

def validate_ai_input(message: str) -> str | None:
    """Validate user input. Returns error message if invalid, None if ok."""
    if not message or not message.strip():
        return "Please enter a message."
    if len(message) > 1000:
        return "Message too long. Please keep it under 1000 characters."
    return None


# ── Follow-up Extraction ─────────────────────────────────────────

def extract_follow_ups(text: str) -> tuple:
    """Extract follow-up suggestions from LLM response text.
    Returns (cleaned_text, follow_ups_list)."""
    import re as _re
    match = _re.search(r'---FOLLOW_UPS---\s*(\[.*?\])\s*---END_FOLLOW_UPS---', text, _re.DOTALL)
    if match:
        try:
            follow_ups = json.loads(match.group(1))
            cleaned = text[:match.start()].rstrip()
            return cleaned, follow_ups[:3]
        except (json.JSONDecodeError, ValueError):
            pass
    return text, []


# ── User Context ──────────────────────────────────────────────────

async def fetch_user_context_summary(user_id: str) -> Dict:
    """Fetch lightweight user data summary for LLM context (Tier 2 calls only)."""
    ctx = {}
    try:
        # Profile
        user_doc = await queries.get_user(user_id)
        if user_doc:
            ctx["profile"] = {
                "name": user_doc.get("name", "Unknown"),
                "level": user_doc.get("level", "Rookie"),
                "total_games": user_doc.get("total_games", 0),
                "total_profit": user_doc.get("total_profit", 0.0),
                "badges_count": len(user_doc.get("badges", [])),
            }

        # Groups
        memberships = await queries.generic_find("group_members", {"user_id": user_id})
        group_ids = [m["group_id"] for m in memberships]
        if group_ids:
            groups = await queries.fetch_raw(
                "SELECT group_id, name FROM groups WHERE group_id = ANY($1)",
                group_ids
            )
            ctx["groups"] = [
                {"name": g.get("name", "Unnamed"), "role": next((m.get("role", "member") for m in memberships if m["group_id"] == g["group_id"]), "member")}
                for g in groups
            ]

        # Active games count
        if group_ids:
            active_rows = await queries.fetch_raw(
                "SELECT COUNT(*) AS cnt FROM game_nights WHERE group_id = ANY($1) AND status = 'active'",
                group_ids
            )
            ctx["active_games_count"] = active_rows[0]["cnt"] if active_rows else 0

        # Pending settlements
        owed_to = await queries.fetch_raw(
            "SELECT amount FROM ledger_entries WHERE to_user_id = $1 AND status != 'paid'",
            user_id
        )
        owes = await queries.fetch_raw(
            "SELECT amount FROM ledger_entries WHERE from_user_id = $1 AND status != 'paid'",
            user_id
        )
        ctx["settlements"] = {
            "owed_to_you": round(sum(e.get("amount", 0) for e in owed_to), 2),
            "you_owe": round(sum(e.get("amount", 0) for e in owes), 2),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch user context for assistant: {e}")
    return ctx


# ── Routes ────────────────────────────────────────────────────────

@router.get("/assistant/usage")
async def get_assistant_usage(user: User = Depends(get_current_user)):
    """Get AI assistant usage for current period."""
    daily_limit, is_premium = await get_user_ai_limit(user.user_id)
    remaining = await get_ai_requests_remaining(user.user_id, daily_limit)
    return {
        "requests_used": daily_limit - remaining,
        "requests_remaining": remaining,
        "daily_limit": daily_limit,
        "is_premium": is_premium
    }

@router.post("/assistant/ask")
async def ask_assistant(data: AskAssistantRequest, user: User = Depends(get_current_user)):
    """Ask the AI assistant a question (BETA - powered by tiered Kvitt Brain)."""
    from ai_assistant import get_quick_answer

    # Step 1: Validate input
    validation_error = validate_ai_input(data.message)
    if validation_error:
        return {"response": validation_error, "source": "guardrail", "requests_remaining": None}

    # Step 2: Check rate limit (checked early, but Tier 0 won't consume a request)
    daily_limit, is_premium = await get_user_ai_limit(user.user_id)

    # Step 3: Cap conversation history
    history = (data.conversation_history or [])[-20:]

    # Step 4: Quick answer fast path (no API call needed)
    quick = get_quick_answer(data.message)
    if quick:
        remaining = await get_ai_requests_remaining(user.user_id, daily_limit)
        resp = {
            "response": quick["text"],
            "source": "quick_answer",
            "requests_remaining": remaining,
        }
        if quick.get("follow_ups"):
            resp["follow_ups"] = quick["follow_ups"]
        if quick.get("navigation"):
            resp["navigation"] = quick["navigation"]
        return resp

    # Step 4.5: Flow continuation — if flow_event present, advance the flow
    if data.flow_event:
        try:
            from ai_service.flows import get_flow
            import ai_service.flows.issue_report_flow  # noqa: F401

            fe = data.flow_event
            flow = get_flow(fe.get("flow_id", ""))
            if flow:
                result = await flow.advance(
                    step=fe.get("step", 0),
                    action=fe.get("action", ""),
                    value=fe.get("value", ""),
                    flow_data=fe.get("flow_data", {}),
                    user_id=user.user_id,
                    interaction_id=fe.get("interaction_id", ""),
                )
                remaining = await get_ai_requests_remaining(user.user_id, daily_limit)
                resp = {
                    "response": result.text,
                    "source": result.source,
                    "requests_remaining": remaining,
                }
                if result.structured_content:
                    resp["structured_content"] = result.structured_content
                if result.follow_ups:
                    resp["follow_ups"] = result.follow_ups

                try:
                    await queries.insert_assistant_event({
                        "user_id": user.user_id,
                        "message": data.message or f"[flow:{fe.get('flow_id')}:step:{fe.get('step')}]",
                        "intent": f"flow_{fe.get('flow_id')}",
                        "confidence": 1.0,
                        "tier": "flow",
                        "timestamp": datetime.now(timezone.utc),
                    })
                except Exception:
                    pass

                return resp
        except Exception as e:
            logger.warning(f"Flow advance error: {e}")
            # Fall through to normal processing

    # Step 5: IntentRouter — local classification (no LLM)
    try:
        from ai_service.intent_router import IntentRouter
        from ai_service.fast_answer_engine import FastAnswerEngine

        intent_router = IntentRouter()
        intent_result = intent_router.classify(data.message, context=data.context, history=history)

        # Step 6: Tier 0 — Fast answer from DB (free, no rate limit consumed)
        if intent_result.confidence >= 0.75 and not intent_result.requires_llm:
            engine = FastAnswerEngine()
            answer = await engine.answer(intent_result, user_id=user.user_id)
            remaining = await get_ai_requests_remaining(user.user_id, daily_limit)

            # Detect navigation intent
            navigation = answer.navigation or detect_navigation(data.message, answer.text)

            resp = {
                "response": answer.text,
                "source": answer.source if answer.source != "fast_answer" else "fast_answer",
                "follow_ups": answer.follow_ups,
                "requests_remaining": remaining,
            }
            if navigation:
                resp["navigation"] = navigation
            if answer.structured_content:
                resp["structured_content"] = answer.structured_content

            # Log for analytics (non-blocking)
            try:
                await queries.insert_assistant_event({
                    "user_id": user.user_id,
                    "message": data.message,
                    "intent": intent_result.intent,
                    "confidence": intent_result.confidence,
                    "tier": "fast_answer",
                    "follow_ups_shown": answer.follow_ups,
                    "timestamp": datetime.now(timezone.utc),
                })
            except Exception:
                pass

            return resp
    except Exception as e:
        logger.warning(f"IntentRouter/FastAnswer error: {e}")
        # Fall through to Tier 2

    # Step 7: Tier 2 — Route through orchestrator (consumes rate limit)
    allowed = await check_ai_rate_limit(user.user_id, daily_limit)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Daily AI request limit reached",
                "limit": daily_limit,
                "requests_remaining": 0,
                "is_premium": is_premium,
                "upgrade_message": "You've reached your daily limit. Upgrade to Premium for 50 requests/day!" if not is_premium else "Daily limit reached. Resets in 24 hours."
            }
        )

    try:
        from server import get_orchestrator
        orchestrator = get_orchestrator()
        if orchestrator:
            context = data.context or {}
            context["user_id"] = user.user_id
            context["is_beta"] = True
            context["conversation_history"] = history

            # Fetch user data for LLM context
            user_data = await fetch_user_context_summary(user.user_id)
            context["user_data"] = user_data

            result = await orchestrator.process(
                user_input=data.message,
                context=context,
                user_id=user.user_id
            )

            # Extract handler/tool info before processing response text
            TOOL_LABELS = {
                "scheduler": "Checked schedule & availability",
                "poker_evaluator": "Analyzed poker hand",
                "game_manager": "Managed game settings",
                "notification_sender": "Sent notifications",
                "report_generator": "Generated analytics report",
                "payment_tracker": "Checked payments",
                "agent_game_setup": "Set up a new game",
                "agent_analytics": "Ran analytics",
                "agent_host_persona": "Used host assistant",
                "agent_game_planner": "Planned game schedule",
                "agent_notification": "Managed notifications",
                "agent_engagement": "Checked engagement",
                "agent_feedback": "Processed feedback",
                "agent_payment_reconciliation": "Reconciled payments",
            }
            handler = result.get("_handler")

            response_text = result.get("message") or result.get("data") or "I couldn't process that request. Try asking differently."
            if isinstance(response_text, dict):
                response_text = str(response_text)

            # Extract follow-ups from LLM response
            response_text, follow_ups = extract_follow_ups(response_text)

            # Detect navigation intent
            navigation = detect_navigation(data.message, response_text)
            remaining = await get_ai_requests_remaining(user.user_id, daily_limit)

            resp = {
                "response": response_text,
                "source": "orchestrator",
                "requests_remaining": remaining,
            }
            if handler:
                resp["agent_activity"] = TOOL_LABELS.get(handler, handler)
                resp["agent_source"] = handler
            if follow_ups:
                resp["follow_ups"] = follow_ups
            if navigation:
                resp["navigation"] = navigation

            # Log for analytics (non-blocking)
            try:
                await queries.insert_assistant_event({
                    "user_id": user.user_id,
                    "message": data.message,
                    "intent": "orchestrator",
                    "confidence": 0.0,
                    "tier": "orchestrator",
                    "follow_ups_shown": follow_ups,
                    "timestamp": datetime.now(timezone.utc),
                })
            except Exception:
                pass

            return resp
        else:
            raise Exception("Orchestrator not available")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Orchestrator error in assistant: {e}")
        # Fallback to simple AI
        try:
            from ai_assistant import get_ai_response
            session_id = f"kvitt_{user.user_id}"
            ctx = data.context or {}
            ctx["user_role"] = "user"
            # Inject user data into fallback context too
            try:
                user_data = await fetch_user_context_summary(user.user_id)
                ctx["user_data"] = user_data
            except Exception:
                pass
            fallback_response = await get_ai_response(data.message, session_id, ctx)
            remaining = await get_ai_requests_remaining(user.user_id, daily_limit)
            navigation = detect_navigation(data.message, fallback_response)
            resp = {
                "response": fallback_response,
                "source": "ai_fallback",
                "requests_remaining": remaining
            }
            if navigation:
                resp["navigation"] = navigation
            return resp
        except Exception as fallback_err:
            logger.error(f"AI fallback error: {fallback_err}")
            return {
                "response": "Sorry, I'm having trouble right now. Please try again later.",
                "source": "error",
                "requests_remaining": None
            }
