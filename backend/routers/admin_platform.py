"""Admin platform monitoring & user management endpoints.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from role_middleware import get_admin_context, AdminContext
import platform_analytics

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["admin-platform"])


# ── Models ────────────────────────────────────────────────────────

class UpdateUserRoleRequest(BaseModel):
    app_role: str = Field(..., pattern="^(user|super_admin)$")


# ── Routes ────────────────────────────────────────────────────────

@router.get("/admin/overview")
async def admin_get_overview(
    range: str = Query("24h", regex="^(1h|24h|7d|30d)$"),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get platform-wide overview KPIs."""
    await ctx.audit("view_overview", {"range": range})
    return await platform_analytics.get_platform_overview(range)

@router.get("/admin/health/rollups")
async def admin_get_health_rollups(
    range: str = Query("24h", regex="^(1h|24h|7d|30d)$"),
    window: str = Query("5m", regex="^(1m|5m|1h|1d)$"),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get health rollups for charts."""
    await ctx.audit("view_health_rollups", {"range": range, "window": window})
    return await platform_analytics.get_health_rollups(range, window)

@router.get("/admin/health/metrics")
async def admin_get_health_metrics(
    range: str = Query("24h", regex="^(1h|24h|7d|30d)$"),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get computed health metrics (real-time)."""
    await ctx.audit("view_health_metrics", {"range": range})
    return await platform_analytics.compute_health_metrics(range)

@router.get("/admin/health/top-endpoints")
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

@router.get("/admin/crashes")
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

@router.get("/admin/security/overview")
async def admin_get_security_overview(
    range: str = Query("24h", regex="^(1h|24h|7d|30d)$"),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get security events overview."""
    await ctx.audit("view_security_overview", {"range": range})
    return await platform_analytics.get_security_overview(range)

@router.get("/admin/users/metrics")
async def admin_get_user_metrics(
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get DAU/WAU/MAU metrics."""
    await ctx.audit("view_user_metrics", {})
    return await platform_analytics.get_dau_wau_mau()

@router.get("/admin/funnel")
async def admin_get_funnel(
    range: str = Query("7d", regex="^(1h|24h|7d|30d)$"),
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get funnel conversion stats."""
    await ctx.audit("view_funnel", {"range": range})
    return await platform_analytics.get_funnel_stats(range)

@router.get("/admin/users")
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

@router.put("/admin/users/{user_id}/role")
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
