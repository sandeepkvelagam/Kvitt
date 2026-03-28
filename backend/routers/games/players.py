"""Player management endpoints: join, approve/reject, invite, add/remove, available."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from dependencies import User, get_current_user, Notification
from db import queries
from routers.groups import GroupMember
from websocket_manager import sio, notify_player_joined

from .models import Player, Transaction, GameThread
from .thread_utils import insert_game_thread_and_broadcast

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/games/{game_id}/join")
async def join_game(game_id: str, user: User = Depends(get_current_user)):
    """Request to join an active game. Sends notification to host for approval."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Verify membership in group
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Check if already a player
    existing = await queries.get_player_by_game_user(game_id, user.user_id)

    if existing:
        if existing.get("rsvp_status") == "pending":
            return {"message": "Join request already pending", "status": "pending"}
        elif existing.get("rsvp_status") == "yes":
            return {"message": "Already in game", "status": "joined"}
        else:
            # Update to pending
            await queries.update_player_by_game_user(game_id, user.user_id, {"rsvp_status": "pending"})
    else:
        # Create pending player record
        player = Player(
            game_id=game_id,
            user_id=user.user_id,
            rsvp_status="pending"
        )
        await queries.insert_player(player.model_dump())

    # Send notification to host
    notification = Notification(
        user_id=game["host_id"],
        type="join_request",
        title="Join Request",
        message=f"{user.name} wants to join the game",
        data={"game_id": game_id, "user_id": user.user_id, "user_name": user.name}
    )
    notif_dict = notification.model_dump()
    try:
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for request_join_game: {e}")

    # Add system message to thread
    message = GameThread(
        game_id=game_id,
        user_id=user.user_id,
        content=f"{user.name} requested a seat at the table (pending host approval).",
        type="system"
    )
    await insert_game_thread_and_broadcast(game_id, message.model_dump())

    return {"message": "Join request sent to host", "status": "pending"}

@router.post("/games/{game_id}/approve-join")
async def approve_join(game_id: str, data: dict, user: User = Depends(get_current_user)):
    """Host approves a join request - auto adds default buy-in."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Only host can approve
    if game["host_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can approve join requests")

    player_user_id = data.get("user_id")
    if not player_user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    # Get default buy-in from game
    buy_in_amount = game.get("buy_in_amount", 20)
    chips_per_buy_in = game.get("chips_per_buy_in", 20)
    chip_value = buy_in_amount / chips_per_buy_in if chips_per_buy_in > 0 else 1.0

    # Update player status AND add default buy-in
    result_count = await queries.update_player_by_game_user_rsvp(
        game_id, player_user_id, "pending",
        {
            "rsvp_status": "yes",
            "total_buy_in": buy_in_amount,
            "total_chips": chips_per_buy_in,
            "buy_in_count": 1
        }
    )

    if result_count == 0:
        raise HTTPException(status_code=400, detail="No pending request found")

    # Update game's total chips distributed
    await queries.increment_game_night_field(game_id, "total_chips_distributed", chips_per_buy_in)

    # Create transaction record
    txn = Transaction(
        game_id=game_id,
        user_id=player_user_id,
        type="buy_in",
        amount=buy_in_amount,
        chips=chips_per_buy_in,
        chip_value=chip_value,
        notes="Initial buy-in (auto on join)"
    )
    txn_dict = txn.model_dump()
    await queries.insert_transaction(txn_dict)

    # Get player name
    player_user = await queries.get_user(player_user_id)
    player_name = player_user["name"] if player_user else "Player"

    # Notify the player
    notification = Notification(
        user_id=player_user_id,
        type="join_approved",
        title="You're In!",
        message=f"Joined with ${buy_in_amount} ({chips_per_buy_in} chips)",
        data={"game_id": game_id, "buy_in": buy_in_amount, "chips": chips_per_buy_in}
    )
    notif_dict = notification.model_dump()
    try:
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for approve_join_request: {e}")

    # Add system message
    message = GameThread(
        game_id=game_id,
        user_id=user.user_id,
        content=f"\u2705 {player_name} joined with ${buy_in_amount} ({chips_per_buy_in} chips)",
        type="system"
    )
    msg_dict = message.model_dump()
    await queries.insert_game_thread(msg_dict)

    # Emit WebSocket event for real-time update
    await notify_player_joined(game_id, player_name, player_user_id, buy_in_amount, chips_per_buy_in)

    return {"message": f"{player_name} approved with default buy-in"}

@router.post("/games/{game_id}/reject-join")
async def reject_join(game_id: str, data: dict, user: User = Depends(get_current_user)):
    """Host rejects a join request."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["host_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can reject join requests")

    player_user_id = data.get("user_id")
    if not player_user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    # Remove player record
    result_count = await queries.delete_player_by_game_user(game_id, player_user_id, rsvp_status="pending")

    if result_count == 0:
        raise HTTPException(status_code=400, detail="No pending request found")

    # Notify the player
    notification = Notification(
        user_id=player_user_id,
        type="join_rejected",
        title="Join Request Declined",
        message="Your request to join the game was declined",
        data={"game_id": game_id}
    )
    notif_dict = notification.model_dump()
    try:
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for reject_join_request: {e}")

    return {"message": "Request rejected"}

@router.post("/games/{game_id}/invite-player")
async def invite_player_to_game(game_id: str, data: dict, user: User = Depends(get_current_user)):
    """Host invites a player to the game. Player must accept before being added."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Only host can invite players
    if game["host_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can invite players")

    player_user_id = data.get("user_id")
    email = data.get("email")

    # Find user by email if user_id not provided
    if not player_user_id and email:
        found_user = await queries.get_user_by_email(email.lower())
        if found_user:
            player_user_id = found_user["user_id"]
        else:
            raise HTTPException(status_code=404, detail=f"No user found with email {email}")

    if not player_user_id:
        raise HTTPException(status_code=400, detail="user_id or email required")

    # Check if user is in the group, if not add them
    membership = await queries.get_group_member(game["group_id"], player_user_id)
    if not membership:
        # Auto-add to group
        member = GroupMember(
            group_id=game["group_id"],
            user_id=player_user_id,
            role="member"
        )
        member_dict = member.model_dump()
        await queries.insert_group_member(member_dict)

    # Check if already a player
    existing = await queries.get_player_by_game_user(game_id, player_user_id)

    if existing:
        if existing.get("rsvp_status") == "yes":
            raise HTTPException(status_code=400, detail="Player already in game")
        if existing.get("rsvp_status") == "invited":
            raise HTTPException(status_code=400, detail="Invite already sent")
        # Update status to invited
        await queries.update_player_by_game_user(game_id, player_user_id, {"rsvp_status": "invited"})
    else:
        player = Player(
            game_id=game_id,
            user_id=player_user_id,
            rsvp_status="invited"
        )
        await queries.insert_player(player.model_dump())

    # Get player name
    player_user = await queries.get_user(player_user_id)
    player_name = player_user["name"] if player_user else "Player"

    # Get group name for notification
    group = await queries.get_group(game["group_id"])
    group_name = group["name"] if group else "the group"

    # Send notification to invited user
    try:
        notification = Notification(
            user_id=player_user_id,
            type="game_invite",
            title="Game Invite",
            message=f"{user.name} invited you to join a game in {group_name}",
            data={"game_id": game_id, "host_id": user.user_id, "host_name": user.name, "group_name": group_name}
        )
        notif_dict = notification.model_dump()
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"invite_player_to_game: notification insert failed for game_id={game_id} user_id={player_user_id}: {e}")

    try:
        message = GameThread(
            game_id=game_id,
            user_id=user.user_id,
            content=f"{user.name} invited {player_name} to this game night.",
            type="system"
        )
        await insert_game_thread_and_broadcast(game_id, message.model_dump())
    except Exception as e:
        logger.error(f"invite_player_to_game: game_thread insert failed for game_id={game_id}: {e}")

    return {"message": f"Invite sent to {player_name}", "status": "invited"}


@router.post("/games/{game_id}/accept-invite")
async def accept_game_invite(game_id: str, user: User = Depends(get_current_user)):
    """User accepts a game invite. Adds them with default buy-in."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check if user has an invite
    player = await queries.get_player_by_game_user(game_id, user.user_id)
    if not player:
        raise HTTPException(status_code=400, detail="No invite found for this game")

    if player.get("rsvp_status") == "yes":
        return {"message": "Already in game", "status": "joined"}

    if player.get("rsvp_status") != "invited":
        raise HTTPException(status_code=400, detail="No pending invite")

    # Get default buy-in from game
    buy_in_amount = game.get("buy_in_amount", 20)
    chips_per_buy_in = game.get("chips_per_buy_in", 20)
    chip_value = buy_in_amount / chips_per_buy_in if chips_per_buy_in > 0 else 1.0

    # Update player status and add default buy-in
    await queries.update_player_by_game_user(game_id, user.user_id, {
        "rsvp_status": "yes",
        "total_buy_in": buy_in_amount,
        "total_chips": chips_per_buy_in,
        "buy_in_count": 1
    })

    # Update game's total chips distributed
    await queries.increment_game_night_field(game_id, "total_chips_distributed", chips_per_buy_in)

    # Create transaction record
    txn = Transaction(
        game_id=game_id,
        user_id=user.user_id,
        type="buy_in",
        amount=buy_in_amount,
        chips=chips_per_buy_in,
        chip_value=chip_value,
        notes="Initial buy-in (accepted invite)"
    )
    txn_dict = txn.model_dump()
    await queries.insert_transaction(txn_dict)

    # Notify host
    try:
        notification = Notification(
            user_id=game["host_id"],
            type="invite_accepted",
            title="Invite Accepted",
            message=f"{user.name} accepted and joined the game",
            data={"game_id": game_id, "user_id": user.user_id, "user_name": user.name}
        )
        notif_dict = notification.model_dump()
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"accept_game_invite: notification insert failed for game_id={game_id}: {e}")

    try:
        message = GameThread(
            game_id=game_id,
            user_id=user.user_id,
            content=(
                f"{user.name} accepted the invite and is in for ${buy_in_amount:.0f} ({chips_per_buy_in} chips)."
            ),
            type="system"
        )
        await insert_game_thread_and_broadcast(game_id, message.model_dump())
    except Exception as e:
        logger.error(f"accept_game_invite: game_thread insert failed for game_id={game_id}: {e}")

    return {"message": f"Joined with ${buy_in_amount} ({chips_per_buy_in} chips)", "status": "joined"}


@router.post("/games/{game_id}/decline-invite")
async def decline_game_invite(game_id: str, user: User = Depends(get_current_user)):
    """User declines a game invite."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check if user has an invite
    player = await queries.get_player_by_game_user(game_id, user.user_id)
    if not player:
        raise HTTPException(status_code=400, detail="No invite found for this game")

    if player.get("rsvp_status") != "invited":
        raise HTTPException(status_code=400, detail="No pending invite")

    # Update status to declined
    await queries.update_player_by_game_user(game_id, user.user_id, {"rsvp_status": "no"})

    # Notify host
    try:
        notification = Notification(
            user_id=game["host_id"],
            type="invite_declined",
            title="Invite Declined",
            message=f"{user.name} declined the game invite",
            data={"game_id": game_id, "user_id": user.user_id, "user_name": user.name}
        )
        notif_dict = notification.model_dump()
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"decline_game_invite: notification insert failed for game_id={game_id}: {e}")

    try:
        message = GameThread(
            game_id=game_id,
            user_id=user.user_id,
            content=f"\u274c {user.name} declined the invite",
            type="system"
        )
        msg_dict = message.model_dump()
        await queries.insert_game_thread(msg_dict)
    except Exception as e:
        logger.error(f"decline_game_invite: game_thread insert failed for game_id={game_id}: {e}")

    return {"message": "Invite declined", "status": "declined"}


@router.post("/games/{game_id}/add-player")
async def add_player_to_game(game_id: str, data: dict, user: User = Depends(get_current_user)):
    """Host adds a player to the game by user_id or email. Deprecated: use invite-player instead."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Only host can add players
    if game["host_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can add players")

    player_user_id = data.get("user_id")
    email = data.get("email")

    # Find user by email if user_id not provided
    if not player_user_id and email:
        found_user = await queries.get_user_by_email(email.lower())
        if found_user:
            player_user_id = found_user["user_id"]
        else:
            raise HTTPException(status_code=404, detail=f"No user found with email {email}")

    if not player_user_id:
        raise HTTPException(status_code=400, detail="user_id or email required")

    # Check if user is in the group, if not add them
    membership = await queries.get_group_member(game["group_id"], player_user_id)
    if not membership:
        # Auto-add to group
        member = GroupMember(
            group_id=game["group_id"],
            user_id=player_user_id,
            role="member"
        )
        member_dict = member.model_dump()
        await queries.insert_group_member(member_dict)

    # Get default buy-in from game
    buy_in_amount = game.get("buy_in_amount", 20)
    chips_per_buy_in = game.get("chips_per_buy_in", 20)
    chip_value = buy_in_amount / chips_per_buy_in if chips_per_buy_in > 0 else 1.0

    # Check if already a player
    existing = await queries.get_player_by_game_user(game_id, player_user_id)

    if existing:
        if existing.get("rsvp_status") == "yes":
            raise HTTPException(status_code=400, detail="Player already in game")
        # Update status to yes AND add default buy-in
        await queries.update_player_by_game_user(game_id, player_user_id, {
                "rsvp_status": "yes",
                "total_buy_in": buy_in_amount,
                "total_chips": chips_per_buy_in,
                "buy_in_count": 1
            })
    else:
        player = Player(
            game_id=game_id,
            user_id=player_user_id,
            rsvp_status="yes",
            total_buy_in=buy_in_amount,
            total_chips=chips_per_buy_in,
            buy_in_count=1
        )
        await queries.insert_player(player.model_dump())

    # Update game's total chips distributed
    await queries.increment_game_night_field(game_id, "total_chips_distributed", chips_per_buy_in)

    # Create transaction record
    txn = Transaction(
        game_id=game_id,
        user_id=player_user_id,
        type="buy_in",
        amount=buy_in_amount,
        chips=chips_per_buy_in,
        chip_value=chip_value,
        notes="Initial buy-in (added by host)"
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
            type="added_to_game",
            title="Added to Game",
            message=f"You've been added with ${buy_in_amount} ({chips_per_buy_in} chips)",
            data={"game_id": game_id, "buy_in": buy_in_amount, "chips": chips_per_buy_in}
        )
        notif_dict = notification.model_dump()
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"add_player_to_game: notification insert failed for game_id={game_id} user_id={player_user_id}: {e}")

    try:
        message = GameThread(
            game_id=game_id,
            user_id=user.user_id,
            content=(
                f"{user.name} added {player_name} to the roster with a ${buy_in_amount:.0f} buy-in "
                f"({chips_per_buy_in} chips)."
            ),
            type="system"
        )
        await insert_game_thread_and_broadcast(game_id, message.model_dump())
    except Exception as e:
        logger.error(f"add_player_to_game: game_thread insert failed for game_id={game_id}: {e}")

    return {"message": f"{player_name} added with ${buy_in_amount} ({chips_per_buy_in} chips)"}

@router.post("/games/{game_id}/remove-player")
async def remove_player_from_game(game_id: str, data: dict, user: User = Depends(get_current_user)):
    """Host removes a player who has not yet bought in."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game["host_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can remove players")
    player_user_id = data.get("user_id")
    if not player_user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    player = await queries.get_player_by_game_user(game_id, player_user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found in this game")
    if (player.get("total_buy_in") or 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot remove a player who has already bought in. Use cash-out instead.")
    removed = await queries.get_user(player_user_id)
    removed_name = removed["name"] if removed else "Player"
    await queries.delete_player_by_game_user(game_id, player_user_id)
    try:
        msg = GameThread(
            game_id=game_id,
            user_id=user.user_id,
            content=(
                f"{user.name} removed {removed_name} from the roster before their first buy-in was recorded."
            ),
            type="system",
        )
        await insert_game_thread_and_broadcast(game_id, msg.model_dump())
    except Exception as e:
        logger.error(f"remove_player thread failed game_id={game_id}: {e}")
    await sio.emit("game_update", {"game_id": game_id})
    return {"message": "Player removed"}

@router.get("/games/{game_id}/available-players")
async def get_available_players(game_id: str, user: User = Depends(get_current_user)):
    """Get group members who can be added to the game."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Get all group members
    memberships = await queries.find_group_members_by_group(game["group_id"], limit=100)

    member_ids = [m["user_id"] for m in memberships]

    # Get existing players in game
    existing_players = await queries.find_players_by_game_active(game_id)
    existing_ids = [p["user_id"] for p in existing_players]

    # Filter out existing players
    available_ids = [uid for uid in member_ids if uid not in existing_ids]

    # Get user details
    users = await queries.find_users_by_ids(available_ids)

    return users
