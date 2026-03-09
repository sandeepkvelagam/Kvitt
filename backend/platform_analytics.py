"""
Kvitt Platform Analytics Service

Aggregation queries for the Super Admin dashboard.
Reads from existing observability tables + core tables to produce dashboard data.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum

from db.pg import get_pool

logger = logging.getLogger(__name__)


class TimeRange(str, Enum):
    """Supported time ranges for analytics queries."""
    HOUR_1 = "1h"
    HOUR_24 = "24h"
    DAY_7 = "7d"
    DAY_30 = "30d"


def parse_range(range_str: str) -> timedelta:
    """Convert range string to timedelta."""
    mapping = {
        "1h": timedelta(hours=1),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    return mapping.get(range_str, timedelta(hours=24))


def get_range_start(range_str: str) -> datetime:
    """Get the start datetime for a range."""
    return datetime.now(timezone.utc) - parse_range(range_str)


async def get_platform_overview(range_str: str = "24h") -> Dict[str, Any]:
    """
    Get platform-wide KPIs.
    
    Returns:
        - total_users (all-time)
        - total_groups (all-time)
        - total_games (all-time)
        - new_users (in range)
        - new_groups (in range)
        - new_games (in range)
        - active_games (currently active)
        - total_volume (sum of buy-ins, all-time)
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database not available"}
    
    range_start = get_range_start(range_str)
    
    async with pool.acquire() as conn:
        # Total counts (all-time)
        totals = await conn.fetchrow("""
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM groups) as total_groups,
                (SELECT COUNT(*) FROM game_nights) as total_games,
                (SELECT COUNT(*) FROM game_nights WHERE status = 'active') as active_games
        """)
        
        # New in range
        new_counts = await conn.fetchrow("""
            SELECT 
                (SELECT COUNT(*) FROM users WHERE created_at >= $1) as new_users,
                (SELECT COUNT(*) FROM groups WHERE created_at >= $1) as new_groups,
                (SELECT COUNT(*) FROM game_nights WHERE created_at >= $1) as new_games
        """, range_start)
        
        # Total volume (sum of all buy-ins)
        volume = await conn.fetchval("""
            SELECT COALESCE(SUM(total_buy_in), 0) FROM players
        """)
        
        return {
            "total_users": totals["total_users"] or 0,
            "total_groups": totals["total_groups"] or 0,
            "total_games": totals["total_games"] or 0,
            "active_games": totals["active_games"] or 0,
            "new_users": new_counts["new_users"] or 0,
            "new_groups": new_counts["new_groups"] or 0,
            "new_games": new_counts["new_games"] or 0,
            "total_volume": float(volume or 0),
            "range": range_str,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }


async def get_health_rollups(
    range_str: str = "24h",
    window: str = "5m"
) -> List[Dict[str, Any]]:
    """
    Get pre-aggregated health rollups for charts.
    
    Args:
        range_str: Time range (1h, 24h, 7d, 30d)
        window: Rollup window (1m, 5m, 1h, 1d)
    
    Returns:
        List of rollup records with bucket_start, requests, errors, latency, etc.
    """
    pool = get_pool()
    if not pool:
        return []
    
    range_start = get_range_start(range_str)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                bucket_start,
                "window",
                requests_total,
                errors_5xx,
                errors_4xx,
                latency_p50_ms,
                latency_p95_ms,
                latency_p99_ms,
                crashes_total,
                active_users,
                active_sessions,
                rate_limit_hits
            FROM service_health_rollups
            WHERE bucket_start >= $1 AND "window" = $2
            ORDER BY bucket_start ASC
        """, range_start, window)
        
        return [dict(row) for row in rows]


async def get_top_endpoints_by_errors(
    range_str: str = "24h",
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Get top endpoints by error count.
    Aggregates from api_metrics table.
    Filters out known security scanner/bot probe paths.
    """
    pool = get_pool()
    if not pool:
        return []
    
    range_start = get_range_start(range_str)
    
    # Patterns to exclude: security scanners probing for vulnerabilities
    # These are external bots, not real app traffic
    bot_patterns = [
        '/api/vendor/%',      # PHPUnit RCE probes
        '/api/.env%',         # Environment file probes
        '/api/spotify/%',     # Non-existent spotify endpoints
        '/api/wp-%',          # WordPress probes
        '/api/admin.php%',    # PHP admin probes
        '/api/config%',       # Config file probes
        '/api/backup%',       # Backup file probes
        '/api/shell%',        # Shell access probes
        '/api/eval%',         # Eval injection probes
    ]
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                endpoint,
                method,
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE status_code >= 500) as errors_5xx,
                COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as errors_4xx,
                ROUND(AVG(latency_ms)) as avg_latency_ms,
                COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) as p95_latency_ms
            FROM api_metrics
            WHERE occurred_at >= $1
              AND endpoint NOT LIKE ALL($3::text[])
            GROUP BY endpoint, method
            ORDER BY errors_5xx DESC, errors_4xx DESC
            LIMIT $2
        """, range_start, limit, bot_patterns)
        
        return [dict(row) for row in rows]


async def get_top_endpoints_by_latency(
    range_str: str = "24h",
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Get top endpoints by latency (p95).
    Filters out known security scanner/bot probe paths.
    """
    pool = get_pool()
    if not pool:
        return []
    
    range_start = get_range_start(range_str)
    
    # Patterns to exclude: security scanners probing for vulnerabilities
    bot_patterns = [
        '/api/vendor/%',
        '/api/.env%',
        '/api/spotify/%',
        '/api/wp-%',
        '/api/admin.php%',
        '/api/config%',
        '/api/backup%',
        '/api/shell%',
        '/api/eval%',
    ]
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                endpoint,
                method,
                COUNT(*) as total_requests,
                ROUND(AVG(latency_ms)) as avg_latency_ms,
                COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) as p95_latency_ms,
                COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 0) as p99_latency_ms,
                MAX(latency_ms) as max_latency_ms
            FROM api_metrics
            WHERE occurred_at >= $1
              AND endpoint NOT LIKE ALL($3::text[])
            GROUP BY endpoint, method
            HAVING COUNT(*) >= 10
            ORDER BY p95_latency_ms DESC
            LIMIT $2
        """, range_start, limit, bot_patterns)
        
        return [dict(row) for row in rows]


async def get_crash_fingerprints(
    range_str: str = "7d",
    platform: Optional[str] = None,
    app_version: Optional[str] = None,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Get top crash fingerprints grouped by error type.
    """
    pool = get_pool()
    if not pool:
        return []
    
    range_start = get_range_start(range_str)
    
    async with pool.acquire() as conn:
        query = """
            SELECT 
                fingerprint,
                error_type,
                severity,
                platform,
                app_version,
                COUNT(*) as occurrence_count,
                MAX(occurred_at) as last_seen,
                MIN(occurred_at) as first_seen,
                COUNT(DISTINCT user_id) as affected_users
            FROM app_errors
            WHERE occurred_at >= $1
        """
        params = [range_start]
        param_idx = 2
        
        if platform:
            query += f" AND platform = ${param_idx}"
            params.append(platform)
            param_idx += 1
        
        if app_version:
            query += f" AND app_version = ${param_idx}"
            params.append(app_version)
            param_idx += 1
        
        query += f"""
            GROUP BY fingerprint, error_type, severity, platform, app_version
            ORDER BY occurrence_count DESC
            LIMIT ${param_idx}
        """
        params.append(limit)
        
        rows = await conn.fetch(query, *params)
        return [dict(row) for row in rows]


async def get_security_overview(range_str: str = "24h") -> Dict[str, Any]:
    """
    Get security events summary.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database not available"}
    
    range_start = get_range_start(range_str)
    
    async with pool.acquire() as conn:
        # Events by type
        by_type = await conn.fetch("""
            SELECT 
                event_type,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE blocked = true) as blocked_count,
                AVG(risk_score) as avg_risk_score
            FROM security_events
            WHERE occurred_at >= $1
            GROUP BY event_type
            ORDER BY count DESC
        """, range_start)
        
        # High risk events
        high_risk = await conn.fetchval("""
            SELECT COUNT(*) FROM security_events
            WHERE occurred_at >= $1 AND risk_score > 70
        """, range_start)
        
        # Blocked events
        blocked = await conn.fetchval("""
            SELECT COUNT(*) FROM security_events
            WHERE occurred_at >= $1 AND blocked = true
        """, range_start)
        
        return {
            "by_type": [dict(row) for row in by_type],
            "high_risk_count": high_risk or 0,
            "blocked_count": blocked or 0,
            "range": range_str
        }


async def get_dau_wau_mau() -> Dict[str, int]:
    """
    Get Daily/Weekly/Monthly Active Users from analytics_sessions.
    """
    pool = get_pool()
    if not pool:
        return {"dau": 0, "wau": 0, "mau": 0}
    
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    async with pool.acquire() as conn:
        dau = await conn.fetchval("""
            SELECT COUNT(DISTINCT user_id) FROM analytics_sessions
            WHERE started_at >= $1 AND user_id IS NOT NULL
        """, day_ago)
        
        wau = await conn.fetchval("""
            SELECT COUNT(DISTINCT user_id) FROM analytics_sessions
            WHERE started_at >= $1 AND user_id IS NOT NULL
        """, week_ago)
        
        mau = await conn.fetchval("""
            SELECT COUNT(DISTINCT user_id) FROM analytics_sessions
            WHERE started_at >= $1 AND user_id IS NOT NULL
        """, month_ago)
        
        return {
            "dau": dau or 0,
            "wau": wau or 0,
            "mau": mau or 0
        }


async def get_funnel_stats(range_str: str = "7d") -> List[Dict[str, Any]]:
    """
    Get conversion funnel statistics.
    """
    pool = get_pool()
    if not pool:
        return []
    
    range_start = get_range_start(range_str)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                funnel_step,
                COUNT(*) as total,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT anonymous_id) as unique_anonymous
            FROM funnel_events
            WHERE occurred_at >= $1
            GROUP BY funnel_step
            ORDER BY total DESC
        """, range_start)
        
        return [dict(row) for row in rows]


async def get_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Get admin alerts with optional filters.
    """
    pool = get_pool()
    if not pool:
        return []
    
    async with pool.acquire() as conn:
        query = "SELECT * FROM admin_alerts WHERE 1=1"
        params = []
        param_idx = 1
        
        if status:
            query += f" AND status = ${param_idx}"
            params.append(status)
            param_idx += 1
        
        if severity:
            query += f" AND severity = ${param_idx}"
            params.append(severity)
            param_idx += 1
        
        if category:
            query += f" AND category = ${param_idx}"
            params.append(category)
            param_idx += 1
        
        query += f" ORDER BY created_at DESC LIMIT ${param_idx}"
        params.append(limit)
        
        rows = await conn.fetch(query, *params)
        return [dict(row) for row in rows]


async def get_incidents(
    status: Optional[str] = None,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Get incidents with optional status filter.
    """
    pool = get_pool()
    if not pool:
        return []
    
    async with pool.acquire() as conn:
        if status:
            rows = await conn.fetch("""
                SELECT * FROM incidents
                WHERE status = $1
                ORDER BY opened_at DESC
                LIMIT $2
            """, status, limit)
        else:
            rows = await conn.fetch("""
                SELECT * FROM incidents
                ORDER BY opened_at DESC
                LIMIT $1
            """, limit)
        
        return [dict(row) for row in rows]


async def get_incident_with_timeline(incident_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a single incident with its full timeline.
    """
    pool = get_pool()
    if not pool:
        return None
    
    async with pool.acquire() as conn:
        incident = await conn.fetchrow("""
            SELECT * FROM incidents WHERE incident_id = $1
        """, incident_id)
        
        if not incident:
            return None
        
        timeline = await conn.fetch("""
            SELECT * FROM incident_timeline_events
            WHERE incident_id = $1
            ORDER BY created_at ASC
        """, incident["id"])
        
        result = dict(incident)
        result["timeline"] = [dict(row) for row in timeline]
        return result


async def get_user_list(
    search: Optional[str] = None,
    app_role: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """
    Get paginated user list for admin management.
    """
    pool = get_pool()
    if not pool:
        return {"users": [], "total": 0}
    
    async with pool.acquire() as conn:
        # Build query
        where_clauses = []
        params = []
        param_idx = 1
        
        if search:
            where_clauses.append(f"(email ILIKE ${param_idx} OR name ILIKE ${param_idx})")
            params.append(f"%{search}%")
            param_idx += 1
        
        if app_role:
            where_clauses.append(f"app_role = ${param_idx}")
            params.append(app_role)
            param_idx += 1
        
        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        # Get total count
        total = await conn.fetchval(f"""
            SELECT COUNT(*) FROM users WHERE {where_sql}
        """, *params)
        
        # Get users with group/game counts
        params.extend([limit, offset])
        rows = await conn.fetch(f"""
            SELECT 
                u.*,
                (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.user_id) as group_count,
                (SELECT COUNT(*) FROM players p WHERE p.user_id = u.user_id) as game_count
            FROM users u
            WHERE {where_sql}
            ORDER BY u.created_at DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """, *params)
        
        return {
            "users": [dict(row) for row in rows],
            "total": total or 0,
            "limit": limit,
            "offset": offset
        }


async def compute_health_metrics(range_str: str = "24h") -> Dict[str, Any]:
    """
    Compute real-time health metrics from raw api_metrics.
    Used when rollups are not yet available.
    """
    pool = get_pool()
    if not pool:
        return {
            "total_requests": 0,
            "errors_5xx": 0,
            "errors_4xx": 0,
            "error_rate_5xx": 0.0,
            "avg_latency_ms": 0.0,
            "p50_latency_ms": 0.0,
            "p95_latency_ms": 0.0,
            "p99_latency_ms": 0.0,
            "crashes_total": 0,
            "rate_limit_hits": 0,
            "range": range_str,
            "error": "Database not available"
        }
    
    range_start = get_range_start(range_str)
    
    try:
        async with pool.acquire() as conn:
            # First check if there's any data to avoid PERCENTILE_CONT issues on empty sets
            row_count = await conn.fetchval("""
                SELECT COUNT(*) FROM api_metrics WHERE occurred_at >= $1
            """, range_start)
            
            if not row_count or row_count == 0:
                # No data - return zeros
                crashes = await conn.fetchval("""
                    SELECT COUNT(*) FROM app_errors
                    WHERE occurred_at >= $1 AND severity IN ('fatal', 'error')
                """, range_start) or 0
                
                rate_limits = await conn.fetchval("""
                    SELECT COUNT(*) FROM rate_limit_events
                    WHERE occurred_at >= $1 AND blocked = true
                """, range_start) or 0
                
                return {
                    "total_requests": 0,
                    "errors_5xx": 0,
                    "errors_4xx": 0,
                    "error_rate_5xx": 0.0,
                    "avg_latency_ms": 0.0,
                    "p50_latency_ms": 0.0,
                    "p95_latency_ms": 0.0,
                    "p99_latency_ms": 0.0,
                    "crashes_total": crashes,
                    "rate_limit_hits": rate_limits,
                    "range": range_str
                }
            
            metrics = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(*) FILTER (WHERE status_code >= 500) as errors_5xx,
                    COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as errors_4xx,
                    COALESCE(ROUND(AVG(latency_ms)), 0) as avg_latency_ms,
                    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms), 0) as p50_latency_ms,
                    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) as p95_latency_ms,
                    COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 0) as p99_latency_ms
                FROM api_metrics
                WHERE occurred_at >= $1
            """, range_start)
            
            crashes = await conn.fetchval("""
                SELECT COUNT(*) FROM app_errors
                WHERE occurred_at >= $1 AND severity IN ('fatal', 'error')
            """, range_start)
            
            rate_limits = await conn.fetchval("""
                SELECT COUNT(*) FROM rate_limit_events
                WHERE occurred_at >= $1 AND blocked = true
            """, range_start)
            
            total = metrics["total_requests"] or 1
            error_5xx = metrics["errors_5xx"] or 0
            
            return {
                "total_requests": total,
                "errors_5xx": error_5xx,
                "errors_4xx": metrics["errors_4xx"] or 0,
                "error_rate_5xx": round((error_5xx / total) * 100, 2) if total > 0 else 0,
                "avg_latency_ms": float(metrics["avg_latency_ms"] or 0),
                "p50_latency_ms": float(metrics["p50_latency_ms"] or 0),
                "p95_latency_ms": float(metrics["p95_latency_ms"] or 0),
                "p99_latency_ms": float(metrics["p99_latency_ms"] or 0),
                "crashes_total": crashes or 0,
                "rate_limit_hits": rate_limits or 0,
                "range": range_str
            }
    except Exception as e:
        logger.error(f"Error computing health metrics: {e}")
        return {
            "total_requests": 0,
            "errors_5xx": 0,
            "errors_4xx": 0,
            "error_rate_5xx": 0.0,
            "avg_latency_ms": 0.0,
            "p50_latency_ms": 0.0,
            "p95_latency_ms": 0.0,
            "p99_latency_ms": 0.0,
            "crashes_total": 0,
            "rate_limit_hits": 0,
            "range": range_str,
            "error": str(e)
        }


async def get_admin_feedback(
    feedback_type: Optional[str] = None,
    status: Optional[str] = None,
    days: int = 30,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """
    Get all user feedback/reports for admin dashboard.
    Returns feedback entries with optional filters.
    """
    pool = get_pool()
    if not pool:
        return {"feedback": [], "total": 0, "error": "Database not available"}
    
    range_start = get_range_start(f"{days}d") if days <= 30 else datetime.now(timezone.utc) - timedelta(days=days)
    
    try:
        async with pool.acquire() as conn:
            # Build query with filters
            conditions = ["created_at >= $1"]
            params: list = [range_start]
            param_idx = 2
            
            if feedback_type:
                conditions.append(f"type = ${param_idx}")
                params.append(feedback_type)
                param_idx += 1
            
            if status:
                conditions.append(f"status = ${param_idx}")
                params.append(status)
                param_idx += 1
            
            where_clause = " AND ".join(conditions)
            
            # Get total count
            count_query = f"SELECT COUNT(*) FROM feedback WHERE {where_clause}"
            total = await conn.fetchval(count_query, *params)
            
            # Get feedback entries
            params.append(limit)
            params.append(offset)
            query = f"""
                SELECT 
                    feedback_id, user_id, group_id, game_id, type, 
                    SUBSTRING(content, 1, 200) as content_preview,
                    status, priority, classification, 
                    auto_fix_attempted, resolution_code,
                    created_at, resolved_at
                FROM feedback 
                WHERE {where_clause}
                ORDER BY created_at DESC 
                LIMIT ${param_idx} OFFSET ${param_idx + 1}
            """
            
            rows = await conn.fetch(query, *params)
            
            # Get user info for each feedback
            feedback_list = []
            for row in rows:
                entry = dict(row)
                # Fetch user name
                if entry.get("user_id"):
                    user = await conn.fetchrow(
                        "SELECT name, email FROM users WHERE user_id = $1",
                        entry["user_id"]
                    )
                    if user:
                        entry["user_name"] = user["name"] or user["email"]
                feedback_list.append(entry)
            
            return {
                "feedback": feedback_list,
                "total": total or 0,
                "limit": limit,
                "offset": offset,
                "days": days
            }
    
    except Exception as e:
        logger.error(f"Error getting admin feedback: {e}")
        return {"feedback": [], "total": 0, "error": str(e)}


async def get_feedback_stats(days: int = 30) -> Dict[str, Any]:
    """
    Get feedback statistics for admin dashboard.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database not available"}
    
    range_start = datetime.now(timezone.utc) - timedelta(days=days)
    
    try:
        async with pool.acquire() as conn:
            # Count by type
            by_type = await conn.fetch("""
                SELECT type, COUNT(*) as count
                FROM feedback
                WHERE created_at >= $1
                GROUP BY type
                ORDER BY count DESC
            """, range_start)
            
            # Count by status
            by_status = await conn.fetch("""
                SELECT status, COUNT(*) as count
                FROM feedback
                WHERE created_at >= $1
                GROUP BY status
                ORDER BY count DESC
            """, range_start)
            
            # Total and unresolved
            totals = await conn.fetchrow("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed', 'duplicate')) as unresolved,
                    COUNT(*) FILTER (WHERE auto_fix_attempted = true) as auto_fixed
                FROM feedback
                WHERE created_at >= $1
            """, range_start)

            # Aging buckets (unresolved reports by age)
            aging = await conn.fetch("""
                SELECT
                    CASE
                        WHEN NOW() - created_at < INTERVAL '24 hours' THEN '0-24h'
                        WHEN NOW() - created_at < INTERVAL '3 days' THEN '1-3d'
                        WHEN NOW() - created_at < INTERVAL '7 days' THEN '3-7d'
                        ELSE '7d+'
                    END AS bucket,
                    COUNT(*) as count
                FROM feedback
                WHERE created_at >= $1
                  AND status NOT IN ('resolved', 'wont_fix', 'duplicate', 'closed')
                GROUP BY 1
                ORDER BY MIN(created_at)
            """, range_start)

            # Average first-response time (hours to first admin_response event)
            avg_response = await conn.fetchrow("""
                SELECT AVG(first_response_interval) as avg_first_response_hours
                FROM (
                    SELECT EXTRACT(EPOCH FROM (
                        (SELECT MIN((e->>'ts')::timestamptz)
                         FROM jsonb_array_elements(events) e
                         WHERE e->>'action' = 'admin_response') - created_at
                    )) / 3600.0 AS first_response_interval
                    FROM feedback
                    WHERE created_at >= $1
                      AND events IS NOT NULL
                      AND jsonb_array_length(COALESCE(events, '[]'::jsonb)) > 0
                ) sub
                WHERE first_response_interval IS NOT NULL AND first_response_interval > 0
            """, range_start)

            # Average resolution time (hours from created_at to resolved_at)
            avg_resolution = await conn.fetchrow("""
                SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0)
                    as avg_resolution_hours
                FROM feedback
                WHERE created_at >= $1
                  AND resolved_at IS NOT NULL
            """, range_start)

            # Trend: compare current period vs previous period
            prev_start = range_start - timedelta(days=days)
            trend = await conn.fetchrow("""
                SELECT
                    COUNT(*) FILTER (WHERE created_at >= $1) as current_total,
                    COUNT(*) FILTER (WHERE created_at >= $2 AND created_at < $1) as prev_total
                FROM feedback
                WHERE created_at >= $2
            """, range_start, prev_start)

            # Calculate trend percentage
            current_total = trend["current_total"] or 0
            prev_total = trend["prev_total"] or 0
            change_pct = round(((current_total - prev_total) / prev_total) * 100, 1) if prev_total > 0 else 0

            return {
                "by_type": [dict(r) for r in by_type],
                "by_status": [dict(r) for r in by_status],
                "total": totals["total"] or 0,
                "unresolved": totals["unresolved"] or 0,
                "auto_fixed": totals["auto_fixed"] or 0,
                "days": days,
                "aging_buckets": [dict(r) for r in aging],
                "avg_first_response_hours": round(float(avg_response["avg_first_response_hours"]), 1) if avg_response and avg_response["avg_first_response_hours"] else None,
                "avg_resolution_hours": round(float(avg_resolution["avg_resolution_hours"]), 1) if avg_resolution and avg_resolution["avg_resolution_hours"] else None,
                "trend": {
                    "current": current_total,
                    "previous": prev_total,
                    "change_pct": change_pct
                }
            }
    
    except Exception as e:
        logger.error(f"Error getting feedback stats: {e}")
        return {"error": str(e)}
