"""Notification endpoints: list, read, delete, preferences.
Extracted from server.py — pure mechanical move, zero behavior changes."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries

router = APIRouter(prefix="/api", tags=["notifications"])


# ── Pydantic models ──────────────────────────────────────────────

class NotificationPreferencesUpdate(BaseModel):
    push_enabled: Optional[bool] = None
    game_updates_enabled: Optional[bool] = None
    settlements_enabled: Optional[bool] = None
    group_invites_enabled: Optional[bool] = None


# ── Routes ────────────────────────────────────────────────────────

@router.get("/notifications")
async def get_notifications(user: User = Depends(get_current_user)):
    """Get user notifications."""
    notifications = await queries.find_notifications({"user_id": user.user_id}, limit=50)

    return notifications

@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: User = Depends(get_current_user)):
    """Mark notification as read. Only the notification owner can mark it."""
    # Verify notification belongs to current user before updating
    notif = await queries.fetchrow_raw(
        "SELECT notification_id FROM notifications WHERE notification_id = $1 AND user_id = $2",
        notification_id, user.user_id
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    await queries.update_notification(notification_id, {"read": True})
    return {"message": "Marked as read"}

@router.put("/notifications/read-all")
async def mark_all_read(user: User = Depends(get_current_user)):
    """Mark all notifications as read."""
    await queries.mark_all_notifications_read(user.user_id)

    return {"message": "All marked as read"}

@router.get("/notifications/unread-count")
async def get_unread_count(user: User = Depends(get_current_user)):
    """Get count of unread notifications."""
    count = await queries.count_unread_notifications(user.user_id)
    return {"count": count}

@router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, user: User = Depends(get_current_user)):
    """Delete a notification."""
    result_count = await queries.delete_notification(notification_id, user.user_id)
    if result_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}

@router.get("/notifications/preferences")
async def get_notification_preferences(user: User = Depends(get_current_user)):
    """Get notification preferences for the current user."""
    prefs = await queries.get_notification_preferences(user.user_id)
    if not prefs:
        prefs = {
            "user_id": user.user_id,
            "push_enabled": True,
            "game_updates_enabled": True,
            "settlements_enabled": True,
            "group_invites_enabled": True,
        }
    return prefs

@router.put("/notifications/preferences")
async def update_notification_preferences(
    updates: NotificationPreferencesUpdate,
    user: User = Depends(get_current_user)
):
    """Update notification preferences for the current user."""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["user_id"] = user.user_id
    update_data["updated_at"] = datetime.now(timezone.utc)

    await queries.upsert_notification_preferences(user.user_id, update_data)
    return {"status": "updated", "preferences": update_data}
