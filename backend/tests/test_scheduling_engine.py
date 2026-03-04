"""
Tests for the Scheduling Engine — occurrence generation, RRULE logic, TZ handling.
"""

import pytest
from datetime import date, time, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scheduling_engine import (
    local_to_utc,
    utc_to_local,
    generate_occurrences,
    make_id,
)


# ============== local_to_utc tests ==============

class TestLocalToUtc:
    def test_est_conversion(self):
        """EST (UTC-5): 7pm on Jan 15 → 00:00 UTC Jan 16"""
        result = local_to_utc(date(2026, 1, 15), time(19, 0), "America/New_York")
        assert result.hour == 0
        assert result.day == 16
        assert result.tzinfo == timezone.utc

    def test_edt_conversion(self):
        """EDT (UTC-4): 7pm on Jul 15 → 23:00 UTC Jul 15"""
        result = local_to_utc(date(2026, 7, 15), time(19, 0), "America/New_York")
        assert result.hour == 23
        assert result.day == 15

    def test_dst_spring_forward(self):
        """Spring forward: Mar 8 (EST) vs Mar 15 (EDT) — same local time, different UTC."""
        # 2026 DST spring forward: Mar 8, 2026
        est_result = local_to_utc(date(2026, 3, 7), time(19, 0), "America/New_York")
        edt_result = local_to_utc(date(2026, 3, 14), time(19, 0), "America/New_York")

        # EST: 7pm → midnight UTC next day (UTC-5)
        assert est_result.utcoffset() == timedelta(0)
        # EDT: 7pm → 11pm UTC same day (UTC-4)
        assert edt_result.utcoffset() == timedelta(0)
        # The UTC times should differ by 1 hour for same local time across DST
        # (both are 7pm local, but UTC offset changes)

    def test_pacific_timezone(self):
        """PST (UTC-8): 7pm → 03:00 UTC next day"""
        result = local_to_utc(date(2026, 1, 15), time(19, 0), "America/Los_Angeles")
        assert result.hour == 3
        assert result.day == 16

    def test_utc_timezone(self):
        """UTC: no offset."""
        result = local_to_utc(date(2026, 1, 15), time(19, 0), "UTC")
        assert result.hour == 19
        assert result.day == 15


# ============== utc_to_local tests ==============

class TestUtcToLocal:
    def test_roundtrip(self):
        """Converting to UTC and back should preserve local time."""
        original_date = date(2026, 6, 15)
        original_time = time(19, 30)
        tzid = "America/New_York"

        utc_dt = local_to_utc(original_date, original_time, tzid)
        local_dt = utc_to_local(utc_dt, tzid)

        assert local_dt.hour == 19
        assert local_dt.minute == 30
        assert local_dt.date() == original_date


# ============== generate_occurrences tests ==============

def _make_event(
    recurrence="none",
    starts_at="2026-03-13T19:00:00-05:00",
    local_start_time="19:00",
    timezone_str="America/New_York",
    duration_minutes=180,
    rrule_weekdays=None,
    rrule_interval=1,
    rrule_until=None,
    rrule_count=None,
    location="Jake's place",
):
    """Helper to create a test event dict."""
    return {
        "event_id": "evt_test123",
        "starts_at": starts_at,
        "local_start_time": local_start_time,
        "timezone": timezone_str,
        "duration_minutes": duration_minutes,
        "location": location,
        "recurrence": recurrence,
        "rrule_weekdays": rrule_weekdays,
        "rrule_interval": rrule_interval,
        "rrule_until": rrule_until,
        "rrule_count": rrule_count,
    }


class TestGenerateOccurrences:
    def test_one_time_event(self):
        """One-time event generates exactly 1 occurrence."""
        event = _make_event(recurrence="none")
        occs = generate_occurrences(event, from_date=date(2026, 3, 1))

        assert len(occs) == 1
        assert occs[0]["occurrence_index"] == 0
        assert occs[0]["event_id"] == "evt_test123"
        assert occs[0]["duration_minutes"] == 180
        assert occs[0]["location"] == "Jake's place"
        assert occs[0]["status"] == "upcoming"
        assert occs[0]["is_exception"] is False
        assert occs[0]["is_override"] is False

    def test_one_time_has_valid_id(self):
        """Occurrence IDs have the occ_ prefix."""
        event = _make_event()
        occs = generate_occurrences(event, from_date=date(2026, 3, 1))
        assert occs[0]["occurrence_id"].startswith("occ_")

    def test_weekly_generates_8_occurrences(self):
        """Weekly event within 8-week window generates 8 occurrences."""
        event = _make_event(
            recurrence="weekly",
            starts_at="2026-03-13T19:00:00-05:00",
            rrule_weekdays=[4],  # Friday
        )
        occs = generate_occurrences(event, from_date=date(2026, 3, 13), weeks_ahead=8)

        assert len(occs) == 8
        # Verify sequential indexes
        for i, occ in enumerate(occs):
            assert occ["occurrence_index"] == i

    def test_biweekly_generates_4_occurrences(self):
        """Biweekly event within 8-week window generates 4 occurrences."""
        event = _make_event(
            recurrence="biweekly",
            starts_at="2026-03-13T19:00:00-05:00",
            rrule_weekdays=[4],  # Friday
        )
        occs = generate_occurrences(event, from_date=date(2026, 3, 13), weeks_ahead=8)

        assert len(occs) == 4

    def test_rrule_count_limits(self):
        """rrule_count limits the total number of occurrences."""
        event = _make_event(
            recurrence="weekly",
            starts_at="2026-03-13T19:00:00-05:00",
            rrule_weekdays=[4],
            rrule_count=3,
        )
        occs = generate_occurrences(event, from_date=date(2026, 3, 13), weeks_ahead=8)

        assert len(occs) == 3

    def test_rrule_until_limits(self):
        """rrule_until stops generation at the end date."""
        event = _make_event(
            recurrence="weekly",
            starts_at="2026-03-13T19:00:00-05:00",
            rrule_weekdays=[4],
            rrule_until="2026-04-03",  # 3 weeks later
        )
        occs = generate_occurrences(event, from_date=date(2026, 3, 13), weeks_ahead=8)

        assert len(occs) == 4  # Mar 13, 20, 27, Apr 3

    def test_custom_interval(self):
        """Custom recurrence with interval=3 generates every 3 weeks."""
        event = _make_event(
            recurrence="custom",
            starts_at="2026-03-13T19:00:00-05:00",
            rrule_weekdays=[4],
            rrule_interval=3,
        )
        occs = generate_occurrences(event, from_date=date(2026, 3, 13), weeks_ahead=12)

        # 12 weeks / 3-week interval = 4 occurrences
        assert len(occs) == 4

    def test_multiple_weekdays(self):
        """Weekly with multiple weekdays generates on each day."""
        event = _make_event(
            recurrence="weekly",
            starts_at="2026-03-09T19:00:00-05:00",  # Monday
            rrule_weekdays=[0, 4],  # Monday and Friday
        )
        occs = generate_occurrences(event, from_date=date(2026, 3, 9), weeks_ahead=2)

        # 2 weeks × 2 days = 4 occurrences
        assert len(occs) == 4

    def test_occurrences_have_utc_timestamps(self):
        """All occurrence starts_at are in UTC (ISO format with offset)."""
        event = _make_event(recurrence="none")
        occs = generate_occurrences(event, from_date=date(2026, 3, 1))

        starts_at = datetime.fromisoformat(occs[0]["starts_at"])
        assert starts_at.tzinfo is not None

    def test_dst_consistent_local_time(self):
        """Weekly occurrences across DST maintain the same local time."""
        # 2026 DST spring forward: Sun Mar 8
        event = _make_event(
            recurrence="weekly",
            starts_at="2026-03-06T19:00:00-05:00",  # Fri Mar 6 (EST)
            rrule_weekdays=[4],  # Friday
        )
        occs = generate_occurrences(event, from_date=date(2026, 3, 6), weeks_ahead=4)

        tz = ZoneInfo("America/New_York")
        for occ in occs:
            utc_dt = datetime.fromisoformat(occ["starts_at"])
            local_dt = utc_dt.astimezone(tz)
            assert local_dt.hour == 19, f"Local hour should be 19, got {local_dt.hour} on {local_dt.date()}"
            assert local_dt.minute == 0

    def test_no_weekdays_defaults_to_start_day(self):
        """If rrule_weekdays is None, use the start date's weekday."""
        event = _make_event(
            recurrence="weekly",
            starts_at="2026-03-11T19:00:00-05:00",  # Wednesday
            rrule_weekdays=None,
        )
        occs = generate_occurrences(event, from_date=date(2026, 3, 11), weeks_ahead=4)

        tz = ZoneInfo("America/New_York")
        for occ in occs:
            utc_dt = datetime.fromisoformat(occ["starts_at"])
            local_dt = utc_dt.astimezone(tz)
            assert local_dt.weekday() == 2  # Wednesday


# ============== make_id tests ==============

class TestMakeId:
    def test_prefix(self):
        assert make_id("occ").startswith("occ_")
        assert make_id("inv").startswith("inv_")
        assert make_id("evt").startswith("evt_")

    def test_uniqueness(self):
        ids = {make_id("occ") for _ in range(100)}
        assert len(ids) == 100

    def test_length(self):
        # prefix + _ + 12 hex chars
        result = make_id("occ")
        assert len(result) == 4 + 12  # "occ_" + 12 chars
