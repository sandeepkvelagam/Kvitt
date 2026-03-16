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
from routers.users import router as users_router
from routers.stats import router as stats_router
from routers.voice import router as voice_router
from routers.premium import router as premium_router
from routers.debug import router as debug_router
from routers.assistant import router as assistant_router
from routers.events import router as events_router
from routers.ledger import router as ledger_router
from routers.settlements import router as settlements_router
from routers.admin_platform import router as admin_platform_router
from routers.admin_incidents import router as admin_incidents_router
from routers.admin_feedback import router as admin_feedback_router
from routers.feature_requests import router as feature_requests_router

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

# Badge/Level definitions moved to routers/users.py

# User and UserSession models are now in dependencies.py
# Group models (GroupInvite, Group, GroupMember) moved to routers/groups.py

# Subscriber model moved to routers/subscribers.py

# GameNight, Player, Transaction, GameThread models moved to routers/games/models.py
# LedgerEntry model moved to dependencies.py
# AuditLog and Notification models moved to dependencies.py
# GroupMessage, GroupAISettings, PollOption, Poll models moved to routers/groups.py


# Wallet models and request models moved to routers/wallet.py

# Request/response models moved to routers/ledger.py

# RegisterPushTokenRequest moved to routers/notifications.py

# Auth helpers and endpoints are now in dependencies.py and routers/auth.py
# Group endpoints moved to routers/groups.py

# User profile routes moved to routers/users.py

# Group invite/member endpoints moved to routers/groups.py

# Game endpoints moved to routers/games/ package

# Ledger routes moved to routers/ledger.py

# Stats routes moved to routers/stats.py

# Game thread endpoints moved to routers/games/thread.py

# Group chat, AI settings, polls endpoints moved to routers/groups.py

# Game scheduler models and routes moved to routers/events.py

# Group calendar endpoint moved to routers/groups.py

# Notification routes moved to routers/notifications.py


# NOTIFICATION_CATEGORY_MAP and check_notification_preferences moved to push_service.py

# Debug routes moved to routers/debug.py

# Voice commands endpoint moved to routers/voice.py

# AI Assistant routes moved to routers/assistant.py

# Poker routes moved to routers/poker.py


# Host persona routes moved to routers/host.py


# Smart defaults and frequent players endpoints moved to routers/groups.py

# Wallet endpoints moved to routers/wallet.py


# Push notification helpers moved to push_service.py
# (send_push_notification_to_user, send_push_to_users imported at top)

# Push token routes moved to routers/notifications.py

# Ledger consolidation routes moved to routers/ledger.py


# Premium/Stripe routes moved to routers/premium.py


# Debt settlement routes moved to routers/settlements.py

# Wallet webhook moved to routers/wallet.py
# Spotify routes moved to routers/spotify.py

# ============== ROOT ENDPOINT ==============

@api_router.get("/")
async def root():
    return {"message": "PokerNight API v1.0"}

# Debug/my-data route moved to routers/debug.py


# Subscriber routes moved to routers/subscribers.py


# Engagement routes moved to routers/engagement.py


# Feedback routes moved to routers/feedback.py

# Automation routes moved to routers/automations.py


# Super admin routes moved to routers/admin_platform.py, admin_incidents.py, admin_feedback.py

# ============== ROUTER REGISTRATION ==============

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
fastapi_app.include_router(users_router)
fastapi_app.include_router(stats_router)
fastapi_app.include_router(voice_router)
fastapi_app.include_router(premium_router)
fastapi_app.include_router(debug_router)
fastapi_app.include_router(assistant_router)
fastapi_app.include_router(events_router)
fastapi_app.include_router(ledger_router)
fastapi_app.include_router(settlements_router)
fastapi_app.include_router(admin_platform_router)
fastapi_app.include_router(admin_incidents_router)
fastapi_app.include_router(admin_feedback_router)
fastapi_app.include_router(feature_requests_router)
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
