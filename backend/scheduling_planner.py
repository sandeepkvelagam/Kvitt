"""
Heuristic scheduling proposals for POST /api/scheduler/plan.
Pure time/math helpers are unit-tested without DB.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone, time
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo


INTENTS = frozenset(
    {
        "schedule_now",
        "rematch_last",
        "plan_weekend",
        "resume_draft",
        "use_last_setup",
    }
)


def next_friday_19_local(now_local: datetime, tz: ZoneInfo) -> datetime:
    """Next Friday 7:00 PM local (or following week if that time already passed today)."""
    target_py_wd = 4  # Friday
    days_ahead = (target_py_wd - now_local.weekday()) % 7
    d = now_local.date()
    if days_ahead == 0:
        cand = datetime.combine(d, time(19, 0), tzinfo=tz)
        if cand <= now_local:
            days_ahead = 7
    elif days_ahead < 0:
        days_ahead += 7
    target_date = d + timedelta(days=days_ahead)
    return datetime.combine(target_date, time(19, 0), tzinfo=tz)


def next_saturday_19_local(now_local: datetime, tz: ZoneInfo) -> datetime:
    """Next Saturday 7:00 PM local."""
    target_py_wd = 5  # Saturday
    days_ahead = (target_py_wd - now_local.weekday()) % 7
    d = now_local.date()
    if days_ahead == 0:
        cand = datetime.combine(d, time(19, 0), tzinfo=tz)
        if cand <= now_local:
            days_ahead = 7
    target_date = d + timedelta(days=days_ahead)
    return datetime.combine(target_date, time(19, 0), tzinfo=tz)


def tomorrow_19_local(now_local: datetime, tz: ZoneInfo) -> datetime:
    d = now_local.date() + timedelta(days=1)
    return datetime.combine(d, time(19, 0), tzinfo=tz)


def ensure_future_local(dt_local: datetime, now_local: datetime, tz: ZoneInfo) -> datetime:
    """If dt is in the past, advance by whole weeks until future."""
    out = dt_local
    while out <= now_local:
        out = out + timedelta(days=7)
    return out


def local_from_last_occurrence(
    last_starts_at: datetime,
    now_local: datetime,
    tz: ZoneInfo,
) -> datetime:
    """Same weekday/time as last occurrence, in the future."""
    if last_starts_at.tzinfo is None:
        last_starts_at = last_starts_at.replace(tzinfo=timezone.utc)
    last_local = last_starts_at.astimezone(tz)
    hh, mm = last_local.hour, last_local.minute
    # Next occurrence of that weekday at hh:mm
    target_py_wd = last_local.weekday()
    days_ahead = (target_py_wd - now_local.weekday()) % 7
    d = now_local.date()
    if days_ahead == 0:
        cand = datetime.combine(d, time(hh, mm, tzinfo=tz))
        if cand <= now_local:
            days_ahead = 7
    target_date = d + timedelta(days=days_ahead)
    out = datetime.combine(target_date, time(hh, mm, tzinfo=tz))
    return ensure_future_local(out, now_local, tz)


def merge_draft_proposal(
    draft: Dict[str, Any],
    group_id: str,
    tz_name: str,
    now_utc: datetime,
) -> Tuple[datetime, str]:
    """Parse client draft; return (starts_at_utc, title)."""
    tz = ZoneInfo(tz_name or "America/New_York")
    now_local = now_utc.astimezone(tz)
    raw = draft.get("starts_at")
    if not raw:
        return next_friday_19_local(now_local, tz).astimezone(timezone.utc), str(
            draft.get("title") or "Game night"
        )
    if isinstance(raw, str):
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    else:
        dt = now_utc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone(tz)
    local = ensure_future_local(local, now_local, tz)
    return local.astimezone(timezone.utc), str(draft.get("title") or "Game night")


def build_proposal_times(
    intent: str,
    tz_name: str,
    now_utc: datetime,
    last_event: Optional[Dict[str, Any]],
) -> Tuple[datetime, str]:
    """
    Returns (starts_at UTC aware, rationale snippet).
    """
    tz = ZoneInfo(tz_name or "America/New_York")
    now_local = now_utc.astimezone(tz)

    if intent == "plan_weekend":
        local = next_saturday_19_local(now_local, tz)
        return local.astimezone(timezone.utc), "Saturday evening works well for most groups."

    if intent in ("rematch_last", "use_last_setup") and last_event and last_event.get("occ_starts_at"):
        occ = last_event["occ_starts_at"]
        if isinstance(occ, str):
            occ = datetime.fromisoformat(occ.replace("Z", "+00:00"))
        if occ.tzinfo is None:
            occ = occ.replace(tzinfo=timezone.utc)
        local = local_from_last_occurrence(occ, now_local, tz)
        reason = (
            "Same rhythm as your last game in this group."
            if intent == "rematch_last"
            else "Reusing your last setup and timing."
        )
        return local.astimezone(timezone.utc), reason

    if intent == "schedule_now":
        local = tomorrow_19_local(now_local, tz)
        if local <= now_local:
            local = next_friday_19_local(now_local, tz)
        return local.astimezone(timezone.utc), "Next available evening slot for your group."

    # resume_draft without draft payload — fall through
    local = next_friday_19_local(now_local, tz)
    return local.astimezone(timezone.utc), "Here’s a strong default time—tap Adjust if you want changes."


def proposal_body_from_context(
    intent: str,
    group_id: str,
    tz_name: str,
    now_utc: datetime,
    last_event: Optional[Dict[str, Any]],
    draft: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], str]:
    """Full proposal dict for POST /events + rationale string."""

    if intent == "resume_draft" and draft:
        starts_at_utc, title = merge_draft_proposal(draft, group_id, tz_name, now_utc)
        rationale = "Picked up where you left off."
    elif intent == "resume_draft":
        starts_at_utc, rationale = build_proposal_times("schedule_now", tz_name, now_utc, last_event)
        title = str(last_event.get("title") or "Game night") if last_event else "Game night"
    else:
        starts_at_utc, rationale = build_proposal_times(intent, tz_name, now_utc, last_event)
        if last_event:
            title = str(last_event.get("title") or "Game night")
        else:
            title = "Game night"

    game_category = "poker"
    default_buy_in: Optional[float] = 20.0
    location = None
    duration_minutes = 180

    if last_event:
        game_category = str(last_event.get("game_category") or "poker")
        if last_event.get("default_buy_in") is not None:
            try:
                default_buy_in = float(last_event["default_buy_in"])
            except (TypeError, ValueError):
                default_buy_in = 20.0
        location = last_event.get("location")
        if last_event.get("duration_minutes"):
            try:
                duration_minutes = int(last_event["duration_minutes"])
            except (TypeError, ValueError):
                duration_minutes = 180

    if draft:
        if draft.get("title"):
            title = str(draft["title"])
        if draft.get("game_category"):
            game_category = str(draft["game_category"])
        if draft.get("default_buy_in") is not None:
            try:
                default_buy_in = float(draft["default_buy_in"])
            except (TypeError, ValueError):
                pass
        if draft.get("location") is not None:
            location = draft.get("location")
        if draft.get("duration_minutes") is not None:
            try:
                duration_minutes = int(draft["duration_minutes"])
            except (TypeError, ValueError):
                pass

    proposal = {
        "group_id": group_id,
        "title": title[:200],
        "starts_at": starts_at_utc.isoformat(),
        "duration_minutes": duration_minutes,
        "location": location,
        "game_category": game_category,
        "recurrence": "none",
        "default_buy_in": default_buy_in,
        "default_chips_per_buy_in": 20,
        "timezone": tz_name or "America/New_York",
        "invite_scope": "group",
    }
    return proposal, rationale
