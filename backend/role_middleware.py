"""
Kvitt Role Middleware

FastAPI dependencies for Super Admin access control and audit logging.
All admin endpoints must use these guards for security and compliance.
"""

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import HTTPException, Request, Depends

logger = logging.getLogger(__name__)


async def get_current_user_for_admin(request: Request):
    """
    Returns the current authenticated user.
    Imports from dependencies (no circular import risk).
    """
    from dependencies import get_current_user
    return await get_current_user(request)


async def require_super_admin(request: Request) -> "User":
    """
    FastAPI dependency that ensures the current user is a Super Admin.
    Raises 403 if user is not a super_admin.
    
    Usage:
        @api_router.get("/admin/something")
        async def admin_endpoint(admin: User = Depends(require_super_admin)):
            ...
    """
    user = await get_current_user_for_admin(request)
    
    app_role = getattr(user, 'app_role', None) or 'user'
    
    if app_role != 'super_admin':
        logger.warning(f"Access denied: user {user.user_id} attempted admin access (role={app_role})")
        raise HTTPException(
            status_code=403,
            detail="Super Admin access required"
        )
    
    return user


async def audit_admin_access(
    admin_user_id: str,
    action: str,
    endpoint: Optional[str] = None,
    filters: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
) -> None:
    """
    Log admin access to the admin_access_log table.
    This is required for Fortune 500 compliance.
    
    Args:
        admin_user_id: The user_id of the admin performing the action
        action: Description of the action (e.g., "view_users", "ack_alert")
        endpoint: The API endpoint accessed
        filters: Any query filters used (for audit trail)
        request: The FastAPI request object (for IP/UA hashing)
    """
    from db.pg import get_pool
    
    pool = get_pool()
    if not pool:
        logger.warning("Cannot audit admin access: database pool not available")
        return
    
    ip_hash = None
    user_agent_hash = None
    
    if request:
        client_ip = request.client.host if request.client else None
        if client_ip:
            ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:64]
        
        user_agent = request.headers.get("user-agent", "")
        if user_agent:
            user_agent_hash = hashlib.sha256(user_agent.encode()).hexdigest()[:64]
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO admin_access_log 
                (admin_user_id, action, endpoint, filters, ip_hash, user_agent_hash, accessed_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
                admin_user_id,
                action,
                endpoint,
                filters if filters else {},
                ip_hash,
                user_agent_hash,
                datetime.now(timezone.utc)
            )
    except Exception as e:
        logger.error(f"Failed to audit admin access: {e}")


def generate_alert_id() -> str:
    """Generate a unique alert ID."""
    return f"alert_{uuid.uuid4().hex[:12]}"


def generate_incident_id() -> str:
    """Generate a unique incident ID."""
    return f"inc_{uuid.uuid4().hex[:12]}"


def compute_fingerprint(*args) -> str:
    """
    Compute a fingerprint for deduplication.
    Combines all arguments into a hash.
    """
    combined = "|".join(str(arg) for arg in args)
    return hashlib.sha256(combined.encode()).hexdigest()[:64]


class AdminContext:
    """
    Context object passed to admin endpoints with user and audit helpers.
    """
    
    def __init__(self, user: "User", request: Request):
        self.user = user
        self.request = request
    
    async def audit(self, action: str, filters: Optional[Dict[str, Any]] = None):
        """Log this admin action."""
        await audit_admin_access(
            admin_user_id=self.user.user_id,
            action=action,
            endpoint=str(self.request.url.path),
            filters=filters,
            request=self.request
        )


async def get_admin_context(request: Request) -> AdminContext:
    """
    FastAPI dependency that returns an AdminContext for admin endpoints.
    Combines require_super_admin + audit context.
    
    Usage:
        @api_router.get("/admin/something")
        async def admin_endpoint(ctx: AdminContext = Depends(get_admin_context)):
            await ctx.audit("view_something", {"filter": "value"})
            ...
    """
    user = await require_super_admin(request)
    return AdminContext(user=user, request=request)
