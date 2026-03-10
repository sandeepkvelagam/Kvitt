from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query, Path, Body
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import json
import logging
import asyncio
from pathlib import Path as FilePath
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from decimal import Decimal
import uuid
import random
from datetime import date, datetime, timezone, timedelta
import httpx
import socketio
import wallet_service

# Import database module (PostgreSQL via Supabase)
import db as database
from db import queries
from db.pg import get_pool

# Import shared dependencies (User model, auth functions, shared models)
from dependencies import User, UserSession, get_current_user, verify_supabase_jwt, Notification, AuditLog, LedgerEntry

# Import shared push notification service
from push_service import send_push_notification_to_user, send_push_to_users, check_notification_preferences

# Import routers
from routers.auth import router as auth_router
from routers.groups import router as groups_router
from routers.games import router as games_router
from routers.games import GameNight, Player  # Used by events domain (start_game_from_occurrence)
from routers.spotify import router as spotify_router
from routers.wallet import router as wallet_router
from routers.feedback import router as feedback_router
from routers.engagement import router as engagement_router
from routers.automations import router as automations_router
from routers.analytics import router as analytics_router
from routers.notifications import router as notifications_router
from routers.host import router as host_router
from routers.subscribers import router as subscribers_router
from routers.poker import router as poker_router

# Setup logging early
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROOT_DIR = FilePath(__file__).parent

# Game constants and models moved to routers/games/
load_dotenv(ROOT_DIR / '.env')

# Database pool is initialized in lifespan via database.init_db()
# All queries go through db.queries or db.pg.get_pool()

# ============== AI ORCHESTRATOR SINGLETON ==============
_orchestrator = None

def get_orchestrator():
    """Lazy-init the AI orchestrator with db and optional Claude client."""
    global _orchestrator
    if _orchestrator is None:
        try:
            from ai_service.orchestrator import AIOrchestrator
            from ai_service.claude_client import get_claude_client
            claude = get_claude_client()
            _orchestrator = AIOrchestrator(
                llm_client=claude if claude.is_available else None
            )
            logger.info("AI Orchestrator initialized successfully")
        except Exception as e:
            logger.error(f"Failed to init AI Orchestrator: {e}")
            return None
    return _orchestrator

# Supabase config (JWT verification now in dependencies.py)
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')

# Import WebSocket manager
from websocket_manager import sio, emit_game_event, emit_feedback_updated, notify_player_joined, notify_buy_in, notify_cash_out, notify_chips_edited, notify_game_message, notify_game_state_change, emit_notification, emit_group_message, emit_group_typing


# ============== LIFESPAN HANDLER ==============
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    # Startup
    logger.info("Starting Kvitt backend...")

    # Initialize database (PostgreSQL/Supabase)
    try:
        await database.init_db()
        logger.info("Database initialized: PostgreSQL (Supabase)")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

    # Start background services (must run inside lifespan; on_event("startup") is not invoked when lifespan is used)
    logger.info("PostgreSQL indexes defined in schema migrations")
    try:
        from ai_service.proactive_scheduler import start_proactive_scheduler
        await start_proactive_scheduler()
        logger.info("ProactiveScheduler started")
    except Exception as e:
        logger.warning(f"ProactiveScheduler failed to start (non-critical): {e}")
    try:
        from ai_service.engagement_scheduler import start_engagement_scheduler
        await start_engagement_scheduler()
        logger.info("EngagementScheduler started")
    except Exception as e:
        logger.warning(f"EngagementScheduler failed to start (non-critical): {e}")
    try:
        from ai_service.event_listener import init_event_listener
        orch = get_orchestrator()
        if orch:
            init_event_listener(orchestrator=orch)
            logger.info("EventListenerService initialized (group chat AI enabled)")
        else:
            logger.warning("EventListenerService: orchestrator unavailable, @kvitt disabled")
    except Exception as e:
        logger.warning(f"EventListenerService init failed: {e}")
    if os.environ.get("ENABLE_OPS_SCHEDULER", "").lower() in ("1", "true", "yes"):
        try:
            from ops_agents import start_ops_scheduler
            await start_ops_scheduler()
            logger.info("OpsScheduler started (Super Admin agents enabled)")
        except Exception as e:
            logger.warning(f"OpsScheduler failed to start (non-critical): {e}")
    else:
        logger.info("OpsScheduler disabled (set ENABLE_OPS_SCHEDULER=1 to enable)")

    yield

    # Shutdown
    logger.info("Shutting down Kvitt backend...")
    try:
        from ai_service.proactive_scheduler import stop_proactive_scheduler
        await stop_proactive_scheduler()
    except Exception:
        pass
    try:
        from ai_service.engagement_scheduler import stop_engagement_scheduler
        await stop_engagement_scheduler()
    except Exception:
        pass
    try:
        from ops_agents import stop_ops_scheduler
        await stop_ops_scheduler()
    except Exception:
        pass
    await database.close_db()


# Create the main app with lifespan
fastapi_app = FastAPI(title="Kvitt API", lifespan=lifespan)

# Wrap FastAPI with Socket.IO — uvicorn serves `server:app`, so this must be named `app`
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

# Badge/Level definitions
LEVELS = [
    {"name": "Rookie", "min_games": 0, "min_profit": -999999, "icon": "🎯"},
    {"name": "Regular", "min_games": 5, "min_profit": -999999, "icon": "🃏"},
    {"name": "Pro", "min_games": 20, "min_profit": 0, "icon": "⭐"},
    {"name": "VIP", "min_games": 50, "min_profit": 100, "icon": "💎"},
    {"name": "Legend", "min_games": 100, "min_profit": 500, "icon": "👑"}
]

BADGES = [
    {"id": "first_win", "name": "First Blood", "description": "Win your first game", "icon": "🏆"},
    {"id": "winning_streak_3", "name": "Hot Streak", "description": "Win 3 games in a row", "icon": "🔥"},
    {"id": "winning_streak_5", "name": "On Fire", "description": "Win 5 games in a row", "icon": "💥"},
    {"id": "big_win", "name": "Big Winner", "description": "Win $100+ in a single game", "icon": "💰"},
    {"id": "huge_win", "name": "Jackpot", "description": "Win $500+ in a single game", "icon": "🎰"},
    {"id": "games_10", "name": "Dedicated", "description": "Play 10 games", "icon": "🎲"},
    {"id": "games_50", "name": "Veteran", "description": "Play 50 games", "icon": "🎖️"},
    {"id": "games_100", "name": "Centurion", "description": "Play 100 games", "icon": "🏅"},
    {"id": "host_5", "name": "Host Master", "description": "Host 5 games", "icon": "🏠"},
    {"id": "comeback", "name": "Comeback Kid", "description": "Win after being down 50%+", "icon": "💪"},
    {"id": "consistent", "name": "Consistent", "description": "Profit in 5 consecutive games", "icon": "📈"},
    {"id": "social", "name": "Social Butterfly", "description": "Play with 10+ different players", "icon": "🦋"},
]

# User and UserSession models are now in dependencies.py
# Group models (GroupInvite, Group, GroupMember) moved to routers/groups.py

# Subscriber model moved to routers/subscribers.py

# GameNight, Player, Transaction, GameThread models moved to routers/games/models.py
# LedgerEntry model moved to dependencies.py
# AuditLog and Notification models moved to dependencies.py
# GroupMessage, GroupAISettings, PollOption, Poll models moved to routers/groups.py


# Wallet models and request models moved to routers/wallet.py

# ============== REQUEST/RESPONSE MODELS ==============

class MarkPaidRequest(BaseModel):
    paid: bool

class LedgerEditRequest(BaseModel):
    amount: float
    reason: str


class RegisterPushTokenRequest(BaseModel):
    """Register Expo push notification token for a user."""
    expo_push_token: str


# Auth helpers and endpoints are now in dependencies.py and routers/auth.py
# Group endpoints moved to routers/groups.py

@api_router.put("/users/me")
async def update_user_profile(data: dict, user: User = Depends(get_current_user)):
    """Update current user's profile."""
    allowed_fields = {"name", "nickname", "preferences", "help_improve_ai"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if update_data:
        await queries.update_user(user.user_id, update_data)

    updated_user = await queries.get_user(user.user_id)
    return updated_user or {"status": "updated"}

@api_router.get("/users/search")
async def search_users(query: str, user: User = Depends(get_current_user)):
    """Search for users by name or email."""
    if len(query) < 2:
        return []
    
    # Search by name or email (case-insensitive)
    users = await queries.search_users(query, exclude_user_id=user.user_id, limit=20)
    return users

# Group invite/member endpoints moved to routers/groups.py

@api_router.get("/users/me/badges")
async def get_my_badges(user: User = Depends(get_current_user)):
    """Get current user's badges and level progress."""
    user_doc = await queries.get_user(user.user_id)
    
    # Calculate stats
    players = await queries.find_players_by_user_with_results(user.user_id)
    
    total_games = len(players)
    total_profit = sum(p.get("net_result", 0) for p in players)
    wins = sum(1 for p in players if p.get("net_result", 0) > 0)
    win_rate = (wins / total_games * 100) if total_games > 0 else 0
    
    # Determine current level
    current_level = LEVELS[0]
    next_level = None
    for i, level in enumerate(LEVELS):
        if total_games >= level["min_games"] and total_profit >= level["min_profit"]:
            current_level = level
            if i < len(LEVELS) - 1:
                next_level = LEVELS[i + 1]
    
    # Calculate progress to next level
    progress = None
    if next_level:
        games_needed = max(0, next_level["min_games"] - total_games)
        profit_needed = max(0, next_level["min_profit"] - total_profit)
        progress = {
            "next_level": next_level["name"],
            "games_needed": games_needed,
            "profit_needed": round(profit_needed, 2),
            "games_progress": min(100, (total_games / next_level["min_games"]) * 100) if next_level["min_games"] > 0 else 100
        }
    
    # Get earned badges
    earned_badges = user_doc.get("badges", [])
    all_badges = []
    for badge in BADGES:
        all_badges.append({
            **badge,
            "earned": badge["id"] in earned_badges
        })
    
    return {
        "level": current_level,
        "progress": progress,
        "stats": {
            "total_games": total_games,
            "total_profit": round(total_profit, 2),
            "wins": wins,
            "win_rate": round(win_rate, 1)
        },
        "badges": all_badges,
        "earned_count": len(earned_badges),
        "total_badges": len(BADGES)
    }

@api_router.get("/levels")
async def get_levels():
    """Get all level definitions."""
    return {"levels": LEVELS, "badges": BADGES}

@api_router.get("/users/game-history")
async def get_game_history(user: User = Depends(get_current_user)):
    """Get user's complete game history with stats."""
    # Get all games where user was a player
    player_records = await queries.find_players_by_user(user.user_id)
    
    game_ids = [p["game_id"] for p in player_records]
    
    # Get game details
    games = []
    total_winnings = 0
    total_losses = 0
    wins = 0
    
    for player in player_records:
        game = await queries.get_game_night(player["game_id"])
        if game:
            # Get group info
            group = await queries.get_group(game["group_id"])
            
            net_result = player.get("net_result", 0)
            
            games.append({
                "game_id": game["game_id"],
                "title": game.get("title", "Game Night"),
                "status": game["status"],
                "created_at": game.get("created_at", game.get("started_at")),
                "group": {"name": group.get("name") if group else "Unknown"},
                "net_result": net_result if player.get("cashed_out") else None,
                "total_buy_in": player.get("total_buy_in", 0),
                "cashed_out": player.get("cashed_out", False)
            })
            
            if player.get("cashed_out") and net_result is not None:
                if net_result > 0:
                    total_winnings += net_result
                    wins += 1
                else:
                    total_losses += net_result
    
    # Sort by date (newest first)
    games.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Calculate stats
    completed_games = [g for g in games if g.get("cashed_out")]
    win_rate = (wins / len(completed_games) * 100) if completed_games else 0
    
    return {
        "games": games,
        "stats": {
            "totalGames": len(games),
            "totalWinnings": total_winnings,
            "totalLosses": total_losses,
            "winRate": win_rate
        }
    }

# Duplicate member removal endpoint removed (consolidated in routers/groups.py)

# Game endpoints moved to routers/games/ package

@api_router.put("/ledger/{ledger_id}/paid")
async def mark_paid(ledger_id: str, data: MarkPaidRequest, user: User = Depends(get_current_user)):
    """Mark a ledger entry as paid."""
    entry = await queries.get_ledger_entry(ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    
    # Only from_user or to_user can mark as paid
    if user.user_id not in [entry["from_user_id"], entry["to_user_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "status": "paid" if data.paid else "pending",
        "paid_at": datetime.now(timezone.utc) if data.paid else None,
        "is_locked": True  # Lock after first status change
    }
    
    await queries.update_ledger_entry(ledger_id, update_data)
    
    return {"message": "Status updated"}

@api_router.post("/ledger/{ledger_id}/request-payment")
async def request_payment(ledger_id: str, user: User = Depends(get_current_user)):
    """Send payment request notification to debtor."""
    entry = await queries.get_ledger_entry(ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    # Only creditor can request payment
    if entry["to_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the creditor can request payment")

    if entry["status"] == "paid":
        raise HTTPException(status_code=400, detail="This debt has already been paid")

    # Get debtor info
    debtor = await queries.get_user(entry["from_user_id"])

    # Create notification for debtor
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": entry["from_user_id"],
        "title": "Payment Requested",
        "message": f"{user.name} is requesting payment of ${entry['amount']:.2f}",
        "type": "payment_request",
        "data": {
            "ledger_id": ledger_id,
            "amount": entry["amount"],
            "creditor_name": user.name,
            "creditor_id": user.user_id
        },
        "channels": ["in_app"],
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    try:
        await queries.insert_notification(notification)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for request_payment: {e}")

    # Send real-time notification via WebSocket
    await emit_notification(entry["from_user_id"], notification)

    return {"status": "requested", "message": f"Payment request sent to {debtor['name'] if debtor else 'user'}"}

@api_router.post("/ledger/{ledger_id}/confirm-received")
async def confirm_payment_received(ledger_id: str, user: User = Depends(get_current_user)):
    """Creditor confirms they received cash payment."""
    entry = await queries.get_ledger_entry(ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    # Only creditor (to_user_id) can confirm they received payment
    if entry["to_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the creditor can confirm payment received")

    if entry["status"] == "paid":
        raise HTTPException(status_code=400, detail="This payment has already been confirmed")

    # Mark as paid
    await queries.update_ledger_entry(ledger_id, {
            "status": "paid",
            "paid_at": datetime.now(timezone.utc),
            "payment_method": "cash",
            "confirmed_by": user.user_id,
            "is_locked": True
        })

    # Get debtor info for notification
    debtor = await queries.get_user(entry["from_user_id"])

    # Notify debtor that payment was confirmed
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": entry["from_user_id"],
        "title": "Payment Confirmed",
        "message": f"{user.name} confirmed receiving your payment of ${entry['amount']:.2f}",
        "type": "payment_confirmed",
        "data": {
            "ledger_id": ledger_id,
            "amount": entry["amount"],
            "creditor_name": user.name
        },
        "channels": ["in_app"],
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    try:
        await queries.insert_notification(notification)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for confirm_payment: {e}")

    # Send real-time notification via WebSocket
    await emit_notification(entry["from_user_id"], notification)

    return {"status": "confirmed", "message": f"Payment of ${entry['amount']:.2f} confirmed as received"}

@api_router.put("/ledger/{ledger_id}/edit")
async def edit_ledger(ledger_id: str, data: LedgerEditRequest, user: User = Depends(get_current_user)):
    """Edit a locked ledger entry (admin only with reason)."""
    entry = await queries.get_ledger_entry(ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    
    # Check admin status
    membership = await queries.get_group_member(entry["group_id"], user.user_id)
    if not membership or membership["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Create audit log
    audit = AuditLog(
        entity_type="ledger",
        entity_id=ledger_id,
        action="update",
        old_value={"amount": entry["amount"]},
        new_value={"amount": data.amount},
        changed_by=user.user_id,
        reason=data.reason
    )
    audit_dict = audit.model_dump()
    await queries.insert_audit_log(audit_dict)
    
    # Update entry
    await queries.update_ledger_entry(ledger_id, {"amount": data.amount})
    
    return {"message": "Ledger entry updated"}

# ============== STATS ENDPOINTS ==============

@api_router.get("/stats/me")
async def get_my_stats(user: User = Depends(get_current_user)):
    """Get personal statistics."""
    # Get all player records for this user
    players = await queries.find_players_by_user_with_results(user.user_id)
    
    if not players:
        return {
            "total_games": 0,
            "total_buy_ins": 0,
            "total_winnings": 0,
            "net_profit": 0,
            "win_rate": 0,
            "biggest_win": 0,
            "biggest_loss": 0,
            "recent_games": []
        }
    
    total_games = len(players)
    total_buy_ins = sum(p.get("total_buy_in", 0) for p in players)
    total_winnings = sum(p.get("cash_out", 0) for p in players)
    net_profit = sum(p.get("net_result", 0) for p in players)
    wins = sum(1 for p in players if p.get("net_result", 0) > 0)
    win_rate = (wins / total_games * 100) if total_games > 0 else 0
    
    results = [p.get("net_result", 0) for p in players]
    biggest_win = max(results) if results else 0
    biggest_loss = min(results) if results else 0
    
    # Get recent games
    recent = sorted(players, key=lambda x: x.get("player_id", ""), reverse=True)[:5]
    recent_games = []
    for p in recent:
        game = await queries.get_game_night(p["game_id"])
        if game:
            group = await queries.get_group(game["group_id"])
            recent_games.append({
                "game_id": p["game_id"],
                "group_name": group["name"] if group else "Unknown",
                "net_result": p.get("net_result", 0),
                "date": game.get("ended_at") or game.get("started_at")
            })
    
    return {
        "total_games": total_games,
        "total_buy_ins": round(total_buy_ins, 2),
        "total_winnings": round(total_winnings, 2),
        "net_profit": round(net_profit, 2),
        "win_rate": round(win_rate, 1),
        "biggest_win": round(biggest_win, 2),
        "biggest_loss": round(biggest_loss, 2),
        "recent_games": recent_games
    }

@api_router.get("/stats/group/{group_id}")
async def get_group_stats(group_id: str, user: User = Depends(get_current_user)):
    """Get group statistics."""
    # Verify membership
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    # Get all games in group
    games = await queries.find_game_nights({"group_id": group_id}, limit=1000)
    games = [g for g in games if g.get("status") in ("ended", "settled")]
    
    game_ids = [g["game_id"] for g in games]
    
    # Get player stats across all games
    leaderboard = await queries.get_leaderboard_by_games(game_ids)

    # Add user info
    for entry in leaderboard:
        user_info = await queries.get_user(entry["user_id"])
        entry["user"] = user_info
    
    return {
        "total_games": len(games),
        "leaderboard": leaderboard
    }

# Game thread endpoints moved to routers/games/thread.py

# Group chat, AI settings, polls endpoints moved to routers/groups.py

# ============== GAME SCHEDULER MODELS ==============

class CreateEventRequest(BaseModel):
    group_id: str
    title: str
    starts_at: datetime
    duration_minutes: int = 180
    location: Optional[str] = None
    game_category: str = "poker"
    template_id: Optional[str] = None
    recurrence: str = "none"
    rrule_weekdays: Optional[List[int]] = None
    rrule_interval: int = 1
    rrule_until: Optional[date] = None
    rrule_count: Optional[int] = None
    default_buy_in: Optional[float] = None
    default_chips_per_buy_in: Optional[int] = None
    invite_scope: str = "group"
    selected_invitees: Optional[List[str]] = None
    notes: Optional[str] = None
    timezone: str = "America/New_York"

class EventRSVPRequest(BaseModel):
    status: str  # accepted | declined | maybe
    note: Optional[str] = None

class ProposeTimeRequest(BaseModel):
    proposed_starts_at: datetime
    proposed_duration_minutes: Optional[int] = None
    proposed_location: Optional[str] = None
    note: Optional[str] = None

class DecideProposalRequest(BaseModel):
    decision: str  # accepted | declined


# ============== GAME SCHEDULER ENDPOINTS ==============

@api_router.post("/events")
async def create_event(data: CreateEventRequest, user: User = Depends(get_current_user)):
    """Create a scheduled event (one-time or recurring) with invites."""
    from scheduling_engine import generate_occurrences, create_invites_for_occurrence, make_id, local_to_utc
    from db.pg import get_pool

    # Verify membership
    membership = await queries.get_group_member(data.group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Validate starts_at is in the future
    if data.starts_at.tzinfo is None:
        data.starts_at = data.starts_at.replace(tzinfo=timezone.utc)
    if data.starts_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="starts_at must be in the future")

    # Derive local_start_time from starts_at + timezone
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(data.timezone)
    local_dt = data.starts_at.astimezone(tz)
    local_start_time = local_dt.time().isoformat()

    event_id = make_id("evt")

    event_doc = {
        "event_id": event_id,
        "group_id": data.group_id,
        "host_id": user.user_id,
        "title": data.title,
        "description": data.notes,
        "location": data.location,
        "game_category": data.game_category,
        "template_id": data.template_id,
        "starts_at": data.starts_at,
        "local_start_time": local_start_time,
        "duration_minutes": data.duration_minutes,
        "timezone": data.timezone,
        "recurrence": data.recurrence,
        "rrule_weekdays": data.rrule_weekdays,
        "rrule_interval": data.rrule_interval,
        "rrule_until": data.rrule_until if data.rrule_until else None,
        "rrule_count": data.rrule_count,
        "default_buy_in": data.default_buy_in,
        "default_chips_per_buy_in": data.default_chips_per_buy_in,
        "status": "published",
        "invite_scope": data.invite_scope,
        "selected_invitees": data.selected_invitees,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    await queries.generic_insert("scheduled_events", event_doc)

    # Generate occurrences
    occurrences = generate_occurrences(event_doc)

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    invites_sent = 0
    for occ in occurrences:
        await queries.generic_insert("event_occurrences", occ)
        # Create invites for each occurrence
        invites = await create_invites_for_occurrence(
            pool=pool,
            occurrence_id=occ["occurrence_id"],
            group_id=data.group_id,
            host_id=user.user_id,
            invite_scope=data.invite_scope,
            selected_invitees=data.selected_invitees,
        )
        invites_sent += len([i for i in invites if i["status"] == "invited"])

    # Send push notification to invitees
    if occurrences:
        invitee_ids = []
        if data.invite_scope == "selected" and data.selected_invitees:
            invitee_ids = [uid for uid in data.selected_invitees if uid != user.user_id]
        else:
            members = await queries.find_group_members_by_group(data.group_id, limit=100)
            invitee_ids = [m["user_id"] for m in members if m["user_id"] != user.user_id]

        for uid in invitee_ids:
            try:
                await send_push_notification_to_user(
                    uid,
                    f"Game scheduled: {data.title}",
                    f"{user.name} scheduled {data.title}. You in?",
                    {"type": "event_invite", "occurrence_id": occurrences[0]["occurrence_id"], "event_id": event_id},
                )
            except Exception as e:
                logger.error(f"Push notification failed for {uid}: {e}")

    # Emit Socket.IO event to group
    try:
        from websocket_manager import emit_event_created
        await emit_event_created(data.group_id, {
            "event_id": event_id,
            "title": data.title,
            "host_id": user.user_id,
            "host_name": user.name,
            "starts_at": data.starts_at.isoformat(),
            "occurrences_count": len(occurrences),
        })
    except Exception as e:
        logger.debug(f"Socket emit failed (non-critical): {e}")

    next_occ = occurrences[0] if occurrences else None
    return {
        "event_id": event_id,
        "group_id": data.group_id,
        "title": data.title,
        "starts_at": data.starts_at.isoformat(),
        "timezone": data.timezone,
        "recurrence": data.recurrence,
        "status": "published",
        "occurrences_generated": len(occurrences),
        "invites_sent": invites_sent,
        "next_occurrence": {
            "occurrence_id": next_occ["occurrence_id"],
            "starts_at": next_occ["starts_at"],
        } if next_occ else None,
    }


@api_router.get("/events")
async def list_events(
    group_id: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """List upcoming events for the current user (optionally filtered by group)."""
    from db.pg import get_pool

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    now = datetime.now(timezone.utc)

    if group_id:
        # Verify membership
        membership = await queries.get_group_member(group_id, user.user_id)
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this group")

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT se.*, eo.occurrence_id, eo.starts_at as occ_starts_at,
                       eo.status as occ_status, eo.occurrence_index,
                       ei.status as my_rsvp
                FROM scheduled_events se
                JOIN event_occurrences eo ON se.event_id = eo.event_id
                LEFT JOIN event_invites ei ON eo.occurrence_id = ei.occurrence_id AND ei.user_id = $1
                WHERE se.group_id = $2 AND se.status = 'published'
                  AND eo.starts_at >= $3 AND eo.status = 'upcoming'
                ORDER BY eo.starts_at ASC
                LIMIT 50
                """,
                user.user_id, group_id, now,
            )
    else:
        # Get all events from user's groups
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT se.*, eo.occurrence_id, eo.starts_at as occ_starts_at,
                       eo.status as occ_status, eo.occurrence_index,
                       ei.status as my_rsvp
                FROM scheduled_events se
                JOIN event_occurrences eo ON se.event_id = eo.event_id
                JOIN group_members gm ON se.group_id = gm.group_id AND gm.user_id = $1
                LEFT JOIN event_invites ei ON eo.occurrence_id = ei.occurrence_id AND ei.user_id = $1
                WHERE se.status = 'published'
                  AND eo.starts_at >= $2 AND eo.status = 'upcoming'
                  AND gm.status = 'active'
                ORDER BY eo.starts_at ASC
                LIMIT 50
                """,
                user.user_id, now,
            )

    events = []
    for row in rows:
        events.append({
            "event_id": row["event_id"],
            "occurrence_id": row["occurrence_id"],
            "title": row["title"],
            "starts_at": row["occ_starts_at"].isoformat() if row["occ_starts_at"] else None,
            "duration_minutes": row["duration_minutes"],
            "location": row["location"],
            "game_category": str(row["game_category"]) if row["game_category"] else "poker",
            "recurrence": str(row["recurrence"]) if row["recurrence"] else "none",
            "group_id": row["group_id"],
            "host_id": row["host_id"],
            "status": row["occ_status"],
            "my_rsvp": str(row["my_rsvp"]) if row["my_rsvp"] else None,
        })

    return {"events": events, "total": len(events)}


@api_router.get("/events/{event_id}")
async def get_event(event_id: str, user: User = Depends(get_current_user)):
    """Get event details with upcoming occurrences."""
    event = await queries.generic_find_one("scheduled_events", {"event_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Verify membership
    membership = await queries.get_group_member(event["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Get upcoming occurrences
    from db.pg import get_pool
    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    async with pool.acquire() as conn:
        occ_rows = await conn.fetch(
            """
            SELECT eo.*, ei.status as my_rsvp
            FROM event_occurrences eo
            LEFT JOIN event_invites ei ON eo.occurrence_id = ei.occurrence_id AND ei.user_id = $1
            WHERE eo.event_id = $2
            ORDER BY eo.starts_at ASC
            LIMIT 20
            """,
            user.user_id, event_id,
        )

    occurrences = []
    for row in occ_rows:
        occurrences.append({
            "occurrence_id": row["occurrence_id"],
            "starts_at": row["starts_at"].isoformat() if row["starts_at"] else None,
            "duration_minutes": row["duration_minutes"],
            "location": row["location"],
            "status": row["status"],
            "occurrence_index": row["occurrence_index"],
            "is_override": row["is_override"],
            "game_id": row["game_id"],
            "my_rsvp": str(row["my_rsvp"]) if row["my_rsvp"] else None,
        })

    # Serialize event
    result = {
        "event_id": event["event_id"],
        "group_id": event["group_id"],
        "host_id": event["host_id"],
        "title": event["title"],
        "description": event.get("description"),
        "location": event.get("location"),
        "game_category": str(event.get("game_category", "poker")),
        "starts_at": event["starts_at"].isoformat() if isinstance(event["starts_at"], datetime) else event["starts_at"],
        "timezone": event.get("timezone", "America/New_York"),
        "recurrence": str(event.get("recurrence", "none")),
        "status": str(event.get("status", "published")),
        "default_buy_in": float(event["default_buy_in"]) if event.get("default_buy_in") else None,
        "default_chips_per_buy_in": event.get("default_chips_per_buy_in"),
        "occurrences": occurrences,
    }

    return result


@api_router.post("/occurrences/{occurrence_id}/rsvp")
async def rsvp_to_occurrence(
    occurrence_id: str,
    data: EventRSVPRequest,
    user: User = Depends(get_current_user)
):
    """RSVP to an event occurrence (accept/decline/maybe)."""
    from scheduling_engine import make_id, get_rsvp_stats
    from db.pg import get_pool

    valid_statuses = {"accepted", "declined", "maybe"}
    if data.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of: {valid_statuses}")

    # Get occurrence
    occurrence = await queries.generic_find_one("event_occurrences", {"occurrence_id": occurrence_id})
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")

    if occurrence.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot RSVP to a cancelled occurrence")

    # Get the parent event for group verification
    event = await queries.generic_find_one("scheduled_events", {"event_id": occurrence["event_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Verify membership
    membership = await queries.get_group_member(event["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    # Find or create invite
    invite = await queries.generic_find_one("event_invites", {
        "occurrence_id": occurrence_id,
        "user_id": user.user_id,
    })

    now = datetime.now(timezone.utc)

    if invite:
        old_status = invite.get("status", "invited")
        # Update existing invite
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE event_invites
                SET status = $1::invite_status, responded_at = $2, notes = $3, updated_at = $2
                WHERE occurrence_id = $4 AND user_id = $5
                """,
                data.status, now, data.note, occurrence_id, user.user_id,
            )
        invite_id = invite["invite_id"]
    else:
        old_status = None
        invite_id = make_id("inv")
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO event_invites (invite_id, occurrence_id, user_id, status, responded_at, notes)
                VALUES ($1, $2, $3, $4::invite_status, $5, $6)
                ON CONFLICT (occurrence_id, user_id) DO UPDATE
                SET status = $4::invite_status, responded_at = $5, notes = $6
                """,
                invite_id, occurrence_id, user.user_id, data.status, now, data.note,
            )

    # Log to rsvp_history
    history_id = make_id("rsh")
    await queries.generic_insert("rsvp_history", {
        "history_id": history_id,
        "invite_id": invite_id,
        "old_status": old_status,
        "new_status": data.status,
        "changed_by": user.user_id,
        "reason": data.note,
        "created_at": now,
    })

    # Get updated stats
    stats = await get_rsvp_stats(pool, occurrence_id)

    # Notify host via push
    host_id = event.get("host_id")
    if host_id and host_id != user.user_id:
        try:
            await send_push_notification_to_user(
                host_id,
                f"RSVP: {user.name} — {data.status}",
                f"{user.name} {data.status} for {event.get('title', 'game night')}",
                {"type": "rsvp_update", "occurrence_id": occurrence_id, "event_id": event["event_id"]},
            )
        except Exception as e:
            logger.error(f"Push notification to host failed: {e}")

    # Emit Socket.IO update
    try:
        from websocket_manager import emit_rsvp_updated
        await emit_rsvp_updated(event["group_id"], {
            "occurrence_id": occurrence_id,
            "user_id": user.user_id,
            "user_name": user.name,
            "status": data.status,
            "stats": stats,
        })
    except Exception as e:
        logger.debug(f"Socket emit failed (non-critical): {e}")

    return {
        "invite_id": invite_id,
        "occurrence_id": occurrence_id,
        "status": data.status,
        "responded_at": now.isoformat(),
        "stats": stats,
    }


@api_router.get("/occurrences/{occurrence_id}/invites")
async def get_occurrence_invites(
    occurrence_id: str,
    user: User = Depends(get_current_user)
):
    """Get invite statuses for an occurrence (host dashboard)."""
    from scheduling_engine import get_rsvp_stats
    from db.pg import get_pool

    # Get occurrence and verify access
    occurrence = await queries.generic_find_one("event_occurrences", {"occurrence_id": occurrence_id})
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")

    event = await queries.generic_find_one("scheduled_events", {"event_id": occurrence["event_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    membership = await queries.get_group_member(event["group_id"], user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT ei.*, u.name as user_name, u.picture as user_picture
            FROM event_invites ei
            JOIN users u ON ei.user_id = u.user_id
            WHERE ei.occurrence_id = $1
            ORDER BY ei.status, u.name
            """,
            occurrence_id,
        )

    invites = []
    for row in rows:
        invites.append({
            "invite_id": row["invite_id"],
            "user_id": row["user_id"],
            "user_name": row["user_name"],
            "user_picture": row["user_picture"],
            "status": str(row["status"]),
            "responded_at": row["responded_at"].isoformat() if row["responded_at"] else None,
            "notes": row["notes"],
        })

    stats = await get_rsvp_stats(pool, occurrence_id)

    return {
        "occurrence_id": occurrence_id,
        "event_id": occurrence["event_id"],
        "invites": invites,
        "stats": stats,
    }


@api_router.post("/occurrences/{occurrence_id}/start-game")
async def start_game_from_occurrence(
    occurrence_id: str,
    user: User = Depends(get_current_user)
):
    """Create a game_night from a scheduled occurrence (host only)."""
    from scheduling_engine import make_id
    from db.pg import get_pool

    occurrence = await queries.generic_find_one("event_occurrences", {"occurrence_id": occurrence_id})
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")

    if occurrence.get("game_id"):
        raise HTTPException(status_code=409, detail="Game already started for this occurrence")

    event = await queries.generic_find_one("scheduled_events", {"event_id": occurrence["event_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event["host_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the host can start the game")

    # Create game_night
    buy_in = float(event.get("default_buy_in") or 20)
    chips = event.get("default_chips_per_buy_in") or 20
    chip_value = buy_in / chips if chips else 1.0

    game = GameNight(
        group_id=event["group_id"],
        host_id=user.user_id,
        title=event.get("title", "Game Night"),
        location=occurrence.get("location") or event.get("location"),
        status="active",
        started_at=datetime.now(timezone.utc),
        buy_in_amount=buy_in,
        chips_per_buy_in=chips,
        chip_value=chip_value,
        event_occurrence_id=occurrence_id,
    )

    game_dict = game.model_dump()
    await queries.insert_game_night(game_dict)

    # Add accepted players to the game
    pool = get_pool()
    if pool:
        async with pool.acquire() as conn:
            accepted_rows = await conn.fetch(
                "SELECT user_id FROM event_invites WHERE occurrence_id = $1 AND status = 'accepted'",
                occurrence_id,
            )

        for row in accepted_rows:
            player = Player(
                game_id=game.game_id,
                user_id=row["user_id"],
                rsvp_status="yes",
                total_buy_in=buy_in if row["user_id"] == user.user_id else 0,
                total_chips=chips if row["user_id"] == user.user_id else 0,
            )
            player_dict = player.model_dump()
            await queries.insert_player(player_dict)

        # Link occurrence to game
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE event_occurrences SET game_id = $1, status = 'active', updated_at = NOW() WHERE occurrence_id = $2",
                game.game_id, occurrence_id,
            )

    return {
        "game_id": game.game_id,
        "occurrence_id": occurrence_id,
        "event_id": event["event_id"],
        "status": "active",
        "title": game.title,
    }


@api_router.get("/templates")
async def list_templates(user: User = Depends(get_current_user)):
    """List available game templates."""
    templates = await queries.generic_find("game_templates", {"is_system": True}, limit=50)
    return {
        "templates": [
            {
                "template_id": t["template_id"],
                "name": t["name"],
                "game_category": str(t.get("game_category", "other")),
                "default_duration_minutes": t.get("default_duration_minutes", 180),
                "min_players": t.get("min_players", 2),
                "max_players": t.get("max_players"),
                "default_buy_in": float(t["default_buy_in"]) if t.get("default_buy_in") else None,
                "default_chips_per_buy_in": t.get("default_chips_per_buy_in"),
            }
            for t in templates
        ]
    }


# Group calendar endpoint moved to routers/groups.py

# Notification routes moved to routers/notifications.py


# NOTIFICATION_CATEGORY_MAP and check_notification_preferences moved to push_service.py

# ============== DEBUG/DIAGNOSTICS ENDPOINTS ==============

@api_router.get("/debug/user-data")
async def debug_user_data(user: User = Depends(get_current_user)):
    """Debug endpoint to diagnose user data issues."""
    result = {
        "current_user": {
            "user_id": user.user_id,
            "email": user.email,
            "name": user.name
        },
        "user_record": None,
        "group_memberships": [],
        "player_records": [],
        "notifications": [],
        "issues": []
    }

    # Get full user record
    user_doc = await queries.get_user(user.user_id)
    result["user_record"] = user_doc

    # Check for duplicate users with same email
    duplicate_users = await queries.find_users({"email": user.email}, limit=10)
    if len(duplicate_users) > 1:
        result["issues"].append({
            "type": "duplicate_users",
            "message": f"Found {len(duplicate_users)} users with same email",
            "users": duplicate_users
        })

    # Get group memberships
    memberships = await queries.find_group_members_by_user(user.user_id, limit=100)
    result["group_memberships"] = memberships

    # Get player records
    players = await queries.find_players_by_user(user.user_id, limit=100)
    result["player_records"] = players

    # Get recent notifications
    notifications = await queries.find_notifications({"user_id": user.user_id}, limit=10)
    result["notifications"] = notifications

    # Check for orphaned records (records with mismatched user_id)
    # Check memberships by email
    if user.email:
        alt_user_ids = [u["user_id"] for u in duplicate_users if u["user_id"] != user.user_id]
        if alt_user_ids:
            # Check for records with alternate user_ids
            alt_memberships = await queries.find_group_members_by_user_ids(alt_user_ids)
            if alt_memberships:
                result["issues"].append({
                    "type": "orphaned_memberships",
                    "message": f"Found {len(alt_memberships)} group memberships with alternate user_id",
                    "records": alt_memberships
                })

            alt_players = await queries.find_players_by_user_ids(alt_user_ids)
            if alt_players:
                result["issues"].append({
                    "type": "orphaned_players",
                    "message": f"Found {len(alt_players)} player records with alternate user_id",
                    "records": alt_players
                })

            alt_notifications = await queries.find_notifications_by_user_ids(alt_user_ids)
            if alt_notifications:
                result["issues"].append({
                    "type": "orphaned_notifications",
                    "message": f"Found {len(alt_notifications)} notifications with alternate user_id",
                    "records": alt_notifications
                })

    return result

@api_router.post("/debug/fix-user-data")
async def fix_user_data(user: User = Depends(get_current_user)):
    """Fix user data issues by consolidating records to the current user_id."""
    fixes = {
        "memberships_fixed": 0,
        "players_fixed": 0,
        "notifications_fixed": 0,
        "duplicate_users_merged": 0
    }

    # Find duplicate users with same email
    duplicate_users = await queries.find_duplicate_users_by_email(user.email, user.user_id)

    alt_user_ids = [u["user_id"] for u in duplicate_users]

    if alt_user_ids:
        # Update group memberships
        memberships_fixed = await queries.update_group_members_user_id(alt_user_ids, user.user_id)
        fixes["memberships_fixed"] = memberships_fixed

        # Update player records
        players_fixed = await queries.update_players_user_id(alt_user_ids, user.user_id)
        fixes["players_fixed"] = players_fixed

        # Update notifications
        notifications_fixed = await queries.update_notifications_user_id(alt_user_ids, user.user_id)
        fixes["notifications_fixed"] = notifications_fixed

        # Update transactions
        await queries.update_transactions_user_id(alt_user_ids, user.user_id)

        # Update game threads
        await queries.update_game_threads_user_id(alt_user_ids, user.user_id)

        # Update ledger entries
        await queries.update_ledger_entries_user_id(alt_user_ids, user.user_id)

        # Delete duplicate user records
        deleted_count = await queries.delete_users_by_ids(alt_user_ids)
        fixes["duplicate_users_merged"] = deleted_count

    return {
        "message": "User data fixed",
        "fixes": fixes,
        "current_user_id": user.user_id
    }

# ============== VOICE COMMANDS ENDPOINT ==============

from fastapi import File, UploadFile, Form

@api_router.post("/voice/transcribe")
async def transcribe_voice(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    user: User = Depends(get_current_user)
):
    """Transcribe voice audio to text using Whisper."""
    from openai import AsyncOpenAI

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise HTTPException(status_code=503, detail="Voice service not configured")

    # Check file type
    allowed_types = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/webm", "audio/m4a", "audio/mp4"]
    content_type = file.content_type or ""
    if not any(t in content_type for t in ["audio", "video"]):
        raise HTTPException(status_code=400, detail="Invalid file type. Must be audio file.")

    try:
        # Read file content
        audio_content = await file.read()

        # Save to temp file (Whisper API expects file-like object)
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            temp_file.write(audio_content)
            temp_path = temp_file.name

        client = AsyncOpenAI(api_key=api_key)
        with open(temp_path, "rb") as audio_file:
            response = await client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="json",
                language=language  # ISO-639-1 format: en, es, fr, etc.
            )

        # Cleanup temp file
        os.unlink(temp_path)

        # Parse voice command (response is Transcription object with .text)
        text = response.text.strip().lower()
        command = parse_voice_command(text)
        
        return {
            "text": response.text,
            "command": command,
            "language": language
        }
        
    except Exception as e:
        logger.error(f"Voice transcription error: {e}")
        raise HTTPException(status_code=500, detail="Failed to transcribe audio")

def parse_voice_command(text: str) -> Optional[Dict[str, Any]]:
    """Parse transcribed text into a poker command."""
    text = text.lower().strip()
    
    # Buy-in commands
    if "buy in" in text or "buy-in" in text or "buyin" in text:
        # Extract amount if present
        import re
        amount_match = re.search(r'\$?(\d+)', text)
        amount = int(amount_match.group(1)) if amount_match else None
        return {"type": "buy_in", "amount": amount}
    
    # Rebuy commands
    if "rebuy" in text or "re-buy" in text or "re buy" in text:
        amount_match = re.search(r'\$?(\d+)', text)
        amount = int(amount_match.group(1)) if amount_match else None
        return {"type": "rebuy", "amount": amount}
    
    # Cash out commands
    if "cash out" in text or "cashout" in text or "cash-out" in text:
        chips_match = re.search(r'(\d+)\s*(chips?)?', text)
        chips = int(chips_match.group(1)) if chips_match else None
        return {"type": "cash_out", "chips": chips}
    
    # Start game
    if "start game" in text or "start the game" in text or "begin game" in text:
        return {"type": "start_game"}
    
    # End game
    if "end game" in text or "end the game" in text or "finish game" in text:
        return {"type": "end_game"}
    
    # Check balance
    if "balance" in text or "how much" in text or "my chips" in text:
        return {"type": "check_balance"}
    
    # AI help
    if "help" in text or "suggest" in text or "what should i do" in text:
        return {"type": "ai_help"}
    
    return None

# ============== AI ASSISTANT ENDPOINTS ==============

class AskAssistantRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, str]]] = None
    flow_event: Optional[Dict[str, Any]] = None

# PokerAnalyzeRequest model moved to routers/poker.py

# --- AI Assistant: Rate Limiting ---

AI_DAILY_LIMIT_FREE = 10
AI_DAILY_LIMIT_PREMIUM = 50

async def check_ai_rate_limit(user_id: str, daily_limit: int) -> bool:
    """Check AI request rate limit. Returns True if allowed."""
    return await wallet_service.check_rate_limit(
        key=f"ai:{user_id}",
        endpoint="assistant_ask",
        limit=daily_limit,
        window_seconds=86400
    )

async def get_ai_requests_remaining(user_id: str, daily_limit: int) -> int:
    """Get remaining AI requests for current period."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=86400)
    doc = await queries.find_rate_limit(f"ai:{user_id}", "assistant_ask", window_start)
    used = doc["count"] if doc else 0
    return max(0, daily_limit - used)

async def get_user_ai_limit(user_id: str) -> tuple:
    """Get daily limit and premium status for user."""
    user_doc = await queries.get_user(user_id)
    is_premium = user_doc.get("is_premium", False) if user_doc else False
    daily_limit = AI_DAILY_LIMIT_PREMIUM if is_premium else AI_DAILY_LIMIT_FREE
    return daily_limit, is_premium

# --- AI Assistant: Navigation Detection ---

SCREEN_MAP = {
    "groups": {"screen": "Groups", "params": {}},
    "wallet": {"screen": "Wallet", "params": {}},
    "settings": {"screen": "Settings", "params": {}},
    "premium": {"screen": "Billing", "params": {}},
    "billing": {"screen": "Billing", "params": {}},
    "notifications": {"screen": "Notifications", "params": {}},
    "profile": {"screen": "Settings", "params": {}},
    "automations": {"screen": "Automations", "params": {}},
    "history": {"screen": "SettlementHistory", "params": {}},
}

NAV_TRIGGERS = {
    "groups": ["go to groups", "my groups", "see groups", "manage groups", "create a group", "show groups", "open groups"],
    "wallet": ["go to wallet", "my wallet", "check wallet", "wallet balance", "open wallet"],
    "settings": ["go to settings", "open settings", "my settings", "my profile"],
    "premium": ["upgrade", "go premium", "go pro", "billing", "subscription"],
    "automations": ["automations", "my automations"],
    "history": ["game history", "past games", "settlement history"],
    "notifications": ["my notifications", "check notifications"],
}

def detect_navigation(user_input: str, ai_response: str):
    """Detect if the response implies navigation to a screen."""
    combined = (user_input + " " + (ai_response or "")).lower()
    for key, triggers in NAV_TRIGGERS.items():
        for trigger in triggers:
            if trigger in combined:
                return SCREEN_MAP.get(key)
    return None

# --- AI Assistant: Content Guardrails ---

def validate_ai_input(message: str) -> str | None:
    """Validate user input. Returns error message if invalid, None if ok."""
    if not message or not message.strip():
        return "Please enter a message."
    if len(message) > 1000:
        return "Message too long. Please keep it under 1000 characters."
    return None

# --- AI Assistant: Follow-up Extraction ---

def extract_follow_ups(text: str) -> tuple:
    """Extract follow-up suggestions from LLM response text.
    Returns (cleaned_text, follow_ups_list)."""
    import re as _re
    match = _re.search(r'---FOLLOW_UPS---\s*(\[.*?\])\s*---END_FOLLOW_UPS---', text, _re.DOTALL)
    if match:
        try:
            follow_ups = json.loads(match.group(1))
            cleaned = text[:match.start()].rstrip()
            return cleaned, follow_ups[:3]
        except (json.JSONDecodeError, ValueError):
            pass
    return text, []


async def fetch_user_context_summary(user_id: str) -> Dict:
    """Fetch lightweight user data summary for LLM context (Tier 2 calls only)."""
    ctx = {}
    try:
        # Profile
        user_doc = await queries.get_user(user_id)
        if user_doc:
            ctx["profile"] = {
                "name": user_doc.get("name", "Unknown"),
                "level": user_doc.get("level", "Rookie"),
                "total_games": user_doc.get("total_games", 0),
                "total_profit": user_doc.get("total_profit", 0.0),
                "badges_count": len(user_doc.get("badges", [])),
            }

        # Groups
        memberships = await queries.generic_find("group_members", {"user_id": user_id})
        group_ids = [m["group_id"] for m in memberships]
        if group_ids:
            groups = await queries.fetch_raw(
                "SELECT group_id, name FROM groups WHERE group_id = ANY($1)",
                group_ids
            )
            ctx["groups"] = [
                {"name": g.get("name", "Unnamed"), "role": next((m.get("role", "member") for m in memberships if m["group_id"] == g["group_id"]), "member")}
                for g in groups
            ]

        # Active games count
        if group_ids:
            active_rows = await queries.fetch_raw(
                "SELECT COUNT(*) AS cnt FROM game_nights WHERE group_id = ANY($1) AND status = 'active'",
                group_ids
            )
            ctx["active_games_count"] = active_rows[0]["cnt"] if active_rows else 0

        # Pending settlements
        owed_to = await queries.fetch_raw(
            "SELECT amount FROM ledger_entries WHERE to_user_id = $1 AND status != 'paid'",
            user_id
        )
        owes = await queries.fetch_raw(
            "SELECT amount FROM ledger_entries WHERE from_user_id = $1 AND status != 'paid'",
            user_id
        )
        ctx["settlements"] = {
            "owed_to_you": round(sum(e.get("amount", 0) for e in owed_to), 2),
            "you_owe": round(sum(e.get("amount", 0) for e in owes), 2),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch user context for assistant: {e}")
    return ctx


# --- AI Assistant: Endpoints ---

@api_router.get("/assistant/usage")
async def get_assistant_usage(user: User = Depends(get_current_user)):
    """Get AI assistant usage for current period."""
    daily_limit, is_premium = await get_user_ai_limit(user.user_id)
    remaining = await get_ai_requests_remaining(user.user_id, daily_limit)
    return {
        "requests_used": daily_limit - remaining,
        "requests_remaining": remaining,
        "daily_limit": daily_limit,
        "is_premium": is_premium
    }

@api_router.post("/assistant/ask")
async def ask_assistant(data: AskAssistantRequest, user: User = Depends(get_current_user)):
    """Ask the AI assistant a question (BETA - powered by tiered Kvitt Brain)."""
    from ai_assistant import get_quick_answer

    # Step 1: Validate input
    validation_error = validate_ai_input(data.message)
    if validation_error:
        return {"response": validation_error, "source": "guardrail", "requests_remaining": None}

    # Step 2: Check rate limit (checked early, but Tier 0 won't consume a request)
    daily_limit, is_premium = await get_user_ai_limit(user.user_id)

    # Step 3: Cap conversation history
    history = (data.conversation_history or [])[-20:]

    # Step 4: Quick answer fast path (no API call needed)
    quick = get_quick_answer(data.message)
    if quick:
        remaining = await get_ai_requests_remaining(user.user_id, daily_limit)
        resp = {
            "response": quick["text"],
            "source": "quick_answer",
            "requests_remaining": remaining,
        }
        if quick.get("follow_ups"):
            resp["follow_ups"] = quick["follow_ups"]
        if quick.get("navigation"):
            resp["navigation"] = quick["navigation"]
        return resp

    # Step 4.5: Flow continuation — if flow_event present, advance the flow
    if data.flow_event:
        try:
            from ai_service.flows import get_flow
            import ai_service.flows.issue_report_flow  # noqa: F401

            fe = data.flow_event
            flow = get_flow(fe.get("flow_id", ""))
            if flow:
                result = await flow.advance(
                    step=fe.get("step", 0),
                    action=fe.get("action", ""),
                    value=fe.get("value", ""),
                    flow_data=fe.get("flow_data", {}),
                    user_id=user.user_id,
                    interaction_id=fe.get("interaction_id", ""),
                )
                remaining = await get_ai_requests_remaining(user.user_id, daily_limit)
                resp = {
                    "response": result.text,
                    "source": result.source,
                    "requests_remaining": remaining,
                }
                if result.structured_content:
                    resp["structured_content"] = result.structured_content
                if result.follow_ups:
                    resp["follow_ups"] = result.follow_ups

                try:
                    await queries.insert_assistant_event({
                        "user_id": user.user_id,
                        "message": data.message or f"[flow:{fe.get('flow_id')}:step:{fe.get('step')}]",
                        "intent": f"flow_{fe.get('flow_id')}",
                        "confidence": 1.0,
                        "tier": "flow",
                        "timestamp": datetime.now(timezone.utc),
                    })
                except Exception:
                    pass

                return resp
        except Exception as e:
            logger.warning(f"Flow advance error: {e}")
            # Fall through to normal processing

    # Step 5: IntentRouter — local classification (no LLM)
    try:
        from ai_service.intent_router import IntentRouter
        from ai_service.fast_answer_engine import FastAnswerEngine

        router = IntentRouter()
        intent_result = router.classify(data.message, context=data.context, history=history)

        # Step 6: Tier 0 — Fast answer from DB (free, no rate limit consumed)
        if intent_result.confidence >= 0.75 and not intent_result.requires_llm:
            engine = FastAnswerEngine()
            answer = await engine.answer(intent_result, user_id=user.user_id)
            remaining = await get_ai_requests_remaining(user.user_id, daily_limit)

            # Detect navigation intent
            navigation = answer.navigation or detect_navigation(data.message, answer.text)

            resp = {
                "response": answer.text,
                "source": answer.source if answer.source != "fast_answer" else "fast_answer",
                "follow_ups": answer.follow_ups,
                "requests_remaining": remaining,
            }
            if navigation:
                resp["navigation"] = navigation
            if answer.structured_content:
                resp["structured_content"] = answer.structured_content

            # Log for analytics (non-blocking)
            try:
                await queries.insert_assistant_event({
                    "user_id": user.user_id,
                    "message": data.message,
                    "intent": intent_result.intent,
                    "confidence": intent_result.confidence,
                    "tier": "fast_answer",
                    "follow_ups_shown": answer.follow_ups,
                    "timestamp": datetime.now(timezone.utc),
                })
            except Exception:
                pass

            return resp
    except Exception as e:
        logger.warning(f"IntentRouter/FastAnswer error: {e}")
        # Fall through to Tier 2

    # Step 7: Tier 2 — Route through orchestrator (consumes rate limit)
    allowed = await check_ai_rate_limit(user.user_id, daily_limit)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Daily AI request limit reached",
                "limit": daily_limit,
                "requests_remaining": 0,
                "is_premium": is_premium,
                "upgrade_message": "You've reached your daily limit. Upgrade to Premium for 50 requests/day!" if not is_premium else "Daily limit reached. Resets in 24 hours."
            }
        )

    try:
        orchestrator = get_orchestrator()
        if orchestrator:
            context = data.context or {}
            context["user_id"] = user.user_id
            context["is_beta"] = True
            context["conversation_history"] = history

            # Fetch user data for LLM context
            user_data = await fetch_user_context_summary(user.user_id)
            context["user_data"] = user_data

            result = await orchestrator.process(
                user_input=data.message,
                context=context,
                user_id=user.user_id
            )

            response_text = result.get("message") or result.get("data") or "I couldn't process that request. Try asking differently."
            if isinstance(response_text, dict):
                response_text = str(response_text)

            # Extract follow-ups from LLM response
            response_text, follow_ups = extract_follow_ups(response_text)

            # Detect navigation intent
            navigation = detect_navigation(data.message, response_text)
            remaining = await get_ai_requests_remaining(user.user_id, daily_limit)

            resp = {
                "response": response_text,
                "source": "orchestrator",
                "requests_remaining": remaining,
            }
            if follow_ups:
                resp["follow_ups"] = follow_ups
            if navigation:
                resp["navigation"] = navigation

            # Log for analytics (non-blocking)
            try:
                await queries.insert_assistant_event({
                    "user_id": user.user_id,
                    "message": data.message,
                    "intent": "orchestrator",
                    "confidence": 0.0,
                    "tier": "orchestrator",
                    "follow_ups_shown": follow_ups,
                    "timestamp": datetime.now(timezone.utc),
                })
            except Exception:
                pass

            return resp
        else:
            raise Exception("Orchestrator not available")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Orchestrator error in assistant: {e}")
        # Fallback to simple AI
        try:
            from ai_assistant import get_ai_response
            session_id = f"kvitt_{user.user_id}"
            ctx = data.context or {}
            ctx["user_role"] = "user"
            # Inject user data into fallback context too
            try:
                user_data = await fetch_user_context_summary(user.user_id)
                ctx["user_data"] = user_data
            except Exception:
                pass
            fallback_response = await get_ai_response(data.message, session_id, ctx)
            remaining = await get_ai_requests_remaining(user.user_id, daily_limit)
            navigation = detect_navigation(data.message, fallback_response)
            resp = {
                "response": fallback_response,
                "source": "ai_fallback",
                "requests_remaining": remaining
            }
            if navigation:
                resp["navigation"] = navigation
            return resp
        except Exception as fallback_err:
            logger.error(f"AI fallback error: {fallback_err}")
            return {
                "response": "Sorry, I'm having trouble right now. Please try again later.",
                "source": "error",
                "requests_remaining": None
            }

# Poker routes moved to routers/poker.py


# Host persona routes moved to routers/host.py


# Smart defaults and frequent players endpoints moved to routers/groups.py

# Wallet endpoints moved to routers/wallet.py


# Push notification helpers moved to push_service.py
# (send_push_notification_to_user, send_push_to_users imported at top)

@api_router.post("/users/push-token")
async def register_push_token(
    data: RegisterPushTokenRequest,
    user: User = Depends(get_current_user)
):
    """Register or update the Expo push notification token for the current user."""
    token = data.expo_push_token.strip()

    # Accept ExponentPushToken or fcm/apns raw tokens from Expo
    if not (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")):
        raise HTTPException(status_code=400, detail="Invalid Expo push token format")

    await queries.update_user_push_token(user.user_id, token)
    return {"success": True, "message": "Push token registered"}


@api_router.delete("/users/push-token")
async def unregister_push_token(user: User = Depends(get_current_user)):
    """Remove push token (on logout)."""
    await queries.clear_user_push_token(user.user_id)
    return {"success": True}

@api_router.get("/ledger/balances")
async def get_balances(user: User = Depends(get_current_user)):
    """Get overall balance summary (who owes/is owed)."""
    # Amounts user owes
    owes = await queries.find_ledger_entries({'from_user_id': user.user_id, "status": "pending"}, limit=100)
    
    # Amounts owed to user
    owed = await queries.find_ledger_entries({'to_user_id': user.user_id, "status": "pending"}, limit=100)
    
    total_owes = sum(e["amount"] for e in owes)
    total_owed = sum(e["amount"] for e in owed)
    
    # Add user info to entries
    for entry in owes:
        to_user = await queries.get_user(entry["to_user_id"])
        entry["to_user"] = to_user
    
    for entry in owed:
        from_user = await queries.get_user(entry["from_user_id"])
        entry["from_user"] = from_user
    
    return {
        "total_owes": round(total_owes, 2),
        "total_owed": round(total_owed, 2),
        # Aliases for mobile compatibility
        "you_owe": round(total_owes, 2),
        "owed_to_you": round(total_owed, 2),
        "net_balance": round(total_owed - total_owes, 2),
        "owes": owes,
        "owed": owed
    }


@api_router.get("/ledger/consolidated")
async def get_consolidated_balances(user: User = Depends(get_current_user)):
    """
    Get consolidated balances - debts grouped by person across ALL games.

    This endpoint consolidates multiple game debts between the same two players
    into a single net balance, reducing transaction complexity.

    Example: If you owe John $20 from Game A and John owes you $15 from Game B,
    the consolidated view shows: You owe John $5 (net).
    """
    # Get all pending ledger entries involving this user
    all_entries = await queries.find_ledger_entries_by_user(user.user_id, status="pending")

    # Consolidate by person
    person_balances = {}  # other_user_id -> net_amount (positive = they owe you)

    for entry in all_entries:
        if entry["from_user_id"] == user.user_id:
            # You owe them
            other_user = entry["to_user_id"]
            person_balances[other_user] = person_balances.get(other_user, 0) - entry["amount"]
        else:
            # They owe you
            other_user = entry["from_user_id"]
            person_balances[other_user] = person_balances.get(other_user, 0) + entry["amount"]

    # Build response with user info
    consolidated = []
    for other_user_id, net_amount in person_balances.items():
        if abs(net_amount) < 0.01:
            continue  # Skip settled balances

        other_user = await queries.get_user(other_user_id)

        consolidated.append({
            "user": other_user,
            "net_amount": round(net_amount, 2),
            "direction": "owed_to_you" if net_amount > 0 else "you_owe",
            "display_amount": round(abs(net_amount), 2)
        })

    # Sort by absolute amount (largest debts first)
    consolidated.sort(key=lambda x: -x["display_amount"])

    # Calculate totals
    total_you_owe = sum(-b["net_amount"] for b in consolidated if b["net_amount"] < 0)
    total_owed_to_you = sum(b["net_amount"] for b in consolidated if b["net_amount"] > 0)

    return {
        "consolidated": consolidated,
        "total_you_owe": round(total_you_owe, 2),
        "total_owed_to_you": round(total_owed_to_you, 2),
        "net_balance": round(total_owed_to_you - total_you_owe, 2),
        "people_count": len(consolidated)
    }


@api_router.get("/ledger/consolidated-detailed")
async def get_consolidated_balances_detailed(user: User = Depends(get_current_user)):
    """
    Enhanced consolidated balances with per-game breakdown.
    Read-only computation — no mutations. Groups all pending ledger entries
    by (other_user, game_id) and computes netting explanation.
    """
    all_entries = await queries.find_ledger_entries_by_user(user.user_id, status="pending")

    # Group entries by (other_person, game_id)
    person_games = {}  # other_user_id -> {game_id -> {"entries": [], "net": 0}}

    for entry in all_entries:
        if entry["from_user_id"] == user.user_id:
            other_user = entry["to_user_id"]
            amount = -entry["amount"]  # negative = you owe
        else:
            other_user = entry["from_user_id"]
            amount = entry["amount"]  # positive = owed to you

        if other_user not in person_games:
            person_games[other_user] = {}

        game_id = entry.get("game_id", "unknown")
        if game_id not in person_games[other_user]:
            person_games[other_user][game_id] = {"entries": [], "net": 0}
        person_games[other_user][game_id]["entries"].append(entry)
        person_games[other_user][game_id]["net"] += amount

    # Build response with user info and game details
    consolidated = []
    for other_user_id, games in person_games.items():
        total_net = sum(g["net"] for g in games.values())

        if abs(total_net) < 0.01:
            continue  # Settled — skip

        other_user = await queries.get_user(other_user_id)

        # Fetch game details for each game
        game_breakdown = []
        for game_id, game_data in games.items():
            game_info = await queries.get_game_night(game_id)
            game_breakdown.append({
                "game_id": game_id,
                "game_title": game_info.get("title", "Game Night") if game_info else "Game",
                "game_date": game_info.get("ended_at") if game_info else None,
                "amount": round(abs(game_data["net"]), 2),
                "direction": "owed_to_you" if game_data["net"] > 0 else "you_owe",
                "ledger_ids": [e["ledger_id"] for e in game_data["entries"]]
            })

        # Sort game breakdown by date (newest first)
        game_breakdown.sort(key=lambda g: g.get("game_date") or "", reverse=True)

        # Compute offset explanation (only when debts flow both ways)
        you_owe_games = [g for g in game_breakdown if g["direction"] == "you_owe"]
        they_owe_games = [g for g in game_breakdown if g["direction"] == "owed_to_you"]

        offset_explanation = None
        if you_owe_games and they_owe_games:
            gross_you_owe = sum(g["amount"] for g in you_owe_games)
            gross_they_owe = sum(g["amount"] for g in they_owe_games)
            offset_amount = min(gross_you_owe, gross_they_owe)
            offset_explanation = {
                "offset_amount": round(offset_amount, 2),
                "gross_you_owe": round(gross_you_owe, 2),
                "gross_they_owe": round(gross_they_owe, 2)
            }

        # Collect all ledger_ids across games for this person
        all_ledger_ids = []
        for g in game_breakdown:
            all_ledger_ids.extend(g["ledger_ids"])

        consolidated.append({
            "user": other_user,
            "net_amount": round(total_net, 2),
            "direction": "owed_to_you" if total_net > 0 else "you_owe",
            "display_amount": round(abs(total_net), 2),
            "game_count": len(games),
            "game_breakdown": game_breakdown,
            "offset_explanation": offset_explanation,
            "all_ledger_ids": all_ledger_ids
        })

    consolidated.sort(key=lambda x: -x["display_amount"])

    total_you_owe = sum(-b["net_amount"] for b in consolidated if b["net_amount"] < 0)
    total_owed_to_you = sum(b["net_amount"] for b in consolidated if b["net_amount"] > 0)

    return {
        "consolidated": consolidated,
        "total_you_owe": round(total_you_owe, 2),
        "total_owed_to_you": round(total_owed_to_you, 2),
        "net_balance": round(total_owed_to_you - total_you_owe, 2),
        "people_count": len(consolidated)
    }


@api_router.post("/ledger/optimize")
async def optimize_ledger(user: User = Depends(get_current_user)):
    """
    Optimize ledger entries by consolidating cross-game debts between same players.

    This creates new consolidated entries and marks old ones as consolidated.
    Only processes entries where the current user is involved.
    """
    # Get all pending entries for this user
    all_entries = await queries.find_ledger_entries_by_user(user.user_id, status="pending")

    if len(all_entries) <= 1:
        return {"message": "No optimization needed", "optimized": 0}

    # Group by person and calculate net
    person_entries = {}  # other_user_id -> list of ledger_ids
    person_net = {}  # other_user_id -> net_amount

    for entry in all_entries:
        if entry["from_user_id"] == user.user_id:
            other_user = entry["to_user_id"]
            if other_user not in person_entries:
                person_entries[other_user] = []
                person_net[other_user] = 0
            person_entries[other_user].append(entry["ledger_id"])
            person_net[other_user] -= entry["amount"]
        else:
            other_user = entry["from_user_id"]
            if other_user not in person_entries:
                person_entries[other_user] = []
                person_net[other_user] = 0
            person_entries[other_user].append(entry["ledger_id"])
            person_net[other_user] += entry["amount"]

    optimized_count = 0

    for other_user_id, entry_ids in person_entries.items():
        if len(entry_ids) <= 1:
            continue  # Nothing to consolidate

        net = person_net[other_user_id]
        if abs(net) < 0.01:
            # They cancel out - mark all as paid
            await queries.update_ledger_entries_by_ids(entry_ids, {"status": "consolidated", "consolidated_at": datetime.now(timezone.utc)})
            optimized_count += len(entry_ids)
        else:
            # Create one consolidated entry
            from_user = user.user_id if net < 0 else other_user_id
            to_user = other_user_id if net < 0 else user.user_id

            # Mark old entries as consolidated
            await queries.update_ledger_entries_by_ids(entry_ids, {"status": "consolidated", "consolidated_at": datetime.now(timezone.utc)})

            # Create new consolidated entry
            new_entry = LedgerEntry(
                group_id="consolidated",
                game_id="consolidated",
                from_user_id=from_user,
                to_user_id=to_user,
                amount=round(abs(net), 2),
                notes=f"Consolidated from {len(entry_ids)} entries"
            )
            entry_dict = new_entry.model_dump()
            await queries.insert_ledger_entry(entry_dict)

            optimized_count += len(entry_ids)

    return {
        "message": "Ledger optimized",
        "optimized": optimized_count,
        "entries_consolidated": optimized_count
    }


# ============== STRIPE PAYMENT ENDPOINTS ==============

class StripeCheckoutRequest(BaseModel):
    plan_id: str
    origin_url: str

@api_router.get("/premium/plans")
async def get_premium_plans():
    """Get available premium plans"""
    from stripe_service import PREMIUM_PLANS
    return {"plans": list(PREMIUM_PLANS.values())}

@api_router.post("/premium/checkout")
async def create_premium_checkout(data: StripeCheckoutRequest, user: User = Depends(get_current_user)):
    """Create Stripe checkout session for premium upgrade"""
    from stripe_service import create_stripe_checkout
    
    # Get user email
    user_doc = await queries.get_user(user.user_id)
    user_email = user_doc.get("email", "") if user_doc else ""
    
    result = await create_stripe_checkout(
        plan_id=data.plan_id,
        origin_url=data.origin_url,
        user_id=user.user_id,
        user_email=user_email,
    )
    
    return result

@api_router.get("/premium/status/{session_id}")
async def get_premium_payment_status(session_id: str):
    """Check payment status for a checkout session"""
    from stripe_service import check_payment_status
    return await check_payment_status(session_id)

@api_router.get("/premium/me")
async def get_my_premium_status(user: User = Depends(get_current_user)):
    """Get current user's premium status"""
    user_doc = await queries.get_user(user.user_id)
    
    if not user_doc:
        return {"is_premium": False}
    
    return {
        "is_premium": user_doc.get("is_premium", False),
        "plan": user_doc.get("premium_plan"),
        "until": user_doc.get("premium_until")
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    from stripe_service import handle_stripe_webhook
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    
    result = await handle_stripe_webhook(body, signature)
    return result


# ============== DEBT SETTLEMENT PAYMENTS ==============

@api_router.post("/settlements/{ledger_id}/pay")
async def create_debt_payment(ledger_id: str, data: dict, user: User = Depends(get_current_user)):
    """Create a Stripe payment link for settling a debt"""
    from stripe_service import create_debt_payment_link
    
    # Get ledger entry
    entry = await queries.get_ledger_entry(ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    
    # Verify the current user is the one who owes money
    if entry["from_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the debtor can initiate payment")
    
    # Check if already paid
    if entry.get("status") == "paid":
        raise HTTPException(status_code=400, detail="This debt has already been paid")
    
    # Get recipient info
    to_user = await queries.get_user(entry["to_user_id"])
    
    origin_url = data.get("origin_url", "")
    if not origin_url:
        raise HTTPException(status_code=400, detail="origin_url required")
    
    result = await create_debt_payment_link(
        ledger_id=ledger_id,
        from_user_id=user.user_id,
        from_user_email=user.email,
        to_user_id=entry["to_user_id"],
        to_user_name=to_user.get("name", "Unknown"),
        amount=entry["amount"],
        game_id=entry["game_id"],
        origin_url=origin_url,
    )
    
    return result


# ============== PAY NET FLOW (2-PHASE COMMIT) ==============

@api_router.post("/ledger/pay-net/prepare")
async def prepare_pay_net(data: dict, user: User = Depends(get_current_user)):
    """
    Prepare a net payment across multiple ledger entries. Creates a plan
    and Stripe session but does NOT mutate any ledger entries.
    Mutations only happen after Stripe webhook confirms success.
    """
    from stripe_service import create_debt_payment_link

    other_user_id = data.get("other_user_id")
    ledger_ids = data.get("ledger_ids", [])
    origin_url = data.get("origin_url", "")

    if not other_user_id or not ledger_ids or not origin_url:
        raise HTTPException(status_code=400, detail="other_user_id, ledger_ids, and origin_url required")

    # Validate all ledger entries
    entries = await queries.find_ledger_entries({"status": "pending"}, limit=100)
    entries = [e for e in entries if e.get("ledger_id") in ledger_ids]

    if len(entries) != len(ledger_ids):
        raise HTTPException(status_code=400, detail="Some ledger entries not found or already paid")

    # Compute net: only entries where current user owes other_user
    net_cents = 0
    valid_ids = []
    for e in entries:
        if e["from_user_id"] == user.user_id and e["to_user_id"] == other_user_id:
            net_cents += round(e["amount"] * 100)
            valid_ids.append(e["ledger_id"])
        elif e["to_user_id"] == user.user_id and e["from_user_id"] == other_user_id:
            net_cents -= round(e["amount"] * 100)
            valid_ids.append(e["ledger_id"])

    if net_cents <= 0:
        raise HTTPException(status_code=400, detail="Net amount must be positive (you must owe)")

    # Get payee info
    payee = await queries.get_user(other_user_id)
    payee_name = payee.get("name", "Unknown") if payee else "Unknown"

    amount_dollars = round(net_cents / 100, 2)

    # Build breakdown for display
    breakdown = []
    for e in entries:
        game_info = await queries.get_game_night(e.get("game_id", ""))
        direction = "you_owe" if e["from_user_id"] == user.user_id else "owed_to_you"
        breakdown.append({
            "game_title": game_info.get("title", "Game") if game_info else "Game",
            "amount": e["amount"],
            "direction": direction
        })

    # Create plan record (no mutation yet)
    plan_id = f"pnp_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    plan = {
        "plan_id": plan_id,
        "payer_id": user.user_id,
        "payee_id": other_user_id,
        "amount_cents": net_cents,
        "ledger_ids": valid_ids,
        "breakdown": breakdown,
        "status": "pending",
        "stripe_session_id": None,
        "created_at": now,
        "expires_at": now + timedelta(minutes=30),
        "completed_at": None
    }

    # Create Stripe checkout session
    import stripe
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment service not configured")

    stripe.api_key = api_key

    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': 'usd',
                'product_data': {
                    'name': f'Net payment to {payee_name}',
                    'description': f'Consolidated settlement across {len(entries)} game(s)',
                },
                'unit_amount': net_cents,
            },
            'quantity': 1,
        }],
        mode='payment',
        success_url=f"{origin_url}/profile?payment=success&plan_id={plan_id}",
        cancel_url=f"{origin_url}/profile?payment=cancelled",
        customer_email=user.email,
        metadata={
            "type": "pay_net",
            "plan_id": plan_id,
            "payer_id": user.user_id,
            "payee_id": other_user_id,
            "amount_cents": str(net_cents)
        }
    )

    plan["stripe_session_id"] = session.id
    await queries.generic_insert("pay_net_plans", plan)

    logger.info(f"Pay-net plan {plan_id} created: {user.user_id} → {other_user_id}, ${amount_dollars}")

    return {
        "plan_id": plan_id,
        "checkout_url": session.url,
        "amount_cents": net_cents,
        "amount": amount_dollars,
        "payee_name": payee_name,
        "breakdown": breakdown
    }


@api_router.get("/ledger/pay-net/status")
async def get_pay_net_status(plan_id: str, user: User = Depends(get_current_user)):
    """Check status of a pay-net plan."""
    plan = await queries.generic_find_one("pay_net_plans", {"plan_id": plan_id, "payer_id": user.user_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Check expiry
    if plan["status"] == "pending":
        expires_at = datetime.fromisoformat(plan["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            await queries.generic_update("pay_net_plans", {"plan_id": plan_id}, {"status": "expired"})
            return {"status": "expired"}

    return {"status": plan["status"]}


@api_router.post("/webhook/stripe-debt")
async def stripe_debt_webhook(request: Request):
    """Handle Stripe webhook events for debt payments"""
    from stripe_service import handle_debt_payment_webhook

    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    result = await handle_debt_payment_webhook(body, signature)
    return result


# Wallet webhook moved to routers/wallet.py
# Spotify routes moved to routers/spotify.py

# ============== ROOT ENDPOINT ==============

@api_router.get("/")
async def root():
    return {"message": "PokerNight API v1.0"}

@api_router.get("/debug/my-data")
async def debug_my_data(user: User = Depends(get_current_user)):
    """Debug endpoint to show all user data"""
    # Current memberships
    memberships = await queries.find_group_members_by_user(user.user_id, limit=100)

    membership_groups = []
    for m in memberships:
        group = await queries.get_group(m["group_id"])
        membership_groups.append({
            "group_id": m["group_id"],
            "group_name": group["name"] if group else "Unknown",
            "role": m["role"],
            "joined_at": m.get("joined_at")
        })

    # All games played
    players = await queries.find_players_by_user(user.user_id, limit=100)

    games_by_group = {}
    for p in players:
        game = await queries.get_game_night(p["game_id"])
        if game:
            group_id = game["group_id"]
            if group_id not in games_by_group:
                group = await queries.get_group(group_id)
                is_member = any(m["group_id"] == group_id for m in memberships)
                games_by_group[group_id] = {
                    "group_name": group["name"] if group else "Deleted Group",
                    "is_current_member": is_member,
                    "games": []
                }
            games_by_group[group_id]["games"].append({
                "game_id": p["game_id"],
                "net_result": p.get("net_result"),
                "status": game["status"]
            })

    return {
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "name": user.name
        },
        "current_memberships": len(memberships),
        "membership_details": membership_groups,
        "total_games_played": len(players),
        "groups_with_games": games_by_group
    }


# Subscriber routes moved to routers/subscribers.py


# Engagement routes moved to routers/engagement.py


# Feedback routes moved to routers/feedback.py

# Automation routes moved to routers/automations.py


# ============== SUPER ADMIN API ==============

from role_middleware import require_super_admin, get_admin_context, AdminContext, generate_alert_id, generate_incident_id
import platform_analytics

@api_router.get("/admin/overview")
async def admin_get_overview(
    range: str = Query("24h", regex="^(1h|24h|7d|30d)$"),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get platform-wide overview KPIs."""
    await ctx.audit("view_overview", {"range": range})
    return await platform_analytics.get_platform_overview(range)

@api_router.get("/admin/health/rollups")
async def admin_get_health_rollups(
    range: str = Query("24h", regex="^(1h|24h|7d|30d)$"),
    window: str = Query("5m", regex="^(1m|5m|1h|1d)$"),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get health rollups for charts."""
    await ctx.audit("view_health_rollups", {"range": range, "window": window})
    return await platform_analytics.get_health_rollups(range, window)

@api_router.get("/admin/health/metrics")
async def admin_get_health_metrics(
    range: str = Query("24h", regex="^(1h|24h|7d|30d)$"),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get computed health metrics (real-time)."""
    await ctx.audit("view_health_metrics", {"range": range})
    return await platform_analytics.compute_health_metrics(range)

@api_router.get("/admin/health/top-endpoints")
async def admin_get_top_endpoints(
    range: str = Query("24h", regex="^(1h|24h|7d|30d)$"),
    sort: str = Query("errors", regex="^(errors|latency)$"),
    limit: int = Query(10, ge=1, le=50),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get top endpoints by errors or latency."""
    await ctx.audit("view_top_endpoints", {"range": range, "sort": sort})
    if sort == "errors":
        return await platform_analytics.get_top_endpoints_by_errors(range, limit)
    else:
        return await platform_analytics.get_top_endpoints_by_latency(range, limit)

@api_router.get("/admin/crashes")
async def admin_get_crashes(
    range: str = Query("7d", regex="^(1h|24h|7d|30d)$"),
    platform: Optional[str] = None,
    app_version: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get crash fingerprints."""
    await ctx.audit("view_crashes", {"range": range, "platform": platform})
    return await platform_analytics.get_crash_fingerprints(range, platform, app_version, limit)

@api_router.get("/admin/security/overview")
async def admin_get_security_overview(
    range: str = Query("24h", regex="^(1h|24h|7d|30d)$"),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get security events overview."""
    await ctx.audit("view_security_overview", {"range": range})
    return await platform_analytics.get_security_overview(range)

@api_router.get("/admin/users/metrics")
async def admin_get_user_metrics(
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get DAU/WAU/MAU metrics."""
    await ctx.audit("view_user_metrics", {})
    return await platform_analytics.get_dau_wau_mau()

@api_router.get("/admin/funnel")
async def admin_get_funnel(
    range: str = Query("7d", regex="^(1h|24h|7d|30d)$"),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get funnel conversion stats."""
    await ctx.audit("view_funnel", {"range": range})
    return await platform_analytics.get_funnel_stats(range)

@api_router.get("/admin/users")
async def admin_list_users(
    search: Optional[str] = None,
    app_role: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    ctx: AdminContext = Depends(get_admin_context)
):
    """List users with optional filters."""
    await ctx.audit("list_users", {"search": search, "app_role": app_role})
    return await platform_analytics.get_user_list(search, app_role, limit, offset)

class UpdateUserRoleRequest(BaseModel):
    app_role: str = Field(..., pattern="^(user|super_admin)$")

@api_router.put("/admin/users/{user_id}/role")
async def admin_update_user_role(
    user_id: str,
    data: UpdateUserRoleRequest,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Update a user's app_role (Super Admin only)."""
    await ctx.audit("update_user_role", {"target_user_id": user_id, "new_role": data.app_role})
    
    from db.pg import get_pool
    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")
    
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE users SET app_role = $1 WHERE user_id = $2
        """, data.app_role, user_id)
        
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="User not found")
    
    logger.info(f"User {user_id} role updated to {data.app_role} by {ctx.user.user_id}")
    return {"success": True, "user_id": user_id, "app_role": data.app_role}

@api_router.get("/admin/alerts")
async def admin_list_alerts(
    status: Optional[str] = Query(None, regex="^(open|acknowledged|resolved)$"),
    severity: Optional[str] = Query(None, regex="^(P0|P1|P2)$"),
    category: Optional[str] = Query(None, regex="^(health|security|product|cost|report)$"),
    limit: int = Query(50, ge=1, le=200),
    ctx: AdminContext = Depends(get_admin_context)
):
    """List admin alerts."""
    await ctx.audit("list_alerts", {"status": status, "severity": severity})
    return await platform_analytics.get_alerts(status, severity, category, limit)

@api_router.post("/admin/alerts/{alert_id}/ack")
async def admin_ack_alert(
    alert_id: str,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Acknowledge an alert."""
    await ctx.audit("ack_alert", {"alert_id": alert_id})
    
    from db.pg import get_pool
    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")
    
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE admin_alerts 
            SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = NOW()
            WHERE alert_id = $2 AND status = 'open'
        """, ctx.user.user_id, alert_id)
        
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Alert not found or already acknowledged")
    
    return {"success": True, "alert_id": alert_id, "status": "acknowledged"}

@api_router.post("/admin/alerts/{alert_id}/resolve")
async def admin_resolve_alert(
    alert_id: str,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Resolve an alert."""
    await ctx.audit("resolve_alert", {"alert_id": alert_id})
    
    from db.pg import get_pool
    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")
    
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE admin_alerts 
            SET status = 'resolved', resolved_by = $1, resolved_at = NOW()
            WHERE alert_id = $2 AND status != 'resolved'
        """, ctx.user.user_id, alert_id)
        
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Alert not found or already resolved")
    
    return {"success": True, "alert_id": alert_id, "status": "resolved"}

@api_router.get("/admin/incidents")
async def admin_list_incidents(
    status: Optional[str] = Query(None, regex="^(open|mitigating|resolved)$"),
    limit: int = Query(20, ge=1, le=100),
    ctx: AdminContext = Depends(get_admin_context)
):
    """List incidents."""
    await ctx.audit("list_incidents", {"status": status})
    return await platform_analytics.get_incidents(status, limit)

@api_router.get("/admin/incidents/{incident_id}")
async def admin_get_incident(
    incident_id: str,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get incident with timeline."""
    await ctx.audit("view_incident", {"incident_id": incident_id})
    result = await platform_analytics.get_incident_with_timeline(incident_id)
    if not result:
        raise HTTPException(status_code=404, detail="Incident not found")
    return result

class IncidentTimelineRequest(BaseModel):
    event_type: str = Field(..., pattern="^(detected|updated|mitigated|resolved|postmortem)$")
    message: str

@api_router.post("/admin/incidents/{incident_id}/timeline")
async def admin_add_incident_timeline(
    incident_id: str,
    data: IncidentTimelineRequest,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Add event to incident timeline."""
    await ctx.audit("add_incident_timeline", {"incident_id": incident_id, "event_type": data.event_type})
    
    from db.pg import get_pool
    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not available")
    
    async with pool.acquire() as conn:
        # Get incident UUID
        incident = await conn.fetchrow("""
            SELECT id FROM incidents WHERE incident_id = $1
        """, incident_id)
        
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        # Add timeline event
        await conn.execute("""
            INSERT INTO incident_timeline_events 
            (incident_id, event_type, message, actor_user_id)
            VALUES ($1, $2, $3, $4)
        """, incident["id"], data.event_type, data.message, ctx.user.user_id)
        
        # Update incident status if resolving
        if data.event_type == "resolved":
            await conn.execute("""
                UPDATE incidents SET status = 'resolved', closed_at = NOW()
                WHERE incident_id = $1
            """, incident_id)
        elif data.event_type == "mitigated":
            await conn.execute("""
                UPDATE incidents SET status = 'mitigating'
                WHERE incident_id = $1
            """, incident_id)
    
    return {"success": True, "incident_id": incident_id, "event_type": data.event_type}

@api_router.get("/admin/reports/daily")
async def admin_get_daily_report(
    date: Optional[str] = None,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get daily ops report."""
    await ctx.audit("view_daily_report", {"date": date})
    
    from ops_agents.executive_summary import generate_daily_summary
    return await generate_daily_summary()


# NOTE: Specific routes (/stats, /{feedback_id}) must be registered BEFORE
# the generic list route (/admin/feedback) to avoid FastAPI route shadowing.

@api_router.get("/admin/feedback/stats")
async def admin_get_feedback_stats(
    days: int = 30,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get feedback statistics for admin dashboard."""
    await ctx.audit("view_feedback_stats", {"days": days})

    return await platform_analytics.get_feedback_stats(days=days)


@api_router.get("/admin/feedback/{feedback_id}")
async def admin_get_feedback_detail(
    feedback_id: str,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get a single feedback entry by ID."""
    await ctx.audit("view_feedback_detail", {"feedback_id": feedback_id})

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        async with pool.acquire() as conn:
            feedback = await conn.fetchrow(
                "SELECT * FROM feedback WHERE feedback_id = $1",
                feedback_id
            )
            if not feedback:
                raise HTTPException(status_code=404, detail="Feedback not found")

            result = dict(feedback)

            # Get user info
            if result.get("user_id"):
                user = await conn.fetchrow(
                    "SELECT name, email FROM users WHERE user_id = $1",
                    result["user_id"]
                )
                if user:
                    result["user_name"] = user["name"] or user["email"]
                    result["user_email"] = user["email"]

            # Get group name if applicable
            if result.get("group_id"):
                group = await conn.fetchrow(
                    "SELECT name FROM groups WHERE group_id = $1",
                    result["group_id"]
                )
                if group:
                    result["group_name"] = group["name"]

            result = {k: _feedback_json_safe(v) for k, v in result.items()}
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching feedback detail {feedback_id}")
        raise HTTPException(status_code=500, detail=f"Error loading report: {str(e)}")


@api_router.get("/admin/feedback")
async def admin_get_feedback(
    feedback_type: Optional[str] = None,
    status: Optional[str] = None,
    days: int = 30,
    limit: int = 50,
    offset: int = 0,
    ctx: AdminContext = Depends(get_admin_context)
):
    """
    Get all user feedback/reports for admin dashboard.
    Returns feedback entries (bugs, complaints, feature requests, etc.) with optional filters.
    """
    await ctx.audit("view_feedback", {
        "feedback_type": feedback_type,
        "status": status,
        "days": days
    })

    return await platform_analytics.get_admin_feedback(
        feedback_type=feedback_type,
        status=status,
        days=days,
        limit=limit,
        offset=offset
    )


# --- Admin Feedback Response & Thread Endpoints ---


def _feedback_json_safe(val):
    """Convert asyncpg types to JSON-serializable values. Handles nested structures."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, bytes):
        try:
            return val.decode("utf-8")
        except Exception:
            return None
    if isinstance(val, dict):
        return {k: _feedback_json_safe(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_feedback_json_safe(v) for v in val]
    if isinstance(val, (str, int, float, bool)):
        return val
    try:
        return str(val)
    except Exception:
        return None


# Allowed status transitions for admin respond endpoint
_ADMIN_RESPOND_TRANSITIONS = {
    "new": {"in_progress", "needs_user_info", "resolved", "wont_fix"},
    "open": {"in_progress", "needs_user_info", "resolved", "wont_fix"},
    "classified": {"in_progress", "needs_user_info", "resolved", "wont_fix"},
    "in_progress": {"needs_user_info", "resolved", "wont_fix"},
    "needs_user_info": {"in_progress", "resolved", "wont_fix"},
    "needs_host_action": {"in_progress", "resolved", "wont_fix"},
    "resolved": {"in_progress"},  # reopen only
}


class AdminFeedbackResponse(BaseModel):
    message: str
    new_status: Optional[str] = None
    idempotency_key: Optional[str] = None


# UserFeedbackReply model and feedback thread/reply routes moved to routers/feedback.py

@api_router.post("/admin/feedback/{feedback_id}/respond")
async def admin_respond_to_feedback(
    feedback_id: str,
    data: AdminFeedbackResponse,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Admin responds to a user report. Persists event + optional status change, then best-effort notifications."""
    await ctx.audit("respond_to_feedback", {"feedback_id": feedback_id, "new_status": data.new_status})

    # 1. Validate message
    message = (data.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty or whitespace-only")
    if len(message) > 5000:
        raise HTTPException(status_code=400, detail="Message exceeds 5000 character limit")

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available")

    # 2. Fetch feedback
    async with pool.acquire() as conn:
        feedback = await conn.fetchrow(
            "SELECT feedback_id, user_id, status, type FROM feedback WHERE feedback_id = $1",
            feedback_id
        )
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    current_status = feedback["status"] or "open"

    # 3. Validate status transition
    if data.new_status:
        allowed = _ADMIN_RESPOND_TRANSITIONS.get(current_status)
        if allowed is None or data.new_status not in allowed:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot transition from '{current_status}' to '{data.new_status}'"
            )

    # 4. Idempotency check
    if data.idempotency_key:
        async with pool.acquire() as conn:
            existing_events = await conn.fetchval(
                "SELECT events FROM feedback WHERE feedback_id = $1",
                feedback_id
            )
            if existing_events:
                import json as _json_mod2
                evts = existing_events if isinstance(existing_events, list) else _json_mod2.loads(existing_events) if isinstance(existing_events, str) else []
                for evt in evts:
                    details = evt.get("details", {})
                    if isinstance(details, dict) and details.get("idempotency_key") == data.idempotency_key:
                        return {
                            "success": True,
                            "feedback_id": feedback_id,
                            "new_status": data.new_status or current_status,
                            "notification": {"in_app": "skipped", "push": "skipped", "email": "skipped"},
                            "deduplicated": True
                        }

    # 5. Persist admin response event
    from ai_service.tools.feedback_collector import FeedbackCollectorTool
    collector = FeedbackCollectorTool()

    event_details = {"message": message}
    if data.idempotency_key:
        event_details["idempotency_key"] = data.idempotency_key

    result = await collector._add_event(
        feedback_id=feedback_id,
        event_type="admin_response",
        actor_id=ctx.user.user_id,
        details=event_details
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error or "Failed to add response event")

    # 6. Persist status change if requested
    final_status = current_status
    if data.new_status:
        status_result = await collector.execute(
            action="update_status",
            feedback_id=feedback_id,
            status=data.new_status,
            user_id=ctx.user.user_id,
        )
        if status_result.success:
            final_status = data.new_status

    # 7. Best-effort notifications (non-blocking)
    notification_result = {"in_app": "skipped", "push": "skipped", "email": "skipped"}
    reporter_user_id = feedback["user_id"]
    if reporter_user_id:
        try:
            from ai_service.tools.notification_sender import NotificationSenderTool
            notifier = NotificationSenderTool()
            notif_result = await notifier.execute(
                user_ids=[reporter_user_id],
                title="Update on your report",
                message=message[:200],
                notification_type="general",
                channels=["in_app", "push", "email"],
                data={"feedback_id": feedback_id, "type": "feedback_response"}
            )
            if notif_result.success:
                notification_result = {"in_app": "queued", "push": "queued", "email": "queued"}
        except Exception as e:
            logger.warning(f"Notification failed for feedback {feedback_id}: {e}")
            notification_result = {"in_app": "failed", "push": "failed", "email": "failed"}

    # 8. Real-time: notify admins viewing this feedback
    try:
        await emit_feedback_updated(feedback_id, {"type": "admin_response"})
    except Exception as e:
        logger.warning(f"emit_feedback_updated failed for {feedback_id}: {e}")

    return {
        "success": True,
        "feedback_id": feedback_id,
        "new_status": final_status,
        "notification": notification_result
    }


# ── Phase 3: AI Draft + Similar Reports endpoints ─────────────────────

# In-memory cache for AI drafts (feedback_id → {draft, ts})
_ai_draft_cache: Dict[str, Dict] = {}
_AI_DRAFT_CACHE_TTL = 300  # 5 minutes

# Template fallbacks (same as frontend DRAFT_TEMPLATES)
_DRAFT_FALLBACK_TEMPLATES = {
    "bug": "Thank you for reporting this bug. We've identified the issue and our team is working on a fix. We'll update you once it's resolved.",
    "complaint": "We appreciate you bringing this to our attention. We take your feedback seriously and are reviewing the situation. We'll follow up with next steps shortly.",
    "feature_request": "Thanks for the feature suggestion! We've logged this for our product team to review. We'll keep you updated on any progress.",
    "ux_issue": "Thank you for flagging this UX issue. We're looking into ways to improve this experience. Your feedback helps us make the app better.",
    "praise": "Thank you for the kind words! We're glad you're enjoying the experience. Your feedback motivates our team.",
    "other": "Thank you for reaching out. We've received your report and will review it. We'll get back to you if we need any additional information.",
}


@api_router.post("/admin/feedback/{feedback_id}/ai-draft")
async def generate_feedback_ai_draft(
    feedback_id: str,
    request: Request,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Generate an AI-powered draft reply for admin. Cached, non-blocking, advisory."""
    import time as _time

    try:
        # Check cache first
        cached = _ai_draft_cache.get(feedback_id)
        if cached and (_time.time() - cached["ts"]) < _AI_DRAFT_CACHE_TTL:
            return {"draft": cached["draft"], "model": cached.get("model"), "cached": True}

        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=503, detail="Database not available")

        # Fetch feedback
        async with pool.acquire() as conn:
            feedback = await conn.fetchrow(
                """SELECT feedback_id, type, content, status, classification,
                          user_id, events, auto_fix_attempted, auto_fix_result
                   FROM feedback WHERE feedback_id = $1""",
                feedback_id
            )
        if not feedback:
            raise HTTPException(status_code=404, detail="Feedback not found")

        feedback_type = feedback["type"] or "other"
        content = feedback["content"] or ""

        # Try Claude Haiku for contextual draft
        draft = None
        model_used = None
        try:
            from ai_service.claude_client import get_claude_client
            client = get_claude_client()
            if client.is_available:
                system_prompt = """You are an admin support assistant for ODDSIDE, a poker game app.
Draft a professional, empathetic admin response to this user report.
Rules:
- Be concise (2-4 sentences)
- Address the specific issue the user reported
- Don't make promises you can't keep
- If the issue is a bug, acknowledge it and mention investigation
- If it's a complaint, empathize and explain next steps
- If it's praise, thank them warmly
- Do NOT use markdown formatting
- Return ONLY the response text, nothing else"""

                user_msg = f"Report type: {feedback_type}\nStatus: {feedback['status']}\n\nUser's report:\n{content[:1500]}"
                if feedback["classification"]:
                    user_msg += f"\nClassification: {feedback['classification']}"

                model_used = "claude-haiku-4-5-20251001"
                response = await client.async_client.messages.create(
                    model=model_used,
                    max_tokens=300,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_msg}]
                )
                if response.content and len(response.content) > 0 and hasattr(response.content[0], "text"):
                    draft = (response.content[0].text or "").strip()
        except Exception as e:
            logger.warning(f"AI draft generation failed for {feedback_id}: {e}")

        # Fallback to template
        if not draft:
            draft = _DRAFT_FALLBACK_TEMPLATES.get(feedback_type, _DRAFT_FALLBACK_TEMPLATES["other"])
            model_used = None

        # Cache the result
        _ai_draft_cache[feedback_id] = {"draft": draft, "model": model_used, "ts": _time.time()}

        return {"draft": draft, "model": model_used, "cached": False}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error generating AI draft for {feedback_id}")
        raise HTTPException(status_code=500, detail=f"Error generating draft: {str(e)}")


@api_router.get("/admin/feedback/{feedback_id}/similar")
async def get_similar_feedback(
    feedback_id: str,
    request: Request,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Find similar/duplicate reports for the AI Assist panel."""
    try:
        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=503, detail="Database not available")

        # Fetch current feedback for matching criteria
        async with pool.acquire() as conn:
            feedback = await conn.fetchrow(
                "SELECT feedback_id, content_hash, type, classification FROM feedback WHERE feedback_id = $1",
                feedback_id
            )
        if not feedback:
            raise HTTPException(status_code=404, detail="Feedback not found")

        content_hash = feedback["content_hash"]
        feedback_type = feedback["type"]
        classification = feedback["classification"]

        # Find similar: exact hash match OR same type+classification within 90 days
        async with pool.acquire() as conn:
            if content_hash and classification:
                similar = await conn.fetch("""
                    SELECT feedback_id, type, status, LEFT(content, 200) as content_preview,
                           created_at,
                           CASE WHEN content_hash = $2 THEN 'exact_hash' ELSE 'same_classification' END as match_reason
                    FROM feedback
                    WHERE feedback_id != $1
                      AND created_at >= NOW() - INTERVAL '90 days'
                      AND (content_hash = $2 OR (type = $3 AND classification = $4))
                    ORDER BY
                      CASE WHEN content_hash = $2 THEN 0 ELSE 1 END,
                      created_at DESC
                    LIMIT 5
                """, feedback_id, content_hash, feedback_type, classification)
            elif content_hash:
                similar = await conn.fetch("""
                    SELECT feedback_id, type, status, LEFT(content, 200) as content_preview,
                           created_at, 'exact_hash' as match_reason
                    FROM feedback
                    WHERE feedback_id != $1
                      AND created_at >= NOW() - INTERVAL '90 days'
                      AND content_hash = $2
                    ORDER BY created_at DESC
                    LIMIT 5
                """, feedback_id, content_hash)
            else:
                similar = []

        results = []
        for row in similar:
            r = {k: _feedback_json_safe(v) for k, v in dict(row).items()}
            results.append(r)

        return {"feedback_id": feedback_id, "similar": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching similar feedback for {feedback_id}")
        raise HTTPException(status_code=500, detail=f"Error finding similar reports: {str(e)}")


# Analytics routes moved to routers/analytics.py

# Include routers
fastapi_app.include_router(auth_router)
fastapi_app.include_router(groups_router)
fastapi_app.include_router(games_router)
fastapi_app.include_router(spotify_router)
fastapi_app.include_router(wallet_router)
fastapi_app.include_router(feedback_router)
fastapi_app.include_router(engagement_router)
fastapi_app.include_router(automations_router)
fastapi_app.include_router(analytics_router)
fastapi_app.include_router(notifications_router)
fastapi_app.include_router(host_router)
fastapi_app.include_router(subscribers_router)
fastapi_app.include_router(poker_router)
fastapi_app.include_router(api_router)

# Add security middleware (rate limiting, headers, metrics)
from security_middleware import SecurityMiddleware
fastapi_app.add_middleware(SecurityMiddleware, enable_metrics=True)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup/shutdown logic moved to lifespan handler above (on_event is not invoked when lifespan is used)
