"""Subscriber/waitlist endpoints: subscribe, unsubscribe, stats.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict

from db import queries
from db.pg import get_pool

router = APIRouter(prefix="/api", tags=["subscribers"])


# ── Pydantic models ──────────────────────────────────────────────

class Subscriber(BaseModel):
    """Email subscriber for waitlist, newsletter, and feature updates"""
    model_config = ConfigDict(extra="ignore")
    subscriber_id: str = Field(default_factory=lambda: f"sub_{uuid.uuid4().hex[:12]}")
    email: str
    source: str = "landing"  # landing, hero, footer, waitlist_ai, waitlist_music, waitlist_charts
    interests: List[str] = []  # ai_assistant, music_integration, charts, newsletter
    subscribed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    verified: bool = False
    unsubscribed: bool = False
    unsubscribed_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class SubscribeRequest(BaseModel):
    email: str
    source: str = "landing"
    interests: List[str] = []


# ── Routes ────────────────────────────────────────────────────────

@router.post("/subscribe")
async def subscribe(request: Request, data: SubscribeRequest):
    """Subscribe to waitlist/newsletter"""
    import re

    # Validate email
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, data.email):
        raise HTTPException(status_code=400, detail="Invalid email address")

    email_lower = data.email.lower().strip()

    # Check if already subscribed
    existing = await queries.generic_find_one("subscribers", {"email": email_lower})

    if existing:
        if existing.get("unsubscribed"):
            # Re-subscribe
            update_data = {
                "unsubscribed": False,
                "unsubscribed_at": None,
                "subscribed_at": datetime.now(timezone.utc)
            }
            # Merge interests (addToSet equivalent)
            existing_interests = existing.get("interests") or []
            merged_interests = list(set(existing_interests + (data.interests or [])))
            update_data["interests"] = merged_interests
            await queries.generic_update("subscribers", {"email": email_lower}, update_data)
            return {"status": "resubscribed", "message": "Welcome back! You've been re-subscribed."}
        else:
            # Update interests if new ones provided
            if data.interests:
                existing_interests = existing.get("interests") or []
                merged_interests = list(set(existing_interests + data.interests))
                await queries.generic_update("subscribers", {"email": email_lower}, {"interests": merged_interests})
            return {"status": "exists", "message": "You're already on the list!"}

    # Get client info
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:500]

    # Create new subscriber
    subscriber = Subscriber(
        email=email_lower,
        source=data.source,
        interests=data.interests,
        ip_address=ip_address,
        user_agent=user_agent
    )

    sub_dict = subscriber.model_dump()
    await queries.generic_insert("subscribers", sub_dict)

    # Send welcome email (async, don't wait)
    from email_service import send_subscriber_welcome_email
    asyncio.create_task(send_subscriber_welcome_email(email_lower, data.source, data.interests))

    return {
        "status": "subscribed",
        "message": "You're in! Check your inbox for confirmation.",
        "subscriber_id": subscriber.subscriber_id
    }


@router.get("/subscribers/stats")
async def get_subscriber_stats():
    """Get public subscriber stats for FOMO display"""
    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)

    async with pool.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM subscribers WHERE unsubscribed = FALSE"
        ) or 0
        recent = await conn.fetchval(
            "SELECT COUNT(*) FROM subscribers WHERE subscribed_at >= $1 AND unsubscribed = FALSE",
            yesterday,
        ) or 0
        ai_waitlist = await conn.fetchval(
            "SELECT COUNT(*) FROM subscribers WHERE interests @> ARRAY[$1]::TEXT[] AND unsubscribed = FALSE",
            "ai_assistant",
        ) or 0
        music_waitlist = await conn.fetchval(
            "SELECT COUNT(*) FROM subscribers WHERE interests @> ARRAY[$1]::TEXT[] AND unsubscribed = FALSE",
            "music_integration",
        ) or 0

    # Add some "social proof" padding for early stage (remove when you have real numbers)
    display_total = max(total, 127)  # Minimum display for social proof
    display_recent = max(recent, 3)  # Minimum recent signups

    return {
        "total_subscribers": display_total,
        "recent_24h": display_recent,
        "ai_waitlist": ai_waitlist,
        "music_waitlist": music_waitlist,
        # Percentage for progress bars
        "ai_waitlist_percent": min(100, int((ai_waitlist / 500) * 100)),  # Goal: 500
        "music_waitlist_percent": min(100, int((music_waitlist / 500) * 100))
    }


@router.post("/unsubscribe")
async def unsubscribe(email: str):
    """Unsubscribe from all communications"""
    email_lower = email.lower().strip()

    result_count = await queries.generic_update("subscribers", {"email": email_lower}, {
        "unsubscribed": True,
        "unsubscribed_at": datetime.now(timezone.utc)
    })

    if result_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")

    return {"status": "unsubscribed", "message": "You've been unsubscribed. Sorry to see you go!"}
