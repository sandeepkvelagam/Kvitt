"""Buy-in and cash-out endpoints."""

import uuid
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from dependencies import User, get_current_user, Notification, AuditLog
from db import queries
from websocket_manager import emit_game_event

from .models import (
    Player, Transaction, GameThread,
    BuyInRequest, AdminBuyInRequest, RequestBuyInRequest,
    CashOutRequest, RequestCashOutRequest, AdminCashOutRequest,
    EditPlayerChipsRequest,
)
from .settlement import auto_generate_settlement

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/games/{game_id}/approve-buy-in")
async def approve_buy_in(game_id: str, data: dict, user: User = Depends(get_current_user)):
    """Host approves a buy-in request."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["host_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can approve buy-ins")

    player_user_id = data.get("user_id")
    amount = data.get("amount", game.get("buy_in_amount", 20))
    chips = data.get("chips")

    if not player_user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    # Calculate chips if not provided
    chip_value = game.get("chip_value", 1.0)
    if not chips:
        chips_per_buy_in = game.get("chips_per_buy_in", 20)
        buy_in_amount = game.get("buy_in_amount", 20.0)
        chips = int((amount / buy_in_amount) * chips_per_buy_in)

    # Update player
    result_count = await queries.increment_player_fields(game_id, player_user_id, {"total_buy_in": amount, "total_chips": chips, "buy_in_count": 1})

    if result_count == 0:
        raise HTTPException(status_code=400, detail="Player not found")

    # Update game's total chips distributed
    await queries.increment_game_night_field(game_id, "total_chips_distributed", chips)

    # Create transaction record
    txn = Transaction(
        game_id=game_id,
        user_id=player_user_id,
        type="buy_in",
        amount=amount,
        chips=chips,
        chip_value=chip_value,
        notes="Buy-in (approved by host)"
    )
    txn_dict = txn.model_dump()
    await queries.insert_transaction(txn_dict)

    # Get player name
    player_user = await queries.get_user(player_user_id)
    player_name = player_user["name"] if player_user else "Player"

    # Side effects: notification + game thread (non-fatal)
    try:
        notification = Notification(
            user_id=player_user_id,
            type="buy_in_approved",
            title="Buy-In Approved!",
            message=f"Your ${amount} buy-in was approved. You received {chips} chips.",
            data={"game_id": game_id, "amount": amount, "chips": chips}
        )
        notif_dict = notification.model_dump()
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"approve_buy_in: notification insert failed for game_id={game_id} user_id={player_user_id}: {e}")

    try:
        message = GameThread(
            game_id=game_id,
            user_id=user.user_id,
            content=f"\U0001f4b0 {player_name} bought in for ${amount} ({chips} chips)",
            type="system"
        )
        msg_dict = message.model_dump()
        await queries.insert_game_thread(msg_dict)
    except Exception as e:
        logger.error(f"approve_buy_in: game_thread insert failed for game_id={game_id}: {e}")

    return {"message": f"Buy-in approved for {player_name}", "chips": chips}

# ============== BUY-IN / CASH-OUT ENDPOINTS ==============

@router.post("/games/{game_id}/buy-in")
async def add_buy_in(game_id: str, data: BuyInRequest, user: User = Depends(get_current_user)):
    """Add a buy-in for current user. Tracks chips received."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["status"] != "active":
        raise HTTPException(status_code=400, detail="Game not active")

    # Calculate chips based on game settings
    chip_value = game.get("chip_value", 1.0)
    chips_per_buy_in = game.get("chips_per_buy_in", 20)
    buy_in_amount = game.get("buy_in_amount", 20.0)

    # Calculate chips to give (based on amount paid vs standard buy-in)
    chips = data.chips if data.chips else int((data.amount / buy_in_amount) * chips_per_buy_in)

    # Check if player exists
    player = await queries.get_player_by_game_user(game_id, user.user_id)

    # Create transaction with chip info
    txn = Transaction(
        game_id=game_id,
        user_id=user.user_id,
        type="buy_in",
        amount=data.amount,
        chips=chips,
        chip_value=chip_value
    )
    txn_dict = txn.model_dump()

    # Calculate new totals
    new_total_buy_in = (player.get("total_buy_in", 0) if player else 0) + data.amount
    new_total_chips = (player.get("total_chips", 0) if player else 0) + chips

    # Critical writes wrapped in a transaction for atomicity
    from db.pg import transaction
    async with transaction() as conn:
        if not player:
            # Auto-join if not already a player
            player_doc = Player(
                game_id=game_id,
                user_id=user.user_id,
                rsvp_status="yes",
                total_buy_in=0,
                total_chips=0
            )
            player_dict = player_doc.model_dump()
            await queries.insert_player(player_dict, conn=conn)
            player = player_dict

        await queries.insert_transaction(txn_dict, conn=conn)
        await queries.update_player_by_game_user(game_id, user.user_id, {
            "total_buy_in": new_total_buy_in,
            "total_chips": new_total_chips
        }, conn=conn)
        await queries.increment_game_night_field(game_id, "total_chips_distributed", chips, conn=conn)

    return {
        "message": "Buy-in added",
        "total_buy_in": new_total_buy_in,
        "total_chips": new_total_chips,
        "chips_received": chips,
        "chip_value": chip_value
    }

@router.post("/games/{game_id}/admin-buy-in")
async def admin_buy_in(game_id: str, data: AdminBuyInRequest, user: User = Depends(get_current_user)):
    """Admin/Host adds buy-in for a specific player. Only host or admin can do this."""
    try:
        game = await queries.get_game_night(game_id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        # Check host or admin permission
        is_host = game["host_id"] == user.user_id
        membership = await queries.get_group_member(game["group_id"], user.user_id)
        if not is_host and (not membership or membership["role"] != "admin"):
            raise HTTPException(status_code=403, detail="Only host or admin can add buy-ins for players")

        if game["status"] != "active":
            raise HTTPException(status_code=400, detail="Game not active")

        # Calculate chips based on game settings
        chip_value = game.get("chip_value", 1.0)
        chips_per_buy_in = game.get("chips_per_buy_in", 20)
        buy_in_amount = game.get("buy_in_amount") or 20.0
        if not buy_in_amount or float(buy_in_amount) <= 0:
            raise HTTPException(status_code=400, detail="Game has invalid buy-in amount")

        # Calculate chips to give
        chips = int((data.amount / float(buy_in_amount)) * chips_per_buy_in)

        # Check if target player exists in game
        player = await queries.get_player_by_game_user(game_id, data.user_id)

        if not player:
            raise HTTPException(status_code=400, detail="Player not in this game")

        if player.get("cash_out") is not None:
            raise HTTPException(status_code=400, detail="Player has already cashed out")

        # Create transaction
        txn = Transaction(
            game_id=game_id,
            user_id=data.user_id,
            type="buy_in",
            amount=data.amount,
            chips=chips,
            chip_value=chip_value,
            notes=f"Added by {user.name}"
        )
        txn_dict = txn.model_dump()
        await queries.insert_transaction(txn_dict)

        # Update player totals (including buy_in_count)
        new_total_buy_in = player.get("total_buy_in", 0) + data.amount
        new_total_chips = player.get("total_chips", 0) + chips
        new_buy_in_count = (player.get("buy_in_count") or 0) + 1

        await queries.update_player_by_game_user(game_id, data.user_id, {
                "total_buy_in": new_total_buy_in,
                "total_chips": new_total_chips,
                "buy_in_count": new_buy_in_count
            })

        # Update game's total chips distributed
        await queries.increment_game_night_field(game_id, "total_chips_distributed", chips)

        # Create notification for the player
        target_user = await queries.get_user(data.user_id)
        notification = Notification(
            user_id=data.user_id,
            type="buy_in_added",
            title="Buy-In Added",
            message=f"{user.name} added ${data.amount} buy-in ({chips} chips) for you",
            data={"game_id": game_id, "amount": data.amount, "chips": chips}
        )
        notif_dict = notification.model_dump()
        try:
            await queries.insert_notification(notif_dict)
        except Exception as e:
            logger.error(f"Non-critical: notification insert failed for admin_buy_in: {e}")

        # Add system message to thread
        try:
            message = GameThread(
                game_id=game_id,
                user_id=user.user_id,
                content=f"\U0001f4b0 {target_user['name'] if target_user else 'Player'} bought in for ${data.amount} ({chips} chips)",
                type="system"
            )
            msg_dict = message.model_dump()
            await queries.insert_game_thread(msg_dict)
        except Exception as e:
            logger.error(f"Non-critical: game_thread insert failed for admin_buy_in: {e}")

        return {
            "message": "Buy-in added for player",
            "player_user_id": data.user_id,
            "total_buy_in": new_total_buy_in,
            "total_chips": new_total_chips,
            "chips_added": chips
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"admin_buy_in failed: game_id={game_id} user={user.user_id}")
        raise HTTPException(status_code=500, detail="Failed to process buy-in")

@router.post("/games/{game_id}/request-buy-in")
async def request_buy_in(game_id: str, data: RequestBuyInRequest, user: User = Depends(get_current_user)):
    """Player requests a buy-in. Sends notification to host for approval."""
    try:
        game = await queries.get_game_night(game_id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        if game["status"] != "active":
            raise HTTPException(status_code=400, detail="Game not active")

        player = await queries.get_player_by_game_user(game_id, user.user_id)

        if not player:
            raise HTTPException(status_code=400, detail="Not a player in this game")

        if player.get("cash_out") is not None:
            raise HTTPException(status_code=400, detail="Already cashed out")

        # Calculate chips that would be given
        chip_value = game.get("chip_value", 1.0)
        chips_per_buy_in = game.get("chips_per_buy_in", 20)
        buy_in_amount = game.get("buy_in_amount") or 20.0
        if not buy_in_amount or float(buy_in_amount) <= 0:
            raise HTTPException(status_code=400, detail="Game has invalid buy-in amount")
        chips = int((data.amount / float(buy_in_amount)) * chips_per_buy_in)

        # Side effects: notification + game thread (non-fatal)
        try:
            notification = Notification(
                user_id=game["host_id"],
                type="buy_in_request",
                title="Buy-In Request",
                message=f"{user.name} is requesting ${data.amount} buy-in ({chips} chips)",
                data={"game_id": game_id, "user_id": user.user_id, "amount": data.amount, "chips": chips}
            )
            notif_dict = notification.model_dump()
            await queries.insert_notification(notif_dict)
        except Exception as e:
            logger.error(f"request_buy_in: notification insert failed for game_id={game_id} host_id={game['host_id']}: {e}")

        try:
            message = GameThread(
                game_id=game_id,
                user_id=user.user_id,
                content=f"\U0001f64b {user.name} requested ${data.amount} buy-in",
                type="system"
            )
            msg_dict = message.model_dump()
            await queries.insert_game_thread(msg_dict)
        except Exception as e:
            logger.error(f"request_buy_in: game_thread insert failed for game_id={game_id}: {e}")

        return {"message": "Buy-in request sent to host", "amount": data.amount, "chips": chips}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"request_buy_in failed: game_id={game_id} user={user.user_id}")
        raise HTTPException(status_code=500, detail="Failed to process buy-in request")

@router.post("/games/{game_id}/request-cash-out")
async def request_cash_out(game_id: str, data: RequestCashOutRequest, user: User = Depends(get_current_user)):
    """Player requests to cash out with their chip count. Host must approve."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["status"] != "active":
        raise HTTPException(status_code=400, detail="Game not active")

    player = await queries.get_player_by_game_user(game_id, user.user_id)

    if not player:
        raise HTTPException(status_code=400, detail="Not a player in this game")

    if player.get("cashed_out"):
        raise HTTPException(status_code=400, detail="Already cashed out")

    chip_value = game.get("chip_value", 1.0)
    cash_value = data.chips_count * chip_value
    net_result = cash_value - player.get("total_buy_in", 0)

    # Side effects: notification + game thread (non-fatal)
    try:
        notification = Notification(
            user_id=game["host_id"],
            type="cash_out_request",
            title="Cash-Out Request",
            message=f"{user.name} wants to cash out {data.chips_count} chips (${cash_value:.2f})",
            data={"game_id": game_id, "user_id": user.user_id, "chips": data.chips_count, "cash_value": cash_value}
        )
        notif_dict = notification.model_dump()
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"request_cash_out: notification insert failed for game_id={game_id} host_id={game['host_id']}: {e}")

    try:
        message = GameThread(
            game_id=game_id,
            user_id=user.user_id,
            content=f"\U0001f3af {user.name} requested cash-out: {data.chips_count} chips (${cash_value:.2f})",
            type="system"
        )
        msg_dict = message.model_dump()
        await queries.insert_game_thread(msg_dict)
    except Exception as e:
        logger.error(f"request_cash_out: game_thread insert failed for game_id={game_id}: {e}")

    return {"message": "Cash-out request sent to host", "chips": data.chips_count, "cash_value": cash_value}

@router.post("/games/{game_id}/admin-cash-out")
async def admin_cash_out(game_id: str, data: AdminCashOutRequest, user: User = Depends(get_current_user)):
    """Admin/Host cashes out a player with specified chip count."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check host or admin permission
    is_host = game["host_id"] == user.user_id
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not is_host and (not membership or membership["role"] != "admin"):
        raise HTTPException(status_code=403, detail="Only host or admin can cash out players")

    if game["status"] != "active":
        raise HTTPException(status_code=400, detail="Game not active")

    player = await queries.get_player_by_game_user(game_id, data.user_id)

    if not player:
        raise HTTPException(status_code=400, detail="Player not in this game")

    if player.get("cashed_out"):
        raise HTTPException(status_code=400, detail="Player already cashed out")

    chip_value = game.get("chip_value", 1.0)
    cash_value = data.chips_count * chip_value
    net_result = cash_value - player.get("total_buy_in", 0)

    # Create cash-out transaction
    txn = Transaction(
        game_id=game_id,
        user_id=data.user_id,
        type="cash_out",
        amount=cash_value,
        chips=data.chips_count,
        chip_value=chip_value,
        notes=f"Cashed out by {user.name}"
    )
    txn_dict = txn.model_dump()
    await queries.insert_transaction(txn_dict)

    # Update player record
    await queries.update_player_by_game_user(game_id, data.user_id, {
            "cashed_out": True,
            "chips_returned": data.chips_count,
            "cash_out": cash_value,
            "net_result": net_result,
            "cashed_out_at": datetime.now(timezone.utc)
        })

    # Update game's chips returned
    await queries.increment_game_night_field(game_id, "total_chips_returned", data.chips_count)

    # Get target user for notification
    target_user = await queries.get_user(data.user_id)

    # Send notification to player
    notification = Notification(
        user_id=data.user_id,
        type="cashed_out",
        title="Cashed Out",
        message=f"You've been cashed out: {data.chips_count} chips = ${cash_value:.2f} (Net: {'+'if net_result >= 0 else ''}${net_result:.2f})",
        data={"game_id": game_id, "chips": data.chips_count, "cash_value": cash_value, "net_result": net_result}
    )
    notif_dict = notification.model_dump()
    try:
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for cash_out: {e}")

    # Add system message to thread
    message = GameThread(
        game_id=game_id,
        user_id=user.user_id,
        content=f"\U0001f4b5 {target_user['name'] if target_user else 'Player'} cashed out: {data.chips_count} chips = ${cash_value:.2f} ({'+'if net_result >= 0 else ''}{net_result:.2f})",
        type="system"
    )
    msg_dict = message.model_dump()
    await queries.insert_game_thread(msg_dict)

    return {
        "message": "Player cashed out",
        "user_id": data.user_id,
        "chips_returned": data.chips_count,
        "cash_value": cash_value,
        "net_result": net_result
    }

@router.post("/games/{game_id}/cash-out")
async def cash_out(game_id: str, data: CashOutRequest, user: User = Depends(get_current_user)):
    """Record cash-out for current user. Calculates winnings based on chips returned."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["status"] not in ["active", "ended"]:
        raise HTTPException(status_code=400, detail="Cannot cash out from this game")

    player = await queries.get_player_by_game_user(game_id, user.user_id)

    if not player:
        raise HTTPException(status_code=400, detail="Not a player in this game")

    if player.get("cash_out") is not None:
        raise HTTPException(status_code=400, detail="Already cashed out")

    # Calculate cash value of chips returned
    chip_value = game.get("chip_value", 1.0)
    cash_out_amount = data.chips_returned * chip_value

    # Calculate net result
    net_result = cash_out_amount - player.get("total_buy_in", 0)

    # Create transaction
    txn = Transaction(
        game_id=game_id,
        user_id=user.user_id,
        type="cash_out",
        amount=cash_out_amount,
        chips=data.chips_returned,
        chip_value=chip_value
    )
    txn_dict = txn.model_dump()

    # Critical writes wrapped in a transaction for atomicity
    from db.pg import transaction as db_transaction
    async with db_transaction() as conn:
        await queries.insert_transaction(txn_dict, conn=conn)
        await queries.update_player_by_game_user(game_id, user.user_id, {
            "chips_returned": data.chips_returned,
            "cash_out": cash_out_amount,
            "net_result": net_result,
            "cashed_out_at": datetime.now(timezone.utc)
        }, conn=conn)
        await queries.increment_game_night_field(game_id, "total_chips_returned", data.chips_returned, conn=conn)

    return {
        "message": "Cash-out recorded",
        "chips_returned": data.chips_returned,
        "cash_out_amount": cash_out_amount,
        "net_result": net_result
    }

@router.post("/games/{game_id}/edit-player-chips")
async def edit_player_chips(game_id: str, data: EditPlayerChipsRequest, user: User = Depends(get_current_user)):
    """Host can edit player's chip count after cash-out. Notifies the affected player."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Only host can edit
    if game["host_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can edit player chips")

    # Can only edit after cash-out (ended or settled status also allowed)
    if game["status"] not in ["active", "ended", "settled"]:
        raise HTTPException(status_code=400, detail="Cannot edit chips in this game state")

    # Settlement lock — host must unlock before editing settled games
    if game.get("is_locked"):
        raise HTTPException(
            status_code=400,
            detail="Game is locked after settlement. Use unlock to make changes."
        )

    player = await queries.get_player_by_game_user(game_id, data.user_id)

    if not player:
        raise HTTPException(status_code=400, detail="Player not in this game")

    # Get previous values for notification
    old_chips = player.get("chips_returned", 0)
    chip_value = game.get("chip_value", 1.0)

    # Calculate new cash value and net result
    new_cash_value = data.chips_count * chip_value
    new_net_result = new_cash_value - player.get("total_buy_in", 0)

    # Update player record
    await queries.update_player_by_game_user(game_id, data.user_id, {
            "chips_returned": data.chips_count,
            "cash_out": new_cash_value,
            "net_result": new_net_result,
            "cashed_out": True,
            "cashed_out_at": datetime.now(timezone.utc)
        })

    # Update game's total chips returned
    old_chips = old_chips or 0  # Handle None case
    chip_diff = data.chips_count - old_chips
    if chip_diff != 0:
        await queries.increment_game_night_field(game_id, "total_chips_returned", chip_diff)

    # Get player info for notifications
    target_user = await queries.get_user(data.user_id)
    player_name = target_user["name"] if target_user else "Player"
    player_email = target_user.get("email") if target_user else None

    # Notify the player about the change
    notification = Notification(
        user_id=data.user_id,
        type="chips_edited",
        title="Chip Count Updated",
        message=f"Host updated your chips: {old_chips} \u2192 {data.chips_count} chips. New cash-out: ${new_cash_value:.2f}. {f'Reason: {data.reason}' if data.reason else ''}",
        data={"game_id": game_id, "old_chips": old_chips, "new_chips": data.chips_count, "net_result": new_net_result}
    )
    notif_dict = notification.model_dump()
    try:
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for edit_chips: {e}")

    # Send email notification
    if player_email:
        try:
            from email_service import send_chips_edited_email
            asyncio.create_task(send_chips_edited_email(
                player_email,
                player_name,
                game.get("title", "Game"),
                old_chips,
                data.chips_count,
                user.name,
                data.reason
            ))
        except Exception as e:
            logger.warning(f"Failed to send chips edited email: {e}")

    # Add system message to thread
    message = GameThread(
        game_id=game_id,
        user_id=user.user_id,
        content=f"\u270f\ufe0f {user.name} edited {player_name}'s chips: {old_chips} \u2192 {data.chips_count}. {f'Reason: {data.reason}' if data.reason else ''}",
        type="system"
    )
    msg_dict = message.model_dump()
    await queries.insert_game_thread(msg_dict)

    # Create audit log
    audit = AuditLog(
        entity_type="player",
        entity_id=player.get("player_id", data.user_id),
        action="edit_chips",
        old_value={"chips_returned": old_chips},
        new_value={"chips_returned": data.chips_count},
        changed_by=user.user_id,
        reason=data.reason
    )
    audit_dict = audit.model_dump()
    await queries.insert_audit_log(audit_dict)

    # If game is settled, regenerate settlement and notify all players
    settlement_regenerated = False
    if game["status"] == "settled":
        # Get players with buy-ins for regeneration (skip observers)
        all_players = await queries.find_players_by_game_with_buyin(game_id, min_buyin=0)

        # Delete old ledger entries
        await queries.delete_ledger_entries_by_game(game_id)

        # Get updated game data (with new totals)
        updated_game = await queries.get_game_night(game_id)

        # Regenerate settlement
        await auto_generate_settlement(game_id, updated_game, all_players)
        settlement_regenerated = True

        # Add system message about regeneration
        regen_message = GameThread(
            game_id=game_id,
            user_id=user.user_id,
            content=f"\U0001f504 Settlement regenerated after chip edit for {player_name}. All players notified.",
            type="system"
        )
        regen_msg_dict = regen_message.model_dump()
        await queries.insert_game_thread(regen_msg_dict)

        # Notify ALL players about settlement regeneration (except the edited player who was already notified)
        for p in all_players:
            if p["user_id"] != data.user_id:  # Already notified the edited player
                try:
                    await queries.insert_notification({
                        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                        "user_id": p["user_id"],
                        "type": "settlement_regenerated",
                        "title": "Settlement Updated",
                        "message": f"The settlement for {game.get('title', 'the game')} has been recalculated after a chip edit.",
                        "data": {"game_id": game_id, "group_id": game.get("group_id")},
                        "read": False,
                        "created_at": datetime.now(timezone.utc)
                    })
                except Exception as e:
                    logger.error(f"Non-critical: notification insert failed for settlement_regenerated: {e}")

        # WebSocket notification to all connected clients
        await emit_game_event(game_id, 'settlement_regenerated', {
            'message': 'Settlement has been recalculated',
            'edited_player': player_name,
            'edited_by': user.name
        })

    return {
        "message": f"Chips updated for {player_name}",
        "old_chips": old_chips,
        "new_chips": data.chips_count,
        "new_cash_value": new_cash_value,
        "new_net_result": new_net_result,
        "settlement_regenerated": settlement_regenerated
    }
