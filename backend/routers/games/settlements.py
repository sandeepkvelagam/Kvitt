"""Settlement endpoints: settle, unlock, dispute CRUD, get settlement."""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from dependencies import User, get_current_user, AuditLog
from db import queries

from .settlement import auto_generate_settlement

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/games/{game_id}/settle")
async def generate_settlement(game_id: str, user: User = Depends(get_current_user)):
    """Generate settlement (host/admin only). Validates all players cashed out."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check host or admin
    is_host = game["host_id"] == user.user_id
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not is_host and (not membership or membership["role"] != "admin"):
        raise HTTPException(status_code=403, detail="Only host or admin can generate settlement")

    if game["status"] not in ["ended", "settled"]:
        raise HTTPException(status_code=400, detail="Game must be ended first")

    # Get all players with buy-ins
    all_players = await queries.find_players_by_game_with_buyin(game_id, min_buyin=0)

    if not all_players:
        raise HTTPException(status_code=400, detail="No players with buy-ins found")

    # Check that ALL players with buy-ins have cashed out
    not_cashed_out = [p for p in all_players if p.get("cash_out") is None]
    if not_cashed_out:
        player_names = []
        for p in not_cashed_out:
            u = await queries.get_user(p["user_id"])
            player_names.append(u["name"] if u else "Unknown")
        raise HTTPException(
            status_code=400,
            detail=f"All players must cash out before settlement. Waiting for: {', '.join(player_names)}"
        )

    # Validate chip count (optional warning)
    total_distributed = game.get("total_chips_distributed", 0)
    total_returned = sum(p.get("chips_returned", 0) for p in all_players)
    if total_distributed != total_returned:
        logger.warning(f"Chip discrepancy in game {game_id}: distributed={total_distributed}, returned={total_returned}")

    # Use shared deterministic settlement algorithm
    result = await auto_generate_settlement(game_id, game, all_players, generated_by=user.user_id)

    return result


@router.post("/games/{game_id}/unlock")
async def unlock_game(game_id: str, user: User = Depends(get_current_user)):
    """Host/admin unlocks a settled game to allow edits. Logs to audit trail."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    is_host = game["host_id"] == user.user_id
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not is_host and (not membership or membership["role"] != "admin"):
        raise HTTPException(status_code=403, detail="Only host or admin can unlock")

    if not game.get("is_locked"):
        return {"message": "Game is already unlocked"}

    await queries.update_game_night(game_id, {"is_locked": False, "updated_at": datetime.now(timezone.utc)})

    # Audit log
    audit = AuditLog(
        entity_type="game",
        entity_id=game_id,
        action="unlock",
        old_value={"is_locked": True},
        new_value={"is_locked": False},
        changed_by=user.user_id,
        reason="Host unlocked for edits"
    )
    audit_dict = audit.model_dump()
    await queries.insert_audit_log(audit_dict)

    logger.info(f"Game {game_id} unlocked by {user.user_id}")
    return {"message": "Game unlocked. You can now edit player values."}


@router.post("/games/{game_id}/settlement/dispute")
async def create_settlement_dispute(game_id: str, data: dict, user: User = Depends(get_current_user)):
    """Player reports an issue with the settlement. Notifies host. Pauses payments."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Verify player is in the game
    player = await queries.get_player_by_game_user(game_id, user.user_id)
    if not player:
        membership = await queries.get_group_member(game["group_id"], user.user_id)
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this group")

    # Check for existing open dispute
    existing = await queries.generic_find_one("settlement_disputes", {"game_id": game_id, "status": "open"})
    if existing:
        raise HTTPException(status_code=400, detail="An open dispute already exists for this settlement")

    category = data.get("category", "other")
    message = data.get("message", "")
    if not message.strip():
        raise HTTPException(status_code=400, detail="Describe the issue")

    dispute = {
        "dispute_id": f"dsp_{uuid.uuid4().hex[:12]}",
        "game_id": game_id,
        "user_id": user.user_id,
        "category": category,
        "message": message.strip(),
        "status": "open",
        "created_at": datetime.now(timezone.utc),
        "resolved_at": None,
        "resolved_by": None
    }
    await queries.insert_settlement_dispute(dispute)

    # Notify host
    host_notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": game["host_id"],
        "type": "settlement_dispute",
        "title": "Settlement Disputed",
        "message": f"{user.name} reported an issue: {category.replace('_', ' ')}. Payments paused.",
        "data": {"game_id": game_id, "dispute_id": dispute["dispute_id"]},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    try:
        await queries.insert_notification(host_notification)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for dispute_settlement: {e}")

    logger.info(f"Settlement dispute created for game {game_id} by {user.user_id}")
    return {"dispute_id": dispute["dispute_id"], "status": "open"}


@router.get("/games/{game_id}/settlement/disputes")
async def get_settlement_disputes(game_id: str, user: User = Depends(get_current_user)):
    """Get all disputes for a game's settlement."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    disputes = await queries.find_settlement_disputes_by_game(game_id)

    # Add user names
    for d in disputes:
        u = await queries.get_user(d["user_id"])
        d["user"] = u

    return {"disputes": disputes}


@router.put("/games/{game_id}/settlement/dispute/{dispute_id}/resolve")
async def resolve_settlement_dispute(game_id: str, dispute_id: str, user: User = Depends(get_current_user)):
    """Host/admin resolves a settlement dispute."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    is_host = game["host_id"] == user.user_id
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not is_host and (not membership or membership["role"] != "admin"):
        raise HTTPException(status_code=403, detail="Only host or admin can resolve disputes")

    dispute = await queries.get_settlement_dispute(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    if dispute["status"] not in ["open", "reviewing"]:
        raise HTTPException(status_code=400, detail="Dispute already resolved")

    await queries.update_settlement_dispute(dispute_id, {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc),
            "resolved_by": user.user_id
        })

    # Notify the disputer
    try:
        await queries.insert_notification({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": dispute["user_id"],
            "type": "dispute_resolved",
            "title": "Dispute Resolved",
            "message": f"Your settlement issue for {game.get('title', 'the game')} has been resolved. Payments are active.",
            "data": {"game_id": game_id, "dispute_id": dispute_id},
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for resolve_dispute: {e}")

    return {"status": "resolved"}


@router.get("/games/{game_id}/settlement")
async def get_settlement(game_id: str, user: User = Depends(get_current_user)):
    """Get settlement details for a game."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Verify membership
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Fetch players and ledger entries
    players = await queries.find_players_by_game(game_id)
    entries = await queries.find_ledger_entries_by_game(game_id)

    # Build user name cache
    user_ids = set()
    for p in players:
        user_ids.add(p["user_id"])
    for e in entries:
        user_ids.add(e["from_user_id"])
        user_ids.add(e["to_user_id"])
    user_map = {}
    for uid in user_ids:
        u = await queries.get_user(uid)
        if u:
            user_map[uid] = u

    # Build results array (player standings)
    results = []
    for p in players:
        u = user_map.get(p["user_id"], {})
        results.append({
            "user_id": p["user_id"],
            "name": u.get("name") or u.get("email") or "Player",
            "email": u.get("email"),
            "total_buy_in": float(p.get("total_buy_in") or 0),
            "cash_out": float(p.get("cash_out") or 0),
            "net_result": float(p.get("net_result") or 0),
        })

    # Build payments array (ledger entries with names)
    payments = []
    for e in entries:
        from_u = user_map.get(e["from_user_id"], {})
        to_u = user_map.get(e["to_user_id"], {})
        payments.append({
            "ledger_id": e.get("ledger_id"),
            "from_user_id": e["from_user_id"],
            "from_name": from_u.get("name") or from_u.get("email") or "Player",
            "to_user_id": e["to_user_id"],
            "to_name": to_u.get("name") or to_u.get("email") or "Player",
            "amount": float(e.get("amount") or 0),
            "paid": e.get("status") == "paid",
            "status": e.get("status", "pending"),
            "paid_at": e.get("paid_at"),
        })

    # Also build backward-compatible flat entries for web
    settlements = []
    for e in entries:
        entry = dict(e)
        entry["from_user"] = user_map.get(e["from_user_id"])
        entry["to_user"] = user_map.get(e["to_user_id"])
        settlements.append(entry)

    return {
        "results": results,
        "payments": payments,
        "settlements": settlements,
        "group_id": game.get("group_id"),
    }
