"""Analytics endpoints: device, session, event, funnel, error, consent tracking.
Extracted from server.py — pure mechanical move, zero behavior changes."""

from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

from dependencies import User, get_current_user
import analytics_service
from analytics_service import (
    DeviceContext, AnalyticsEvent, SessionStart, SessionEnd,
    SecurityEvent, AppError, APIMetric, FunnelEvent, AuditLogEntry,
    Platform, SecurityEventType, ErrorSeverity
)

router = APIRouter(prefix="/api", tags=["analytics"])


# ── Pydantic models ──────────────────────────────────────────────

class DeviceContextRequest(BaseModel):
    device_id: str
    platform: str
    os_version: Optional[str] = None
    device_model: Optional[str] = None
    locale: Optional[str] = None
    timezone: Optional[str] = None
    app_version: Optional[str] = None
    build_number: Optional[str] = None

class AnalyticsEventRequest(BaseModel):
    event_name: str
    event_version: int = 1
    user_id: Optional[str] = None
    anonymous_id: Optional[str] = None
    session_id: Optional[str] = None
    device_id: Optional[str] = None
    platform: Optional[str] = None
    app_version: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)

class AnalyticsEventBatchRequest(BaseModel):
    events: List[AnalyticsEventRequest]

class SessionStartRequest(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    anonymous_id: Optional[str] = None
    device_id: str
    platform: str
    app_version: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SessionEndRequest(BaseModel):
    session_id: str
    crash_flag: bool = False

class AppErrorRequest(BaseModel):
    error_type: str
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    device_id: Optional[str] = None
    platform: Optional[str] = None
    app_version: Optional[str] = None
    severity: str = "error"
    breadcrumbs: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class FunnelEventRequest(BaseModel):
    funnel_step: str
    user_id: Optional[str] = None
    anonymous_id: Optional[str] = None
    device_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ConsentRequest(BaseModel):
    consent_type: str
    version: str
    status: str = "granted"


# ── Routes ────────────────────────────────────────────────────────

@router.post("/analytics/device")
async def register_device(data: DeviceContextRequest, request: Request):
    """Register or update device context."""
    try:
        platform = Platform(data.platform.lower())
    except ValueError:
        platform = Platform.WEB

    device = DeviceContext(
        device_id=data.device_id,
        platform=platform,
        os_version=data.os_version,
        device_model=data.device_model,
        locale=data.locale,
        timezone=data.timezone,
        app_version=data.app_version,
        build_number=data.build_number
    )
    success = await analytics_service.upsert_device(device)
    return {"success": success}

@router.post("/analytics/session/start")
async def start_analytics_session(data: SessionStartRequest):
    """Start a new analytics session."""
    try:
        platform = Platform(data.platform.lower())
    except ValueError:
        platform = Platform.WEB

    session = SessionStart(
        session_id=data.session_id,
        user_id=data.user_id,
        anonymous_id=data.anonymous_id,
        device_id=data.device_id,
        platform=platform,
        app_version=data.app_version,
        metadata=data.metadata
    )
    success = await analytics_service.start_session(session)
    return {"success": success}

@router.post("/analytics/session/end")
async def end_analytics_session(data: SessionEndRequest):
    """End an analytics session."""
    session = SessionEnd(
        session_id=data.session_id,
        crash_flag=data.crash_flag
    )
    success = await analytics_service.end_session(session)
    return {"success": success}

@router.post("/analytics/event")
async def track_analytics_event(data: AnalyticsEventRequest):
    """Track a single analytics event."""
    try:
        platform = Platform(data.platform.lower()) if data.platform else None
    except ValueError:
        platform = None

    event = AnalyticsEvent(
        event_name=data.event_name,
        event_version=data.event_version,
        user_id=data.user_id,
        anonymous_id=data.anonymous_id,
        session_id=data.session_id,
        device_id=data.device_id,
        platform=platform,
        app_version=data.app_version,
        properties=data.properties
    )
    success = await analytics_service.track_event(event)
    return {"success": success}

@router.post("/analytics/events")
async def track_analytics_events_batch(data: AnalyticsEventBatchRequest):
    """Track multiple analytics events in batch."""
    events = []
    for e in data.events:
        try:
            platform = Platform(e.platform.lower()) if e.platform else None
        except ValueError:
            platform = None

        events.append(AnalyticsEvent(
            event_name=e.event_name,
            event_version=e.event_version,
            user_id=e.user_id,
            anonymous_id=e.anonymous_id,
            session_id=e.session_id,
            device_id=e.device_id,
            platform=platform,
            app_version=e.app_version,
            properties=e.properties
        ))

    count = await analytics_service.track_events_batch(events)
    return {"success": True, "tracked_count": count}

@router.post("/analytics/funnel")
async def track_funnel_step(data: FunnelEventRequest):
    """Track a conversion funnel event."""
    event = FunnelEvent(
        funnel_step=data.funnel_step,
        user_id=data.user_id,
        anonymous_id=data.anonymous_id,
        device_id=data.device_id,
        metadata=data.metadata
    )
    success = await analytics_service.track_funnel_event(event)
    return {"success": success}

@router.post("/analytics/error")
async def log_client_error(data: AppErrorRequest):
    """Log a client-side error."""
    try:
        severity = ErrorSeverity(data.severity.lower())
    except ValueError:
        severity = ErrorSeverity.ERROR

    error = AppError(
        error_type=data.error_type,
        error_message=data.error_message,
        stack_trace=data.stack_trace,
        user_id=data.user_id,
        session_id=data.session_id,
        device_id=data.device_id,
        platform=data.platform,
        app_version=data.app_version,
        severity=severity,
        breadcrumbs=data.breadcrumbs,
        metadata=data.metadata
    )
    success = await analytics_service.log_app_error(error)
    return {"success": success}

@router.post("/analytics/consent")
async def record_user_consent(
    data: ConsentRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Record user consent decision."""
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    success = await analytics_service.record_consent(
        user_id=current_user.user_id,
        consent_type=data.consent_type,
        version=data.version,
        status=data.status,
        ip_address=ip,
        user_agent=ua
    )
    return {"success": success}
