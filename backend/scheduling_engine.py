"""
Scheduling Engine — Occurrence generation, RRULE logic, TZ handling.

Generates materialized occurrence rows from scheduled_events recurrence rules.
DST-safe: stores human intent (local_start_time + timezone) and derives UTC per-date.
"""

import uuid
import logging
from datetime import date, time, datetime, timedelta, timezone
from typing import List, Dict, Optional, Any
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

DEFAULT_WINDOW_WEEKS = 8


def make_id(prefix: str) -> str:
    """Generate a prefixed short ID (e.g., 'occ_a1b2c3d4e5f6')."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def local_to_utc(local_date: date, local_time: time, tzid: str) -> datetime:
    """
    Convert a local date + time + IANA timezone to UTC datetime.

    DST-safe: "7pm ET" stays 7pm local regardless of DST.
    - Mar 8 (EST): 7:00 PM → 00:00 UTC Mar 9
    - Mar 15 (EDT): 7:00 PM → 23:00 UTC Mar 15
    """
    tz = ZoneInfo(tzid)
    local_dt = datetime.combine(local_date, local_time, tzinfo=tz)
    return local_dt.astimezone(timezone.utc)


def utc_to_local(utc_dt: datetime, tzid: str) -> datetime:
    """Convert a UTC datetime to local datetime in the given timezone."""
    tz = ZoneInfo(tzid)
    return utc_dt.astimezone(tz)


def generate_occurrences(
    event: Dict[str, Any],
    from_date: Optional[date] = None,
    weeks_ahead: int = DEFAULT_WINDOW_WEEKS,
) -> List[Dict[str, Any]]:
    """
    Generate occurrence dicts from an event's recurrence rules.

    Args:
        event: Dict with keys: event_id, starts_at, local_start_time, timezone,
               duration_minutes, location, recurrence, rrule_weekdays,
               rrule_interval, rrule_until, rrule_count
        from_date: Start generating from this date (default: today)
        weeks_ahead: How many weeks ahead to generate (default: 8)

    Returns:
        List of occurrence dicts ready for DB insertion.
    """
    if from_date is None:
        from_date = date.today()

    event_id = event["event_id"]
    local_time = event["local_start_time"]
    if isinstance(local_time, str):
        local_time = time.fromisoformat(local_time)
    tzid = event.get("timezone", "America/New_York")
    duration = event.get("duration_minutes", 180)
    location = event.get("location")
    recurrence = event.get("recurrence", "none")

    # Parse the initial start date from starts_at
    starts_at = event["starts_at"]
    if isinstance(starts_at, str):
        starts_at = datetime.fromisoformat(starts_at)
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=timezone.utc)

    # Get the local start date
    local_start = utc_to_local(starts_at, tzid)
    start_date = local_start.date()

    occurrences = []

    if recurrence == "none":
        # One-time event: single occurrence
        utc_start = local_to_utc(start_date, local_time, tzid)
        occurrences.append(_make_occurrence(
            event_id=event_id,
            index=0,
            starts_at=utc_start,
            duration=duration,
            location=location,
        ))
        return occurrences

    # Recurring: generate occurrences within the window
    end_date = from_date + timedelta(weeks=weeks_ahead)

    rrule_until = event.get("rrule_until")
    if isinstance(rrule_until, str):
        rrule_until = date.fromisoformat(rrule_until)
    if rrule_until:
        # rrule_until is inclusive, so add 1 day for the < boundary check
        end_date = min(end_date, rrule_until + timedelta(days=1))

    rrule_count = event.get("rrule_count")
    interval = event.get("rrule_interval", 1)
    weekdays = event.get("rrule_weekdays")  # 0=Mon..6=Sun

    if recurrence in ("weekly", "biweekly"):
        if recurrence == "biweekly":
            interval = 2
        occurrences = _generate_weekly(
            event_id=event_id,
            start_date=start_date,
            local_time=local_time,
            tzid=tzid,
            duration=duration,
            location=location,
            interval=interval,
            weekdays=weekdays,
            end_date=end_date,
            max_count=rrule_count,
            from_date=from_date,
        )
    elif recurrence == "custom":
        occurrences = _generate_weekly(
            event_id=event_id,
            start_date=start_date,
            local_time=local_time,
            tzid=tzid,
            duration=duration,
            location=location,
            interval=interval,
            weekdays=weekdays,
            end_date=end_date,
            max_count=rrule_count,
            from_date=from_date,
        )

    return occurrences


def _generate_weekly(
    event_id: str,
    start_date: date,
    local_time: time,
    tzid: str,
    duration: int,
    location: Optional[str],
    interval: int,
    weekdays: Optional[List[int]],
    end_date: date,
    max_count: Optional[int],
    from_date: date,
) -> List[Dict[str, Any]]:
    """Generate weekly/biweekly/custom occurrences."""
    occurrences = []
    index = 0

    # If no weekdays specified, use the start_date's weekday
    if not weekdays:
        weekdays = [start_date.weekday()]

    current_week_start = start_date - timedelta(days=start_date.weekday())  # Monday of start week

    while True:
        for wd in sorted(weekdays):
            occ_date = current_week_start + timedelta(days=wd)

            # Skip dates before the series start
            if occ_date < start_date:
                continue

            # Stop if at or past the end date
            if occ_date >= end_date:
                return occurrences

            # Stop if max count reached
            if max_count is not None and index >= max_count:
                return occurrences

            utc_start = local_to_utc(occ_date, local_time, tzid)
            occurrences.append(_make_occurrence(
                event_id=event_id,
                index=index,
                starts_at=utc_start,
                duration=duration,
                location=location,
            ))
            index += 1

        current_week_start += timedelta(weeks=interval)

        # Safety: don't generate more than 52 occurrences in one call
        if index >= 52:
            break

    return occurrences


def _make_occurrence(
    event_id: str,
    index: int,
    starts_at: datetime,
    duration: int,
    location: Optional[str],
) -> Dict[str, Any]:
    """Create a single occurrence dict."""
    return {
        "occurrence_id": make_id("occ"),
        "event_id": event_id,
        "occurrence_index": index,
        "starts_at": starts_at,
        "duration_minutes": duration,
        "location": location,
        "is_exception": False,
        "is_override": False,
        "status": "upcoming",
        "game_id": None,
        "reminder_24h_sent": False,
        "reminder_2h_sent": False,
    }


async def create_invites_for_occurrence(
    pool,
    occurrence_id: str,
    group_id: str,
    host_id: str,
    invite_scope: str = "group",
    selected_invitees: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Create invite rows for all eligible users of an occurrence.

    Args:
        pool: asyncpg connection pool
        occurrence_id: The occurrence to create invites for
        group_id: The group this event belongs to
        host_id: The host user_id (excluded from invites — they're auto-accepted)
        invite_scope: 'group' (all members) or 'selected' (specific users)
        selected_invitees: List of user_ids if invite_scope='selected'

    Returns:
        List of created invite dicts.
    """
    invites = []

    if invite_scope == "selected" and selected_invitees:
        user_ids = selected_invitees
    else:
        # Get all active group members
        rows = await pool.fetch(
            "SELECT user_id FROM group_members WHERE group_id = $1 AND status = 'active'",
            group_id,
        )
        user_ids = [r["user_id"] for r in rows]

    for user_id in user_ids:
        invite_id = make_id("inv")
        # Host is auto-accepted
        status = "accepted" if user_id == host_id else "invited"
        responded_at = datetime.now(timezone.utc) if user_id == host_id else None

        try:
            await pool.execute(
                """
                INSERT INTO event_invites (invite_id, occurrence_id, user_id, status, responded_at)
                VALUES ($1, $2, $3, $4::invite_status, $5)
                ON CONFLICT (occurrence_id, user_id) DO NOTHING
                """,
                invite_id, occurrence_id, user_id, status, responded_at,
            )
            invites.append({
                "invite_id": invite_id,
                "occurrence_id": occurrence_id,
                "user_id": user_id,
                "status": status,
            })
        except Exception as e:
            logger.error(f"Failed to create invite for {user_id}: {e}")

    return invites


async def get_rsvp_stats(pool, occurrence_id: str) -> Dict[str, int]:
    """
    Get RSVP statistics for an occurrence.

    Returns:
        Dict with keys: accepted, declined, maybe, invited, proposed_new_time,
        no_response, total
    """
    rows = await pool.fetch(
        """
        SELECT status::text, COUNT(*) as cnt
        FROM event_invites
        WHERE occurrence_id = $1
        GROUP BY status
        """,
        occurrence_id,
    )

    stats = {
        "accepted": 0,
        "declined": 0,
        "maybe": 0,
        "invited": 0,
        "proposed_new_time": 0,
        "no_response": 0,
    }

    for row in rows:
        status = row["status"]
        if status in stats:
            stats[status] = row["cnt"]

    stats["total"] = sum(stats.values())
    return stats
