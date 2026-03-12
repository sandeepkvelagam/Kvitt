"""Game thread endpoints: get and post messages."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Depends

from dependencies import User, get_current_user
from db import queries

from .models import GameThread, ThreadMessageCreate

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/games/{game_id}/thread")
async def get_thread(game_id: str, user: User = Depends(get_current_user)):
    """Get game thread messages."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Verify membership
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    messages = await queries.find_game_threads_by_game(game_id, order_by="created_at ASC")

    # Add user info
    for msg in messages:
        if msg["user_id"] == "ai_assistant":
            msg["user"] = {"user_id": "ai_assistant", "name": "Kvitt", "picture": None}
        else:
            user_info = await queries.get_user(msg["user_id"])
            msg["user"] = user_info

    return messages

@router.post("/games/{game_id}/thread")
async def post_message(game_id: str, data: ThreadMessageCreate, user: User = Depends(get_current_user)):
    """Post a message to game thread."""
    game = await queries.get_game_night(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Verify membership
    membership = await queries.get_group_member(game["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Check if game is archived (settled)
    if game["status"] == "settled":
        raise HTTPException(status_code=400, detail="Thread is archived")

    message = GameThread(
        game_id=game_id,
        user_id=user.user_id,
        content=data.content,
        type="user"
    )
    msg_dict = message.model_dump()
    await queries.insert_game_thread(msg_dict)

    # Broadcast via Socket.IO so all clients see the message in real-time
    user_info = await queries.get_user(user.user_id)
    sender_name = user_info.get("name", "Someone") if user_info else "Someone"
    try:
        from websocket_manager import notify_game_message
        await notify_game_message(game_id, sender_name, data.content, "user")
    except Exception as e:
        logger.debug(f"Game thread broadcast error (non-critical): {e}")

    # Fire-and-forget: trigger AI processing for game thread
    asyncio.create_task(_trigger_game_thread_ai(game_id, game["group_id"], msg_dict))

    return {"message_id": message.message_id}


async def _trigger_game_thread_ai(game_id: str, group_id: str, message: dict):
    """Fire-and-forget task to process game thread message through AI pipeline."""
    try:
        from ai_service.event_listener import get_event_listener
        listener = get_event_listener()
        await listener.emit("game_thread_message", {
            "game_id": game_id,
            "group_id": group_id,
            "message": message
        })
    except Exception as e:
        logger.debug(f"Game thread AI trigger error (non-critical): {e}")
