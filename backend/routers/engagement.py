"""Engagement endpoints: scores, settings, preferences, nudges, reports.
Extracted from server.py — pure mechanical move, zero behavior changes."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries

router = APIRouter(prefix="/api", tags=["engagement"])


# ── Pydantic models ──────────────────────────────────────────────

class EngagementSettingsUpdate(BaseModel):
    """Settings for group engagement features."""
    engagement_enabled: Optional[bool] = None
    inactive_group_nudge_days: Optional[int] = None
    inactive_user_nudge_days: Optional[int] = None
    milestone_celebrations: Optional[bool] = None
    big_winner_celebrations: Optional[bool] = None
    weekly_digest: Optional[bool] = None
    show_amounts_in_celebrations: Optional[bool] = None

class EngagementPreferencesUpdate(BaseModel):
    """User-level engagement preferences."""
    muted_all: Optional[bool] = None
    muted_categories: Optional[list] = None
    preferred_channels: Optional[list] = None
    preferred_tone: Optional[str] = None
    timezone_offset_hours: Optional[int] = None
    quiet_start: Optional[int] = None
    quiet_end: Optional[int] = None


# ── Routes ────────────────────────────────────────────────────────

@router.get("/engagement/scores/group/{group_id}")
async def get_group_engagement_score(group_id: str, current_user: User = Depends(get_current_user)):
    """Get engagement score for a group."""
    from ai_service.tools.engagement_scorer import EngagementScorerTool
    scorer = EngagementScorerTool()
    result = await scorer.execute(action="score_group", group_id=group_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data

@router.get("/engagement/scores/user/{user_id}")
async def get_user_engagement_score(
    user_id: str,
    group_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get engagement score for a user."""
    from ai_service.tools.engagement_scorer import EngagementScorerTool
    scorer = EngagementScorerTool()
    result = await scorer.execute(action="score_user", user_id=user_id, group_id=group_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data

@router.get("/engagement/scores/me")
async def get_my_engagement_score(
    group_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get engagement score for the current user."""
    from ai_service.tools.engagement_scorer import EngagementScorerTool
    scorer = EngagementScorerTool()
    result = await scorer.execute(action="score_user", user_id=current_user.user_id, group_id=group_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data

@router.get("/engagement/inactive-groups")
async def get_inactive_groups(
    days: int = 14,
    current_user: User = Depends(get_current_user)
):
    """Get list of inactive groups (admin use)."""
    from ai_service.tools.engagement_scorer import EngagementScorerTool
    scorer = EngagementScorerTool()
    result = await scorer.execute(action="find_inactive_groups", inactive_days=days)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data

@router.get("/engagement/inactive-users/{group_id}")
async def get_inactive_users(
    group_id: str,
    days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """Get list of inactive users in a group."""
    from ai_service.tools.engagement_scorer import EngagementScorerTool
    scorer = EngagementScorerTool()
    result = await scorer.execute(action="find_inactive_users", group_id=group_id, inactive_days=days)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data

@router.get("/engagement/settings/{group_id}")
async def get_engagement_settings(group_id: str, current_user: User = Depends(get_current_user)):
    """Get engagement settings for a group."""
    settings = await queries.generic_find_one("engagement_settings", {"group_id": group_id})
    if not settings:
        # Return defaults
        settings = {
            "group_id": group_id,
            "engagement_enabled": True,
            "inactive_group_nudge_days": 14,
            "inactive_user_nudge_days": 30,
            "milestone_celebrations": True,
            "big_winner_celebrations": True,
            "weekly_digest": True,
        }
    return settings

@router.put("/engagement/settings/{group_id}")
async def update_engagement_settings(
    group_id: str,
    updates: EngagementSettingsUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update engagement settings for a group (admin only)."""
    # Check admin permission
    member = await queries.get_group_member(group_id, current_user.user_id)
    if not member:
        raise HTTPException(status_code=403, detail="Only group admins can update engagement settings")

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["group_id"] = group_id
    update_data["updated_at"] = datetime.now(timezone.utc)

    await queries.upsert_engagement_settings(group_id, update_data)

    return {"status": "updated", "settings": update_data}

@router.post("/engagement/trigger-check/{group_id}")
async def trigger_engagement_check(group_id: str, current_user: User = Depends(get_current_user)):
    """Manually trigger an engagement check for a group (admin only)."""
    member = await queries.get_group_member(group_id, current_user.user_id)
    if not member:
        raise HTTPException(status_code=403, detail="Only group admins can trigger engagement checks")

    from ai_service.agents.engagement_agent import EngagementAgent
    from ai_service.tools.registry import ToolRegistry

    tool_registry = ToolRegistry()
    agent = EngagementAgent(tool_registry=tool_registry)
    result = await agent.execute(
        "Send engagement digest",
        context={"action": "send_engagement_digest", "group_id": group_id}
    )

    return {
        "status": "completed" if result.success else "failed",
        "message": result.message,
        "data": result.data
    }

@router.get("/engagement/nudge-history/{group_id}")
async def get_nudge_history(
    group_id: str,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get nudge history for a group."""
    nudges = await queries.generic_find("engagement_nudges_log", {"group_id": group_id}, limit=limit, order_by="sent_at DESC")

    return {"nudges": nudges, "count": len(nudges)}

@router.get("/engagement/report/{group_id}")
async def get_engagement_report(group_id: str, current_user: User = Depends(get_current_user)):
    """Get a comprehensive engagement report for a group."""
    from ai_service.tools.engagement_scorer import EngagementScorerTool
    scorer = EngagementScorerTool()
    result = await scorer.execute(action="get_engagement_report", group_id=group_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data

@router.get("/engagement/preferences")
async def get_engagement_preferences(current_user: User = Depends(get_current_user)):
    """Get engagement preferences for the current user."""
    prefs = await queries.generic_find_one("engagement_preferences", {"user_id": current_user.user_id})
    if not prefs:
        prefs = {
            "user_id": current_user.user_id,
            "muted_all": False,
            "muted_categories": [],
            "preferred_channels": ["push", "in_app"],
            "preferred_tone": None,
            "timezone_offset_hours": 0,
            "quiet_start": 22,
            "quiet_end": 8,
        }
    return prefs

@router.put("/engagement/preferences")
async def update_engagement_preferences(
    updates: EngagementPreferencesUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update engagement preferences for the current user."""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["user_id"] = current_user.user_id
    update_data["updated_at"] = datetime.now(timezone.utc)

    await queries.upsert_engagement_preferences(current_user.user_id, update_data)

    return {"status": "updated", "preferences": update_data}

@router.post("/engagement/mute")
async def mute_engagement(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Mute engagement notifications (all or specific category)."""
    from ai_service.tools.engagement_policy import EngagementPolicyTool
    policy = EngagementPolicyTool()
    result = await policy.execute(
        action="record_mute",
        recipient_id=current_user.user_id,
        category=category
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data
