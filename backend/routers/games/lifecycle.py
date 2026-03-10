"""Game lifecycle endpoints: create, list, get, start, end, update, cancel, rsvp."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

from dependencies import User, get_current_user, Notification
from push_service import send_push_to_users
from db import queries
from routers.groups import GroupMessage
from websocket_manager import emit_group_message

from .models import (
    GameNight, Player, Transaction, GameThread,
    GameNightCreate, GameNightUpdate, CancelGameRequest, RSVPRequest,
    generate_default_game_name,
)
from .settlement import auto_generate_settlement

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/games", response_model=dict)
async def create_game(data: GameNightCreate, user: User = Depends(get_current_user)):
    """Create a new game night."""
    try:
        # Verify membership
        membership = await queries.get_group_member(data.group_id, user.user_id)
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this group")

        # Get group settings
        group = await queries.get_group(data.group_id)

        # Calculate chip value
        chip_value = data.buy_in_amount / data.chips_per_buy_in

        # Use default title if not provided or empty
        game_title = data.title.strip() if data.title and data.title.strip() else generate_default_game_name()

        game = GameNight(
            group_id=data.group_id,
            host_id=user.user_id,
            title=game_title,
            location=data.location,
            scheduled_at=data.scheduled_at,
            status="scheduled" if data.scheduled_at else "active",
            started_at=None if data.scheduled_at else datetime.now(timezone.utc),
            buy_in_amount=data.buy_in_amount,
            chips_per_buy_in=data.chips_per_buy_in,
            chip_value=chip_value
        )

        game_dict = game.model_dump()
        await queries.insert_game_night(game_dict)

        # Add host as player with auto buy-in for active games
        player = Player(
            game_id=game.game_id,
            user_id=user.user_id,
            rsvp_status="yes",
            total_buy_in=data.buy_in_amount if game.status == "active" else 0,
            total_chips=data.chips_per_buy_in if game.status == "active" else 0
        )
        player_dict = player.model_dump()
        await queries.insert_player(player_dict)

        # Update game's total chips distributed if auto buy-in was added
        if game.status == "active":
            await queries.increment_game_night_field(game.game_id, "total_chips_distributed", data.chips_per_buy_in)

            # Create transaction record for host's initial buy-in
            txn = Transaction(
                game_id=game.game_id,
                user_id=user.user_id,
                type="buy_in",
                amount=data.buy_in_amount,
                chips=data.chips_per_buy_in,
                chip_value=chip_value,
                notes="Initial buy-in (auto)"
            )
            txn_dict = txn.model_dump()
            await queries.insert_transaction(txn_dict)

        # Add initial players with default buy-in (if provided and game is active)
        if data.initial_players and game.status == "active":
            for player_user_id in data.initial_players:
                # Skip the host (already added)
                if player_user_id == user.user_id:
                    continue

                # Check if user exists
                player_user = await queries.get_user(player_user_id)
                if not player_user:
                    continue

                # Add player with default buy-in
                init_player = Player(
                    game_id=game.game_id,
                    user_id=player_user_id,
                    rsvp_status="yes",
                    total_buy_in=data.buy_in_amount,
                    total_chips=data.chips_per_buy_in,
                    buy_in_count=1
                )
                init_player_dict = init_player.model_dump()
                await queries.insert_player(init_player_dict)

                # Update game's total chips distributed
                await queries.increment_game_night_field(game.game_id, "total_chips_distributed", data.chips_per_buy_in)

                # Create transaction record
                init_txn = Transaction(
                    game_id=game.game_id,
                    user_id=player_user_id,
                    type="buy_in",
                    amount=data.buy_in_amount,
                    chips=data.chips_per_buy_in,
                    chip_value=chip_value,
                    notes="Initial buy-in (added at game start)"
                )
                init_txn_dict = init_txn.model_dump()
                await queries.insert_transaction(init_txn_dict)

                # Notify the player
                init_notif = Notification(
                    user_id=player_user_id,
                    type="added_to_game",
                    title="Added to Game",
                    message=f"You've been added with ${data.buy_in_amount} ({data.chips_per_buy_in} chips)",
                    data={"game_id": game.game_id, "buy_in": data.buy_in_amount, "chips": data.chips_per_buy_in}
                )
                init_notif_dict = init_notif.model_dump()
                try:
                    await queries.insert_notification(init_notif_dict)
                except Exception as e:
                    logger.error(f"Non-critical: notification insert failed for added_to_game: {e}")

        # Notify remaining group members (exclude host and initial players)
        excluded_ids = [user.user_id] + (data.initial_players or [])
        all_members = await queries.find_group_members_by_group(data.group_id, limit=100)
        members = [m for m in all_members if m["user_id"] not in excluded_ids]

        for member in members:
            notification = Notification(
                user_id=member["user_id"],
                type="game_invite",
                title="Game Night!",
                message=f"New game scheduled in {group['name']}",
                data={"game_id": game.game_id, "group_id": data.group_id}
            )
            notif_dict = notification.model_dump()
            try:
                await queries.insert_notification(notif_dict)
            except Exception as e:
                logger.error(f"Non-critical: notification insert failed for game_invite: {e}")

        # Post game-started message to group chat
        try:
            buy_in_text = f"${data.buy_in_amount:.0f}" if data.buy_in_amount else ""
            game_chat_msg = GroupMessage(
                group_id=data.group_id,
                user_id="ai_assistant",
                content=f"Game started! {user.name} kicked off a {buy_in_text} buy-in game.",
                type="system",
                metadata={"game_id": game.game_id}
            )
            await queries.insert_group_message(game_chat_msg.model_dump())
            await emit_group_message(data.group_id, {
                **game_chat_msg.model_dump(),
                "user": {"user_id": "ai_assistant", "name": "Kvitt", "picture": None}
            })
        except Exception as e:
            logger.debug(f"Group chat game-start message error (non-critical): {e}")

        return {"game_id": game.game_id, "status": game.status}
    except HTTPException:
        raise
    except Exception as e:
        trace_id = uuid.uuid4().hex[:10]
        logger.exception(f"[{trace_id}] Failed to create game")
        raise HTTPException(status_code=500, detail=f"Failed to create game. Reference: {trace_id}")

@router.get("/games")
async def get_games(group_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Get games (optionally filtered by group)."""
    # Get user's groups
    memberships = await queries.find_group_members_by_user(user.user_id, limit=100)
    group_ids = [m["group_id"] for m in memberships]

    if group_id:
        if group_id not in group_ids:
            raise HTTPException(status_code=403, detail="Not a member of this group")

    games = await queries.find_game_nights_by_group_ids(group_ids, group_id=group_id if group_id else None)

    if not games:
        return games

    # Batch fetch all related data
    game_ids = [g["game_id"] for g in games]
    unique_group_ids = list(set(g["group_id"] for g in games))
    unique_host_ids = list(set(g["host_id"] for g in games if g.get("host_id")))

    # Get all groups at once
    groups = await queries.find_groups_by_ids(unique_group_ids)
    group_map = {g["group_id"]: g for g in groups}

    # Get all hosts
    hosts = await queries.find_users_by_ids(unique_host_ids)
    host_map = {h["user_id"]: h for h in hosts}

    # Get player counts and total buy-ins using aggregation
    player_stats = await queries.get_player_stats_by_games(game_ids)
    stats_map = {ps["game_id"]: ps for ps in player_stats}

    # Get user's player records for all games
    user_players = await queries.find_players_by_games_user(game_ids, user.user_id)
    player_map = {p["game_id"]: p for p in user_players}

    # Apply to games
    for game in games:
        group = group_map.get(game["group_id"])
        host = host_map.get(game.get("host_id"))
        stats = stats_map.get(game["game_id"], {})

        game["group_name"] = group["name"] if group else "Unknown"
        game["host_name"] = host["name"] if host else "Unknown"
        game["player_count"] = stats.get("count", 0)
        game["total_pot"] = stats.get("total_pot", 0)

        player = player_map.get(game["game_id"])
        game["is_player"] = player is not None
        game["rsvp_status"] = player["rsvp_status"] if player else None

    return games

@router.get("/games/{game_id}")
async def get_game(game_id: str, user: User = Depends(get_current_user)):
    """Get game details."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check for required fields to prevent KeyError crashes
    group_id = game.get("group_id")
    host_id = game.get("host_id")
    if not group_id:
        raise HTTPException(status_code=404, detail="Game data is corrupted (missing group)")

    # Verify membership
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Get players
    players = await queries.find_players_by_game(game_id)

    if players:
        # Batch fetch user info for all players
        user_ids = [p["user_id"] for p in players]
        users = await queries.find_users_by_ids(user_ids)
        user_map = {u["user_id"]: u for u in users}

        # Batch fetch all transactions for this game
        txns = await queries.find_transactions_by_game(game_id)
        txn_map = {}
        for txn in txns:
            if txn["user_id"] not in txn_map:
                txn_map[txn["user_id"]] = []
            txn_map[txn["user_id"]].append(txn)

        # Apply to players
        for player in players:
            player["user"] = user_map.get(player["user_id"])
            player["transactions"] = txn_map.get(player["user_id"], [])
            player["buy_in_count"] = len([t for t in player["transactions"] if t.get("type") == "buy_in"])
            # Calculate net_result for settlement display (handle None values)
            cash_out = player.get("cash_out") or 0
            total_buy_in = player.get("total_buy_in") or 0
            player["net_result"] = cash_out - total_buy_in

    game["players"] = players

    # Get group info
    group = await queries.get_group(group_id)
    game["group"] = group

    # Get host info (handle missing host_id gracefully)
    host = None
    if host_id:
        host = await queries.get_user(host_id)
    game["host"] = host

    # Check if current user is host
    game["is_host"] = host_id == user.user_id if host_id else False

    # Get current user's player record (already in players list)
    current_player = next((p for p in players if p["user_id"] == user.user_id), None)
    game["current_player"] = current_player

    return game

@router.post("/games/{game_id}/start")
async def start_game(game_id: str, user: User = Depends(get_current_user)):
    """Start a scheduled game (host only). Requires minimum 2 players."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["host_id"] != user.user_id:
        # Check if user is admin
        membership = await queries.get_group_member(game["group_id"], user.user_id)
        if not membership:
            raise HTTPException(status_code=403, detail="Only host or admin can start game")

    if game["status"] != "scheduled":
        raise HTTPException(status_code=400, detail="Game already started or ended")

    # Check minimum players (at least 2 with RSVP yes)
    player_count = await queries.count_players_by_game_rsvp(game_id, "yes")
    if player_count < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 players required to start game")

    await queries.update_game_night(game_id, {
            "status": "active",
            "started_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        })

    # Add system message to thread
    message = GameThread(
        game_id=game_id,
        user_id=user.user_id,
        content="Game started!",
        type="system"
    )
    msg_dict = message.model_dump()
    await queries.insert_game_thread(msg_dict)

    # Push notification to all players
    try:
        players_yes = await queries.find_players_by_game_rsvp(game_id, "yes", limit=50)
        player_ids = [p["user_id"] for p in players_yes if p["user_id"] != user.user_id]
        if player_ids:
            await send_push_to_users(
                player_ids,
                "Game Started! ",
                f"Your poker game has started. Buy in to join the action!",
                {"type": "game_started", "game_id": game_id}
            )
    except Exception as e:
        logger.error(f"Push notification error on game start: {e}")

    return {"message": "Game started", "player_count": player_count}


@router.post("/games/{game_id}/end")
async def end_game(game_id: str, user: User = Depends(get_current_user)):
    """End an active game (host/admin only). Validates all players cashed out."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check host or admin
    is_host = game["host_id"] == user.user_id
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not is_host and (not membership or membership["role"] != "admin"):
        raise HTTPException(status_code=403, detail="Only host or admin can end game")

    if game["status"] != "active":
        raise HTTPException(status_code=400, detail="Game not active")

    # Check if all players with buy-ins have cashed out
    players_with_buyin = await queries.find_players_by_game_with_buyin(game_id, min_buyin=0)

    not_cashed_out = [p for p in players_with_buyin if p.get("cash_out") is None]

    if not_cashed_out:
        player_names = []
        for p in not_cashed_out:
            u = await queries.get_user(p["user_id"])
            player_names.append(u["name"] if u else "Unknown")
        raise HTTPException(
            status_code=400,
            detail=f"All players must cash out before ending. Waiting for: {', '.join(player_names)}"
        )

    # Critical writes wrapped in a transaction for atomicity
    from db.pg import transaction as db_transaction
    message = GameThread(
        game_id=game_id,
        user_id=user.user_id,
        content="Game ended!",
        type="system"
    )
    msg_dict = message.model_dump()
    async with db_transaction() as conn:
        await queries.update_game_night(game_id, {
            "status": "ended",
            "ended_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }, conn=conn)
        await queries.insert_game_thread(msg_dict, conn=conn)

    # Non-critical side effects outside the transaction
    # Auto-generate settlement (Smart Settlement)
    try:
        settlement_result = await auto_generate_settlement(game_id, game, players_with_buyin)
    except Exception as e:
        logger.error(f"Settlement generation failed for game {game_id}: {e}")
        return {"success": True, "game_id": game_id, "status": "ended", "settlement_error": str(e)}

    # Build personalized notifications per player
    if settlement_result.get("settlements"):
        # Map user_ids to names
        player_user_ids = [p["user_id"] for p in players_with_buyin]
        player_users = await queries.find_users_by_ids(player_user_ids)
        user_name_map = {u["user_id"]: u["name"] for u in player_users}

        # Build per-player debt/credit summary
        player_debts = {}
        for s in settlement_result["settlements"]:
            from_id, to_id, amt = s["from_user_id"], s["to_user_id"], s["amount"]
            if from_id not in player_debts:
                player_debts[from_id] = {"owes": [], "owed": []}
            if to_id not in player_debts:
                player_debts[to_id] = {"owes": [], "owed": []}
            player_debts[from_id]["owes"].append((user_name_map.get(to_id, "Unknown"), amt))
            player_debts[to_id]["owed"].append((user_name_map.get(from_id, "Unknown"), amt))

        for player in players_with_buyin:
            pid = player["user_id"]
            debts = player_debts.get(pid, {"owes": [], "owed": []})
            net_result = player.get("net_result") or ((player.get("cash_out") or 0) - player.get("total_buy_in", 0))

            # Personalized in-app message
            if net_result > 0.01:
                owed_parts = [f"{name} owes you ${amt:.0f}" for name, amt in debts["owed"]]
                in_app_msg = f"You won ${net_result:.0f}! {', '.join(owed_parts)}."
                push_msg = f"You won ${net_result:.0f}. Open Kvitt to collect."
            elif net_result < -0.01:
                owes_parts = [f"You owe {name} ${amt:.0f}" for name, amt in debts["owes"]]
                in_app_msg = f"You lost ${abs(net_result):.0f}. {', '.join(owes_parts)}."
                push_msg = f"You owe ${abs(net_result):.0f}. Open Kvitt to settle."
            else:
                in_app_msg = "You broke even. No payments needed."
                push_msg = "You broke even. No action needed."

            try:
                await queries.insert_notification({
                    "notification_id": str(uuid.uuid4()),
                    "user_id": pid,
                    "type": "settlement_generated",
                    "title": "Settlement Ready",
                    "message": in_app_msg,
                    "data": {"game_id": game_id, "group_id": game["group_id"]},
                    "read": False,
                    "created_at": datetime.now(timezone.utc)
                })
            except Exception as e:
                logger.error(f"Non-critical: notification insert failed for settlement pid={pid}: {e}")

            # Push notification per player (short, drives action)
            try:
                await send_push_to_users(
                    [pid],
                    "Settlement Ready",
                    push_msg,
                    {"type": "settlement_generated", "game_id": game_id}
                )
            except Exception as e:
                logger.error(f"Push notification error for {pid}: {e}")

    # Post game-ended summary to group chat
    try:
        sorted_players = sorted(players_with_buyin, key=lambda p: float(p.get("net_result") or 0), reverse=True)
        player_user_ids = [p["user_id"] for p in sorted_players]
        player_users = await queries.find_users_by_ids(player_user_ids)
        name_map = {u["user_id"]: u["name"] for u in player_users}
        summary_lines = []
        for p in sorted_players:
            net = float(p.get("net_result") or 0)
            name = name_map.get(p["user_id"], "Player")
            if net > 0.01:
                summary_lines.append(f"  {name}: +${net:.0f}")
            elif net < -0.01:
                summary_lines.append(f"  {name}: -${abs(net):.0f}")
            else:
                summary_lines.append(f"  {name}: even")
        results_text = "\n".join(summary_lines)

        end_msg = GroupMessage(
            group_id=game["group_id"],
            user_id="ai_assistant",
            content=f"Game over!\n{results_text}",
            type="system",
            metadata={"game_id": game_id}
        )
        await queries.insert_group_message(end_msg.model_dump())
        await emit_group_message(game["group_id"], {
            **end_msg.model_dump(),
            "user": {"user_id": "ai_assistant", "name": "Kvitt", "picture": None}
        })
    except Exception as e:
        logger.debug(f"Group chat game-end message error (non-critical): {e}")

    return {
        "message": "Game ended",
        "settlement_generated": bool(settlement_result.get("settlements")),
        "settlement_count": len(settlement_result.get("settlements", []))
    }

@router.put("/games/{game_id}")
async def update_game(game_id: str, data: GameNightUpdate, user: User = Depends(get_current_user)):
    """Update game details (host/admin only)."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check host or admin
    is_host = game["host_id"] == user.user_id
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not is_host and (not membership or membership["role"] != "admin"):
        raise HTTPException(status_code=403, detail="Only host or admin can update game")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    # scheduled_at is already a datetime from Pydantic; _build_update_query handles coercion
    update_data["updated_at"] = datetime.now(timezone.utc)

    if update_data:
        await queries.update_game_night(game_id, update_data)

    return {"message": "Game updated"}

@router.post("/games/{game_id}/cancel")
async def cancel_game(game_id: str, data: CancelGameRequest, user: User = Depends(get_current_user)):
    """Cancel a game (host/admin only)."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check host or admin
    is_host = game["host_id"] == user.user_id
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not is_host and (not membership or membership["role"] != "admin"):
        raise HTTPException(status_code=403, detail="Only host or admin can cancel game")

    if game["status"] in ["settled", "cancelled"]:
        raise HTTPException(status_code=400, detail="Game already settled or cancelled")

    await queries.update_game_night(game_id, {
            "status": "cancelled",
            "cancelled_by": user.user_id,
            "cancel_reason": data.reason,
            "updated_at": datetime.now(timezone.utc)
        })

    # Add system message
    message = GameThread(
        game_id=game_id,
        user_id=user.user_id,
        content=f"Game cancelled. Reason: {data.reason or 'No reason provided'}",
        type="system"
    )
    msg_dict = message.model_dump()
    await queries.insert_game_thread(msg_dict)

    return {"message": "Game cancelled"}

@router.post("/games/{game_id}/rsvp")
async def rsvp_game(game_id: str, data: RSVPRequest, user: User = Depends(get_current_user)):
    """RSVP for a game."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Verify membership
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Update or create player record
    existing = await queries.get_player_by_game_user(game_id, user.user_id)

    if existing:
        await queries.update_player_by_game_user(game_id, user.user_id, {"rsvp_status": data.status})
    else:
        player = Player(
            game_id=game_id,
            user_id=user.user_id,
            rsvp_status=data.status
        )
        await queries.insert_player(player.model_dump())

    return {"message": "RSVP updated"}
