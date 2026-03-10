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
fastapi_app.include_router(users_router)
fastapi_app.include_router(stats_router)
fastapi_app.include_router(voice_router)
fastapi_app.include_router(premium_router)
fastapi_app.include_router(debug_router)
fastapi_app.include_router(assistant_router)
fastapi_app.include_router(events_router)
fastapi_app.include_router(ledger_router)
fastapi_app.include_router(settlements_router)
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
