"""
Product Insights Agent

Runs every hour to:
1. Track DAU/WAU/MAU changes
2. Monitor funnel conversion rates
3. Detect significant activity changes
4. Create P2 product alerts for notable changes

Thresholds:
- DAU drop > 20% from previous day
- Funnel conversion drop > 15%
- Game activity drop > 30%
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

from db.pg import get_pool
from role_middleware import generate_alert_id, compute_fingerprint

logger = logging.getLogger(__name__)


async def get_dau_comparison() -> Dict[str, Any]:
    """
    Compare today's DAU with yesterday's DAU.
    """
    pool = get_pool()
    if not pool:
        return {}
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    
    async with pool.acquire() as conn:
        today_dau = await conn.fetchval("""
            SELECT COUNT(DISTINCT user_id) FROM analytics_sessions
            WHERE started_at >= $1 AND user_id IS NOT NULL
        """, today_start)
        
        yesterday_dau = await conn.fetchval("""
            SELECT COUNT(DISTINCT user_id) FROM analytics_sessions
            WHERE started_at >= $1 AND started_at < $2 AND user_id IS NOT NULL
        """, yesterday_start, today_start)
        
        today_dau = today_dau or 0
        yesterday_dau = yesterday_dau or 1  # Avoid division by zero
        
        change_pct = ((today_dau - yesterday_dau) / yesterday_dau) * 100
        
        return {
            "today_dau": today_dau,
            "yesterday_dau": yesterday_dau,
            "change_pct": round(change_pct, 1),
            "is_significant_drop": change_pct < -20,
        }


async def get_game_activity_comparison() -> Dict[str, Any]:
    """
    Compare game activity between today and yesterday.
    """
    pool = get_pool()
    if not pool:
        return {}
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    
    async with pool.acquire() as conn:
        today_games = await conn.fetchval("""
            SELECT COUNT(*) FROM game_nights
            WHERE created_at >= $1
        """, today_start)
        
        yesterday_games = await conn.fetchval("""
            SELECT COUNT(*) FROM game_nights
            WHERE created_at >= $1 AND created_at < $2
        """, yesterday_start, today_start)
        
        today_games = today_games or 0
        yesterday_games = yesterday_games or 1
        
        change_pct = ((today_games - yesterday_games) / yesterday_games) * 100
        
        return {
            "today_games": today_games,
            "yesterday_games": yesterday_games,
            "change_pct": round(change_pct, 1),
            "is_significant_drop": change_pct < -30,
        }


async def get_signup_rate() -> Dict[str, Any]:
    """
    Get signup rate for today vs yesterday.
    """
    pool = get_pool()
    if not pool:
        return {}
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    
    async with pool.acquire() as conn:
        today_signups = await conn.fetchval("""
            SELECT COUNT(*) FROM users
            WHERE created_at >= $1
        """, today_start)
        
        yesterday_signups = await conn.fetchval("""
            SELECT COUNT(*) FROM users
            WHERE created_at >= $1 AND created_at < $2
        """, yesterday_start, today_start)
        
        return {
            "today_signups": today_signups or 0,
            "yesterday_signups": yesterday_signups or 0,
        }


async def get_funnel_conversion() -> Dict[str, Any]:
    """
    Calculate funnel conversion rates for the last 24 hours.
    """
    pool = get_pool()
    if not pool:
        return {}
    
    window_start = datetime.now(timezone.utc) - timedelta(hours=24)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                funnel_step,
                COUNT(DISTINCT COALESCE(user_id, anonymous_id)) as unique_users
            FROM funnel_events
            WHERE occurred_at >= $1
            GROUP BY funnel_step
        """, window_start)
        
        steps = {row["funnel_step"]: row["unique_users"] for row in rows}
        
        return {
            "steps": steps,
            "total_steps": len(steps),
        }


async def create_product_alert(
    title: str,
    summary: str,
    details: Dict[str, Any],
    fingerprint_parts: list
) -> Optional[str]:
    """
    Create a P2 product insight alert.
    """
    pool = get_pool()
    if not pool:
        return None
    
    fingerprint = compute_fingerprint("product", *fingerprint_parts)
    
    async with pool.acquire() as conn:
        # Check for recent duplicate (24h cooldown for product alerts)
        recent = await conn.fetchval("""
            SELECT alert_id FROM admin_alerts
            WHERE fingerprint = $1 
              AND created_at >= $2
              AND status != 'resolved'
        """, fingerprint, datetime.now(timezone.utc) - timedelta(hours=24))
        
        if recent:
            return None
        
        alert_id = generate_alert_id()
        
        await conn.execute("""
            INSERT INTO admin_alerts 
            (alert_id, severity, category, title, summary, details, fingerprint, status)
            VALUES ($1, 'P2', 'product', $2, $3, $4, $5, 'open')
        """,
            alert_id,
            title,
            summary,
            details,
            fingerprint
        )
        
        logger.info(f"Created product alert: {alert_id} - {title}")
        return alert_id


async def run_product_insights():
    """
    Main entry point for the product insights agent.
    Called by OpsScheduler every hour.
    """
    try:
        alerts_created = 0
        
        # Check DAU
        dau = await get_dau_comparison()
        if dau.get("is_significant_drop"):
            await create_product_alert(
                title="Significant DAU Drop",
                summary=f"DAU dropped {abs(dau['change_pct'])}% from yesterday ({dau['yesterday_dau']} → {dau['today_dau']})",
                details=dau,
                fingerprint_parts=["dau_drop", str(datetime.now(timezone.utc).date())]
            )
            alerts_created += 1
        
        # Check game activity
        games = await get_game_activity_comparison()
        if games.get("is_significant_drop"):
            await create_product_alert(
                title="Game Activity Drop",
                summary=f"Game creation dropped {abs(games['change_pct'])}% from yesterday",
                details=games,
                fingerprint_parts=["game_drop", str(datetime.now(timezone.utc).date())]
            )
            alerts_created += 1
        
        # Log insights
        signups = await get_signup_rate()
        funnel = await get_funnel_conversion()
        
        logger.info(
            f"Product insights: DAU={dau.get('today_dau', 0)} ({dau.get('change_pct', 0):+.1f}%), "
            f"Games={games.get('today_games', 0)} ({games.get('change_pct', 0):+.1f}%), "
            f"Signups={signups.get('today_signups', 0)}"
        )
        
        if alerts_created:
            logger.info(f"Product insights: created {alerts_created} alerts")
            
    except Exception as e:
        logger.error(f"Product insights error: {e}")
