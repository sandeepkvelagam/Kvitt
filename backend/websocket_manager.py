"""
WebSocket Manager for Real-Time Game Updates
Uses Socket.IO for bidirectional communication
"""

import socketio
import logging
import json
import jwt
import os
from datetime import datetime, timezone, date
from typing import Optional
from jwt import PyJWKClient


class _DateTimeEncoder(json.JSONEncoder):
    """JSON encoder that handles datetime objects for Socket.IO serialization."""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, date):
            return obj.isoformat()
        return super().default(obj)


def _sio_json_dumps(data, **kwargs):
    """Custom JSON serializer for Socket.IO that handles datetime objects."""
    return json.dumps(data, cls=_DateTimeEncoder)


# Module-level json shim so socketio uses our datetime-aware serializer
_sio_json = type('_sio_json', (), {
    'dumps': staticmethod(_sio_json_dumps),
    'loads': staticmethod(json.loads),
})

logger = logging.getLogger(__name__)

# Get Supabase configuration from environment
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')

# JWKS client factory for clean refresh
def make_jwks_client():
    """Create JWKS client with 12-hour cache"""
    jwks_url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=43200)

# Initialize JWKS client for JWT verification (Supabase signing keys)
jwks_client = None
if SUPABASE_URL:
    try:
        jwks_client = make_jwks_client()
        logger.info(f"✅ JWKS client initialized (TTL: 12h)")
    except Exception as e:
        logger.warning(f"Failed to initialize JWKS client: {e}")

# Create Socket.IO server with CORS and datetime-aware JSON serializer
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False,
    json=_sio_json
)

# Track connected users: {user_id: set(sid)}
connected_users: dict[str, set[str]] = {}

# Track game rooms: {game_id: set(user_id)}
game_rooms: dict[str, set[str]] = {}

# Track group rooms: {group_id: set(user_id)}
group_rooms: dict[str, set[str]] = {}

# Track sid to user_id mapping
sid_to_user: dict[str, str] = {}


async def verify_supabase_jwt(token: str) -> Optional[dict]:
    """
    Verify Supabase JWT using either:
    1. JWKS method (ES256/RS256) - auto-fetches public keys with retry on unknown kid
    2. Legacy secret method (HS256) - uses shared secret
    """
    global jwks_client

    # Try JWKS method first (ES256 or RS256)
    if jwks_client:
        for attempt in range(2):
            try:
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["ES256", "RS256"],
                    audience="authenticated"
                )
                logger.debug("JWT verified using JWKS")
                return payload
            except jwt.exceptions.PyJWKClientError as e:
                # Unknown kid - recreate client (clean refresh) and retry once
                if attempt == 0 and "Unable to find" in str(e):
                    logger.warning(f"Unknown kid, refreshing JWKS client (attempt {attempt + 1}/2)")
                    try:
                        jwks_client = make_jwks_client()
                        continue
                    except Exception as refresh_err:
                        logger.error(f"Failed to refresh JWKS client: {refresh_err}")
                        break
                logger.debug(f"JWKS verification failed: {e}")
                break
            except Exception as e:
                logger.debug(f"JWKS verification failed: {e}")
                break

    # Fallback to legacy secret method (HS256)
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
            logger.debug("JWT verified using legacy secret (HS256)")
            return payload
        except Exception as e:
            logger.debug(f"Legacy secret verification failed: {e}")

    return None


@sio.event
async def connect(sid, environ, auth):
    """Handle new connection with JWT or session token verification"""
    token = (auth or {}).get('token')

    if not token:
        logger.warning(f"Connection rejected - no token (sid: {sid})")
        return False

    user_id = None

    # Method 1: Try JWT verification (JWKS or HS256)
    if jwks_client or SUPABASE_JWT_SECRET:
        try:
            payload = await verify_supabase_jwt(token)
            if payload:
                supabase_id = payload.get("sub")
                if supabase_id:
                    from db import queries
                    user_doc = await queries.get_user_by_supabase_id(supabase_id)
                    if user_doc:
                        user_id = user_doc.get("user_id")
        except Exception:
            pass

    # Method 2: Fallback to session token lookup in DB
    if not user_id:
        try:
            from db import queries
            session_doc = await queries.get_user_session(token)
            if session_doc:
                expires_at = session_doc.get("expires_at")
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at)
                if expires_at and expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at and expires_at >= datetime.now(timezone.utc):
                    user_id = session_doc.get("user_id")
        except Exception as e:
            logger.error(f"Session token lookup error (sid: {sid}): {e}")

    # Method 3: Decode JWT WITHOUT signature verification (demo/sandbox fallback)
    # When JWKS endpoint is unavailable (401) and no HS256 secret is configured,
    # decode the token to extract the sub claim and look up user by supabase_id.
    if not user_id:
        try:
            payload = jwt.decode(
                token,
                options={"verify_signature": False},
                algorithms=["RS256", "HS256"]
            )
            supabase_id = payload.get("sub")
            if supabase_id:
                from db import queries
                user_doc = await queries.get_user_by_supabase_id(supabase_id)
                if user_doc:
                    user_id = user_doc.get("user_id")
                    logger.info(f"Auth via JWT decode fallback for supabase_id {supabase_id[:8]}...")
        except Exception as e:
            logger.error(f"JWT decode fallback error (sid: {sid}): {e}")

    if not user_id:
        logger.warning(f"Connection rejected - auth failed (sid: {sid})")
        return False

    # Track connection
    if user_id not in connected_users:
        connected_users[user_id] = set()
    connected_users[user_id].add(sid)
    sid_to_user[sid] = user_id

    await sio.save_session(sid, {'user_id': user_id})
    logger.info(f"✅ User {user_id[:8]}... connected (sid: {sid})")
    return True


@sio.event
async def disconnect(sid):
    """Handle disconnection"""
    # Get user_id from sid mapping
    user_id = sid_to_user.get(sid)

    if user_id:
        # Clean up connected_users tracking
        if user_id in connected_users:
            connected_users[user_id].discard(sid)
            if not connected_users[user_id]:
                del connected_users[user_id]

        # Leave all game rooms
        for game_id, users in list(game_rooms.items()):
            if user_id in users:
                users.discard(user_id)
                await sio.leave_room(sid, f"game_{game_id}")
                if not users:
                    del game_rooms[game_id]

        # Leave all group rooms
        for group_id, users in list(group_rooms.items()):
            if user_id in users:
                users.discard(user_id)
                await sio.leave_room(sid, f"group_{group_id}")
                if not users:
                    del group_rooms[group_id]

        # Clean up sid mapping
        del sid_to_user[sid]

        logger.info(f"User {user_id} disconnected (sid: {sid})")
    else:
        logger.info(f"Disconnected (sid: {sid})")


@sio.event
async def join_game(sid, data):
    """User joins a game room for real-time updates"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    game_id = data.get('game_id')

    if not user_id or not game_id:
        logger.warning(f"join_game rejected - missing user_id or game_id (sid: {sid})")
        return {'error': 'Missing user_id or game_id'}

    # AUTHORIZATION: Verify user has access to this game
    try:
        from db import queries

        # Check if user is in the game's group or is a player in the game
        game = await queries.get_game_night(game_id)
        if not game:
            logger.warning(f"join_game rejected - game {game_id} not found (user: {user_id})")
            return {'error': 'Game not found'}

        group_id = game.get('group_id')
        if not group_id:
            logger.warning(f"join_game rejected - game {game_id} has no group_id")
            return {'error': 'Invalid game'}

        # Check if user is a member of the group
        membership = await queries.get_group_member(group_id, user_id)

        if not membership or membership.get('status') != 'active':
            # Also check if user is a player in this specific game (invited)
            player = await queries.get_player_by_game_user(game_id, user_id)

            if not player:
                logger.warning(f"join_game rejected - user {user_id} not authorized for game {game_id}")
                return {'error': 'Not authorized to join this game'}

        # Authorization passed - join room
        room = f"game_{game_id}"
        await sio.enter_room(sid, room)

        if game_id not in game_rooms:
            game_rooms[game_id] = set()
        game_rooms[game_id].add(user_id)

        logger.info(f"✅ User {user_id} joined game room {game_id}")
        return {'status': 'joined', 'room': room}

    except Exception as e:
        logger.error(f"join_game error for user {user_id}, game {game_id}: {e}")
        return {'error': 'Authorization check failed'}


@sio.event
async def leave_game(sid, data):
    """User leaves a game room"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    game_id = data.get('game_id')
    
    if game_id:
        room = f"game_{game_id}"
        await sio.leave_room(sid, room)
        
        if game_id in game_rooms and user_id:
            game_rooms[game_id].discard(user_id)
            if not game_rooms[game_id]:
                del game_rooms[game_id]
    
    return {'status': 'left'}


@sio.event
async def join_group(sid, data):
    """User joins a group's chat room for real-time messages"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    group_id = data.get('group_id')

    if not user_id or not group_id:
        logger.warning(f"join_group rejected - missing user_id or group_id (sid: {sid})")
        return {'error': 'Missing user_id or group_id'}

    # Verify user is a member of the group
    try:
        from db import queries

        membership = await queries.get_group_member(group_id, user_id)

        if not membership or membership.get('status') != 'active':
            logger.warning(f"join_group rejected - user {user_id} not member of group {group_id}")
            return {'error': 'Not a member of this group'}

        # Join the group room
        room = f"group_{group_id}"
        await sio.enter_room(sid, room)

        if group_id not in group_rooms:
            group_rooms[group_id] = set()
        group_rooms[group_id].add(user_id)

        logger.info(f"User {user_id[:8]}... joined group room {group_id}")
        return {'status': 'joined', 'room': room}

    except Exception as e:
        logger.error(f"join_group error for user {user_id}, group {group_id}: {e}")
        return {'error': 'Authorization check failed'}


@sio.event
async def leave_group(sid, data):
    """User leaves a group's chat room"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    group_id = data.get('group_id')

    if group_id:
        room = f"group_{group_id}"
        await sio.leave_room(sid, room)

        if group_id in group_rooms and user_id:
            group_rooms[group_id].discard(user_id)
            if not group_rooms[group_id]:
                del group_rooms[group_id]

    return {'status': 'left'}


@sio.event
async def group_typing(sid, data):
    """Broadcast typing indicator to group room"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    group_id = data.get('group_id')
    user_name = data.get('user_name', 'Someone')

    if user_id and group_id:
        await sio.emit('group_typing', {
            'group_id': group_id,
            'user_id': user_id,
            'user_name': user_name
        }, room=f"group_{group_id}", skip_sid=sid)


# ============== EVENT EMITTERS ==============

async def emit_game_event(game_id: str, event_type: str, data: dict, exclude_user: Optional[str] = None):
    """
    Emit a game event to all users in the game room
    
    Event types:
    - player_joined: New player joined
    - player_left: Player left
    - buy_in: Player bought in
    - rebuy: Player rebought
    - cash_out: Player cashed out
    - chips_edited: Host edited chips
    - game_started: Game started
    - game_ended: Game ended
    - message: New chat message
    """
    room = f"game_{game_id}"
    
    event_data = {
        'type': event_type,
        'game_id': game_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **data
    }
    
    await sio.emit('game_update', event_data, room=room)
    logger.info(f"Emitted {event_type} to game {game_id}")


async def emit_to_user(user_id: str, event_type: str, data: dict):
    """Emit event to a specific user (all their connections)"""
    if user_id in connected_users:
        event_data = {
            'type': event_type,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            **data
        }
        
        for sid in connected_users[user_id]:
            await sio.emit('notification', event_data, to=sid)
        
        logger.info(f"Emitted {event_type} to user {user_id}")


async def emit_notification(user_id: str, notification: dict):
    """Emit a notification to a user"""
    await emit_to_user(user_id, 'new_notification', notification)


# ============== GAME EVENT HELPERS ==============

async def notify_player_joined(game_id: str, player_name: str, user_id: str, buy_in: float, chips: int):
    """Notify all players that someone joined"""
    await emit_game_event(game_id, 'player_joined', {
        'player_name': player_name,
        'user_id': user_id,
        'buy_in': buy_in,
        'chips': chips
    })


async def notify_buy_in(game_id: str, player_name: str, user_id: str, amount: float, chips: int, total_buy_in: float):
    """Notify all players of a buy-in"""
    await emit_game_event(game_id, 'buy_in', {
        'player_name': player_name,
        'user_id': user_id,
        'amount': amount,
        'chips': chips,
        'total_buy_in': total_buy_in
    })


async def notify_cash_out(game_id: str, player_name: str, user_id: str, chips_returned: int, cash_out: float, net_result: float):
    """Notify all players of a cash-out"""
    await emit_game_event(game_id, 'cash_out', {
        'player_name': player_name,
        'user_id': user_id,
        'chips_returned': chips_returned,
        'cash_out': cash_out,
        'net_result': net_result
    })


async def notify_chips_edited(game_id: str, player_name: str, user_id: str, old_chips: int, new_chips: int, reason: str):
    """Notify all players that chips were edited"""
    await emit_game_event(game_id, 'chips_edited', {
        'player_name': player_name,
        'user_id': user_id,
        'old_chips': old_chips,
        'new_chips': new_chips,
        'reason': reason
    })


async def notify_game_message(game_id: str, sender_name: str, message: str, message_type: str = 'chat'):
    """Notify all players of a new message"""
    await emit_game_event(game_id, 'message', {
        'sender_name': sender_name,
        'content': message,
        'message_type': message_type
    })


async def notify_game_state_change(game_id: str, new_status: str, message: str = None):
    """Notify all players of game state change"""
    await emit_game_event(game_id, 'game_state', {
        'status': new_status,
        'message': message
    })


async def broadcast_thread_message(game_id: str, msg_dict: dict):
    """
    Push a full game_threads row to clients in the game room (game thread UI).
    Used after insert so Chats / game screens show live timeline + chat without polling.
    """
    try:
        from db import queries as _queries
        row = dict(msg_dict)
        ca = row.get("created_at")
        if ca is not None and hasattr(ca, "isoformat"):
            row["created_at"] = ca.isoformat()
        uid = row.get("user_id")
        if uid == "ai_assistant":
            row["user"] = {"user_id": "ai_assistant", "name": "Kvitt", "picture": None}
        else:
            u = await _queries.get_user(uid) if uid else None
            row["user"] = u
        await emit_game_event(game_id, "thread_message", {"message": row})
    except Exception as e:
        logger.error(f"broadcast_thread_message failed for game {game_id}: {e}")


# ============== GROUP CHAT EMITTERS ==============

async def emit_group_message(group_id: str, message_data: dict):
    """Broadcast a message to all group members in the room"""
    event_data = {
        'group_id': group_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **message_data
    }
    await sio.emit('group_message', event_data, room=f"group_{group_id}")
    logger.info(f"Emitted group_message to group {group_id}")


async def emit_group_typing(group_id: str, user_id: str, user_name: str):
    """Broadcast typing indicator to group room"""
    await sio.emit('group_typing', {
        'group_id': group_id,
        'user_id': user_id,
        'user_name': user_name
    }, room=f"group_{group_id}")


# ============== GAME SCHEDULER EVENT EMITTERS ==============

# Track event rooms: {event_id: set(user_id)}
event_rooms: dict[str, set[str]] = {}


@sio.event
async def join_event(sid, data):
    """User joins an event room for real-time RSVP updates"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    occurrence_id = data.get('occurrence_id')

    if not user_id or not occurrence_id:
        return {'error': 'Missing user_id or occurrence_id'}

    try:
        from db import queries

        # Get occurrence and verify group membership
        occurrence = await queries.generic_find_one("event_occurrences", {'occurrence_id': occurrence_id})
        if not occurrence:
            return {'error': 'Occurrence not found'}

        event = await queries.generic_find_one("scheduled_events", {'event_id': occurrence['event_id']})
        if not event:
            return {'error': 'Event not found'}

        membership = await queries.get_group_member(event['group_id'], user_id)
        if not membership or membership.get('status') != 'active':
            return {'error': 'Not authorized'}

        room = f"event_{occurrence_id}"
        await sio.enter_room(sid, room)

        if occurrence_id not in event_rooms:
            event_rooms[occurrence_id] = set()
        event_rooms[occurrence_id].add(user_id)

        logger.info(f"User {user_id[:8]}... joined event room {occurrence_id}")
        return {'status': 'joined', 'room': room}

    except Exception as e:
        logger.error(f"join_event error: {e}")
        return {'error': 'Authorization check failed'}


@sio.event
async def leave_event(sid, data):
    """User leaves an event room"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    occurrence_id = data.get('occurrence_id')

    if occurrence_id:
        room = f"event_{occurrence_id}"
        await sio.leave_room(sid, room)

        if occurrence_id in event_rooms and user_id:
            event_rooms[occurrence_id].discard(user_id)
            if not event_rooms[occurrence_id]:
                del event_rooms[occurrence_id]

    return {'status': 'left'}


# ============== ADMIN FEEDBACK ROOMS ==============

@sio.event
async def join_admin_feedback(sid, data):
    """Admin joins a feedback room for real-time updates. Auth: super_admin only."""
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    feedback_id = data.get('feedback_id')

    if not user_id or not feedback_id:
        logger.warning(f"join_admin_feedback rejected - missing user_id or feedback_id (sid: {sid})")
        return {'error': 'Missing user_id or feedback_id'}

    try:
        from db import queries

        user = await queries.generic_find_one("users", {"user_id": user_id})
        if not user or user.get("app_role") != "super_admin":
            logger.warning(f"join_admin_feedback rejected - user {user_id} not super_admin")
            return {'error': 'Not authorized to join admin feedback room'}

        # Verify feedback exists
        feedback = await queries.generic_find_one("feedback", {"feedback_id": feedback_id})
        if not feedback:
            return {'error': 'Feedback not found'}

        room = f"admin_feedback_{feedback_id}"
        await sio.enter_room(sid, room)
        logger.info(f"Admin {user_id[:8]}... joined feedback room {feedback_id}")
        return {'status': 'joined', 'room': room}

    except Exception as e:
        logger.error(f"join_admin_feedback error for user {user_id}, feedback {feedback_id}: {e}")
        return {'error': 'Authorization check failed'}


@sio.event
async def leave_admin_feedback(sid, data):
    """Admin leaves a feedback room"""
    feedback_id = data.get('feedback_id')
    if feedback_id:
        await sio.leave_room(sid, f"admin_feedback_{feedback_id}")
    return {'status': 'left'}


async def emit_feedback_updated(feedback_id: str, event_summary: dict = None):
    """Notify admins viewing this feedback that it was updated."""
    room = f"admin_feedback_{feedback_id}"
    await sio.emit("feedback_updated", {"feedback_id": feedback_id, "event": event_summary}, room=room)
    logger.debug(f"Emitted feedback_updated to room {room}")


async def emit_event_created(group_id: str, event_data: dict):
    """Notify group members that a new event was created"""
    data = {
        'type': 'event_created',
        'group_id': group_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **event_data
    }
    await sio.emit('event_update', data, room=f"group_{group_id}")
    logger.info(f"Emitted event_created to group {group_id}")


async def emit_rsvp_updated(group_id: str, rsvp_data: dict):
    """Notify group members of an RSVP update"""
    data = {
        'type': 'rsvp_updated',
        'group_id': group_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **rsvp_data
    }
    await sio.emit('event_update', data, room=f"group_{group_id}")

    # Also emit to the specific event room
    occurrence_id = rsvp_data.get('occurrence_id')
    if occurrence_id:
        await sio.emit('event_update', data, room=f"event_{occurrence_id}")

    logger.info(f"Emitted rsvp_updated to group {group_id}")


async def emit_occurrence_updated(group_id: str, occurrence_data: dict):
    """Notify group members of an occurrence change (edited/cancelled)"""
    data = {
        'type': 'occurrence_updated',
        'group_id': group_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **occurrence_data
    }
    await sio.emit('event_update', data, room=f"group_{group_id}")
    logger.info(f"Emitted occurrence_updated to group {group_id}")


async def emit_occurrence_reminder(user_id: str, occurrence_data: dict, hours_until: int):
    """Send a reminder to a specific user about an upcoming occurrence"""
    await emit_to_user(user_id, 'occurrence_reminder', {
        **occurrence_data,
        'hours_until': hours_until,
    })


async def emit_time_proposed(host_id: str, proposal_data: dict):
    """Notify host that an invitee proposed a new time"""
    await emit_to_user(host_id, 'time_proposed', proposal_data)
