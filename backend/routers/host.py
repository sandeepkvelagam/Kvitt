"""Host persona endpoints: decisions, persona status, settings.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries
from websocket_manager import sio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["host"])


# ── Pydantic models ──────────────────────────────────────────────

class HostDecisionRequest(BaseModel):
    decision_id: Optional[str] = None
    decision_ids: Optional[List[str]] = None
    reason: Optional[str] = None


class HostPersonaSettingsRequest(BaseModel):
    auto_approve_standard_buyin: bool = False
    auto_send_reminders: bool = True
    auto_generate_settlement: bool = True
    auto_send_summary: bool = True
    payment_reminder_days: List[int] = [1, 3, 7]
    notify_on_rsvp_change: bool = True
    suggest_next_game: bool = True


# ── Routes ────────────────────────────────────────────────────────

@router.get("/host/decisions")
async def get_pending_decisions(
    game_id: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get pending decisions for the host."""
    query = {
        "host_id": user.user_id,
        "status": "pending",
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    }
    if game_id:
        query["game_id"] = game_id

    decisions = await queries.find_host_decisions_by_query(query, limit=50)

    # Group by type
    grouped = {
        "join_request": [],
        "buy_in": [],
        "cash_out": [],
        "end_game": [],
        "chip_correction": []
    }
    for d in decisions:
        dtype = d.get("decision_type", "other")
        if dtype in grouped:
            grouped[dtype].append(d)

    return {
        "decisions": decisions,
        "grouped": grouped,
        "total": len(decisions)
    }


@router.post("/host/decisions/{decision_id}/approve")
async def approve_decision(
    decision_id: str,
    user: User = Depends(get_current_user)
):
    """Approve a pending decision."""
    # Verify ownership
    decision = await queries.generic_find_one("host_decisions", {
        "decision_id": decision_id,
        "host_id": user.user_id,
        "status": "pending"
    })

    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found or already processed")

    # Update status
    await queries.update_host_decision(decision_id, {
        "status": "approved",
        "processed_at": datetime.now(timezone.utc)
    })

    # Execute the approved action
    action_result = await _execute_host_decision(decision)

    return {
        "success": True,
        "decision_id": decision_id,
        "decision_type": decision.get("decision_type"),
        "action_result": action_result
    }


@router.post("/host/decisions/{decision_id}/reject")
async def reject_decision(
    decision_id: str,
    data: HostDecisionRequest,
    user: User = Depends(get_current_user)
):
    """Reject a pending decision."""
    decision = await queries.generic_find_one("host_decisions", {
        "decision_id": decision_id,
        "host_id": user.user_id,
        "status": "pending"
    })

    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found or already processed")

    await queries.update_host_decision(decision_id, {
        "status": "rejected",
        "rejection_reason": data.reason,
        "processed_at": datetime.now(timezone.utc)
    })

    # Notify player of rejection
    player_id = decision.get("context", {}).get("player_id")
    if player_id:
        try:
            await queries.insert_notification({
                "notification_id": str(uuid.uuid4()),
                "user_id": player_id,
                "title": "Request Declined",
                "message": f"Your {decision.get('decision_type', 'request').replace('_', ' ')} was declined" +
                          (f": {data.reason}" if data.reason else ""),
                "type": "request_rejected",
                "data": {
                    "decision_type": decision.get("decision_type"),
                    "game_id": decision.get("game_id"),
                    "reason": data.reason
                },
                "read": False,
                "created_at": datetime.now(timezone.utc)
            })
        except Exception as e:
            logger.error(f"Non-critical: notification insert failed for reject_host_decision: {e}")

    return {
        "success": True,
        "decision_id": decision_id,
        "reason": data.reason
    }


@router.post("/host/decisions/bulk-approve")
async def bulk_approve_decisions(
    data: HostDecisionRequest,
    user: User = Depends(get_current_user)
):
    """Approve multiple decisions at once."""
    if not data.decision_ids:
        raise HTTPException(status_code=400, detail="decision_ids required")

    approved = []
    failed = []

    for decision_id in data.decision_ids:
        decision = await queries.generic_find_one("host_decisions", {
            "decision_id": decision_id,
            "host_id": user.user_id,
            "status": "pending"
        })

        if decision:
            await queries.update_host_decision(decision_id, {"status": "approved", "processed_at": datetime.now(timezone.utc)})
            action_result = await _execute_host_decision(decision)
            approved.append({"decision_id": decision_id, "result": action_result})
        else:
            failed.append({"decision_id": decision_id, "error": "Not found or already processed"})

    return {
        "success": len(failed) == 0,
        "approved": approved,
        "failed": failed,
        "total_approved": len(approved),
        "total_failed": len(failed)
    }


@router.get("/host/persona/status")
async def get_host_persona_status(
    game_id: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get Host Persona automation status."""
    # Get user's Host Persona settings
    settings = await queries.generic_find_one("host_persona_settings", {"user_id": user.user_id})

    # Get pending decision count
    query = {"host_id": user.user_id, "status": "pending"}
    if game_id:
        query["game_id"] = game_id
    pending_count = await queries.generic_count("host_decisions", query)

    return {
        "enabled": True,
        "settings": settings or {
            "auto_approve_standard_buyin": False,
            "auto_send_reminders": True,
            "auto_generate_settlement": True,
            "auto_send_summary": True,
            "payment_reminder_days": [1, 3, 7],
            "notify_on_rsvp_change": True,
            "suggest_next_game": True
        },
        "pending_decisions": pending_count
    }


@router.put("/host/persona/settings")
async def update_host_persona_settings(
    data: HostPersonaSettingsRequest,
    user: User = Depends(get_current_user)
):
    """Update Host Persona automation settings."""
    settings = data.model_dump()
    settings["user_id"] = user.user_id
    settings["updated_at"] = datetime.now(timezone.utc)

    await queries.upsert_host_persona_settings(user.user_id, settings)

    return {"success": True, "settings": settings}


# ── Helper ────────────────────────────────────────────────────────

async def _execute_host_decision(decision: dict) -> dict:
    """Execute the action for an approved decision."""
    decision_type = decision.get("decision_type")
    context = decision.get("context", {})
    game_id = decision.get("game_id")

    if decision_type == "join_request":
        player_entry = {
            "user_id": context.get("player_id"),
            "status": "active",
            "chips": 0,
            "total_buy_in": 0,
            "joined_at": datetime.now(timezone.utc)
        }
        await queries.insert_player(player_entry)
        # Emit WebSocket event
        await sio.emit("game_update", {
            "type": "player_joined",
            "game_id": game_id,
            "player_id": context.get("player_id")
        }, room=game_id)
        return {"action": "player_added", "player_id": context.get("player_id")}

    elif decision_type == "buy_in":
        amount = context.get("amount", 0)
        chips = context.get("chips", 0)
        player_id = context.get("player_id")

        await queries.increment_player_fields(game_id, player_id, {"total_chips": chips, "total_buy_in": amount})
        await sio.emit("game_update", {
            "type": "buy_in_approved",
            "game_id": game_id,
            "player_id": player_id,
            "amount": amount,
            "chips": chips
        }, room=game_id)
        return {"action": "buy_in_processed", "amount": amount, "chips": chips}

    elif decision_type == "cash_out":
        chips = context.get("chips", 0)
        player_id = context.get("player_id")
        cash_amount = context.get("cash_amount", 0)

        await queries.update_player_by_game_user(game_id, player_id, {
            "total_chips": 0,
            "cashed_out": True,
            "chips_returned": chips,
            "cash_out": cash_amount,
            "cashed_out_at": datetime.now(timezone.utc)
        })
        await sio.emit("game_update", {
            "type": "cash_out_approved",
            "game_id": game_id,
            "player_id": player_id,
            "chips": chips,
            "amount": cash_amount
        }, room=game_id)
        return {"action": "cash_out_processed", "chips": chips, "amount": cash_amount}

    elif decision_type == "end_game":
        await queries.update_game_night(game_id, {"status": "ended", "ended_at": datetime.now(timezone.utc)})
        await sio.emit("game_update", {"type": "game_ended", "game_id": game_id}, room=game_id)
        return {"action": "game_ended"}

    elif decision_type == "chip_correction":
        player_id = context.get("player_id")
        new_chips = context.get("new_chips", 0)

        await queries.update_player_by_game_user(game_id, player_id, {"total_chips": new_chips})
        await sio.emit("game_update", {
            "type": "chips_corrected",
            "game_id": game_id,
            "player_id": player_id,
            "new_chips": new_chips
        }, room=game_id)
        return {"action": "chips_corrected", "new_chips": new_chips}

    return {"action": "unknown", "decision_type": decision_type}
