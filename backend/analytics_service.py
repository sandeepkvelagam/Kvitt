"""
Kvitt Analytics Service - Enterprise Event Ingestion

Handles:
- Analytics event ingestion (append-only)
- Device context tracking
- Session management
- Security event logging
- API metrics collection
"""

import logging
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum

from db.pg import get_pool, is_initialized

logger = logging.getLogger(__name__)


# ============================================
# ENUMS
# ============================================

class Platform(str, Enum):
    IOS = "ios"
    ANDROID = "android"
    WEB = "web"


class SecurityEventType(str, Enum):
    AUTH_FAILED = "auth_failed"
    AUTH_SUCCESS = "auth_success"
    TOKEN_REUSE = "token_reuse"
    TOKEN_REFRESH = "token_refresh"
    RATE_LIMITED = "rate_limited"
    SUSPICIOUS_GEO = "suspicious_geo"
    DEVICE_CHANGE = "device_change"
    PRIVILEGE_CHANGE = "privilege_change"
    PASSWORD_CHANGE = "password_change"
    ACCOUNT_LOCKED = "account_locked"
    DATA_EXPORT = "data_export"
    DATA_DELETION = "data_deletion"


class ErrorSeverity(str, Enum):
    FATAL = "fatal"
    ERROR = "error"
    WARN = "warn"
    INFO = "info"


# ============================================
# MODELS
# ============================================

class DeviceContext(BaseModel):
    device_id: str
    platform: Platform
    os_version: Optional[str] = None
    device_model: Optional[str] = None
    locale: Optional[str] = None
    timezone: Optional[str] = None
    app_version: Optional[str] = None
    build_number: Optional[str] = None
    push_token_hash: Optional[str] = None


class AnalyticsEvent(BaseModel):
    event_name: str
    event_version: int = 1
    user_id: Optional[str] = None
    anonymous_id: Optional[str] = None
    session_id: Optional[str] = None
    device_id: Optional[str] = None
    platform: Optional[Platform] = None
    app_version: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    occurred_at: Optional[datetime] = None


class SessionStart(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    anonymous_id: Optional[str] = None
    device_id: str
    platform: Platform
    app_version: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SessionEnd(BaseModel):
    session_id: str
    crash_flag: bool = False


class SecurityEvent(BaseModel):
    event_type: SecurityEventType
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    device_id: Optional[str] = None
    session_id: Optional[str] = None
    geo_country: Optional[str] = None
    geo_region: Optional[str] = None
    risk_score: int = 0
    risk_factors: List[str] = Field(default_factory=list)
    blocked: bool = False
    details: Dict[str, Any] = Field(default_factory=dict)


class AppError(BaseModel):
    error_type: str
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    device_id: Optional[str] = None
    platform: Optional[str] = None
    app_version: Optional[str] = None
    severity: ErrorSeverity = ErrorSeverity.ERROR
    breadcrumbs: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class APIMetric(BaseModel):
    endpoint: str
    method: str
    status_code: int
    latency_ms: int
    user_id: Optional[str] = None
    request_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_size_bytes: Optional[int] = None
    response_size_bytes: Optional[int] = None
    error_type: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FunnelEvent(BaseModel):
    funnel_step: str
    user_id: Optional[str] = None
    anonymous_id: Optional[str] = None
    device_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AuditLogEntry(BaseModel):
    action: str
    entity_type: str
    entity_id: str
    actor_user_id: Optional[str] = None
    actor_type: str = "user"
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    risk_score: int = 0
    details: Dict[str, Any] = Field(default_factory=dict)


# ============================================
# HELPERS
# ============================================

def generate_id(prefix: str = "") -> str:
    """Generate a unique ID with optional prefix."""
    import uuid
    return f"{prefix}{uuid.uuid4().hex[:24]}"


def hash_value(value: str) -> str:
    """Hash a value for privacy (IP, user agent, etc.)."""
    return hashlib.sha256(value.encode()).hexdigest()[:64]


# ============================================
# DEVICE CONTEXT
# ============================================

async def upsert_device(device: DeviceContext) -> bool:
    """Insert or update device context."""
    pool = get_pool()
    if not pool:
        logger.warning("Database not initialized, skipping device upsert")
        return False
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO devices (
                    device_id, platform, os_version, device_model,
                    locale, timezone, app_version, build_number,
                    push_token_hash, first_seen_at, last_seen_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                ON CONFLICT (device_id) DO UPDATE SET
                    os_version = EXCLUDED.os_version,
                    device_model = EXCLUDED.device_model,
                    locale = EXCLUDED.locale,
                    timezone = EXCLUDED.timezone,
                    app_version = EXCLUDED.app_version,
                    build_number = EXCLUDED.build_number,
                    push_token_hash = EXCLUDED.push_token_hash,
                    last_seen_at = NOW()
            """, device.device_id, device.platform.value, device.os_version,
                device.device_model, device.locale, device.timezone,
                device.app_version, device.build_number, device.push_token_hash)
        return True
    except Exception as e:
        logger.error(f"Failed to upsert device: {e}")
        return False


# ============================================
# SESSIONS
# ============================================

async def start_session(session: SessionStart) -> bool:
    """Start a new analytics session."""
    pool = get_pool()
    if not pool:
        return False
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO analytics_sessions (
                    session_id, user_id, anonymous_id, device_id,
                    platform, app_version, started_at, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
                ON CONFLICT (session_id) DO NOTHING
            """, session.session_id, session.user_id, session.anonymous_id,
                session.device_id, session.platform.value, session.app_version,
                session.metadata)
        return True
    except Exception as e:
        logger.error(f"Failed to start session: {e}")
        return False


async def end_session(session: SessionEnd) -> bool:
    """End an analytics session."""
    pool = get_pool()
    if not pool:
        return False
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                UPDATE analytics_sessions SET
                    ended_at = NOW(),
                    duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INT,
                    crash_flag = $2
                WHERE session_id = $1 AND ended_at IS NULL
            """, session.session_id, session.crash_flag)
        return True
    except Exception as e:
        logger.error(f"Failed to end session: {e}")
        return False


# ============================================
# ANALYTICS EVENTS
# ============================================

async def track_event(event: AnalyticsEvent) -> bool:
    """Track an analytics event (append-only)."""
    pool = get_pool()
    if not pool:
        return False
    
    event_id = generate_id("evt_")
    occurred_at = event.occurred_at or datetime.now(timezone.utc)
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO analytics_events (
                    event_id, event_name, event_version, occurred_at,
                    user_id, anonymous_id, session_id, device_id,
                    platform, app_version, properties
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """, event_id, event.event_name, event.event_version, occurred_at,
                event.user_id, event.anonymous_id, event.session_id, event.device_id,
                event.platform.value if event.platform else None, event.app_version,
                event.properties)
            
            # Update session event count
            if event.session_id:
                await conn.execute("""
                    UPDATE analytics_sessions SET event_count = event_count + 1
                    WHERE session_id = $1
                """, event.session_id)
        
        return True
    except Exception as e:
        logger.error(f"Failed to track event: {e}")
        return False


async def track_events_batch(events: List[AnalyticsEvent]) -> int:
    """Track multiple analytics events in batch."""
    pool = get_pool()
    if not pool:
        return 0
    
    success_count = 0
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                for event in events:
                    event_id = generate_id("evt_")
                    occurred_at = event.occurred_at or datetime.now(timezone.utc)
                    
                    await conn.execute("""
                        INSERT INTO analytics_events (
                            event_id, event_name, event_version, occurred_at,
                            user_id, anonymous_id, session_id, device_id,
                            platform, app_version, properties
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    """, event_id, event.event_name, event.event_version, occurred_at,
                        event.user_id, event.anonymous_id, event.session_id, event.device_id,
                        event.platform.value if event.platform else None, event.app_version,
                        event.properties)
                    success_count += 1
        
        return success_count
    except Exception as e:
        logger.error(f"Failed to track events batch: {e}")
        return success_count


# ============================================
# FUNNEL TRACKING
# ============================================

async def track_funnel_event(event: FunnelEvent) -> bool:
    """Track a conversion funnel event."""
    pool = get_pool()
    if not pool:
        return False
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO funnel_events (
                    user_id, anonymous_id, device_id, funnel_step, metadata
                ) VALUES ($1, $2, $3, $4, $5)
            """, event.user_id, event.anonymous_id, event.device_id,
                event.funnel_step, event.metadata)
        return True
    except Exception as e:
        logger.error(f"Failed to track funnel event: {e}")
        return False


# ============================================
# SECURITY EVENTS
# ============================================

async def log_security_event(event: SecurityEvent) -> bool:
    """Log a security event."""
    pool = get_pool()
    if not pool:
        return False
    
    event_id = generate_id("sec_")
    ip_hash = hash_value(event.ip_address) if event.ip_address else None
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO security_events (
                    event_id, event_type, user_id, ip_hash, device_id,
                    session_id, geo_country, geo_region, risk_score,
                    risk_factors, blocked, details
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            """, event_id, event.event_type.value, event.user_id, ip_hash,
                event.device_id, event.session_id, event.geo_country,
                event.geo_region, event.risk_score, event.risk_factors,
                event.blocked, event.details)
        return True
    except Exception as e:
        logger.error(f"Failed to log security event: {e}")
        return False


# ============================================
# APP ERRORS
# ============================================

async def log_app_error(error: AppError) -> bool:
    """Log an application error."""
    pool = get_pool()
    if not pool:
        return False
    
    error_id = generate_id("err_")
    fingerprint = hash_value(f"{error.error_type}:{error.stack_trace or ''}")[:64]
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO app_errors (
                    error_id, user_id, session_id, device_id, platform,
                    app_version, severity, error_type, error_message,
                    stack_trace, breadcrumbs, fingerprint, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            """, error_id, error.user_id, error.session_id, error.device_id,
                error.platform, error.app_version, error.severity.value,
                error.error_type, error.error_message, error.stack_trace,
                error.breadcrumbs, fingerprint, error.metadata)
        return True
    except Exception as e:
        logger.error(f"Failed to log app error: {e}")
        return False


# ============================================
# API METRICS
# ============================================

async def log_api_metric(metric: APIMetric) -> bool:
    """Log an API metric."""
    pool = get_pool()
    if not pool:
        return False
    
    metric_id = generate_id("met_")
    ip_hash = hash_value(metric.ip_address) if metric.ip_address else None
    ua_hash = hash_value(metric.user_agent) if metric.user_agent else None
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO api_metrics (
                    metric_id, endpoint, method, status_code, latency_ms,
                    user_id, request_id, ip_hash, user_agent_hash,
                    request_size_bytes, response_size_bytes, error_type, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            """, metric_id, metric.endpoint, metric.method, metric.status_code,
                metric.latency_ms, metric.user_id, metric.request_id, ip_hash,
                ua_hash, metric.request_size_bytes, metric.response_size_bytes,
                metric.error_type, metric.metadata)
        return True
    except Exception as e:
        logger.error(f"Failed to log API metric: {e}")
        return False


# ============================================
# AUDIT LOG
# ============================================

async def log_audit(entry: AuditLogEntry) -> bool:
    """Log an audit entry (immutable)."""
    pool = get_pool()
    if not pool:
        return False
    
    audit_id = generate_id("aud_")
    ip_hash = hash_value(entry.ip_address) if entry.ip_address else None
    ua_hash = hash_value(entry.user_agent) if entry.user_agent else None
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO audit_log (
                    audit_id, actor_user_id, actor_type, action,
                    entity_type, entity_id, old_value, new_value,
                    ip_hash, user_agent_hash, device_id, session_id,
                    request_id, risk_score, details
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            """, audit_id, entry.actor_user_id, entry.actor_type, entry.action,
                entry.entity_type, entry.entity_id, entry.old_value, entry.new_value,
                ip_hash, ua_hash, entry.device_id, entry.session_id,
                entry.request_id, entry.risk_score, entry.details)
        return True
    except Exception as e:
        logger.error(f"Failed to log audit entry: {e}")
        return False


# ============================================
# CONSENT TRACKING
# ============================================

async def record_consent(
    user_id: str,
    consent_type: str,
    version: str,
    status: str = "granted",
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> bool:
    """Record a user consent decision."""
    pool = get_pool()
    if not pool:
        return False
    
    ip_hash = hash_value(ip_address) if ip_address else None
    ua_hash = hash_value(user_agent) if user_agent else None
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO consents (
                    user_id, consent_type, version, status,
                    ip_address, user_agent_hash
                ) VALUES ($1, $2::consent_type, $3, $4::consent_status, $5::inet, $6)
                ON CONFLICT (user_id, consent_type, version) DO UPDATE SET
                    status = EXCLUDED.status,
                    timestamp = NOW()
            """, user_id, consent_type, version, status, ip_hash, ua_hash)
        return True
    except Exception as e:
        logger.error(f"Failed to record consent: {e}")
        return False
