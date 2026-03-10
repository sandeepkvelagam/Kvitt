"""
Group endpoints: CRUD, invites, members, chat, AI settings, polls, calendar, insights.

Extracted from server.py — pure mechanical move, zero behavior changes.
Duplicate member removal endpoint (simplified version) was consolidated.
"""

import os
import uuid
import logging
import asyncio
import random
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, ConfigDict

from dependencies import User, get_current_user, Notification, AuditLog
from push_service import send_push_notification_to_user, send_push_to_users
from db import queries
from db.pg import get_pool
from websocket_manager import emit_notification, emit_group_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["groups"])


# --- Constants ---

GROUP_NAME_PREFIXES = [
    "High Rollers", "Royal Flush", "Pocket Aces", "All In", "Full House",
    "The Sharks", "Diamond Club", "Lucky 7s", "Card Kings", "Chip Leaders",
    "Bluff Masters", "Texas Holdem", "River Rats", "Flop House", "Ante Up",
]


def generate_default_group_name():
    """Generate a fun default group name."""
    prefix = random.choice(GROUP_NAME_PREFIXES)
    suffix = random.randint(1, 99)
    return f"{prefix} #{suffix}"


# --- Pydantic Models (group-exclusive) ---

class GroupInvite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invite_id: str = Field(default_factory=lambda: f"inv_{uuid.uuid4().hex[:12]}")
    group_id: str
    invited_by: str  # user_id who sent invite
    invited_email: str  # email of person being invited
    invited_user_id: Optional[str] = None  # if user exists
    status: str = "pending"  # pending, accepted, rejected, expired
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    responded_at: Optional[datetime] = None


class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    group_id: str = Field(default_factory=lambda: f"grp_{uuid.uuid4().hex[:12]}")
    name: str
    description: Optional[str] = None
    created_by: str  # user_id
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    default_buy_in: float = 20.0
    default_chip_value: float = 1.0  # Value per chip (e.g., $1 per chip)
    chips_per_buy_in: int = 20  # Number of chips per buy-in
    currency: str = "USD"
    max_players: int = 20


class GroupMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    member_id: str = Field(default_factory=lambda: f"mem_{uuid.uuid4().hex[:12]}")
    group_id: str
    user_id: str
    role: str = "member"  # admin, member
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    nickname: Optional[str] = None


class GroupMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message_id: str = Field(default_factory=lambda: f"gmsg_{uuid.uuid4().hex[:12]}")
    group_id: str
    user_id: str  # sender (or "ai_assistant" for AI messages)
    content: str
    type: str = "user"  # user, system, ai
    reply_to: Optional[str] = None  # message_id for threading
    metadata: Optional[Dict[str, Any]] = None  # poll_id, game_id, etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    edited_at: Optional[datetime] = None
    deleted: bool = False


class GroupAISettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    group_id: str
    ai_enabled: bool = True  # Master switch for AI in this group
    auto_suggest_games: bool = True  # Proactively suggest games
    respond_to_chat: bool = True  # Respond in group chat
    weather_alerts: bool = True  # Mention weather-based game opportunities
    holiday_alerts: bool = True  # Mention holiday-based game opportunities
    smart_scheduling: bool = True  # Detect availability talk, offer time suggestions & polls
    auto_poll_suggestions: bool = True  # When group debates dates, Kvitt recommends a poll
    chat_summaries: bool = True  # Kvitt posts brief recaps after busy threads
    safety_filters: bool = True  # Block offensive content, de-escalate conflicts
    max_messages_per_hour: int = 5  # Rate limit for AI messages
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None  # user_id of admin who changed settings


class PollOption(BaseModel):
    option_id: str = Field(default_factory=lambda: f"opt_{uuid.uuid4().hex[:8]}")
    label: str
    votes: List[str] = []  # list of user_ids


class Poll(BaseModel):
    model_config = ConfigDict(extra="ignore")
    poll_id: str = Field(default_factory=lambda: f"poll_{uuid.uuid4().hex[:12]}")
    group_id: str
    created_by: str  # "ai_assistant" or user_id
    type: str = "availability"  # availability, general
    question: str
    options: List[Dict[str, Any]] = []
    status: str = "active"  # active, closed, resolved
    expires_at: Optional[datetime] = None  # Auto-close time
    winning_option: Optional[str] = None  # option_id that won
    message_id: Optional[str] = None  # Group message containing this poll
    game_id: Optional[str] = None  # Game created from this poll
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    closed_at: Optional[datetime] = None


# --- Request Models ---

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    default_buy_in: float = 20.0  # Must be one of: 5, 10, 20, 50, 100
    chips_per_buy_in: int = 20
    currency: str = "USD"


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_buy_in: Optional[float] = None
    chips_per_buy_in: Optional[int] = None


class GroupMessageCreate(BaseModel):
    content: str
    reply_to: Optional[str] = None  # message_id to reply to


class GroupMessageUpdate(BaseModel):
    content: str


class GroupAISettingsUpdate(BaseModel):
    ai_enabled: Optional[bool] = None
    auto_suggest_games: Optional[bool] = None
    respond_to_chat: Optional[bool] = None
    weather_alerts: Optional[bool] = None
    holiday_alerts: Optional[bool] = None
    smart_scheduling: Optional[bool] = None
    auto_poll_suggestions: Optional[bool] = None
    chat_summaries: Optional[bool] = None
    safety_filters: Optional[bool] = None
    max_messages_per_hour: Optional[int] = None


class PollCreate(BaseModel):
    question: str
    options: List[str]  # list of label strings
    type: str = "availability"
    expires_in_hours: int = 48  # defaults to 48h


class PollVote(BaseModel):
    option_id: str


class InviteMemberRequest(BaseModel):
    email: str


class RespondToInviteRequest(BaseModel):
    accept: bool


# ============== GROUP CRUD ENDPOINTS ==============

@router.post("/groups", response_model=dict)
async def create_group(data: GroupCreate, user: User = Depends(get_current_user)):
    """Create a new group."""
    try:
        # Use default name if not provided or empty
        group_name = data.name.strip() if data.name and data.name.strip() else generate_default_group_name()

        group = Group(
            name=group_name,
            description=data.description,
            created_by=user.user_id,
            default_buy_in=data.default_buy_in,
            currency=data.currency
        )

        group_dict = group.model_dump()
        await queries.insert_group(group_dict)

        # Add creator as admin
        member = GroupMember(
            group_id=group.group_id,
            user_id=user.user_id,
            role="admin"
        )
        member_dict = member.model_dump()
        await queries.insert_group_member(member_dict)

        return {"group_id": group.group_id, "name": group.name}
    except Exception as e:
        trace_id = uuid.uuid4().hex[:10]
        logger.exception(f"[{trace_id}] Failed to create group")
        raise HTTPException(status_code=500, detail=f"Failed to create group. Reference: {trace_id}")


@router.get("/groups/buy-in-options")
async def get_buy_in_options():
    """Get available buy-in denomination options."""
    return {
        "denominations": [5, 10, 20, 50, 100],
        "chip_options": [10, 20, 50, 100]
    }


@router.get("/groups")
async def get_groups(user: User = Depends(get_current_user)):
    """Get all groups user is a member of."""
    memberships = await queries.find_group_members_by_user(user.user_id, limit=100)

    group_ids = [m["group_id"] for m in memberships]
    groups = await queries.find_groups_by_ids(group_ids)

    # Add member count and user's role
    for group in groups:
        count = await queries.count_group_members_for_group(group["group_id"])
        group["member_count"] = count
        membership = next((m for m in memberships if m["group_id"] == group["group_id"]), None)
        group["user_role"] = membership["role"] if membership else None

    return groups


@router.get("/groups/{group_id}")
async def get_group(group_id: str, user: User = Depends(get_current_user)):
    """Get group details."""
    # Verify membership
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    group = await queries.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Get members with user info (batched query)
    members = await queries.find_group_members_by_group(group_id, limit=100)

    # Batch fetch user info for all members
    user_ids = [m["user_id"] for m in members]
    users = await queries.find_users_by_ids(user_ids)
    user_map = {u["user_id"]: u for u in users}

    for member in members:
        member["user"] = user_map.get(member["user_id"])

    group["members"] = members
    group["user_role"] = membership["role"]

    return group


@router.put("/groups/{group_id}")
async def update_group(group_id: str, data: GroupUpdate, user: User = Depends(get_current_user)):
    """Update group (admin only)."""
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership or membership["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await queries.update_group(group_id, update_data)

    return {"message": "Group updated"}


# ============== INVITE ENDPOINTS ==============

@router.post("/groups/{group_id}/invite")
async def invite_member(group_id: str, data: InviteMemberRequest, user: User = Depends(get_current_user)):
    """Invite a user to group by email. Works for both registered and unregistered users."""
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    group = await queries.get_group(group_id)
    inviter = await queries.get_user(user.user_id)

    # Check if user exists
    invited_user = await queries.get_user_by_email(data.email)

    if invited_user:
        # Check if already a member
        existing = await queries.get_group_member(group_id, invited_user["user_id"])
        if existing:
            raise HTTPException(status_code=400, detail="User already a member")

        # Check for pending invite
        pending = await queries.find_pending_invite(group_id, data.email)
        if pending:
            raise HTTPException(status_code=400, detail="Invite already sent")

        # Create invite for existing user
        invite = GroupInvite(
            group_id=group_id,
            invited_by=user.user_id,
            invited_email=data.email,
            invited_user_id=invited_user["user_id"]
        )
        invite_dict = invite.model_dump()
        await queries.insert_group_invite(invite_dict)

        # Side effect: notification (non-fatal)
        try:
            notification = Notification(
                user_id=invited_user["user_id"],
                type="group_invite_request",
                title="Group Invitation",
                message=f"{inviter['name']} invited you to join {group['name']}",
                data={"group_id": group_id, "invite_id": invite.invite_id, "inviter_name": inviter['name']}
            )
            notif_dict = notification.model_dump()
            await queries.insert_notification(notif_dict)
        except Exception as e:
            logger.error(f"invite_member: notification insert failed for group_id={group_id} user_id={invited_user['user_id']}: {e}")

        # Push notification to invited user
        try:
            await send_push_notification_to_user(
                invited_user["user_id"],
                "Group Invitation",
                f"{inviter['name']} invited you to join {group['name']}",
                {"type": "group_invite_request", "group_id": group_id, "invite_id": invite.invite_id}
            )
        except Exception as e:
            logger.error(f"Push notification error on group invite: {e}")

        # Send email notification
        try:
            from email_service import send_group_invite_email
            app_url = os.environ.get('APP_URL', 'https://kvitt.app')
            invite_link = f"{app_url}/dashboard"
            asyncio.create_task(send_group_invite_email(
                data.email,
                inviter['name'],
                group['name'],
                invite_link
            ))
        except Exception as e:
            logger.warning(f"Failed to send invite email: {e}")

        return {"message": "Invite sent! They'll see a notification to accept.", "status": "invite_sent"}
    else:
        # User not registered - create pending invite
        pending = await queries.find_pending_invite(group_id, data.email)
        if pending:
            raise HTTPException(status_code=400, detail="Invite already sent to this email")

        invite = GroupInvite(
            group_id=group_id,
            invited_by=user.user_id,
            invited_email=data.email,
            invited_user_id=None  # Will be set when they register
        )
        invite_dict = invite.model_dump()
        await queries.insert_group_invite(invite_dict)

        # Send email invitation to non-registered user
        try:
            from email_service import send_group_invite_email
            app_url = os.environ.get('APP_URL', 'https://kvitt.app')
            invite_link = f"{app_url}/signup"
            asyncio.create_task(send_group_invite_email(
                data.email,
                inviter['name'],
                group['name'],
                invite_link
            ))
        except Exception as e:
            logger.warning(f"Failed to send invite email: {e}")

        return {
            "message": f"Invite sent to {data.email}. They'll receive an email!",
            "status": "pending_registration",
            "note": "Email sent. Invite will be waiting when they sign up."
        }


@router.get("/groups/{group_id}/invites")
async def get_group_invites(group_id: str, user: User = Depends(get_current_user)):
    """Get pending invites for a group (admin only)."""
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Admin access required")

    invites = await queries.find_group_invites({"group_id": group_id}, limit=100)

    # Add inviter info
    for invite in invites:
        inviter = await queries.get_user(invite["invited_by"])
        invite["inviter_name"] = inviter["name"] if inviter else "Unknown"

    return invites


@router.get("/users/invites")
async def get_my_invites(user: User = Depends(get_current_user)):
    """Get pending group invites for current user."""
    invites = await queries.find_group_invites_for_user(user.user_id, limit=50)

    # Add group and inviter info
    for invite in invites:
        group = await queries.get_group(invite["group_id"])
        inviter = await queries.get_user(invite["invited_by"])
        invite["group"] = group
        invite["inviter"] = inviter

    return invites


@router.post("/users/invites/{invite_id}/respond")
async def respond_to_invite(invite_id: str, data: RespondToInviteRequest, user: User = Depends(get_current_user)):
    """Accept or reject a group invite."""
    invite = await queries.get_group_invite(invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if data.accept:
        # Add user to group
        member = GroupMember(
            group_id=invite["group_id"],
            user_id=user.user_id,
            role="member"
        )
        member_dict = member.model_dump()
        await queries.insert_group_member(member_dict)

        # Update invite status
        await queries.update_group_invite(invite_id, {"status": "accepted", "responded_at": datetime.now(timezone.utc)})

        # Notify inviter
        group = await queries.get_group(invite["group_id"])
        notification = Notification(
            user_id=invite["invited_by"],
            type="invite_accepted",
            title="Invite Accepted",
            message=f"{user.name} joined {group['name']}!",
            data={"group_id": invite["group_id"]}
        )
        notif_dict = notification.model_dump()
        try:
            await queries.insert_notification(notif_dict)
        except Exception as e:
            logger.error(f"Non-critical: notification insert failed for accept_invite: {e}")

        # Push notification to inviter
        try:
            await send_push_notification_to_user(
                invite["invited_by"],
                "Invite Accepted",
                f"{user.name} joined {group['name']}!",
                {"type": "invite_accepted", "group_id": invite["group_id"]}
            )
        except Exception as e:
            logger.error(f"Push notification error on invite accept: {e}")

        return {"message": "Welcome to the group!", "group_id": invite["group_id"]}
    else:
        # Reject invite
        await queries.update_group_invite(invite_id, {"status": "rejected", "responded_at": datetime.now(timezone.utc)})
        return {"message": "Invite declined"}


# ============== MEMBER ENDPOINTS ==============

@router.delete("/groups/{group_id}/members/{member_id}")
async def remove_group_member(group_id: str, member_id: str, user: User = Depends(get_current_user)):
    """Remove a member from group (admin only) or leave group (self). Stats are preserved."""
    group = await queries.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Check if user is admin or removing themselves
    membership = await queries.get_group_member(group_id, user.user_id)

    is_admin = membership and membership.get("role") == "admin"
    is_self = user.user_id == member_id

    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Only admins can remove other members")

    # Check if target member exists
    target_membership = await queries.get_group_member(group_id, member_id)
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found in group")

    # Cannot remove group admin (unless leaving as admin)
    if target_membership.get("role") == "admin" and not is_self:
        raise HTTPException(status_code=403, detail="Cannot remove group admin")

    # Check if member is in active game without cashing out
    active_games = await queries.find_active_games_by_group(group_id)

    for game in active_games:
        player = await queries.get_player_by_game_user(game["game_id"], member_id)
        if player:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove member who is in an active game. They must cash out first."
            )

    # Remove membership (but keep player records for stats)
    await queries.delete_group_member(group_id, member_id)

    # Get member name for notification
    removed_user = await queries.get_user(member_id)
    member_name = removed_user["name"] if removed_user else "Member"

    if is_self:
        return {"message": f"You have left {group['name']}"}
    else:
        # Notify the removed member
        notification = Notification(
            user_id=member_id,
            type="removed_from_group",
            title="Removed from Group",
            message=f"You have been removed from {group['name']} by an admin.",
            data={"group_id": group_id}
        )
        notif_dict = notification.model_dump()
        try:
            await queries.insert_notification(notif_dict)
        except Exception as e:
            logger.error(f"Non-critical: notification insert failed for remove_member: {e}")

        return {"message": f"{member_name} has been removed from the group"}


@router.put("/groups/{group_id}/transfer-admin")
async def transfer_group_admin(group_id: str, data: dict, user: User = Depends(get_current_user)):
    """Transfer group admin role to another member (admin only)."""
    group = await queries.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Validate current user is admin
    current_membership = await queries.get_group_member(group_id, user.user_id)
    if not current_membership or current_membership.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only group admins can transfer ownership")

    # Get target user ID from request
    new_admin_id = data.get("new_admin_id")
    if not new_admin_id:
        raise HTTPException(status_code=400, detail="new_admin_id is required")

    # Cannot transfer to self
    if new_admin_id == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot transfer admin to yourself")

    # Validate target user is a member
    target_membership = await queries.get_group_member(group_id, new_admin_id)
    if not target_membership:
        raise HTTPException(status_code=404, detail="Target user is not a member of this group")

    # Check if target user is in active game (optional check for safety)
    active_games = await queries.find_active_games_by_group(group_id)

    for game in active_games:
        player = await queries.get_player_by_game_user(game["game_id"], new_admin_id)
        if player:
            raise HTTPException(
                status_code=400,
                detail="Cannot transfer admin to a member who is currently in an active game"
            )

    # Update both memberships
    await queries.update_group_member(group_id, user.user_id, {"role": "member"})

    await queries.update_group_member(group_id, new_admin_id, {"role": "admin"}
    )

    # Create audit log
    audit = AuditLog(
        entity_type="group",
        entity_id=group_id,
        action="transfer_admin",
        old_value={"admin_id": user.user_id},
        new_value={"admin_id": new_admin_id},
        changed_by=user.user_id,
        reason=f"Admin role transferred to {new_admin_id}"
    )
    audit_dict = audit.model_dump()
    await queries.insert_audit_log(audit_dict)

    # Send notification to new admin
    new_admin_user = await queries.get_user(new_admin_id)
    notification = Notification(
        user_id=new_admin_id,
        type="admin_transferred",
        title="You're now a group admin!",
        message=f"You've been promoted to admin of {group['name']}",
        data={"group_id": group_id}
    )
    notif_dict = notification.model_dump()
    try:
        await queries.insert_notification(notif_dict)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for transfer_admin: {e}")

    # Emit real-time notification
    await emit_notification(new_admin_id, {
        "type": "admin_transferred",
        "title": "You're now a group admin!",
        "message": f"You've been promoted to admin of {group['name']}",
        "group_id": group_id
    })

    logger.info(f"Admin transferred from {user.user_id} to {new_admin_id} in group {group_id}")

    return {
        "message": "Admin role transferred successfully",
        "new_admin_name": new_admin_user.get("name", "Unknown") if new_admin_user else "Unknown"
    }


# ============== CHAT MESSAGE ENDPOINTS ==============

@router.get("/groups/{group_id}/messages")
async def get_group_messages(
    group_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    before: Optional[str] = Query(default=None, description="Cursor: message_id to fetch messages before"),
    user: User = Depends(get_current_user)
):
    """Get group chat messages (paginated, cursor-based)."""
    # Verify membership
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Cursor-based pagination
    before_time = None
    if before:
        cursor_msg = await queries.get_group_message(before)
        if cursor_msg:
            before_time = cursor_msg["created_at"]

    messages = await queries.find_group_messages_paginated(
        group_id, before_time=before_time, limit=limit, exclude_deleted=True
    )

    # Reverse to chronological order
    messages.reverse()

    # Batch-fetch user info for all unique user_ids
    user_ids = list(set(m["user_id"] for m in messages if m["user_id"] != "ai_assistant"))
    users_info = {}
    if user_ids:
        users_list = await queries.find_users_by_ids(user_ids)
        users_info = {u["user_id"]: u for u in users_list}

    # Attach user info
    for msg in messages:
        if msg["user_id"] == "ai_assistant":
            msg["user"] = {"user_id": "ai_assistant", "name": "Kvitt", "picture": None}
        else:
            msg["user"] = users_info.get(msg["user_id"])

    return messages


@router.post("/groups/{group_id}/messages")
async def post_group_message(
    group_id: str,
    data: GroupMessageCreate,
    user: User = Depends(get_current_user)
):
    """Post a message to group chat."""
    # Verify membership
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Validate reply_to if provided
    if data.reply_to:
        reply_msg = await queries.get_group_message(data.reply_to)
        if not reply_msg:
            raise HTTPException(status_code=400, detail="Reply target message not found")

    message = GroupMessage(
        group_id=group_id,
        user_id=user.user_id,
        content=data.content,
        type="user",
        reply_to=data.reply_to
    )
    msg_dict = message.model_dump()
    await queries.insert_group_message(msg_dict)
    msg_dict.pop("_id", None)

    # Get sender info for WebSocket broadcast
    user_info = await queries.get_user(user.user_id)

    # Broadcast via WebSocket to group room
    await emit_group_message(group_id, {
        **msg_dict,
        "user": user_info
    })

    # Fire-and-forget: trigger AI processing for group chat
    asyncio.create_task(_trigger_group_chat_ai(group_id, msg_dict))

    # Fire-and-forget: push notification to offline group members
    asyncio.create_task(_send_group_message_push(
        group_id, user.user_id,
        user_info.get("name", "Someone") if user_info else "Someone",
        data.content
    ))

    return {"message_id": message.message_id}


async def _trigger_group_chat_ai(group_id: str, message: dict):
    """Fire-and-forget task to process group message through AI pipeline."""
    try:
        from ai_service.event_listener import get_event_listener
        listener = get_event_listener()
        await listener.emit("group_message", {
            "group_id": group_id,
            "message": message
        })
    except Exception as e:
        logger.debug(f"Group chat AI trigger error (non-critical): {e}")


async def _send_group_message_push(group_id: str, sender_id: str, sender_name: str, content: str):
    """Fire-and-forget: send push notifications to group members for a new message."""
    try:
        group = await queries.get_group(group_id)
        group_name = group["name"] if group else "Group Chat"
        members = await queries.find_group_members_by_group(group_id, limit=100)
        recipient_ids = [m["user_id"] for m in members if m["user_id"] != sender_id]
        if not recipient_ids:
            return
        truncated = content[:100] + ("..." if len(content) > 100 else "")
        await send_push_to_users(
            recipient_ids, group_name, f"{sender_name}: {truncated}",
            {"type": "group_message", "group_id": group_id}
        )
    except Exception as e:
        logger.debug(f"Group message push error (non-critical): {e}")


@router.put("/groups/{group_id}/messages/{message_id}")
async def edit_group_message(
    group_id: str,
    message_id: str,
    data: GroupMessageUpdate,
    user: User = Depends(get_current_user)
):
    """Edit a group chat message (only your own)."""
    msg = await queries.get_group_message(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Can only edit your own messages")
    if msg.get("deleted"):
        raise HTTPException(status_code=400, detail="Message is deleted")

    edited_at = datetime.now(timezone.utc)
    await queries.update_group_message(message_id, {"content": data.content, "edited_at": edited_at})

    # Broadcast edit via WebSocket
    await emit_group_message(group_id, {
        "type": "message_edited",
        "message_id": message_id,
        "content": data.content,
        "edited_at": edited_at
    })

    return {"status": "updated"}


@router.delete("/groups/{group_id}/messages/{message_id}")
async def delete_group_message(
    group_id: str,
    message_id: str,
    user: User = Depends(get_current_user)
):
    """Soft-delete a group chat message (own messages or admin)."""
    msg = await queries.get_group_message(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Allow delete if: own message OR group admin
    if msg["user_id"] != user.user_id:
        membership = await queries.get_group_member(group_id, user.user_id)
        if not membership or membership.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Can only delete your own messages")

    await queries.update_group_message(message_id, {"deleted": True})

    # Broadcast delete via WebSocket
    await emit_group_message(group_id, {
        "type": "message_deleted",
        "message_id": message_id
    })

    return {"status": "deleted"}


# ============== GROUP AI SETTINGS ENDPOINTS ==============

@router.get("/groups/{group_id}/ai-settings")
async def get_group_ai_settings(group_id: str, user: User = Depends(get_current_user)):
    """Get AI settings for a group."""
    # Verify membership
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    settings = await queries.generic_find_one("group_ai_settings", {"group_id": group_id})

    if not settings:
        # Return defaults
        defaults = GroupAISettings(group_id=group_id)
        return defaults.model_dump()

    return settings


@router.put("/groups/{group_id}/ai-settings")
async def update_group_ai_settings(
    group_id: str,
    data: GroupAISettingsUpdate,
    user: User = Depends(get_current_user)
):
    """Update AI settings for a group (admin only)."""
    # Verify admin role
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    if membership.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update AI settings")

    # Build update dict from non-None fields
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    updates["updated_by"] = user.user_id

    # Upsert the settings
    await queries.upsert_group_ai_settings(group_id, updates)

    return {"status": "updated", "settings": updates}


# ============== AI FEATURES ENDPOINTS ==============

@router.get("/groups/{group_id}/suggest-times")
async def suggest_game_times(
    group_id: str,
    num: int = Query(default=3, ge=1, le=10),
    user: User = Depends(get_current_user)
):
    """Get AI-powered game time suggestions for a group."""
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    try:
        from ai_service.smart_scheduler import SmartSchedulerService
        from ai_service.context_provider import ContextProvider

        ctx_provider = ContextProvider()
        external_context = await ctx_provider.get_context(group_id=group_id)

        scheduler = SmartSchedulerService(context_provider=ctx_provider)
        suggestions = await scheduler.suggest_times(
            group_id=group_id,
            num_suggestions=num,
            external_context=external_context
        )
        return {"suggestions": suggestions, "external_context_summary": {
            "holidays": len(external_context.get("upcoming_holidays", [])),
            "bad_weather_days": len(external_context.get("weather_forecast", {}).get("bad_weather_days", [])),
            "long_weekends": len(external_context.get("long_weekends", [])),
        }}
    except Exception as e:
        logger.error(f"Suggest times error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate suggestions")


# ============== HOST UPDATE ENDPOINTS ==============

@router.get("/groups/{group_id}/host-updates")
async def get_host_updates(
    group_id: str,
    limit: int = Query(default=20, ge=1, le=50),
    unread_only: bool = Query(default=False),
    user: User = Depends(get_current_user)
):
    """Get host update feed for a group (admin only)."""
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership or membership.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view host updates")

    from ai_service.host_update_service import HostUpdateService
    service = HostUpdateService()
    updates = await service.get_host_updates(
        group_id=group_id, host_id=user.user_id,
        limit=limit, unread_only=unread_only
    )
    return updates


@router.post("/groups/{group_id}/host-updates/mark-read")
async def mark_host_updates_read(
    group_id: str,
    user: User = Depends(get_current_user)
):
    """Mark all host updates as read for a group."""
    from ai_service.host_update_service import HostUpdateService
    service = HostUpdateService()
    await service.mark_all_read(group_id=group_id, host_id=user.user_id)
    return {"status": "all_read"}


@router.post("/groups/{group_id}/host-updates/{update_id}/mark-read")
async def mark_single_host_update_read(
    group_id: str,
    update_id: str,
    user: User = Depends(get_current_user)
):
    """Mark a single host update as read."""
    from ai_service.host_update_service import HostUpdateService
    service = HostUpdateService()
    await service.mark_read(update_id=update_id, host_id=user.user_id)
    return {"status": "read"}


# ============== POLL ENDPOINTS ==============

@router.post("/groups/{group_id}/polls")
async def create_poll(group_id: str, data: PollCreate, user: User = Depends(get_current_user)):
    """Create an availability poll in a group."""
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    if len(data.options) < 2:
        raise HTTPException(status_code=400, detail="At least 2 options required")

    # Build poll options
    options = []
    for label in data.options:
        options.append({
            "option_id": f"opt_{uuid.uuid4().hex[:8]}",
            "label": label,
            "votes": []
        })

    poll = Poll(
        group_id=group_id,
        created_by=user.user_id,
        type=data.type,
        question=data.question,
        options=options,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=data.expires_in_hours)
    )
    poll_dict = poll.model_dump()
    await queries.insert_poll(poll_dict)

    # Post the poll as a group message
    poll_msg = GroupMessage(
        group_id=group_id,
        user_id=user.user_id,
        content=f"📊 **Poll:** {data.question}\n" + "\n".join(
            f"  {i+1}. {opt}" for i, opt in enumerate(data.options)
        ),
        type="system",
        metadata={"poll_id": poll.poll_id}
    )
    msg_dict = poll_msg.model_dump()
    await queries.insert_group_message(msg_dict)

    # Update poll with message_id
    await queries.update_poll(poll.poll_id, {"message_id": poll_msg.message_id})

    # Broadcast poll via WebSocket
    user_info = await queries.get_user(user.user_id)
    await emit_group_message(group_id, {
        **msg_dict,
        "user": user_info,
        "poll": poll_dict
    })

    return {"poll_id": poll.poll_id, "message_id": poll_msg.message_id}


@router.get("/groups/{group_id}/polls")
async def get_group_polls(
    group_id: str,
    status: Optional[str] = Query(default=None, description="Filter by status: active, closed, resolved"),
    user: User = Depends(get_current_user)
):
    """Get polls for a group."""
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    polls = await queries.find_polls_by_group(group_id, limit=20)
    return polls


@router.get("/groups/{group_id}/polls/{poll_id}")
async def get_poll(group_id: str, poll_id: str, user: User = Depends(get_current_user)):
    """Get a specific poll with vote details."""
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    poll = await queries.get_poll(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    # Enrich with voter names
    all_voter_ids = set()
    for opt in poll.get("options", []):
        all_voter_ids.update(opt.get("votes", []))
    if all_voter_ids:
        voters = await queries.find_users_by_ids(list(all_voter_ids))
        voter_map = {v["user_id"]: v for v in voters}
        for opt in poll["options"]:
            opt["voter_details"] = [voter_map.get(uid, {"user_id": uid}) for uid in opt.get("votes", [])]

    # Get group member count for completion tracking
    member_count = await queries.count_group_members_for_group(group_id)
    total_votes = sum(len(opt.get("votes", [])) for opt in poll.get("options", []))
    poll["member_count"] = member_count
    poll["total_votes"] = total_votes
    poll["completion_pct"] = round((total_votes / member_count) * 100) if member_count > 0 else 0

    return poll


@router.post("/groups/{group_id}/polls/{poll_id}/vote")
async def vote_on_poll(
    group_id: str,
    poll_id: str,
    data: PollVote,
    user: User = Depends(get_current_user)
):
    """Vote on a poll option (or change vote)."""
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    poll = await queries.get_poll(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if poll["status"] != "active":
        raise HTTPException(status_code=400, detail="Poll is no longer active")

    # Check expiry
    if poll.get("expires_at"):
        expires = poll["expires_at"]
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires:
            await queries.update_poll(poll_id, {"status": "closed", "closed_at": datetime.now(timezone.utc)})
            raise HTTPException(status_code=400, detail="Poll has expired")

    # Validate option exists
    option_ids = [opt["option_id"] for opt in poll.get("options", [])]
    if data.option_id not in option_ids:
        raise HTTPException(status_code=400, detail="Invalid option")

    # Remove user's previous votes (single-choice)
    await queries.poll_remove_user_vote(poll_id, user.user_id)

    # Add new vote
    await queries.poll_add_user_vote(poll_id, data.option_id, user.user_id)

    # Fetch updated poll
    updated_poll = await queries.get_poll(poll_id)

    # Broadcast vote update via WebSocket
    user_info = await queries.get_user(user.user_id)
    await emit_group_message(group_id, {
        "type": "poll_vote",
        "poll_id": poll_id,
        "voter": user_info,
        "option_id": data.option_id,
        "poll": updated_poll
    })

    # Check if majority voted → auto-resolve
    member_count = await queries.count_group_members_for_group(group_id)
    total_votes = sum(len(opt.get("votes", [])) for opt in updated_poll.get("options", []))
    if total_votes >= member_count:
        await _auto_resolve_poll(group_id, poll_id)

    return {"status": "voted", "option_id": data.option_id}


@router.post("/groups/{group_id}/polls/{poll_id}/close")
async def close_poll(group_id: str, poll_id: str, user: User = Depends(get_current_user)):
    """Close a poll and determine the winner (creator or admin only)."""
    poll = await queries.get_poll(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if poll["status"] != "active":
        raise HTTPException(status_code=400, detail="Poll is already closed")

    # Only creator or admin can close
    if poll["created_by"] != user.user_id:
        membership = await queries.get_group_member(group_id, user.user_id)
        if not membership or membership.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only poll creator or admin can close")

    result = await _resolve_poll(group_id, poll_id)
    return result


async def _auto_resolve_poll(group_id: str, poll_id: str):
    """Auto-resolve a poll when all members have voted."""
    await _resolve_poll(group_id, poll_id)


async def _resolve_poll(group_id: str, poll_id: str) -> Dict:
    """Resolve a poll: find winner, close it, and announce."""
    poll = await queries.get_poll(poll_id)
    if not poll:
        return {"error": "Poll not found"}

    # Find winning option (most votes)
    options = poll.get("options", [])
    if not options:
        return {"error": "No options"}

    winner = max(options, key=lambda o: len(o.get("votes", [])))
    winning_id = winner["option_id"]
    winning_label = winner["label"]
    vote_count = len(winner.get("votes", []))

    now = datetime.now(timezone.utc)
    await queries.update_poll(poll_id, {
            "status": "resolved",
            "winning_option": winning_id,
            "closed_at": now
        })

    # Post resolution message in group chat
    resolution_msg = GroupMessage(
        group_id=group_id,
        user_id="ai_assistant",
        content=f"Poll closed! **{winning_label}** wins with {vote_count} vote(s). Let's make it happen!",
        type="ai",
        metadata={"poll_id": poll_id, "winning_option": winning_id}
    )
    msg_dict = resolution_msg.model_dump()
    await queries.insert_group_message(msg_dict)

    await emit_group_message(group_id, {
        **msg_dict,
        "user": {"user_id": "ai_assistant", "name": "Kvitt", "picture": None},
        "poll_result": {"winning_option": winning_id, "winning_label": winning_label, "votes": vote_count}
    })

    return {
        "status": "resolved",
        "winning_option": winning_id,
        "winning_label": winning_label,
        "votes": vote_count
    }


# ============== CALENDAR ENDPOINT ==============

@router.get("/groups/{group_id}/calendar")
async def get_group_calendar(
    group_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get calendar data for a group (all occurrences in date range)."""
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    # Default: next 4 weeks
    now = datetime.now(timezone.utc)
    start = datetime.fromisoformat(from_date) if from_date else now
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(to_date) if to_date else (now + timedelta(weeks=4))
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT eo.*, se.title, se.game_category, se.group_id, se.host_id,
                   ei.status as my_rsvp
            FROM event_occurrences eo
            JOIN scheduled_events se ON eo.event_id = se.event_id
            LEFT JOIN event_invites ei ON eo.occurrence_id = ei.occurrence_id AND ei.user_id = $1
            WHERE se.group_id = $2 AND se.status = 'published'
              AND eo.starts_at >= $3 AND eo.starts_at <= $4
              AND eo.status != 'cancelled'
            ORDER BY eo.starts_at ASC
            """,
            user.user_id, group_id, start, end,
        )

    occurrences = []
    for row in rows:
        occurrences.append({
            "occurrence_id": row["occurrence_id"],
            "event_id": row["event_id"],
            "title": row["title"],
            "starts_at": row["starts_at"].isoformat() if row["starts_at"] else None,
            "duration_minutes": row["duration_minutes"],
            "location": row["location"],
            "game_category": str(row["game_category"]) if row["game_category"] else "poker",
            "status": row["status"],
            "is_override": row["is_override"],
            "my_rsvp": str(row["my_rsvp"]) if row["my_rsvp"] else None,
            "group_id": row["group_id"],
            "host_id": row["host_id"],
        })

    return {
        "occurrences": occurrences,
        "total": len(occurrences),
        "from": start.isoformat(),
        "to": end.isoformat(),
    }


# ============== INSIGHTS ENDPOINTS ==============

@router.get("/groups/{group_id}/smart-defaults")
async def get_smart_defaults(group_id: str, user: User = Depends(get_current_user)):
    """Get smart defaults based on group history (data-driven, no AI)."""
    # Verify membership
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a group member")

    # Get group's game history
    games = await queries.find_game_nights({"group_id": group_id}, limit=50)
    games = [g for g in games if g.get("status") in ("ended", "settled")]

    if not games:
        # Return app defaults if no history
        return {
            "buy_in_amount": 20,
            "chips_per_buy_in": 20,
            "reason": "default",
            "games_analyzed": 0
        }

    # Calculate median (most common) values
    buy_ins = sorted([g.get("buy_in_amount", 20) for g in games])
    chips = sorted([g.get("chips_per_buy_in", 20) for g in games])

    median_buy_in = buy_ins[len(buy_ins) // 2]
    median_chips = chips[len(chips) // 2]

    return {
        "buy_in_amount": median_buy_in,
        "chips_per_buy_in": median_chips,
        "reason": "based_on_history",
        "games_analyzed": len(games)
    }


@router.get("/groups/{group_id}/frequent-players")
async def get_frequent_players(group_id: str, user: User = Depends(get_current_user)):
    """Get frequently invited players for quick game setup."""
    # Verify membership
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a group member")

    # Get all games in this group
    games = await queries.find_game_nights({"group_id": group_id}, limit=100)

    if not games:
        return {"players": [], "games_analyzed": 0}

    game_ids = [g["game_id"] for g in games]

    player_stats = await queries.get_frequent_players_by_games(game_ids, limit=10)

    # Add user info
    for p in player_stats:
        user_info = await queries.get_user(p["user_id"])
        p["user"] = user_info

    return {
        "players": player_stats,
        "games_analyzed": len(games)
    }
