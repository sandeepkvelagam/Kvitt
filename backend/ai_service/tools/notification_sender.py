"""
Notification Sender Tool

Sends push notifications, in-app notifications, and manages notification preferences.
"""

import logging
from typing import List, Dict, Optional
from .base import BaseTool, ToolResult
from datetime import datetime
import uuid

from db import queries
from db.pg import get_pool

logger = logging.getLogger(__name__)

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"


class NotificationSenderTool(BaseTool):
    """
    Sends notifications to users via various channels.

    Supports:
    - In-app notifications (stored in database)
    - Push notifications (via Expo Push API)
    - Email notifications (via email_service)
    """

    def __init__(self):
        pass

    @property
    def name(self) -> str:
        return "notification_sender"

    @property
    def description(self) -> str:
        return """Sends notifications to one or more users.
        Can send in-app notifications, push notifications, or emails.
        Use this to notify users about game invites, game starting, settlements, etc."""

    @property
    def parameters(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "user_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of user IDs to notify"
                },
                "title": {
                    "type": "string",
                    "description": "Notification title"
                },
                "message": {
                    "type": "string",
                    "description": "Notification message body"
                },
                "notification_type": {
                    "type": "string",
                    "enum": ["game_invite", "game_starting", "game_ended", "settlement", "buy_in_request", "cash_out", "reminder", "general"],
                    "description": "Type of notification for categorization"
                },
                "channels": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["in_app", "push", "email"]
                    },
                    "description": "Channels to send notification through",
                    "default": ["in_app"]
                },
                "data": {
                    "type": "object",
                    "description": "Additional data payload (e.g., game_id, group_id)"
                },
                "scheduled_for": {
                    "type": "string",
                    "format": "date-time",
                    "description": "Optional: Schedule notification for later"
                }
            },
            "required": ["user_ids", "title", "message", "notification_type"]
        }

    async def _send_push_notification(self, user_id: str, title: str, body: str, data: Dict) -> tuple:
        """Send Expo push notification to a user if they have a token.
        Returns (success: bool, reason: str)."""
        import httpx

        if not get_pool():
            return (False, "no_db")

        user_doc = await queries.get_user(user_id)
        if not user_doc or not user_doc.get("expo_push_token"):
            return (False, "no_token")

        token = user_doc["expo_push_token"]
        if not token.startswith("ExponentPushToken["):
            return (False, "no_token")

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
                return (False, "api_error")

        return (True, "sent")

    async def _send_email_notification(self, user_id: str, title: str, body: str) -> bool:
        """Send email notification to a user."""
        if not get_pool():
            return False

        user_doc = await queries.get_user(user_id)
        if not user_doc or not user_doc.get("email"):
            return False

        from email_service import send_email
        await send_email(user_doc["email"], title, body)
        return True

    async def execute(
        self,
        user_ids: List[str],
        title: str,
        message: str,
        notification_type: str,
        channels: List[str] = None,
        data: Dict = None,
        scheduled_for: str = None
    ) -> ToolResult:
        """Send notifications to users"""
        try:
            if not channels:
                channels = ["in_app"]

            if not user_ids:
                return ToolResult(
                    success=False,
                    error="No user IDs provided"
                )

            sent_count = 0
            failed_count = 0
            results = []

            for user_id in user_ids:
                notification = {
                    "notification_id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "title": title,
                    "message": message,
                    "type": notification_type,
                    "data": data or {},
                    "channels": channels,
                    "read": False,
                    "created_at": datetime.utcnow().isoformat(),
                    "scheduled_for": scheduled_for
                }

                # Store in-app notification
                if "in_app" in channels and get_pool():
                    try:
                        await queries.insert_notification(notification)
                        sent_count += 1
                        results.append({
                            "user_id": user_id,
                            "status": "sent",
                            "channel": "in_app"
                        })
                    except Exception as e:
                        failed_count += 1
                        results.append({
                            "user_id": user_id,
                            "status": "failed",
                            "channel": "in_app",
                            "error": str(e)
                        })

                # Send push notification via Expo Push API
                if "push" in channels:
                    try:
                        success, reason = await self._send_push_notification(
                            user_id, title, message, data or {}
                        )
                        if success:
                            sent_count += 1
                            results.append({
                                "user_id": user_id,
                                "status": "sent",
                                "channel": "push"
                            })
                        elif reason == "no_token":
                            results.append({
                                "user_id": user_id,
                                "status": "skipped",
                                "channel": "push",
                                "note": "No push token registered"
                            })
                        else:
                            failed_count += 1
                            results.append({
                                "user_id": user_id,
                                "status": "failed",
                                "channel": "push",
                                "note": f"Push delivery failed ({reason})"
                            })
                    except Exception as e:
                        failed_count += 1
                        results.append({
                            "user_id": user_id,
                            "status": "failed",
                            "channel": "push",
                            "error": str(e)
                        })

                # Send email notification
                if "email" in channels:
                    try:
                        success = await self._send_email_notification(
                            user_id, title, message
                        )
                        if success:
                            sent_count += 1
                            results.append({
                                "user_id": user_id,
                                "status": "sent",
                                "channel": "email"
                            })
                        else:
                            results.append({
                                "user_id": user_id,
                                "status": "skipped",
                                "channel": "email",
                                "note": "No email address found"
                            })
                    except ImportError:
                        results.append({
                            "user_id": user_id,
                            "status": "skipped",
                            "channel": "email",
                            "note": "Email service not available"
                        })
                    except Exception as e:
                        failed_count += 1
                        results.append({
                            "user_id": user_id,
                            "status": "failed",
                            "channel": "email",
                            "error": str(e)
                        })

            return ToolResult(
                success=sent_count > 0,
                data={
                    "sent_count": sent_count,
                    "failed_count": failed_count,
                    "total_users": len(user_ids),
                    "results": results
                },
                message=f"Sent {sent_count} notifications, {failed_count} failed"
            )

        except Exception as e:
            return ToolResult(
                success=False,
                error=str(e)
            )
