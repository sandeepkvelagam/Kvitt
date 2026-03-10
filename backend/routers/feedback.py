"""Feedback endpoints: submit, survey, thread, reply, auto-fix.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries
from db.pg import get_pool
from websocket_manager import emit_feedback_updated
from role_middleware import get_admin_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["feedback"])


# ============== FEEDBACK MODELS ==============

class FeedbackSubmit(BaseModel):
    feedback_type: str = "other"  # bug, feature_request, ux_issue, complaint, praise, other
    content: str
    group_id: Optional[str] = None
    game_id: Optional[str] = None
    tags: List[str] = []
    context: Dict[str, Any] = {}
    idempotency_key: Optional[str] = None  # Prevents duplicate processing from retries

class SurveySubmit(BaseModel):
    game_id: str
    rating: int  # 1-5
    comment: str = ""
    group_id: Optional[str] = None

class FeedbackStatusUpdate(BaseModel):
    status: Optional[str] = None
    owner_type: Optional[str] = None
    owner_id: Optional[str] = None
    linked_feedback_id: Optional[str] = None

class FeedbackEventAdd(BaseModel):
    event_type: str = "note"
    details: Dict[str, Any] = {}

class AutoFixRequest(BaseModel):
    fix_type: str
    feedback_id: Optional[str] = None
    group_id: Optional[str] = None
    game_id: Optional[str] = None
    confirmed: bool = False

class ConfirmFixRequest(BaseModel):
    confirmed: bool = True

class UserFeedbackReply(BaseModel):
    message: str


# ============== HELPER ==============

def _build_feedback_agent():
    """
    Always returns a FeedbackAgent with required tools registered.
    Tries orchestrator first; falls back to local registry with explicit registration.
    """
    # 1) Try orchestrator (preferred — has all tools pre-registered)
    try:
        from ai_service.orchestrator import AIOrchestrator
        orchestrator = AIOrchestrator()
        agent = orchestrator.agent_registry.get("feedback")
        if agent:
            return agent
        logger.warning("AIOrchestrator loaded but 'feedback' agent not in agent_registry")
    except Exception as e:
        logger.exception("AIOrchestrator init failed, falling back to local FeedbackAgent: %s", e)

    # 2) Fallback — register tools explicitly so agent always works
    from ai_service.tools.registry import ToolRegistry
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    from ai_service.tools.feedback_classifier import FeedbackClassifierTool
    from ai_service.tools.feedback_policy import FeedbackPolicyTool
    from ai_service.tools.auto_fixer import AutoFixerTool
    from ai_service.tools.notification_sender import NotificationSenderTool
    from ai_service.agents.feedback_agent import FeedbackAgent

    registry = ToolRegistry()
    if not registry.get("feedback_collector"):
        registry.register(FeedbackCollectorTool())
    if not registry.get("feedback_classifier"):
        registry.register(FeedbackClassifierTool(llm_client=None))
    if not registry.get("feedback_policy"):
        registry.register(FeedbackPolicyTool())
    if not registry.get("auto_fixer"):
        registry.register(AutoFixerTool(tool_registry=registry))
    if not registry.get("notification_sender"):
        registry.register(NotificationSenderTool())

    return FeedbackAgent(tool_registry=registry, llm_client=None)


# ============== FEEDBACK ENDPOINTS ==============


@router.post("/feedback")
async def submit_feedback(data: FeedbackSubmit, current_user: User = Depends(get_current_user)):
    """Submit user feedback (bug report, feature request, complaint, etc.)."""
    agent = _build_feedback_agent()

    result = await agent.execute(
        "Submit feedback",
        context={
            "action": "submit_feedback",
            "user_id": current_user.user_id,
            "feedback_type": data.feedback_type,
            "content": data.content,
            "group_id": data.group_id,
            "game_id": data.game_id,
            "tags": data.tags,
            "context": data.context,
            "idempotency_key": data.idempotency_key,
        }
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return {"success": True, "data": result.data, "message": result.message}


@router.post("/feedback/survey")
async def submit_survey(data: SurveySubmit, current_user: User = Depends(get_current_user)):
    """Submit a post-game survey (star rating + optional comment)."""
    if not (1 <= data.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()
    result = await collector.execute(
        action="submit_survey",
        user_id=current_user.user_id,
        game_id=data.game_id,
        group_id=data.group_id,
        rating=data.rating,
        content=data.comment
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return {"success": True, "data": result.data}


@router.get("/feedback")
async def get_feedback(
    group_id: Optional[str] = None,
    feedback_type: Optional[str] = None,
    days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """Get feedback entries with optional filters."""
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()
    result = await collector.execute(
        action="get_feedback",
        user_id=current_user.user_id,
        group_id=group_id,
        feedback_type=feedback_type,
        days=days
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data


@router.get("/feedback/surveys/{game_id}")
async def get_game_surveys(game_id: str, current_user: User = Depends(get_current_user)):
    """Get survey responses for a specific game."""
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()
    result = await collector.execute(action="get_surveys", game_id=game_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data


@router.get("/feedback/trends")
async def get_feedback_trends(
    group_id: Optional[str] = None,
    days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """Get feedback trends and aggregates."""
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()
    result = await collector.execute(action="get_trends", group_id=group_id, days=days)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data


@router.get("/feedback/unresolved")
async def get_unresolved_feedback(
    group_id: Optional[str] = None,
    feedback_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all unresolved feedback entries."""
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()
    result = await collector.execute(
        action="get_unresolved",
        group_id=group_id,
        feedback_type=feedback_type
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data


@router.put("/feedback/{feedback_id}/resolve")
async def resolve_feedback(feedback_id: str, current_user: User = Depends(get_current_user)):
    """Mark a feedback entry as resolved."""
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()
    result = await collector.execute(action="mark_resolved", feedback_id=feedback_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return {"success": True, "data": result.data}


@router.put("/feedback/{feedback_id}/status")
async def update_feedback_status(
    feedback_id: str,
    data: FeedbackStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update feedback status, ownership, or link duplicates."""
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()
    result = await collector.execute(
        action="update_status",
        feedback_id=feedback_id,
        status=data.status,
        user_id=current_user.user_id,
        owner_type=data.owner_type,
        owner_id=data.owner_id,
        linked_feedback_id=data.linked_feedback_id
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return {"success": True, "data": result.data}


@router.post("/feedback/{feedback_id}/events")
async def add_feedback_event(
    feedback_id: str,
    data: FeedbackEventAdd,
    current_user: User = Depends(get_current_user)
):
    """Add an event to a feedback entry's audit trail."""
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()
    result = await collector.execute(
        action="add_event",
        feedback_id=feedback_id,
        event_type=data.event_type,
        user_id=current_user.user_id,
        event_details=data.details
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return {"success": True, "data": result.data}


@router.post("/feedback/auto-fix")
async def attempt_auto_fix(
    data: AutoFixRequest,
    current_user: User = Depends(get_current_user)
):
    """Attempt a policy-gated auto-fix for a feedback issue."""
    from ai_service.tools.feedback_policy import FeedbackPolicyTool
    from ai_service.tools.auto_fixer import AutoFixerTool
    from ai_service.tools.registry import ToolRegistry

    # Policy check first
    policy = FeedbackPolicyTool()
    policy_result = await policy.execute(
        action="check_policy",
        fix_type=data.fix_type,
        user_id=current_user.user_id,
        group_id=data.group_id,
        feedback_id=data.feedback_id,
        feedback_owner_id=current_user.user_id
    )

    if not policy_result.success:
        raise HTTPException(status_code=500, detail=policy_result.error)

    policy_data = policy_result.data
    if not policy_data.get("allowed"):
        raise HTTPException(
            status_code=403,
            detail=policy_data.get("blocked_reason", "Fix not allowed by policy")
        )

    if policy_data.get("requires_confirmation") and not data.confirmed:
        return {
            "success": True,
            "requires_confirmation": True,
            "tier": policy_data.get("tier"),
            "message": "This fix requires explicit confirmation. Re-submit with confirmed=true."
        }

    # Execute fix
    tool_registry = ToolRegistry()
    fixer = AutoFixerTool(tool_registry=tool_registry)
    fix_result = await fixer.execute(
        action="auto_fix",
        fix_type=data.fix_type,
        user_id=current_user.user_id,
        group_id=data.group_id,
        game_id=data.game_id,
        feedback_id=data.feedback_id,
        confirmed=data.confirmed
    )
    if not fix_result.success:
        raise HTTPException(status_code=500, detail=fix_result.error)
    return {"success": True, "data": fix_result.data, "message": fix_result.message}


@router.get("/feedback/policy/allowed-fixes")
async def get_allowed_fixes(
    group_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get list of auto-fix types allowed for the current user."""
    from ai_service.tools.feedback_policy import FeedbackPolicyTool
    policy = FeedbackPolicyTool()
    result = await policy.execute(
        action="get_allowed_fixes",
        user_id=current_user.user_id,
        group_id=group_id,
        feedback_owner_id=current_user.user_id
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data


@router.get("/feedback/health")
async def get_feedback_health(
    group_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get internal feedback health score (red/yellow/green)."""
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()
    result = await collector.get_health_score(group_id=group_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data


@router.get("/feedback/public-stats")
async def get_public_rating_stats(days: int = 90):
    """
    Get statistically honest public-facing rating stats for the landing page.
    No auth required — public endpoint.
    Returns stats only if confidence floor is met (100+ unique ratings, avg >= 3.5).
    """
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()
    result = await collector.get_public_rating_stats(days=days)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data


@router.get("/feedback/my")
async def get_my_feedback(
    status: Optional[str] = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get the current user's submitted feedback with status tracking."""
    query = {"user_id": current_user.user_id}
    if status:
        query["status"] = status

    feedback_items = await queries.generic_find("feedback", query, limit=limit, order_by="created_at DESC")

    # For each feedback, attach the latest auto-fix log if any
    for item in feedback_items:
        fid = item.get("feedback_id")
        if fid:
            fix_logs = await queries.generic_find("auto_fix_log", {"feedback_id": fid}, limit=1, order_by="created_at DESC")
            fix_log = fix_logs[0] if fix_logs else None
            item["auto_fix"] = fix_log

    return {"feedback": feedback_items}


@router.post("/feedback/{feedback_id}/confirm-fix")
async def confirm_auto_fix(
    feedback_id: str,
    data: ConfirmFixRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Confirm or reject a pending auto-fix for a specific feedback item.
    This is a convenience endpoint — it looks up the pending fix and
    re-submits through the policy-gated auto-fix pipeline with confirmed=true.
    """
    # Find the feedback
    feedback = await queries.generic_find_one("feedback", {"feedback_id": feedback_id})
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    # Only the feedback owner or a group admin can confirm
    if feedback.get("user_id") != current_user.user_id:
        # Check if user is group admin
        group_id = feedback.get("context", {}).get("group_id")
        if group_id:
            group = await queries.get_group(group_id)
            if not group or current_user.user_id not in (group.get("admin_ids") or []):
                raise HTTPException(status_code=403, detail="Not authorized to confirm this fix")
        else:
            raise HTTPException(status_code=403, detail="Not authorized to confirm this fix")

    # Find the pending auto-fix log entry
    pending_fixes = await queries.generic_find("auto_fix_log", {"feedback_id": feedback_id, "status": "pending_confirmation"}, limit=1, order_by="created_at DESC")
    pending_fix = pending_fixes[0] if pending_fixes else None

    if not pending_fix:
        raise HTTPException(status_code=404, detail="No pending fix found for this feedback")

    if not data.confirmed:
        # User rejected the fix
        await queries.generic_update("auto_fix_log", {"_id": pending_fix["_id"]}, {"status": "rejected", "rejected_at": datetime.utcnow(), "rejected_by": current_user.user_id})
        return {"success": True, "message": "Fix rejected"}

    # Re-submit through the auto-fix pipeline with confirmed=true
    from ai_service.tools.feedback_policy import FeedbackPolicyTool
    from ai_service.tools.auto_fixer import AutoFixerTool
    from ai_service.tools.registry import ToolRegistry

    fix_type = pending_fix.get("fix_type")
    group_id = pending_fix.get("group_id") or feedback.get("context", {}).get("group_id")
    game_id = pending_fix.get("game_id") or feedback.get("context", {}).get("game_id")

    tool_registry = ToolRegistry()
    fixer = AutoFixerTool(tool_registry=tool_registry)
    fix_result = await fixer.execute(
        action="auto_fix",
        fix_type=fix_type,
        user_id=current_user.user_id,
        group_id=group_id,
        game_id=game_id,
        feedback_id=feedback_id,
        confirmed=True
    )

    if not fix_result.success:
        raise HTTPException(status_code=500, detail=fix_result.error)

    # Update the pending log entry
    await queries.generic_update("auto_fix_log", {"_id": pending_fix["_id"]}, {"status": "confirmed", "confirmed_at": datetime.utcnow(), "confirmed_by": current_user.user_id})

    return {"success": True, "data": fix_result.data, "message": "Fix confirmed and applied"}


# ============== FEEDBACK THREAD & REPLY ==============


@router.get("/feedback/{feedback_id}/thread")
async def get_feedback_thread(
    feedback_id: str,
    request: Request
):
    """Get the conversation thread for a feedback item. Accessible by super admin or the reporter."""
    # Dual-auth: try admin first, fall back to regular user
    user = None
    is_admin = False
    try:
        admin_ctx = await get_admin_context(request)
        user = admin_ctx.user
        is_admin = True
        await admin_ctx.audit("view_feedback_thread", {"feedback_id": feedback_id})
    except HTTPException:
        # Not an admin — try regular user auth
        user = await get_current_user(request)

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT feedback_id, events, user_id, created_at, type FROM feedback WHERE feedback_id = $1",
                feedback_id
            )
            if not row:
                raise HTTPException(status_code=404, detail="Feedback not found")

            # If not admin, verify the user is the reporter
            if not is_admin and row["user_id"] != user.user_id:
                raise HTTPException(status_code=403, detail="Not authorized to view this thread")

            events_raw = row["events"] or []
            if isinstance(events_raw, str):
                import json as _json_mod
                events_raw = _json_mod.loads(events_raw)

            # Defensive: ensure events_raw is a list
            if not isinstance(events_raw, list):
                events_raw = []

            # Filter to thread-relevant event types (include created for "Ticket received")
            thread_types = {"created", "admin_response", "user_reply", "status_change", "status_updated"}
            thread_events = []
            has_created = False
            for idx, evt in enumerate(events_raw):
                if not isinstance(evt, dict):
                    continue
                action = evt.get("action", evt.get("event_type", ""))
                if action == "created":
                    has_created = True
                if action in thread_types:
                    details = evt.get("details", {}) or {}
                    message = details.get("message") if isinstance(details, dict) else None
                    thread_events.append({
                        "event_type": action,
                        "message": message,
                        "details": details,
                        "actor_user_id": evt.get("actor", None),
                        "ts": evt.get("ts", ""),
                        "index": idx,
                    })

            # Synthesize "created" when missing (empty, malformed, or historical data)
            if not has_created and row.get("created_at") and row.get("user_id"):
                created_at = row["created_at"]
                ts = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at)
                feedback_type = row.get("type") or "other"
                thread_events.append({
                    "event_type": "created",
                    "message": None,
                    "details": {"feedback_type": feedback_type},
                    "actor_user_id": row["user_id"],
                    "ts": ts,
                    "index": -1,
                })

            # Sort by ts ascending, stable by index
            thread_events.sort(key=lambda e: (e.get("ts", ""), e.get("index", 0)))

            # Enrich with actor names (batch lookup)
            actor_ids = [str(aid) for aid in {e["actor_user_id"] for e in thread_events if e.get("actor_user_id") and e["actor_user_id"] != "system"} if aid]
            actor_names = {}
            if actor_ids:
                users = await conn.fetch(
                    "SELECT user_id, COALESCE(name, email) as display_name FROM users WHERE user_id = ANY($1)",
                    actor_ids
                )
                actor_names = {u["user_id"]: u["display_name"] for u in users}

            for evt in thread_events:
                evt["actor_name"] = actor_names.get(evt.get("actor_user_id"), evt.get("actor_user_id"))
                evt.pop("index", None)

        return {"feedback_id": feedback_id, "events": thread_events}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching feedback thread {feedback_id}")
        raise HTTPException(status_code=500, detail=f"Error loading thread: {str(e)}")


@router.post("/feedback/{feedback_id}/reply")
async def user_reply_to_feedback(
    feedback_id: str,
    data: UserFeedbackReply,
    current_user: User = Depends(get_current_user)
):
    """User replies to admin response on their own feedback report."""
    # 1. Validate message
    message = (data.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty or whitespace-only")
    if len(message) > 2000:
        raise HTTPException(status_code=400, detail="Message exceeds 2000 character limit")

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available")

    # 2. Fetch feedback and verify ownership
    async with pool.acquire() as conn:
        feedback = await conn.fetchrow(
            "SELECT feedback_id, user_id, status FROM feedback WHERE feedback_id = $1",
            feedback_id
        )
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    if feedback["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only reply to your own reports")

    # 3. Check status — cannot reply on wont_fix
    current_status = feedback["status"] or "open"
    if current_status == "wont_fix":
        raise HTTPException(status_code=409, detail="Cannot reply to closed reports")

    # 4. Persist user reply event
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()

    result = await collector._add_event(
        feedback_id=feedback_id,
        event_type="user_reply",
        actor_id=current_user.user_id,
        details={"message": message}
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error or "Failed to add reply event")

    # 5. Auto-reopen resolved reports to needs_user_info
    if current_status == "resolved":
        status_result = await collector.execute(
            action="update_status",
            feedback_id=feedback_id,
            status="needs_user_info",
            user_id=current_user.user_id,
        )

    # 6. Best-effort: notify admins (in_app only)
    try:
        from ai_service.tools.notification_sender import NotificationSenderTool
        notifier = NotificationSenderTool()
        # Find super admins to notify
        async with pool.acquire() as conn:
            admins = await conn.fetch(
                "SELECT user_id FROM users WHERE app_role = 'super_admin' LIMIT 10"
            )
        admin_ids = [a["user_id"] for a in admins] if admins else []
        if admin_ids:
            await notifier.execute(
                user_ids=admin_ids,
                title="User replied to report",
                message=f"Reply on {feedback_id}: {message[:100]}",
                notification_type="general",
                channels=["in_app"],
                data={"feedback_id": feedback_id, "type": "feedback_user_reply"}
            )
    except Exception as e:
        logger.warning(f"Admin notification failed for reply on {feedback_id}: {e}")

    # 7. Real-time: notify admins viewing this feedback
    try:
        await emit_feedback_updated(feedback_id, {"type": "user_reply"})
    except Exception as e:
        logger.warning(f"emit_feedback_updated failed for {feedback_id}: {e}")

    return {"success": True, "feedback_id": feedback_id}
