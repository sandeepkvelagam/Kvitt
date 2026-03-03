"""
Executive Summary Agent

Runs daily at 8:00 AM to:
1. Generate a daily ops brief
2. Summarize key metrics from the last 24 hours
3. List open incidents and alerts
4. Create a report alert for the dashboard
5. Send email to super admins

Summary includes:
- Platform health (uptime, error rate, latency)
- User activity (DAU, new signups, games played)
- Open incidents and alerts
- Notable events
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from db.pg import get_pool
from role_middleware import generate_alert_id

logger = logging.getLogger(__name__)


async def generate_daily_summary() -> Dict[str, Any]:
    """
    Generate the daily ops summary.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database not available"}
    
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(hours=24)
    
    async with pool.acquire() as conn:
        # Platform health from rollups
        health = await conn.fetchrow("""
            SELECT 
                SUM(requests_total) as total_requests,
                SUM(errors_5xx) as total_5xx,
                SUM(errors_4xx) as total_4xx,
                AVG(latency_p95_ms) as avg_p95_latency,
                SUM(crashes_total) as total_crashes,
                SUM(rate_limit_hits) as total_rate_limits
            FROM service_health_rollups
            WHERE bucket_start >= $1
        """, yesterday)
        
        total_requests = health["total_requests"] or 1
        total_5xx = health["total_5xx"] or 0
        error_rate = round((total_5xx / total_requests) * 100, 2) if total_requests > 0 else 0
        uptime = round(100 - error_rate, 2)
        
        # User activity
        dau = await conn.fetchval("""
            SELECT COUNT(DISTINCT user_id) FROM analytics_sessions
            WHERE started_at >= $1 AND user_id IS NOT NULL
        """, yesterday)
        
        new_users = await conn.fetchval("""
            SELECT COUNT(*) FROM users WHERE created_at >= $1
        """, yesterday)
        
        new_groups = await conn.fetchval("""
            SELECT COUNT(*) FROM groups WHERE created_at >= $1
        """, yesterday)
        
        games_created = await conn.fetchval("""
            SELECT COUNT(*) FROM game_nights WHERE created_at >= $1
        """, yesterday)
        
        games_completed = await conn.fetchval("""
            SELECT COUNT(*) FROM game_nights 
            WHERE status = 'completed' AND updated_at >= $1
        """, yesterday)
        
        # Open incidents
        open_incidents = await conn.fetch("""
            SELECT incident_id, severity, title, opened_at
            FROM incidents
            WHERE status != 'resolved'
            ORDER BY severity, opened_at DESC
        """)
        
        # Open alerts
        open_alerts = await conn.fetchval("""
            SELECT COUNT(*) FROM admin_alerts WHERE status = 'open'
        """)
        
        p0_alerts = await conn.fetchval("""
            SELECT COUNT(*) FROM admin_alerts 
            WHERE status = 'open' AND severity = 'P0'
        """)
        
        p1_alerts = await conn.fetchval("""
            SELECT COUNT(*) FROM admin_alerts 
            WHERE status = 'open' AND severity = 'P1'
        """)
        
        # Security events
        security_blocked = await conn.fetchval("""
            SELECT COUNT(*) FROM security_events
            WHERE occurred_at >= $1 AND blocked = true
        """, yesterday)
        
        high_risk_events = await conn.fetchval("""
            SELECT COUNT(*) FROM security_events
            WHERE occurred_at >= $1 AND risk_score > 70
        """, yesterday)
        
        return {
            "generated_at": now.isoformat(),
            "period": "24h",
            "period_start": yesterday.isoformat(),
            "period_end": now.isoformat(),
            
            "health": {
                "uptime_pct": uptime,
                "error_rate_5xx": error_rate,
                "total_requests": total_requests,
                "total_5xx": total_5xx,
                "total_4xx": health["total_4xx"] or 0,
                "avg_p95_latency_ms": round(health["avg_p95_latency"] or 0),
                "total_crashes": health["total_crashes"] or 0,
                "rate_limit_hits": health["total_rate_limits"] or 0,
            },
            
            "activity": {
                "dau": dau or 0,
                "new_users": new_users or 0,
                "new_groups": new_groups or 0,
                "games_created": games_created or 0,
                "games_completed": games_completed or 0,
            },
            
            "incidents": {
                "open_count": len(open_incidents),
                "open_list": [dict(row) for row in open_incidents],
            },
            
            "alerts": {
                "open_total": open_alerts or 0,
                "p0_count": p0_alerts or 0,
                "p1_count": p1_alerts or 0,
            },
            
            "security": {
                "blocked_events": security_blocked or 0,
                "high_risk_events": high_risk_events or 0,
            },
        }


def format_summary_text(summary: Dict[str, Any]) -> str:
    """
    Format summary as readable text for email/display.
    """
    health = summary.get("health", {})
    activity = summary.get("activity", {})
    incidents = summary.get("incidents", {})
    alerts = summary.get("alerts", {})
    security = summary.get("security", {})
    
    lines = [
        "=" * 50,
        "KVITT DAILY OPS BRIEF",
        f"Generated: {summary.get('generated_at', 'N/A')}",
        "=" * 50,
        "",
        "PLATFORM HEALTH",
        f"  Uptime: {health.get('uptime_pct', 0)}%",
        f"  Error Rate (5xx): {health.get('error_rate_5xx', 0)}%",
        f"  Total Requests: {health.get('total_requests', 0):,}",
        f"  Avg p95 Latency: {health.get('avg_p95_latency_ms', 0)}ms",
        f"  Crashes: {health.get('total_crashes', 0)}",
        "",
        "USER ACTIVITY",
        f"  DAU: {activity.get('dau', 0):,}",
        f"  New Users: {activity.get('new_users', 0)}",
        f"  New Groups: {activity.get('new_groups', 0)}",
        f"  Games Created: {activity.get('games_created', 0)}",
        f"  Games Completed: {activity.get('games_completed', 0)}",
        "",
        "INCIDENTS & ALERTS",
        f"  Open Incidents: {incidents.get('open_count', 0)}",
        f"  Open Alerts: {alerts.get('open_total', 0)} (P0: {alerts.get('p0_count', 0)}, P1: {alerts.get('p1_count', 0)})",
        "",
        "SECURITY",
        f"  Blocked Events: {security.get('blocked_events', 0)}",
        f"  High-Risk Events: {security.get('high_risk_events', 0)}",
        "",
        "=" * 50,
    ]
    
    return "\n".join(lines)


async def save_summary_as_alert(summary: Dict[str, Any]) -> Optional[str]:
    """
    Save the daily summary as a report alert.
    """
    pool = get_pool()
    if not pool:
        return None
    
    alert_id = generate_alert_id()
    title = f"Daily Ops Brief - {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    summary_text = format_summary_text(summary)
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO admin_alerts 
            (alert_id, severity, category, title, summary, details, fingerprint, status)
            VALUES ($1, 'P2', 'report', $2, $3, $4, $5, 'open')
        """,
            alert_id,
            title,
            summary_text[:500],  # Truncate for summary field
            summary,
            f"daily_brief_{datetime.now(timezone.utc).strftime('%Y%m%d')}"
        )
    
    return alert_id


async def get_super_admin_emails() -> List[str]:
    """
    Get email addresses of all super admins.
    """
    pool = get_pool()
    if not pool:
        return []
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT email FROM users WHERE app_role = 'super_admin'
        """)
        return [row["email"] for row in rows]


async def send_summary_email(summary: Dict[str, Any]):
    """
    Send the daily summary email to super admins.
    """
    try:
        from email_service import send_email
        
        emails = await get_super_admin_emails()
        if not emails:
            logger.info("No super admins to send daily brief to")
            return
        
        subject = f"[Kvitt] Daily Ops Brief - {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        body = format_summary_text(summary)
        
        for email in emails:
            try:
                await send_email(email, subject, body)
                logger.info(f"Sent daily brief to {email}")
            except Exception as e:
                logger.warning(f"Failed to send daily brief to {email}: {e}")
                
    except ImportError:
        logger.warning("email_service not available, skipping email")
    except Exception as e:
        logger.error(f"Failed to send summary emails: {e}")


async def run_executive_summary():
    """
    Main entry point for the executive summary agent.
    Called by OpsScheduler daily at 8:00 AM.
    """
    try:
        logger.info("Generating daily ops brief...")
        
        # Generate summary
        summary = await generate_daily_summary()
        
        if "error" in summary:
            logger.error(f"Failed to generate summary: {summary['error']}")
            return
        
        # Save as alert
        alert_id = await save_summary_as_alert(summary)
        logger.info(f"Saved daily brief as alert: {alert_id}")
        
        # Send email
        await send_summary_email(summary)
        
        # Log summary
        health = summary.get("health", {})
        activity = summary.get("activity", {})
        logger.info(
            f"Daily brief: Uptime={health.get('uptime_pct', 0)}%, "
            f"DAU={activity.get('dau', 0)}, "
            f"Games={activity.get('games_created', 0)}"
        )
        
    except Exception as e:
        logger.error(f"Executive summary error: {e}")
