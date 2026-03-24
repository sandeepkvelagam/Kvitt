"""Unit tests for heuristic scheduling planner (no database)."""

import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scheduling_planner import (
    INTENTS,
    build_proposal_times,
    ensure_future_local,
    merge_draft_proposal,
    next_friday_19_local,
    next_saturday_19_local,
    proposal_body_from_context,
    tomorrow_19_local,
)
from zoneinfo import ZoneInfo


class TestIntents:
    def test_intents_contains_expected(self):
        assert "schedule_now" in INTENTS
        assert "rematch_last" in INTENTS
        assert "plan_weekend" in INTENTS
        assert "resume_draft" in INTENTS
        assert "use_last_setup" in INTENTS


class TestBuildProposalTimes:
    def test_plan_weekend_future(self):
        tz = ZoneInfo("America/New_York")
        now_utc = datetime(2026, 3, 24, 15, 0, tzinfo=timezone.utc)
        utc, rationale = build_proposal_times("plan_weekend", "America/New_York", now_utc, None)
        assert "Saturday" in rationale or "evening" in rationale
        assert utc > now_utc

    def test_schedule_now_future(self):
        now_utc = datetime(2026, 3, 24, 15, 0, tzinfo=timezone.utc)
        utc, _ = build_proposal_times("schedule_now", "America/New_York", now_utc, None)
        assert utc > now_utc

    def test_rematch_uses_last_occurrence_weekday(self):
        now_utc = datetime(2026, 3, 24, 15, 0, tzinfo=timezone.utc)
        last = {"occ_starts_at": datetime(2026, 3, 20, 23, 0, tzinfo=timezone.utc)}
        utc, rationale = build_proposal_times("rematch_last", "America/New_York", now_utc, last)
        assert utc > now_utc
        assert "rhythm" in rationale or "last" in rationale


class TestMergeDraft:
    def test_merge_draft_respects_starts_at(self):
        now_utc = datetime(2026, 3, 24, 15, 0, tzinfo=timezone.utc)
        draft = {
            "title": "Friday Crew",
            "starts_at": "2026-12-15T00:00:00+00:00",
        }
        utc, title = merge_draft_proposal(draft, "grp_1", "UTC", now_utc)
        assert title == "Friday Crew"
        assert utc > now_utc


class TestProposalBody:
    def test_proposal_shape(self):
        now_utc = datetime(2026, 3, 24, 15, 0, tzinfo=timezone.utc)
        prop, rationale = proposal_body_from_context(
            "schedule_now",
            "grp_x",
            "America/New_York",
            now_utc,
            None,
            None,
        )
        assert prop["group_id"] == "grp_x"
        assert prop["recurrence"] == "none"
        assert prop["invite_scope"] == "group"
        assert "starts_at" in prop
        assert isinstance(rationale, str)
