"""Admin alerts, incidents, and daily reports endpoints.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from role_middleware import get_admin_context, AdminContext
import platform_analytics

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["admin-incidents"])


# ── Models ────────────────────────────────────────────────────────

class IncidentTimelineRequest(BaseModel):
    event_type: str = Field(..., pattern="^(detected|updated|mitigated|resolved|postmortem)$")
    message: str


# ── Routes ────────────────────────────────────────────────────────

@router.get("/admin/alerts")
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

@router.post("/admin/alerts/{alert_id}/ack")
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

@router.post("/admin/alerts/{alert_id}/resolve")
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

@router.get("/admin/incidents")
async def admin_list_incidents(
    status: Optional[str] = Query(None, regex="^(open|mitigating|resolved)$"),
    limit: int = Query(20, ge=1, le=100),
    ctx: AdminContext = Depends(get_admin_context)
):
    """List incidents."""
    await ctx.audit("list_incidents", {"status": status})
    return await platform_analytics.get_incidents(status, limit)

@router.get("/admin/incidents/{incident_id}")
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

@router.post("/admin/incidents/{incident_id}/timeline")
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

@router.get("/admin/reports/daily")
async def admin_get_daily_report(
    date: Optional[str] = None,
    ctx: AdminContext = Depends(get_admin_context)
):
    """Get daily ops report."""
    await ctx.audit("view_daily_report", {"date": date})

    from ops_agents.executive_summary import generate_daily_summary
    return await generate_daily_summary()
