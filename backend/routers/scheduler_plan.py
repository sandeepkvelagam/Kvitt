"""Structured scheduling proposals for the mobile Scheduler (agent-style planning surface)."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dependencies import User, get_current_user
from db import queries
from db.pg import get_pool
from scheduling_planner import INTENTS, proposal_body_from_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["scheduler"])


class PlanSchedulerRequest(BaseModel):
    intent: str = Field(..., description="One of: schedule_now, rematch_last, plan_weekend, resume_draft, use_last_setup")
    group_id: str
    timezone: str = Field(default="America/New_York")
    draft: Optional[Dict[str, Any]] = None


@router.post("/scheduler/plan")
async def plan_scheduler_event(data: PlanSchedulerRequest, user: User = Depends(get_current_user)):
    """
    Returns a high-confidence proposal for POST /api/events (confirm on client).
    Heuristic planner using group history; no duplicate of event creation logic.
    """
    if data.intent not in INTENTS:
        raise HTTPException(status_code=422, detail=f"Unknown intent. Allowed: {sorted(INTENTS)}")

    membership = await queries.get_group_member(data.group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    last_event: Optional[Dict[str, Any]] = None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT se.title, se.game_category, se.default_buy_in, se.location, se.duration_minutes,
                   eo.starts_at AS occ_starts_at
            FROM scheduled_events se
            JOIN event_occurrences eo ON se.event_id = eo.event_id
            WHERE se.group_id = $1 AND se.status = 'published'
            ORDER BY eo.starts_at DESC
            LIMIT 1
            """,
            data.group_id,
        )
        if row:
            last_event = dict(row)

    now_utc = datetime.now(timezone.utc)
    try:
        proposal, rationale = proposal_body_from_context(
            intent=data.intent,
            group_id=data.group_id,
            tz_name=data.timezone,
            now_utc=now_utc,
            last_event=last_event,
            draft=data.draft,
        )
    except Exception as e:
        logger.exception("scheduler plan failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    summary_bits = [proposal["title"]]
    try:
        dt = datetime.fromisoformat(proposal["starts_at"].replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        local = dt.astimezone()
        summary_bits.append(local.strftime("%a %b %d · %I:%M %p"))
    except Exception:
        pass

    return {
        "proposal": proposal,
        "rationale": rationale,
        "intent": data.intent,
        "summary": " · ".join(summary_bits),
    }
