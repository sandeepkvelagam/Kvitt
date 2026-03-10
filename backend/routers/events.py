"""Game scheduler/events endpoints: create events, RSVP, start games, templates.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import logging
from datetime import datetime, timezone, date
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries
from push_service import send_push_notification_to_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["events"])


# ── Pydantic models ──────────────────────────────────────────────

class CreateEventRequest(BaseModel):
    group_id: str
    title: str
    starts_at: datetime
    duration_minutes: int = 180
    location: Optional[str] = None
    game_category: str = "poker"
    template_id: Optional[str] = None
    recurrence: str = "none"
    rrule_weekdays: Optional[List[int]] = None
    rrule_interval: int = 1
    rrule_until: Optional[date] = None
    rrule_count: Optional[int] = None
    default_buy_in: Optional[float] = None
    default_chips_per_buy_in: Optional[int] = None
    invite_scope: str = "group"
    selected_invitees: Optional[List[str]] = None
    notes: Optional[str] = None
    timezone: str = "America/New_York"

class EventRSVPRequest(BaseModel):
    status: str  # accepted | declined | maybe
    note: Optional[str] = None

class ProposeTimeRequest(BaseModel):
    proposed_starts_at: datetime
    proposed_duration_minutes: Optional[int] = None
    proposed_location: Optional[str] = None
    note: Optional[str] = None

class DecideProposalRequest(BaseModel):
    decision: str  # accepted | declined


# ── Routes ────────────────────────────────────────────────────────

@router.post("/events")
async def create_event(data: CreateEventRequest, user: User = Depends(get_current_user)):
    """Create a scheduled event (one-time or recurring) with invites."""
    from scheduling_engine import generate_occurrences, create_invites_for_occurrence, make_id, local_to_utc
    from db.pg import get_pool

    # Verify membership
    membership = await queries.get_group_member(data.group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Validate starts_at is in the future
    if data.starts_at.tzinfo is None:
        data.starts_at = data.starts_at.replace(tzinfo=timezone.utc)
    if data.starts_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="starts_at must be in the future")

    # Derive local_start_time from starts_at + timezone
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(data.timezone)
    local_dt = data.starts_at.astimezone(tz)
    local_start_time = local_dt.time().isoformat()

    event_id = make_id("evt")

    event_doc = {
        "event_id": event_id,
        "group_id": data.group_id,
        "host_id": user.user_id,
        "title": data.title,
        "description": data.notes,
        "location": data.location,
        "game_category": data.game_category,
        "template_id": data.template_id,
        "starts_at": data.starts_at,
        "local_start_time": local_start_time,
        "duration_minutes": data.duration_minutes,
        "timezone": data.timezone,
        "recurrence": data.recurrence,
        "rrule_weekdays": data.rrule_weekdays,
        "rrule_interval": data.rrule_interval,
        "rrule_until": data.rrule_until if data.rrule_until else None,
        "rrule_count": data.rrule_count,
        "default_buy_in": data.default_buy_in,
        "default_chips_per_buy_in": data.default_chips_per_buy_in,
        "status": "published",
        "invite_scope": data.invite_scope,
        "selected_invitees": data.selected_invitees,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    await queries.generic_insert("scheduled_events", event_doc)

    # Generate occurrences
    occurrences = generate_occurrences(event_doc)

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    invites_sent = 0
    for occ in occurrences:
        await queries.generic_insert("event_occurrences", occ)
        # Create invites for each occurrence
        invites = await create_invites_for_occurrence(
            pool=pool,
            occurrence_id=occ["occurrence_id"],
            group_id=data.group_id,
            host_id=user.user_id,
            invite_scope=data.invite_scope,
            selected_invitees=data.selected_invitees,
        )
        invites_sent += len([i for i in invites if i["status"] == "invited"])

    # Send push notification to invitees
    if occurrences:
        invitee_ids = []
        if data.invite_scope == "selected" and data.selected_invitees:
            invitee_ids = [uid for uid in data.selected_invitees if uid != user.user_id]
        else:
            members = await queries.find_group_members_by_group(data.group_id, limit=100)
            invitee_ids = [m["user_id"] for m in members if m["user_id"] != user.user_id]

        for uid in invitee_ids:
            try:
                await send_push_notification_to_user(
                    uid,
                    f"Game scheduled: {data.title}",
                    f"{user.name} scheduled {data.title}. You in?",
                    {"type": "event_invite", "occurrence_id": occurrences[0]["occurrence_id"], "event_id": event_id},
                )
            except Exception as e:
                logger.error(f"Push notification failed for {uid}: {e}")

    # Emit Socket.IO event to group
    try:
        from websocket_manager import emit_event_created
        await emit_event_created(data.group_id, {
            "event_id": event_id,
            "title": data.title,
            "host_id": user.user_id,
            "host_name": user.name,
            "starts_at": data.starts_at.isoformat(),
            "occurrences_count": len(occurrences),
        })
    except Exception as e:
        logger.debug(f"Socket emit failed (non-critical): {e}")

    next_occ = occurrences[0] if occurrences else None
    return {
        "event_id": event_id,
        "group_id": data.group_id,
        "title": data.title,
        "starts_at": data.starts_at.isoformat(),
        "timezone": data.timezone,
        "recurrence": data.recurrence,
        "status": "published",
        "occurrences_generated": len(occurrences),
        "invites_sent": invites_sent,
        "next_occurrence": {
            "occurrence_id": next_occ["occurrence_id"],
            "starts_at": next_occ["starts_at"],
        } if next_occ else None,
    }


@router.get("/events")
async def list_events(
    group_id: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """List upcoming events for the current user (optionally filtered by group)."""
    from db.pg import get_pool

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    now = datetime.now(timezone.utc)

    if group_id:
        # Verify membership
        membership = await queries.get_group_member(group_id, user.user_id)
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this group")

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT se.*, eo.occurrence_id, eo.starts_at as occ_starts_at,
                       eo.status as occ_status, eo.occurrence_index,
                       ei.status as my_rsvp
                FROM scheduled_events se
                JOIN event_occurrences eo ON se.event_id = eo.event_id
                LEFT JOIN event_invites ei ON eo.occurrence_id = ei.occurrence_id AND ei.user_id = $1
                WHERE se.group_id = $2 AND se.status = 'published'
                  AND eo.starts_at >= $3 AND eo.status = 'upcoming'
                ORDER BY eo.starts_at ASC
                LIMIT 50
                """,
                user.user_id, group_id, now,
            )
    else:
        # Get all events from user's groups
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT se.*, eo.occurrence_id, eo.starts_at as occ_starts_at,
                       eo.status as occ_status, eo.occurrence_index,
                       ei.status as my_rsvp
                FROM scheduled_events se
                JOIN event_occurrences eo ON se.event_id = eo.event_id
                JOIN group_members gm ON se.group_id = gm.group_id AND gm.user_id = $1
                LEFT JOIN event_invites ei ON eo.occurrence_id = ei.occurrence_id AND ei.user_id = $1
                WHERE se.status = 'published'
                  AND eo.starts_at >= $2 AND eo.status = 'upcoming'
                  AND gm.status = 'active'
                ORDER BY eo.starts_at ASC
                LIMIT 50
                """,
                user.user_id, now,
            )

    events = []
    for row in rows:
        events.append({
            "event_id": row["event_id"],
            "occurrence_id": row["occurrence_id"],
            "title": row["title"],
            "starts_at": row["occ_starts_at"].isoformat() if row["occ_starts_at"] else None,
            "duration_minutes": row["duration_minutes"],
            "location": row["location"],
            "game_category": str(row["game_category"]) if row["game_category"] else "poker",
            "recurrence": str(row["recurrence"]) if row["recurrence"] else "none",
            "group_id": row["group_id"],
            "host_id": row["host_id"],
            "status": row["occ_status"],
            "my_rsvp": str(row["my_rsvp"]) if row["my_rsvp"] else None,
        })

    return {"events": events, "total": len(events)}


@router.get("/events/{event_id}")
async def get_event(event_id: str, user: User = Depends(get_current_user)):
    """Get event details with upcoming occurrences."""
    event = await queries.generic_find_one("scheduled_events", {"event_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Verify membership
    membership = await queries.get_group_member(event["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Get upcoming occurrences
    from db.pg import get_pool
    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    async with pool.acquire() as conn:
        occ_rows = await conn.fetch(
            """
            SELECT eo.*, ei.status as my_rsvp
            FROM event_occurrences eo
            LEFT JOIN event_invites ei ON eo.occurrence_id = ei.occurrence_id AND ei.user_id = $1
            WHERE eo.event_id = $2
            ORDER BY eo.starts_at ASC
            LIMIT 20
            """,
            user.user_id, event_id,
        )

    occurrences = []
    for row in occ_rows:
        occurrences.append({
            "occurrence_id": row["occurrence_id"],
            "starts_at": row["starts_at"].isoformat() if row["starts_at"] else None,
            "duration_minutes": row["duration_minutes"],
            "location": row["location"],
            "status": row["status"],
            "occurrence_index": row["occurrence_index"],
            "is_override": row["is_override"],
            "game_id": row["game_id"],
            "my_rsvp": str(row["my_rsvp"]) if row["my_rsvp"] else None,
        })

    # Serialize event
    result = {
        "event_id": event["event_id"],
        "group_id": event["group_id"],
        "host_id": event["host_id"],
        "title": event["title"],
        "description": event.get("description"),
        "location": event.get("location"),
        "game_category": str(event.get("game_category", "poker")),
        "starts_at": event["starts_at"].isoformat() if isinstance(event["starts_at"], datetime) else event["starts_at"],
        "timezone": event.get("timezone", "America/New_York"),
        "recurrence": str(event.get("recurrence", "none")),
        "status": str(event.get("status", "published")),
        "default_buy_in": float(event["default_buy_in"]) if event.get("default_buy_in") else None,
        "default_chips_per_buy_in": event.get("default_chips_per_buy_in"),
        "occurrences": occurrences,
    }

    return result


@router.post("/occurrences/{occurrence_id}/rsvp")
async def rsvp_to_occurrence(
    occurrence_id: str,
    data: EventRSVPRequest,
    user: User = Depends(get_current_user)
):
    """RSVP to an event occurrence (accept/decline/maybe)."""
    from scheduling_engine import make_id, get_rsvp_stats
    from db.pg import get_pool

    valid_statuses = {"accepted", "declined", "maybe"}
    if data.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of: {valid_statuses}")

    # Get occurrence
    occurrence = await queries.generic_find_one("event_occurrences", {"occurrence_id": occurrence_id})
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")

    if occurrence.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot RSVP to a cancelled occurrence")

    # Get the parent event for group verification
    event = await queries.generic_find_one("scheduled_events", {"event_id": occurrence["event_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Verify membership
    membership = await queries.get_group_member(event["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    # Find or create invite
    invite = await queries.generic_find_one("event_invites", {
        "occurrence_id": occurrence_id,
        "user_id": user.user_id,
    })

    now = datetime.now(timezone.utc)

    if invite:
        old_status = invite.get("status", "invited")
        # Update existing invite
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE event_invites
                SET status = $1::invite_status, responded_at = $2, notes = $3, updated_at = $2
                WHERE occurrence_id = $4 AND user_id = $5
                """,
                data.status, now, data.note, occurrence_id, user.user_id,
            )
        invite_id = invite["invite_id"]
    else:
        old_status = None
        invite_id = make_id("inv")
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO event_invites (invite_id, occurrence_id, user_id, status, responded_at, notes)
                VALUES ($1, $2, $3, $4::invite_status, $5, $6)
                ON CONFLICT (occurrence_id, user_id) DO UPDATE
                SET status = $4::invite_status, responded_at = $5, notes = $6
                """,
                invite_id, occurrence_id, user.user_id, data.status, now, data.note,
            )

    # Log to rsvp_history
    history_id = make_id("rsh")
    await queries.generic_insert("rsvp_history", {
        "history_id": history_id,
        "invite_id": invite_id,
        "old_status": old_status,
        "new_status": data.status,
        "changed_by": user.user_id,
        "reason": data.note,
        "created_at": now,
    })

    # Get updated stats
    stats = await get_rsvp_stats(pool, occurrence_id)

    # Notify host via push
    host_id = event.get("host_id")
    if host_id and host_id != user.user_id:
        try:
            await send_push_notification_to_user(
                host_id,
                f"RSVP: {user.name} — {data.status}",
                f"{user.name} {data.status} for {event.get('title', 'game night')}",
                {"type": "rsvp_update", "occurrence_id": occurrence_id, "event_id": event["event_id"]},
            )
        except Exception as e:
            logger.error(f"Push notification to host failed: {e}")

    # Emit Socket.IO update
    try:
        from websocket_manager import emit_rsvp_updated
        await emit_rsvp_updated(event["group_id"], {
            "occurrence_id": occurrence_id,
            "user_id": user.user_id,
            "user_name": user.name,
            "status": data.status,
            "stats": stats,
        })
    except Exception as e:
        logger.debug(f"Socket emit failed (non-critical): {e}")

    return {
        "invite_id": invite_id,
        "occurrence_id": occurrence_id,
        "status": data.status,
        "responded_at": now.isoformat(),
        "stats": stats,
    }


@router.get("/occurrences/{occurrence_id}/invites")
async def get_occurrence_invites(
    occurrence_id: str,
    user: User = Depends(get_current_user)
):
    """Get invite statuses for an occurrence (host dashboard)."""
    from scheduling_engine import get_rsvp_stats
    from db.pg import get_pool

    # Get occurrence and verify access
    occurrence = await queries.generic_find_one("event_occurrences", {"occurrence_id": occurrence_id})
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")

    event = await queries.generic_find_one("scheduled_events", {"event_id": occurrence["event_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    membership = await queries.get_group_member(event["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT ei.*, u.name as user_name, u.picture as user_picture
            FROM event_invites ei
            JOIN users u ON ei.user_id = u.user_id
            WHERE ei.occurrence_id = $1
            ORDER BY ei.status, u.name
            """,
            occurrence_id,
        )

    invites = []
    for row in rows:
        invites.append({
            "invite_id": row["invite_id"],
            "user_id": row["user_id"],
            "user_name": row["user_name"],
            "user_picture": row["user_picture"],
            "status": str(row["status"]),
            "responded_at": row["responded_at"].isoformat() if row["responded_at"] else None,
            "notes": row["notes"],
        })

    stats = await get_rsvp_stats(pool, occurrence_id)

    return {
        "occurrence_id": occurrence_id,
        "event_id": occurrence["event_id"],
        "invites": invites,
        "stats": stats,
    }


@router.post("/occurrences/{occurrence_id}/start-game")
async def start_game_from_occurrence(
    occurrence_id: str,
    user: User = Depends(get_current_user)
):
    """Create a game_night from a scheduled occurrence (host only)."""
    from scheduling_engine import make_id
    from db.pg import get_pool
    from routers.games import GameNight, Player

    occurrence = await queries.generic_find_one("event_occurrences", {"occurrence_id": occurrence_id})
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")

    if occurrence.get("game_id"):
        raise HTTPException(status_code=409, detail="Game already started for this occurrence")

    event = await queries.generic_find_one("scheduled_events", {"event_id": occurrence["event_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event["host_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the host can start the game")

    # Create game_night
    buy_in = float(event.get("default_buy_in") or 20)
    chips = event.get("default_chips_per_buy_in") or 20
    chip_value = buy_in / chips if chips else 1.0

    game = GameNight(
        group_id=event["group_id"],
        host_id=user.user_id,
        title=event.get("title", "Game Night"),
        location=occurrence.get("location") or event.get("location"),
        status="active",
        started_at=datetime.now(timezone.utc),
        buy_in_amount=buy_in,
        chips_per_buy_in=chips,
        chip_value=chip_value,
        event_occurrence_id=occurrence_id,
    )

    game_dict = game.model_dump()
    await queries.insert_game_night(game_dict)

    # Add accepted players to the game
    pool = get_pool()
    if pool:
        async with pool.acquire() as conn:
            accepted_rows = await conn.fetch(
                "SELECT user_id FROM event_invites WHERE occurrence_id = $1 AND status = 'accepted'",
                occurrence_id,
            )

        for row in accepted_rows:
            player = Player(
                game_id=game.game_id,
                user_id=row["user_id"],
                rsvp_status="yes",
                total_buy_in=buy_in if row["user_id"] == user.user_id else 0,
                total_chips=chips if row["user_id"] == user.user_id else 0,
            )
            player_dict = player.model_dump()
            await queries.insert_player(player_dict)

        # Link occurrence to game
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE event_occurrences SET game_id = $1, status = 'active', updated_at = NOW() WHERE occurrence_id = $2",
                game.game_id, occurrence_id,
            )

    return {
        "game_id": game.game_id,
        "occurrence_id": occurrence_id,
        "event_id": event["event_id"],
        "status": "active",
        "title": game.title,
    }


@router.get("/templates")
async def list_templates(user: User = Depends(get_current_user)):
    """List available game templates."""
    templates = await queries.generic_find("game_templates", {"is_system": True}, limit=50)
    return {
        "templates": [
            {
                "template_id": t["template_id"],
                "name": t["name"],
                "game_category": str(t.get("game_category", "other")),
                "default_duration_minutes": t.get("default_duration_minutes", 180),
                "min_players": t.get("min_players", 2),
                "max_players": t.get("max_players"),
                "default_buy_in": float(t["default_buy_in"]) if t.get("default_buy_in") else None,
                "default_chips_per_buy_in": t.get("default_chips_per_buy_in"),
            }
            for t in templates
        ]
    }
