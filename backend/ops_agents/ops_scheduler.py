"""
Ops Scheduler

Orchestrates all Ops Copilot agents on their intervals.
Runs as an asyncio background task alongside the FastAPI server.

Schedule:
- Health Monitor: every 1 minute
- Security Watch: every 5 minutes
- Product Insights: every 1 hour
- Executive Summary: daily at 8:00 AM UTC
- Escalation Check: every 5 minutes
"""

import logging
import asyncio
from datetime import datetime, timezone, time as dt_time
from typing import Optional

logger = logging.getLogger(__name__)

# Singleton instance
_scheduler: Optional["OpsScheduler"] = None


class OpsScheduler:
    """
    Orchestrates all Ops Copilot agents.
    """
    
    # Intervals in seconds
    HEALTH_MONITOR_INTERVAL = 60          # 1 minute
    SECURITY_WATCH_INTERVAL = 5 * 60      # 5 minutes
    PRODUCT_INSIGHTS_INTERVAL = 60 * 60   # 1 hour
    ESCALATION_CHECK_INTERVAL = 5 * 60    # 5 minutes
    
    # Daily summary time (8:00 AM UTC)
    DAILY_SUMMARY_HOUR = 8
    DAILY_SUMMARY_MINUTE = 0
    
    def __init__(self, db=None):
        self.db = db
        self._running = False
        self._tasks = []
        self._last_daily_summary = None
    
    async def start(self):
        """Start all agent tasks."""
        if self._running:
            logger.warning("OpsScheduler already running")
            return
        
        self._running = True
        logger.info("OpsScheduler starting...")
        
        self._tasks = [
            asyncio.create_task(self._run_health_monitor()),
            asyncio.create_task(self._run_security_watch()),
            asyncio.create_task(self._run_product_insights()),
            asyncio.create_task(self._run_daily_summary()),
            asyncio.create_task(self._run_escalation_check()),
        ]
        
        logger.info("OpsScheduler started with 5 agent tasks")
    
    async def stop(self):
        """Stop all agent tasks."""
        if not self._running:
            return
        
        self._running = False
        
        for task in self._tasks:
            task.cancel()
        
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        
        self._tasks = []
        logger.info("OpsScheduler stopped")
    
    async def _run_health_monitor(self):
        """Run health monitor agent on schedule."""
        from .health_monitor import run_health_monitor
        
        logger.info("Health monitor agent starting (interval: 1 min)")
        
        while self._running:
            try:
                await run_health_monitor()
            except Exception as e:
                logger.error(f"Health monitor error: {e}")
            
            await asyncio.sleep(self.HEALTH_MONITOR_INTERVAL)
    
    async def _run_security_watch(self):
        """Run security watch agent on schedule."""
        from .security_watch import run_security_watch
        
        logger.info("Security watch agent starting (interval: 5 min)")
        
        # Initial delay to stagger startup
        await asyncio.sleep(30)
        
        while self._running:
            try:
                await run_security_watch()
            except Exception as e:
                logger.error(f"Security watch error: {e}")
            
            await asyncio.sleep(self.SECURITY_WATCH_INTERVAL)
    
    async def _run_product_insights(self):
        """Run product insights agent on schedule."""
        from .product_insights import run_product_insights
        
        logger.info("Product insights agent starting (interval: 1 hour)")
        
        # Initial delay
        await asyncio.sleep(60)
        
        while self._running:
            try:
                await run_product_insights()
            except Exception as e:
                logger.error(f"Product insights error: {e}")
            
            await asyncio.sleep(self.PRODUCT_INSIGHTS_INTERVAL)
    
    async def _run_daily_summary(self):
        """Run executive summary agent daily at 8:00 AM UTC."""
        from .executive_summary import run_executive_summary
        
        logger.info("Executive summary agent starting (daily at 8:00 AM UTC)")
        
        while self._running:
            now = datetime.now(timezone.utc)
            target_time = dt_time(self.DAILY_SUMMARY_HOUR, self.DAILY_SUMMARY_MINUTE)
            
            # Check if it's time to run
            if (now.hour == self.DAILY_SUMMARY_HOUR and 
                now.minute == self.DAILY_SUMMARY_MINUTE and
                self._last_daily_summary != now.date()):
                
                try:
                    await run_executive_summary()
                    self._last_daily_summary = now.date()
                except Exception as e:
                    logger.error(f"Executive summary error: {e}")
            
            # Sleep for 1 minute before checking again
            await asyncio.sleep(60)
    
    async def _run_escalation_check(self):
        """Run escalation check for unacknowledged P0 alerts."""
        from .notification_router import check_escalations
        
        logger.info("Escalation check starting (interval: 5 min)")
        
        # Initial delay
        await asyncio.sleep(120)
        
        while self._running:
            try:
                await check_escalations()
            except Exception as e:
                logger.error(f"Escalation check error: {e}")
            
            await asyncio.sleep(self.ESCALATION_CHECK_INTERVAL)


async def start_ops_scheduler(db=None) -> OpsScheduler:
    """
    Start the global OpsScheduler instance.
    Called from server.py on startup.
    """
    global _scheduler
    
    if _scheduler is not None:
        logger.warning("OpsScheduler already exists")
        return _scheduler
    
    _scheduler = OpsScheduler(db=db)
    await _scheduler.start()
    return _scheduler


async def stop_ops_scheduler():
    """
    Stop the global OpsScheduler instance.
    Called from server.py on shutdown.
    """
    global _scheduler
    
    if _scheduler is not None:
        await _scheduler.stop()
        _scheduler = None


def get_ops_scheduler() -> Optional[OpsScheduler]:
    """Get the current OpsScheduler instance."""
    return _scheduler
