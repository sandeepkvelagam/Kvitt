"""
Shared push notification service — Expo Push API + preference checking.

Used by groups, games, settlements, and notification endpoints.
Extracted from server.py — pure mechanical move, zero behavior changes.
"""

import logging
from typing import List, Optional, Dict, Any

import httpx

from db import queries

logger = logging.getLogger(__name__)

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"

NOTIFICATION_CATEGORY_MAP = {
    "game_started": "game_updates_enabled",
    "game_ended": "game_updates_enabled",
    "buy_in_request": "game_updates_enabled",
    "buy_in_approved": "game_updates_enabled",
    "buy_in_added": "game_updates_enabled",
    "buy_in_request_rejected": "game_updates_enabled",
    "buy_in": "game_updates_enabled",
    "cash_out": "game_updates_enabled",
    "cash_out_request": "game_updates_enabled",
    "cash_out_request_rejected": "game_updates_enabled",
    "cashed_out": "game_updates_enabled",
    "join_request": "game_updates_enabled",
    "join_approved": "game_updates_enabled",
    "join_rejected": "game_updates_enabled",
    "chip_edit": "game_updates_enabled",
    "settlement": "settlements_enabled",
    "settlement_generated": "settlements_enabled",
    "payment_request": "settlements_enabled",
    "payment_received": "settlements_enabled",
    "group_invite_request": "group_invites_enabled",
    "invite_accepted": "group_invites_enabled",
    "invite_sent": "group_invites_enabled",
    "group_invite": "group_invites_enabled",
}


async def check_notification_preferences(user_id: str, notification_type: str) -> dict:
    """Check user preferences and return which channels to use.

    Returns {"push": True/False} based on user's notification preferences.
    In-app notifications are always created regardless of preferences.
    """
    category = NOTIFICATION_CATEGORY_MAP.get(notification_type)
    if not category:
        # Unknown type — always send
        return {"push": True}

    prefs = await queries.get_notification_preferences(user_id)
    if not prefs:
        return {"push": True}

    if not prefs.get("push_enabled", True):
        return {"push": False}

    return {"push": prefs.get(category, True)}


async def send_push_notification_to_user(
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None
):
    """Helper: send Expo push notification to a user if they have a token.

    Respects user notification preferences — skips sending if the user
    has disabled the relevant notification category.
    """
    try:
        # Check user notification preferences
        notification_type = (data or {}).get("type", "")
        if notification_type:
            prefs = await check_notification_preferences(user_id, notification_type)
            if not prefs.get("push", True):
                return  # User has disabled this notification category

        user_doc = await queries.get_user(user_id)
        if not user_doc or not user_doc.get("expo_push_token"):
            return  # No token, skip silently

        token = user_doc["expo_push_token"]
        if not token.startswith("ExponentPushToken["):
            return

        payload = {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "data": data or {},
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                EXPO_PUSH_API_URL,
                json=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            if resp.status_code != 200:
                logger.warning(f"Push notification failed for {user_id}: {resp.text}")
    except Exception as e:
        logger.error(f"Push notification error for {user_id}: {e}")


async def send_push_to_users(user_ids: List[str], title: str, body: str, data: Optional[Dict[str, Any]] = None):
    """Send push notification to multiple users."""
    if not user_ids:
        return
    try:
        users = await queries.find_users_with_push_tokens(user_ids)

        tokens = [
            u["expo_push_token"] for u in users
            if u.get("expo_push_token", "").startswith("ExponentPushToken[")
        ]
        if not tokens:
            return

        messages = [
            {"to": t, "title": title, "body": body, "sound": "default", "data": data or {}}
            for t in tokens
        ]

        # Chunk to 100
        for i in range(0, len(messages), 100):
            chunk = messages[i:i + 100]
            async with httpx.AsyncClient(timeout=15.0) as client:
                await client.post(
                    EXPO_PUSH_API_URL,
                    json=chunk,
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                )
    except Exception as e:
        logger.error(f"Batch push notification error: {e}")
