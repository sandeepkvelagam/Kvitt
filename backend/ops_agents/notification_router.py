"""
Notification Router Agent

Routes alerts to appropriate channels with deduplication:
- P0: Email + In-app (immediate)
- P1: Email + In-app (immediate)
- P2: In-app only (batched)

Features:
- Fingerprint-based deduplication
- Cooldown windows per channel
- Audit logging to alert_notifications_log
- Escalation for unacknowledged P0 alerts
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from db.pg import get_pool

logger = logging.getLogger(__name__)

# Cooldown windows (in minutes) per severity
COOLDOWN_WINDOWS = {
    "P0": 5,   # Can re-notify every 5 min for P0
    "P1": 15,  # Every 15 min for P1
    "P2": 60,  # Every hour for P2
}


async def should_send_notification(
    alert_id: str,
    channel: str,
    recipient: str,
    severity: str
) -> bool:
    """
    Check if we should send this notification (deduplication).
    """
    pool = get_pool()
    if not pool:
        return False
    
    cooldown_minutes = COOLDOWN_WINDOWS.get(severity, 30)
    cooldown_start = datetime.now(timezone.utc) - timedelta(minutes=cooldown_minutes)
    
    async with pool.acquire() as conn:
        recent = await conn.fetchval("""
            SELECT id FROM alert_notifications_log
            WHERE alert_id = $1 
              AND channel = $2 
              AND recipient = $3
              AND sent_at >= $4
              AND status = 'sent'
        """, alert_id, channel, recipient, cooldown_start)
        
        return recent is None


async def log_notification(
    alert_id: str,
    channel: str,
    recipient: str,
    status: str = "sent",
    provider_message_id: Optional[str] = None,
    error_message: Optional[str] = None
):
    """
    Log notification to alert_notifications_log.
    """
    pool = get_pool()
    if not pool:
        return
    
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO alert_notifications_log 
                (alert_id, channel, recipient, status, provider_message_id, error_message)
                VALUES ($1, $2, $3, $4, $5, $6)
            """,
                alert_id,
                channel,
                recipient,
                status,
                provider_message_id,
                error_message
            )
    except Exception as e:
        logger.error(f"Failed to log notification: {e}")


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


async def get_super_admin_user_ids() -> List[str]:
    """
    Get user IDs of all super admins.
    """
    pool = get_pool()
    if not pool:
        return []
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT user_id FROM users WHERE app_role = 'super_admin'
        """)
        return [row["user_id"] for row in rows]


async def send_email_notification(
    alert_id: str,
    severity: str,
    category: str,
    title: str,
    summary: str,
    recipients: List[str]
):
    """
    Send email notification to recipients.
    """
    try:
        from email_service import send_email
        
        subject = f"[{severity}] {title}"
        body = f"""
Kvitt Alert Notification

Severity: {severity}
Category: {category}
Title: {title}

Summary:
{summary}

---
View in Admin Dashboard: /admin
Alert ID: {alert_id}
        """.strip()
        
        for email in recipients:
            if not await should_send_notification(alert_id, "email", email, severity):
                logger.debug(f"Skipping email to {email} (cooldown)")
                continue
            
            try:
                await send_email(email, subject, body)
                await log_notification(alert_id, "email", email, "sent")
                logger.info(f"Sent alert email to {email}")
            except Exception as e:
                await log_notification(alert_id, "email", email, "failed", error_message=str(e))
                logger.warning(f"Failed to send email to {email}: {e}")
                
    except ImportError:
        logger.debug("email_service not available")
    except Exception as e:
        logger.error(f"Email notification error: {e}")


async def send_in_app_notification(
    alert_id: str,
    severity: str,
    category: str,
    title: str,
    summary: str,
    user_ids: List[str]
):
    """
    Create in-app notifications for super admins.
    """
    pool = get_pool()
    if not pool:
        return
    
    notification_type = f"admin_alert_{severity.lower()}"
    
    for user_id in user_ids:
        if not await should_send_notification(alert_id, "in_app", user_id, severity):
            continue
        
        try:
            async with pool.acquire() as conn:
                # Create notification in the notifications table
                import uuid
                notif_id = f"notif_{uuid.uuid4().hex[:12]}"
                
                await conn.execute("""
                    INSERT INTO notifications 
                    (notification_id, user_id, type, title, message, data, read)
                    VALUES ($1, $2, $3, $4, $5, $6, false)
                """,
                    notif_id,
                    user_id,
                    notification_type,
                    f"[{severity}] {title}",
                    summary[:200],
                    {"alert_id": alert_id, "category": category, "severity": severity}
                )
                
                await log_notification(alert_id, "in_app", user_id, "sent")
                logger.debug(f"Created in-app notification for {user_id}")
                
        except Exception as e:
            await log_notification(alert_id, "in_app", user_id, "failed", error_message=str(e))
            logger.warning(f"Failed to create in-app notification for {user_id}: {e}")


async def route_alert_notification(
    alert_id: str,
    severity: str,
    category: str,
    title: str,
    summary: str
):
    """
    Main entry point for routing alert notifications.
    Called by other agents when they create alerts.
    
    Routing rules:
    - P0: Email + In-app (immediate)
    - P1: Email + In-app (immediate)
    - P2: In-app only
    """
    try:
        admin_emails = await get_super_admin_emails()
        admin_user_ids = await get_super_admin_user_ids()
        
        if not admin_emails and not admin_user_ids:
            logger.warning("No super admins configured for notifications")
            return
        
        # P0 and P1: Email + In-app
        if severity in ("P0", "P1"):
            if admin_emails:
                await send_email_notification(
                    alert_id, severity, category, title, summary, admin_emails
                )
            if admin_user_ids:
                await send_in_app_notification(
                    alert_id, severity, category, title, summary, admin_user_ids
                )
        
        # P2: In-app only
        elif severity == "P2":
            if admin_user_ids:
                await send_in_app_notification(
                    alert_id, severity, category, title, summary, admin_user_ids
                )
        
        logger.info(f"Routed notifications for alert {alert_id} [{severity}]")
        
    except Exception as e:
        logger.error(f"Notification routing error: {e}")


async def check_escalations():
    """
    Check for P0 alerts that haven't been acknowledged and re-notify.
    Called periodically by OpsScheduler.
    """
    pool = get_pool()
    if not pool:
        return
    
    # P0 alerts open for more than 15 minutes without acknowledgment
    escalation_threshold = datetime.now(timezone.utc) - timedelta(minutes=15)
    
    try:
        async with pool.acquire() as conn:
            unacked = await conn.fetch("""
                SELECT alert_id, title, summary, category
                FROM admin_alerts
                WHERE severity = 'P0'
                  AND status = 'open'
                  AND acknowledged_at IS NULL
                  AND created_at <= $1
            """, escalation_threshold)
            
            for alert in unacked:
                logger.warning(f"Escalating unacknowledged P0 alert: {alert['alert_id']}")
                await route_alert_notification(
                    alert["alert_id"],
                    "P0",
                    alert["category"],
                    f"[ESCALATION] {alert['title']}",
                    f"UNACKNOWLEDGED FOR 15+ MINUTES: {alert['summary']}"
                )
                
    except Exception as e:
        logger.error(f"Escalation check error: {e}")
