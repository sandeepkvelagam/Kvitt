"""
Kvitt Security Middleware

Enterprise-grade security middleware for FastAPI:
- Rate limiting
- Request validation
- Security headers
- API metrics collection
- Security event logging
"""

import time
import hashlib
import logging
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timezone
from collections import defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

import analytics_service
from analytics_service import APIMetric, SecurityEvent, SecurityEventType

logger = logging.getLogger(__name__)


# ============================================
# RATE LIMITING
# ============================================

class RateLimiter:
    """In-memory rate limiter with sliding window."""
    
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.blocked_until: Dict[str, float] = {}
    
    def _clean_old_requests(self, key: str, window_seconds: int) -> None:
        """Remove requests outside the window."""
        cutoff = time.time() - window_seconds
        self.requests[key] = [t for t in self.requests[key] if t > cutoff]
    
    def is_allowed(
        self,
        key: str,
        limit: int,
        window_seconds: int = 60
    ) -> tuple[bool, int]:
        """
        Check if request is allowed.
        Returns (allowed, remaining_requests).
        """
        now = time.time()
        
        # Check if blocked
        if key in self.blocked_until:
            if now < self.blocked_until[key]:
                return False, 0
            del self.blocked_until[key]
        
        self._clean_old_requests(key, window_seconds)
        
        current_count = len(self.requests[key])
        if current_count >= limit:
            # Block for remaining window time
            self.blocked_until[key] = now + window_seconds
            return False, 0
        
        self.requests[key].append(now)
        return True, limit - current_count - 1
    
    def block(self, key: str, seconds: int) -> None:
        """Explicitly block a key."""
        self.blocked_until[key] = time.time() + seconds


# Global rate limiter instance
rate_limiter = RateLimiter()

# Rate limit configurations per endpoint pattern
RATE_LIMITS = {
    "/api/auth/": {"limit": 10, "window": 60},  # 10 req/min for auth
    "/api/analytics/": {"limit": 100, "window": 60},  # 100 req/min for analytics
    "/api/wallet/": {"limit": 30, "window": 60},  # 30 req/min for wallet
    "/api/ai/": {"limit": 20, "window": 60},  # 20 req/min for AI
    "default": {"limit": 60, "window": 60},  # 60 req/min default
}


def get_rate_limit_config(path: str) -> Dict[str, int]:
    """Get rate limit config for a path."""
    for pattern, config in RATE_LIMITS.items():
        if pattern != "default" and path.startswith(pattern):
            return config
    return RATE_LIMITS["default"]


# ============================================
# SECURITY HEADERS
# ============================================

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
}


# ============================================
# HELPERS
# ============================================

def hash_ip(ip: str) -> str:
    """Hash IP address for privacy."""
    return hashlib.sha256(ip.encode()).hexdigest()[:32]


def get_client_ip(request: Request) -> str:
    """Get client IP, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_user_id_from_request(request: Request) -> Optional[str]:
    """Extract user ID from request state if available."""
    return getattr(request.state, "user_id", None)


# ============================================
# MIDDLEWARE
# ============================================

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Security middleware that handles:
    - Rate limiting
    - Security headers
    - API metrics collection
    - Security event logging
    """
    
    def __init__(self, app: ASGIApp, enable_metrics: bool = True):
        super().__init__(app)
        self.enable_metrics = enable_metrics
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        client_ip = get_client_ip(request)
        ip_hash = hash_ip(client_ip)
        request_id = request.headers.get("X-Request-ID", hashlib.md5(
            f"{client_ip}{time.time()}".encode()
        ).hexdigest()[:16])
        
        # Store request ID in state
        request.state.request_id = request_id
        
        # Rate limiting
        rate_key = f"{ip_hash}:{request.url.path}"
        config = get_rate_limit_config(request.url.path)
        allowed, remaining = rate_limiter.is_allowed(
            rate_key,
            config["limit"],
            config["window"]
        )
        
        if not allowed:
            # Log rate limit event
            await analytics_service.log_security_event(SecurityEvent(
                event_type=SecurityEventType.RATE_LIMITED,
                ip_address=client_ip,
                details={
                    "path": request.url.path,
                    "method": request.method,
                }
            ))
            
            response = Response(
                content='{"error": "Rate limit exceeded"}',
                status_code=429,
                media_type="application/json"
            )
            response.headers["Retry-After"] = str(config["window"])
            response.headers["X-RateLimit-Limit"] = str(config["limit"])
            response.headers["X-RateLimit-Remaining"] = "0"
            return response
        
        # Process request
        response = await call_next(request)
        
        # Calculate latency
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Add security headers
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(config["limit"])
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-Request-ID"] = request_id
        
        # Log API metrics
        if self.enable_metrics and request.url.path.startswith("/api/"):
            try:
                user_id = get_user_id_from_request(request)
                await analytics_service.log_api_metric(APIMetric(
                    endpoint=request.url.path,
                    method=request.method,
                    status_code=response.status_code,
                    latency_ms=latency_ms,
                    user_id=user_id,
                    request_id=request_id,
                    ip_address=client_ip,
                    user_agent=request.headers.get("user-agent"),
                    error_type=None if response.status_code < 400 else f"HTTP_{response.status_code}",
                ))
            except Exception as e:
                logger.warning(f"Failed to log API metric: {e}")
        
        return response


# ============================================
# AUDIT LOGGING DECORATOR
# ============================================

def audit_action(action: str, entity_type: str):
    """
    Decorator to log audit events for sensitive actions.
    
    Usage:
        @audit_action("wallet.transfer", "wallet")
        async def transfer_funds(...):
            ...
    """
    def decorator(func: Callable):
        async def wrapper(*args, **kwargs):
            request = kwargs.get("request")
            current_user = kwargs.get("current_user")
            
            # Capture old state if available
            old_value = None
            
            try:
                result = await func(*args, **kwargs)
                
                # Log successful action
                await analytics_service.log_audit(analytics_service.AuditLogEntry(
                    action=action,
                    entity_type=entity_type,
                    entity_id=kwargs.get("entity_id", "unknown"),
                    actor_user_id=current_user.user_id if current_user else None,
                    old_value=old_value,
                    new_value=result if isinstance(result, dict) else None,
                    ip_address=get_client_ip(request) if request else None,
                    user_agent=request.headers.get("user-agent") if request else None,
                    request_id=getattr(request.state, "request_id", None) if request else None,
                ))
                
                return result
            except Exception as e:
                # Log failed action
                await analytics_service.log_audit(analytics_service.AuditLogEntry(
                    action=f"{action}.failed",
                    entity_type=entity_type,
                    entity_id=kwargs.get("entity_id", "unknown"),
                    actor_user_id=current_user.user_id if current_user else None,
                    details={"error": str(e)},
                    risk_score=50,
                ))
                raise
        
        return wrapper
    return decorator


# ============================================
# SECURITY EVENT HELPERS
# ============================================

async def log_auth_success(
    user_id: str,
    ip_address: str,
    device_id: Optional[str] = None,
    session_id: Optional[str] = None
) -> None:
    """Log successful authentication."""
    await analytics_service.log_security_event(SecurityEvent(
        event_type=SecurityEventType.AUTH_SUCCESS,
        user_id=user_id,
        ip_address=ip_address,
        device_id=device_id,
        session_id=session_id,
        risk_score=0,
    ))


async def log_auth_failure(
    ip_address: str,
    reason: str,
    attempted_user: Optional[str] = None,
    device_id: Optional[str] = None
) -> None:
    """Log failed authentication attempt."""
    await analytics_service.log_security_event(SecurityEvent(
        event_type=SecurityEventType.AUTH_FAILED,
        user_id=attempted_user,
        ip_address=ip_address,
        device_id=device_id,
        risk_score=25,
        risk_factors=["auth_failure"],
        details={"reason": reason},
    ))


async def log_suspicious_activity(
    event_type: SecurityEventType,
    user_id: Optional[str],
    ip_address: str,
    risk_score: int,
    risk_factors: list,
    details: Dict[str, Any]
) -> None:
    """Log suspicious activity."""
    await analytics_service.log_security_event(SecurityEvent(
        event_type=event_type,
        user_id=user_id,
        ip_address=ip_address,
        risk_score=risk_score,
        risk_factors=risk_factors,
        details=details,
        blocked=risk_score >= 80,
    ))
