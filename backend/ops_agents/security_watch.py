"""
Security Watch Agent

Runs every 5 minutes to:
1. Detect brute force login attempts
2. Detect suspicious geo patterns
3. Detect token anomalies
4. Create security alerts for high-risk events

Thresholds:
- Brute force: > 10 auth_failed from same IP in 5 min
- Suspicious geo: > 3 different countries for same user in 1 hour
- High risk: Any event with risk_score > 70
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

from db.pg import get_pool
from role_middleware import generate_alert_id, compute_fingerprint

logger = logging.getLogger(__name__)


async def detect_brute_force(window_minutes: int = 5) -> List[Dict[str, Any]]:
    """
    Detect brute force login attempts.
    Returns list of suspicious IPs with their attempt counts.
    """
    pool = get_pool()
    if not pool:
        return []
    
    window_start = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                ip_hash,
                COUNT(*) as attempt_count,
                COUNT(DISTINCT user_id) as targeted_users,
                array_agg(DISTINCT geo_country) as countries
            FROM security_events
            WHERE occurred_at >= $1 
              AND event_type = 'auth_failed'
              AND ip_hash IS NOT NULL
            GROUP BY ip_hash
            HAVING COUNT(*) > 10
            ORDER BY attempt_count DESC
        """, window_start)
        
        return [dict(row) for row in rows]


async def detect_suspicious_geo(window_hours: int = 1) -> List[Dict[str, Any]]:
    """
    Detect users logging in from multiple countries in short time.
    """
    pool = get_pool()
    if not pool:
        return []
    
    window_start = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                user_id,
                array_agg(DISTINCT geo_country) as countries,
                COUNT(DISTINCT geo_country) as country_count,
                COUNT(*) as event_count
            FROM security_events
            WHERE occurred_at >= $1 
              AND event_type IN ('auth_success', 'token_refresh')
              AND user_id IS NOT NULL
              AND geo_country IS NOT NULL
            GROUP BY user_id
            HAVING COUNT(DISTINCT geo_country) >= 3
        """, window_start)
        
        return [dict(row) for row in rows]


async def detect_high_risk_events(window_minutes: int = 5) -> List[Dict[str, Any]]:
    """
    Get recent high-risk security events.
    """
    pool = get_pool()
    if not pool:
        return []
    
    window_start = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                event_id,
                event_type,
                user_id,
                ip_hash,
                geo_country,
                risk_score,
                risk_factors,
                blocked,
                details,
                occurred_at
            FROM security_events
            WHERE occurred_at >= $1 
              AND risk_score > 70
            ORDER BY risk_score DESC, occurred_at DESC
            LIMIT 50
        """, window_start)
        
        return [dict(row) for row in rows]


async def create_security_alert(
    severity: str,
    title: str,
    summary: str,
    details: Dict[str, Any],
    fingerprint_parts: list
) -> str:
    """
    Create a security alert with deduplication.
    """
    pool = get_pool()
    if not pool:
        return None
    
    fingerprint = compute_fingerprint("security", *fingerprint_parts)
    
    async with pool.acquire() as conn:
        # Check for recent duplicate
        recent = await conn.fetchval("""
            SELECT alert_id FROM admin_alerts
            WHERE fingerprint = $1 
              AND created_at >= $2
              AND status != 'resolved'
        """, fingerprint, datetime.now(timezone.utc) - timedelta(minutes=30))
        
        if recent:
            logger.debug(f"Skipping duplicate security alert")
            return None
        
        alert_id = generate_alert_id()
        
        await conn.execute("""
            INSERT INTO admin_alerts 
            (alert_id, severity, category, title, summary, details, fingerprint, status)
            VALUES ($1, $2, 'security', $3, $4, $5, $6, 'open')
        """,
            alert_id,
            severity,
            title,
            summary,
            details,
            fingerprint
        )
        
        logger.warning(f"Created security alert: {alert_id} [{severity}] - {title}")
        
        # Trigger notification
        from .notification_router import route_alert_notification
        await route_alert_notification(alert_id, severity, "security", title, summary)
        
        return alert_id


async def run_security_watch():
    """
    Main entry point for the security watch agent.
    Called by OpsScheduler every 5 minutes.
    """
    try:
        alerts_created = 0
        
        # Check for brute force attacks
        brute_force = await detect_brute_force(window_minutes=5)
        for attack in brute_force:
            await create_security_alert(
                severity="P1",
                title="Brute Force Attack Detected",
                summary=f"IP {attack['ip_hash'][:16]}... made {attack['attempt_count']} failed login attempts",
                details=attack,
                fingerprint_parts=["brute_force", attack["ip_hash"]]
            )
            alerts_created += 1
        
        # Check for suspicious geo patterns
        suspicious_geo = await detect_suspicious_geo(window_hours=1)
        for pattern in suspicious_geo:
            await create_security_alert(
                severity="P1",
                title="Suspicious Geo Pattern",
                summary=f"User {pattern['user_id']} logged in from {pattern['country_count']} countries: {', '.join(pattern['countries'])}",
                details=pattern,
                fingerprint_parts=["suspicious_geo", pattern["user_id"]]
            )
            alerts_created += 1
        
        # Check for high-risk events
        high_risk = await detect_high_risk_events(window_minutes=5)
        if len(high_risk) >= 5:
            # Aggregate alert for multiple high-risk events
            await create_security_alert(
                severity="P1",
                title="Multiple High-Risk Security Events",
                summary=f"{len(high_risk)} high-risk events detected in the last 5 minutes",
                details={"events": high_risk[:10], "total_count": len(high_risk)},
                fingerprint_parts=["high_risk_batch", str(len(high_risk))]
            )
            alerts_created += 1
        elif high_risk:
            # Individual alerts for fewer events
            for event in high_risk[:3]:
                await create_security_alert(
                    severity="P2",
                    title=f"High-Risk Event: {event['event_type']}",
                    summary=f"Risk score {event['risk_score']} - {', '.join(event['risk_factors'] or [])}",
                    details=event,
                    fingerprint_parts=["high_risk", event["event_id"]]
                )
                alerts_created += 1
        
        if alerts_created:
            logger.info(f"Security watch: created {alerts_created} alerts")
        else:
            logger.debug("Security watch: no anomalies detected")
            
    except Exception as e:
        logger.error(f"Security watch error: {e}")
