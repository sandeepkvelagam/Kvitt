"""
Kvitt Ops Agents

24/7 background agents for platform health monitoring, security watch,
product insights, and automated alerting.

Agents:
- HealthMonitorAgent: Monitors error rates, latency, crashes (runs every 1 min)
- SecurityWatchAgent: Detects security anomalies (runs every 5 min)
- ProductInsightsAgent: Tracks DAU/funnel/activity deltas (runs every hour)
- ExecutiveSummaryAgent: Generates daily ops brief (runs daily at 8am)
- NotificationRouterAgent: Routes alerts to email/in-app with dedupe

Scheduler:
- OpsScheduler: Orchestrates all agents on their intervals
"""

from .ops_scheduler import OpsScheduler, start_ops_scheduler, stop_ops_scheduler

__all__ = [
    "OpsScheduler",
    "start_ops_scheduler",
    "stop_ops_scheduler",
]
