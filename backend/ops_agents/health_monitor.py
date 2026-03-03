"""
Health Monitor Agent

Runs every 1 minute to:
1. Compute health metrics from api_metrics, app_errors, rate_limit_events
2. Write rollup to service_health_rollups
3. Create admin_alerts if thresholds exceeded
4. Open incidents for P0 issues

Thresholds:
- P0: 5xx rate > 5% OR p95 latency > 5000ms OR crash rate > 10/min
- P1: 5xx rate > 2% OR p95 latency > 3000ms OR crash rate > 5/min
- P2: 5xx rate > 1% OR p95 latency > 2000ms
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from db.pg import get_pool
from role_middleware import generate_alert_id, generate_incident_id, compute_fingerprint

logger = logging.getLogger(__name__)

# Thresholds
THRESHOLDS = {
    "P0": {
        "error_rate_5xx": 5.0,
        "p95_latency_ms": 5000,
        "crashes_per_min": 10,
    },
    "P1": {
        "error_rate_5xx": 2.0,
        "p95_latency_ms": 3000,
        "crashes_per_min": 5,
    },
    "P2": {
        "error_rate_5xx": 1.0,
        "p95_latency_ms": 2000,
        "crashes_per_min": 2,
    },
}


async def compute_current_metrics(window_minutes: int = 5) -> Dict[str, Any]:
    """
    Compute health metrics for the last N minutes.
    """
    pool = get_pool()
    if not pool:
        return {}
    
    window_start = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
    
    async with pool.acquire() as conn:
        # API metrics
        api_stats = await conn.fetchrow("""
            SELECT 
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE status_code >= 500) as errors_5xx,
                COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as errors_4xx,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as p50_latency_ms,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
                PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency_ms
            FROM api_metrics
            WHERE occurred_at >= $1
        """, window_start)
        
        # Crashes
        crashes = await conn.fetchval("""
            SELECT COUNT(*) FROM app_errors
            WHERE occurred_at >= $1 AND severity IN ('fatal', 'error')
        """, window_start)
        
        # Active users (from sessions)
        active_users = await conn.fetchval("""
            SELECT COUNT(DISTINCT user_id) FROM analytics_sessions
            WHERE started_at >= $1 AND user_id IS NOT NULL
        """, window_start)
        
        # Active sessions
        active_sessions = await conn.fetchval("""
            SELECT COUNT(*) FROM analytics_sessions
            WHERE started_at >= $1 AND (ended_at IS NULL OR ended_at >= $1)
        """, window_start)
        
        # Rate limit hits
        rate_limits = await conn.fetchval("""
            SELECT COUNT(*) FROM rate_limit_events
            WHERE occurred_at >= $1 AND blocked = true
        """, window_start)
        
        total = api_stats["total_requests"] or 1
        errors_5xx = api_stats["errors_5xx"] or 0
        
        return {
            "requests_total": total,
            "errors_5xx": errors_5xx,
            "errors_4xx": api_stats["errors_4xx"] or 0,
            "error_rate_5xx": round((errors_5xx / total) * 100, 2) if total > 0 else 0,
            "latency_p50_ms": int(api_stats["p50_latency_ms"] or 0),
            "latency_p95_ms": int(api_stats["p95_latency_ms"] or 0),
            "latency_p99_ms": int(api_stats["p99_latency_ms"] or 0),
            "crashes_total": crashes or 0,
            "crashes_per_min": round((crashes or 0) / window_minutes, 2),
            "active_users": active_users or 0,
            "active_sessions": active_sessions or 0,
            "rate_limit_hits": rate_limits or 0,
            "window_minutes": window_minutes,
        }


async def write_rollup(metrics: Dict[str, Any], window: str = "5m") -> bool:
    """
    Write metrics to service_health_rollups table.
    """
    pool = get_pool()
    if not pool:
        return False
    
    # Round bucket_start to the nearest 5 minutes
    now = datetime.now(timezone.utc)
    if window == "1m":
        bucket_start = now.replace(second=0, microsecond=0)
    elif window == "5m":
        minute = (now.minute // 5) * 5
        bucket_start = now.replace(minute=minute, second=0, microsecond=0)
    elif window == "1h":
        bucket_start = now.replace(minute=0, second=0, microsecond=0)
    else:
        bucket_start = now.replace(minute=0, second=0, microsecond=0)
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO service_health_rollups 
                (bucket_start, "window", requests_total, errors_5xx, errors_4xx,
                 latency_p50_ms, latency_p95_ms, latency_p99_ms, crashes_total,
                 active_users, active_sessions, rate_limit_hits)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (bucket_start, "window") DO UPDATE SET
                    requests_total = EXCLUDED.requests_total,
                    errors_5xx = EXCLUDED.errors_5xx,
                    errors_4xx = EXCLUDED.errors_4xx,
                    latency_p50_ms = EXCLUDED.latency_p50_ms,
                    latency_p95_ms = EXCLUDED.latency_p95_ms,
                    latency_p99_ms = EXCLUDED.latency_p99_ms,
                    crashes_total = EXCLUDED.crashes_total,
                    active_users = EXCLUDED.active_users,
                    active_sessions = EXCLUDED.active_sessions,
                    rate_limit_hits = EXCLUDED.rate_limit_hits
            """,
                bucket_start,
                window,
                metrics.get("requests_total", 0),
                metrics.get("errors_5xx", 0),
                metrics.get("errors_4xx", 0),
                metrics.get("latency_p50_ms"),
                metrics.get("latency_p95_ms"),
                metrics.get("latency_p99_ms"),
                metrics.get("crashes_total", 0),
                metrics.get("active_users", 0),
                metrics.get("active_sessions", 0),
                metrics.get("rate_limit_hits", 0)
            )
        return True
    except Exception as e:
        logger.error(f"Failed to write rollup: {e}")
        return False


async def check_thresholds_and_alert(metrics: Dict[str, Any]) -> Optional[str]:
    """
    Check metrics against thresholds and create alerts if needed.
    Returns the severity of any alert created, or None.
    """
    error_rate = metrics.get("error_rate_5xx", 0)
    p95_latency = metrics.get("latency_p95_ms", 0)
    crashes_per_min = metrics.get("crashes_per_min", 0)
    
    severity = None
    reasons = []
    
    # Check P0 thresholds
    if error_rate >= THRESHOLDS["P0"]["error_rate_5xx"]:
        severity = "P0"
        reasons.append(f"5xx error rate {error_rate}% >= {THRESHOLDS['P0']['error_rate_5xx']}%")
    elif p95_latency >= THRESHOLDS["P0"]["p95_latency_ms"]:
        severity = "P0"
        reasons.append(f"p95 latency {p95_latency}ms >= {THRESHOLDS['P0']['p95_latency_ms']}ms")
    elif crashes_per_min >= THRESHOLDS["P0"]["crashes_per_min"]:
        severity = "P0"
        reasons.append(f"crash rate {crashes_per_min}/min >= {THRESHOLDS['P0']['crashes_per_min']}/min")
    
    # Check P1 thresholds
    elif error_rate >= THRESHOLDS["P1"]["error_rate_5xx"]:
        severity = "P1"
        reasons.append(f"5xx error rate {error_rate}% >= {THRESHOLDS['P1']['error_rate_5xx']}%")
    elif p95_latency >= THRESHOLDS["P1"]["p95_latency_ms"]:
        severity = "P1"
        reasons.append(f"p95 latency {p95_latency}ms >= {THRESHOLDS['P1']['p95_latency_ms']}ms")
    elif crashes_per_min >= THRESHOLDS["P1"]["crashes_per_min"]:
        severity = "P1"
        reasons.append(f"crash rate {crashes_per_min}/min >= {THRESHOLDS['P1']['crashes_per_min']}/min")
    
    # Check P2 thresholds
    elif error_rate >= THRESHOLDS["P2"]["error_rate_5xx"]:
        severity = "P2"
        reasons.append(f"5xx error rate {error_rate}% >= {THRESHOLDS['P2']['error_rate_5xx']}%")
    elif p95_latency >= THRESHOLDS["P2"]["p95_latency_ms"]:
        severity = "P2"
        reasons.append(f"p95 latency {p95_latency}ms >= {THRESHOLDS['P2']['p95_latency_ms']}ms")
    
    if not severity:
        return None
    
    # Create alert
    await create_health_alert(severity, reasons, metrics)
    return severity


async def create_health_alert(
    severity: str,
    reasons: list,
    metrics: Dict[str, Any]
) -> Optional[str]:
    """
    Create an admin alert for health issues.
    Uses fingerprint for deduplication.
    """
    pool = get_pool()
    if not pool:
        return None
    
    # Fingerprint based on severity + primary reason (dedupe within 15 min)
    fingerprint = compute_fingerprint("health", severity, reasons[0] if reasons else "unknown")
    
    # Check for recent alert with same fingerprint
    async with pool.acquire() as conn:
        recent = await conn.fetchval("""
            SELECT alert_id FROM admin_alerts
            WHERE fingerprint = $1 
              AND created_at >= $2
              AND status != 'resolved'
        """, fingerprint, datetime.now(timezone.utc) - timedelta(minutes=15))
        
        if recent:
            logger.debug(f"Skipping duplicate alert (fingerprint={fingerprint[:16]}...)")
            return None
        
        alert_id = generate_alert_id()
        title = f"[{severity}] Platform Health Alert"
        summary = "; ".join(reasons)
        
        await conn.execute("""
            INSERT INTO admin_alerts 
            (alert_id, severity, category, title, summary, details, fingerprint, status)
            VALUES ($1, $2, 'health', $3, $4, $5, $6, 'open')
        """,
            alert_id,
            severity,
            title,
            summary,
            metrics,
            fingerprint
        )
        
        logger.warning(f"Created health alert: {alert_id} [{severity}] - {summary}")
        
        # For P0, also open an incident
        if severity == "P0":
            await open_incident(alert_id, title, summary, metrics)
        
        # Trigger notification
        from .notification_router import route_alert_notification
        await route_alert_notification(alert_id, severity, "health", title, summary)
        
        return alert_id


async def open_incident(
    alert_id: str,
    title: str,
    summary: str,
    details: Dict[str, Any]
) -> Optional[str]:
    """
    Open a new incident for P0 alerts.
    """
    pool = get_pool()
    if not pool:
        return None
    
    incident_id = generate_incident_id()
    
    try:
        async with pool.acquire() as conn:
            # Create incident
            result = await conn.fetchrow("""
                INSERT INTO incidents 
                (incident_id, severity, status, title, current_summary, metadata)
                VALUES ($1, 'P0', 'open', $2, $3, $4)
                RETURNING id
            """, incident_id, title, summary, details)
            
            incident_uuid = result["id"]
            
            # Link alert to incident
            await conn.execute("""
                UPDATE admin_alerts SET incident_id = $1 WHERE alert_id = $2
            """, incident_uuid, alert_id)
            
            # Add timeline event
            await conn.execute("""
                INSERT INTO incident_timeline_events 
                (incident_id, event_type, message, data)
                VALUES ($1, 'detected', $2, $3)
            """, incident_uuid, f"Incident opened: {summary}", details)
            
            logger.warning(f"Opened incident: {incident_id} - {title}")
            return incident_id
            
    except Exception as e:
        logger.error(f"Failed to open incident: {e}")
        return None


async def run_health_monitor():
    """
    Main entry point for the health monitor agent.
    Called by OpsScheduler every 1 minute.
    """
    try:
        # Compute metrics for last 5 minutes
        metrics = await compute_current_metrics(window_minutes=5)
        
        if not metrics:
            logger.warning("Health monitor: no metrics computed")
            return
        
        # Write rollup
        await write_rollup(metrics, window="5m")
        
        # Check thresholds and alert
        severity = await check_thresholds_and_alert(metrics)
        
        if severity:
            logger.info(f"Health monitor: alert created [{severity}]")
        else:
            logger.debug(f"Health monitor: all metrics healthy")
            
    except Exception as e:
        logger.error(f"Health monitor error: {e}")
