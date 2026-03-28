"""Helpers for game thread persistence + real-time broadcast."""

import logging
from typing import Any, Dict, Optional

from db import queries

logger = logging.getLogger(__name__)


async def insert_game_thread_and_broadcast(game_id: str, row: Dict[str, Any]) -> None:
    """Insert a game_threads row and notify clients in the game Socket.IO room."""
    await queries.insert_game_thread(row)
    try:
        from websocket_manager import broadcast_thread_message

        await broadcast_thread_message(game_id, row)
    except Exception as e:
        logger.error(f"Non-critical: thread broadcast failed game_id={game_id}: {e}")


async def broadcast_thread_message_after_insert(game_id: str, row: Dict[str, Any]) -> None:
    """Call after insert_game_thread(..., conn=conn) once the transaction has committed."""
    try:
        from websocket_manager import broadcast_thread_message

        await broadcast_thread_message(game_id, row)
    except Exception as e:
        logger.error(f"Non-critical: thread broadcast failed game_id={game_id}: {e}")
