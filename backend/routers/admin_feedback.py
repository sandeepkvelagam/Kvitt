"""Admin feedback management, AI drafts, and similar reports endpoints.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import logging
from typing import Optional, Dict
from datetime import datetime, date
from decimal import Decimal
import uuid

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel

from db.pg import get_pool
from role_middleware import get_admin_context, AdminContext
import platform_analytics
from websocket_manager import emit_feedback_updated

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["admin-feedback"])


# ── Helpers ───────────────────────────────────────────────────────

def _feedback_json_safe(val):
    """Convert asyncpg types to JSON-serializable values. Handles nested structures."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, bytes):
        try:
            return val.decode("utf-8")
        except Exception:
            return None
    if isinstance(val, dict):
        return {k: _feedback_json_safe(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_feedback_json_safe(v) for v in val]
    if isinstance(val, (str, int, float, bool)):
        return val
    try:
        return str(val)
    except Exception:
        return None


# Allowed status transitions for admin respond endpoint
_ADMIN_RESPOND_TRANSITIONS = {
    "new": {"in_progress", "needs_user_info", "resolved", "wont_fix"},
    "open": {"in_progress", "needs_user_info", "resolved", "wont_fix"},
    "classified": {"in_progress", "needs_user_info", "resolved", "wont_fix"},
    "in_progress": {"needs_user_info", "resolved", "wont_fix"},
    "needs_user_info": {"in_progress", "resolved", "wont_fix"},
    "needs_host_action": {"in_progress", "resolved", "wont_fix"},
    "resolved": {"in_progress"},  # reopen only
}


# ── Models ────────────────────────────────────────────────────────

class AdminFeedbackResponse(BaseModel):
    message: str
    new_status: Optional[str] = None
    idempotency_key: Optional[str] = None


# ── AI Draft cache & templates ────────────────────────────────────

# In-memory cache for AI drafts (feedback_id → {draft, ts})
_ai_draft_cache: Dict[str, Dict] = {}
_AI_DRAFT_CACHE_TTL = 300  # 5 minutes

# Template fallbacks (same as frontend DRAFT_TEMPLATES)
_DRAFT_FALLBACK_TEMPLATES = {
    "bug": "Thank you for reporting this bug. We've identified the issue and our team is working on a fix. We'll update you once it's resolved.",
    "complaint": "We appreciate you bringing this to our attention. We take your feedback seriously and are reviewing the situation. We'll follow up with next steps shortly.",
    "feature_request": "Thanks for the feature suggestion! We've logged this for our product team to review. We'll keep you updated on any progress.",
    "ux_issue": "Thank you for flagging this UX issue. We're looking into ways to improve this experience. Your feedback helps us make the app better.",
    "praise": "Thank you for the kind words! We're glad you're enjoying the experience. Your feedback motivates our team.",
    "other": "Thank you for reaching out. We've received your report and will review it. We'll get back to you if we need any additional information.",
}


# ── Routes ────────────────────────────────────────────────────────

# NOTE: Specific routes (/stats, /{feedback_id}) must be registered BEFORE
# the generic list route (/admin/feedback) to avoid FastAPI route shadowing.

@router.get("/admin/feedback/stats")
async def admin_get_feedback_stats(
    days: int = 30,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get feedback statistics for admin dashboard."""
    await ctx.audit("view_feedback_stats", {"days": days})

    return await platform_analytics.get_feedback_stats(days=days)


@router.get("/admin/feedback/{feedback_id}")
async def admin_get_feedback_detail(
    feedback_id: str,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get a single feedback entry by ID."""
    await ctx.audit("view_feedback_detail", {"feedback_id": feedback_id})

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        async with pool.acquire() as conn:
            feedback = await conn.fetchrow(
                "SELECT * FROM feedback WHERE feedback_id = $1",
                feedback_id
            )
            if not feedback:
                raise HTTPException(status_code=404, detail="Feedback not found")

            result = dict(feedback)

            # Get user info
            if result.get("user_id"):
                user = await conn.fetchrow(
                    "SELECT name, email FROM users WHERE user_id = $1",
                    result["user_id"]
                )
                if user:
                    result["user_name"] = user["name"] or user["email"]
                    result["user_email"] = user["email"]

            # Get group name if applicable
            if result.get("group_id"):
                group = await conn.fetchrow(
                    "SELECT name FROM groups WHERE group_id = $1",
                    result["group_id"]
                )
                if group:
                    result["group_name"] = group["name"]

            result = {k: _feedback_json_safe(v) for k, v in result.items()}
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching feedback detail {feedback_id}")
        raise HTTPException(status_code=500, detail=f"Error loading report: {str(e)}")


@router.get("/admin/feedback")
async def admin_get_feedback(
    feedback_type: Optional[str] = None,
    status: Optional[str] = None,
    days: int = 30,
    limit: int = 50,
    offset: int = 0,
    ctx: AdminContext = Depends(get_admin_context)
):
    """
    Get all user feedback/reports for admin dashboard.
    Returns feedback entries (bugs, complaints, feature requests, etc.) with optional filters.
    """
    await ctx.audit("view_feedback", {
        "feedback_type": feedback_type,
        "status": status,
        "days": days
    })

    return await platform_analytics.get_admin_feedback(
        feedback_type=feedback_type,
        status=status,
        days=days,
        limit=limit,
        offset=offset
    )


@router.post("/admin/feedback/{feedback_id}/respond")
async def admin_respond_to_feedback(
    feedback_id: str,
    data: AdminFeedbackResponse,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Admin responds to a user report. Persists event + optional status change, then best-effort notifications."""
    await ctx.audit("respond_to_feedback", {"feedback_id": feedback_id, "new_status": data.new_status})

    # 1. Validate message
    message = (data.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty or whitespace-only")
    if len(message) > 5000:
        raise HTTPException(status_code=400, detail="Message exceeds 5000 character limit")

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available")

    # 2. Fetch feedback
    async with pool.acquire() as conn:
        feedback = await conn.fetchrow(
            "SELECT feedback_id, user_id, status, type FROM feedback WHERE feedback_id = $1",
            feedback_id
        )
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    current_status = feedback["status"] or "open"

    # 3. Validate status transition
    if data.new_status:
        allowed = _ADMIN_RESPOND_TRANSITIONS.get(current_status)
        if allowed is None or data.new_status not in allowed:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot transition from '{current_status}' to '{data.new_status}'"
            )

    # 4. Idempotency check
    if data.idempotency_key:
        async with pool.acquire() as conn:
            existing_events = await conn.fetchval(
                "SELECT events FROM feedback WHERE feedback_id = $1",
                feedback_id
            )
            if existing_events:
                import json as _json_mod2
                evts = existing_events if isinstance(existing_events, list) else _json_mod2.loads(existing_events) if isinstance(existing_events, str) else []
                for evt in evts:
                    details = evt.get("details", {})
                    if isinstance(details, dict) and details.get("idempotency_key") == data.idempotency_key:
                        return {
                            "success": True,
                            "feedback_id": feedback_id,
                            "new_status": data.new_status or current_status,
                            "notification": {"in_app": "skipped", "push": "skipped", "email": "skipped"},
                            "deduplicated": True
                        }

    # 5. Persist admin response event
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()

    event_details = {"message": message}
    if data.idempotency_key:
        event_details["idempotency_key"] = data.idempotency_key

    result = await collector._add_event(
        feedback_id=feedback_id,
        event_type="admin_response",
        actor_id=ctx.user.user_id,
        details=event_details
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error or "Failed to add response event")

    # 6. Persist status change if requested
    final_status = current_status
    if data.new_status:
        status_result = await collector.execute(
            action="update_status",
            feedback_id=feedback_id,
            status=data.new_status,
            user_id=ctx.user.user_id,
        )
        if status_result.success:
            final_status = data.new_status

    # 7. Best-effort notifications (non-blocking)
    notification_result = {"in_app": "skipped", "push": "skipped", "email": "skipped"}
    reporter_user_id = feedback["user_id"]
    if reporter_user_id:
        try:
            from ai_service.tools.notification_sender import NotificationSenderTool
            notifier = NotificationSenderTool()
            notif_result = await notifier.execute(
                user_ids=[reporter_user_id],
                title="Update on your report",
                message=message[:200],
                notification_type="general",
                channels=["in_app", "push", "email"],
                data={"feedback_id": feedback_id, "type": "feedback_response"}
            )
            if notif_result.success:
                notification_result = {"in_app": "queued", "push": "queued", "email": "queued"}
        except Exception as e:
            logger.warning(f"Notification failed for feedback {feedback_id}: {e}")
            notification_result = {"in_app": "failed", "push": "failed", "email": "failed"}

    # 8. Real-time: notify admins viewing this feedback
    try:
        await emit_feedback_updated(feedback_id, {"type": "admin_response"})
    except Exception as e:
        logger.warning(f"emit_feedback_updated failed for {feedback_id}: {e}")

    return {
        "success": True,
        "feedback_id": feedback_id,
        "new_status": final_status,
        "notification": notification_result
    }


@router.post("/admin/feedback/{feedback_id}/ai-draft")
async def generate_feedback_ai_draft(
    feedback_id: str,
    request: Request,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Generate an AI-powered draft reply for admin. Cached, non-blocking, advisory."""
    import time as _time

    try:
        # Check cache first
        cached = _ai_draft_cache.get(feedback_id)
        if cached and (_time.time() - cached["ts"]) < _AI_DRAFT_CACHE_TTL:
            return {"draft": cached["draft"], "model": cached.get("model"), "cached": True}

        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=503, detail="Database not available")

        # Fetch feedback
        async with pool.acquire() as conn:
            feedback = await conn.fetchrow(
                """SELECT feedback_id, type, content, status, classification,
                          user_id, events, auto_fix_attempted, auto_fix_result
                   FROM feedback WHERE feedback_id = $1""",
                feedback_id
            )
        if not feedback:
            raise HTTPException(status_code=404, detail="Feedback not found")

        feedback_type = feedback["type"] or "other"
        content = feedback["content"] or ""

        # Try Claude Haiku for contextual draft
        draft = None
        model_used = None
        try:
            from ai_service.claude_client import get_claude_client
            client = get_claude_client()
            if client.is_available:
                system_prompt = """You are an admin support assistant for ODDSIDE, a poker game app.
Draft a professional, empathetic admin response to this user report.
Rules:
- Be concise (2-4 sentences)
- Address the specific issue the user reported
- Don't make promises you can't keep
- If the issue is a bug, acknowledge it and mention investigation
- If it's a complaint, empathize and explain next steps
- If it's praise, thank them warmly
- Do NOT use markdown formatting
- Return ONLY the response text, nothing else"""

                user_msg = f"Report type: {feedback_type}\nStatus: {feedback['status']}\n\nUser's report:\n{content[:1500]}"
                if feedback["classification"]:
                    user_msg += f"\nClassification: {feedback['classification']}"

                model_used = "claude-haiku-4-5-20251001"
                response = await client.async_client.messages.create(
                    model=model_used,
                    max_tokens=300,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_msg}]
                )
                if response.content and len(response.content) > 0 and hasattr(response.content[0], "text"):
                    draft = (response.content[0].text or "").strip()
        except Exception as e:
            logger.warning(f"AI draft generation failed for {feedback_id}: {e}")

        # Fallback to template
        if not draft:
            draft = _DRAFT_FALLBACK_TEMPLATES.get(feedback_type, _DRAFT_FALLBACK_TEMPLATES["other"])
            model_used = None

        # Cache the result
        _ai_draft_cache[feedback_id] = {"draft": draft, "model": model_used, "ts": _time.time()}

        return {"draft": draft, "model": model_used, "cached": False}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error generating AI draft for {feedback_id}")
        raise HTTPException(status_code=500, detail=f"Error generating draft: {str(e)}")


@router.get("/admin/feedback/{feedback_id}/similar")
async def get_similar_feedback(
    feedback_id: str,
    request: Request,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Find similar/duplicate reports for the AI Assist panel."""
    try:
        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=503, detail="Database not available")

        # Fetch current feedback for matching criteria
        async with pool.acquire() as conn:
            feedback = await conn.fetchrow(
                "SELECT feedback_id, content_hash, type, classification FROM feedback WHERE feedback_id = $1",
                feedback_id
            )
        if not feedback:
            raise HTTPException(status_code=404, detail="Feedback not found")

        content_hash = feedback["content_hash"]
        feedback_type = feedback["type"]
        classification = feedback["classification"]

        # Find similar: exact hash match OR same type+classification within 90 days
        async with pool.acquire() as conn:
            if content_hash and classification:
                similar = await conn.fetch("""
                    SELECT feedback_id, type, status, LEFT(content, 200) as content_preview,
                           created_at,
                           CASE WHEN content_hash = $2 THEN 'exact_hash' ELSE 'same_classification' END as match_reason
                    FROM feedback
                    WHERE feedback_id != $1
                      AND created_at >= NOW() - INTERVAL '90 days'
                      AND (content_hash = $2 OR (type = $3 AND classification = $4))
                    ORDER BY
                      CASE WHEN content_hash = $2 THEN 0 ELSE 1 END,
                      created_at DESC
                    LIMIT 5
                """, feedback_id, content_hash, feedback_type, classification)
            elif content_hash:
                similar = await conn.fetch("""
                    SELECT feedback_id, type, status, LEFT(content, 200) as content_preview,
                           created_at, 'exact_hash' as match_reason
                    FROM feedback
                    WHERE feedback_id != $1
                      AND created_at >= NOW() - INTERVAL '90 days'
                      AND content_hash = $2
                    ORDER BY created_at DESC
                    LIMIT 5
                """, feedback_id, content_hash)
            else:
                similar = []

        results = []
        for row in similar:
            r = {k: _feedback_json_safe(v) for k, v in dict(row).items()}
            results.append(r)

        return {"feedback_id": feedback_id, "similar": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching similar feedback for {feedback_id}")
        raise HTTPException(status_code=500, detail=f"Error finding similar reports: {str(e)}")
