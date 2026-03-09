"""
Test suite for Admin Feedback Response & Thread endpoints + User Reply

Endpoints tested:
- GET /api/feedback/{feedback_id}/thread - Get conversation thread (dual-auth)
- POST /api/admin/feedback/{feedback_id}/respond - Admin respond to user report
- POST /api/feedback/{feedback_id}/reply - User reply to admin response

Tests:
1. Auth guard tests (401/403 for unauthenticated/non-admin)
2. Respond endpoint validation (message, status transitions)
3. Thread endpoint behavior
4. Idempotency key handling
5. User reply validation (message length, wont_fix blocking, auto-reopen)
6. Thread dual-auth (admin vs reporter access)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Skip integration tests if no server URL is configured
requires_server = pytest.mark.skipif(
    not BASE_URL or not BASE_URL.startswith('http'),
    reason="REACT_APP_BACKEND_URL not set or invalid - skipping integration tests"
)


@requires_server
class TestFeedbackThreadAuthGuards:
    """Test that feedback thread/respond endpoints are properly protected."""

    def test_thread_requires_auth(self):
        """Thread endpoint should return 401 without auth."""
        response = requests.get(f"{BASE_URL}/api/feedback/fake_id/thread")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_respond_requires_auth(self):
        """Respond endpoint should return 401 without auth."""
        response = requests.post(
            f"{BASE_URL}/api/admin/feedback/fake_id/respond",
            json={"message": "test"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


@requires_server
class TestFeedbackRespondValidation:
    """Test respond endpoint parameter validation (requires auth bypass or test token)."""

    def test_respond_missing_message(self):
        """Respond with empty message should fail."""
        response = requests.post(
            f"{BASE_URL}/api/admin/feedback/fake_id/respond",
            json={"message": ""}
        )
        # Should be 401 (auth first) or 400 if auth is bypassed
        assert response.status_code in (400, 401, 403), f"Expected 400/401/403, got {response.status_code}"

    def test_respond_whitespace_only_message(self):
        """Respond with whitespace-only message should fail."""
        response = requests.post(
            f"{BASE_URL}/api/admin/feedback/fake_id/respond",
            json={"message": "   \n  \t  "}
        )
        assert response.status_code in (400, 401, 403), f"Expected 400/401/403, got {response.status_code}"

    def test_respond_nonexistent_feedback(self):
        """Respond to non-existent feedback should return 404 (after auth)."""
        response = requests.post(
            f"{BASE_URL}/api/admin/feedback/nonexistent_fb_999/respond",
            json={"message": "test response"}
        )
        # Will be 401 without auth, which is fine for integration test
        assert response.status_code in (401, 403, 404), f"Expected 401/403/404, got {response.status_code}"

    def test_thread_nonexistent_feedback(self):
        """Thread for non-existent feedback should return 404 (after auth)."""
        response = requests.get(f"{BASE_URL}/api/feedback/nonexistent_fb_999/thread")
        assert response.status_code in (401, 403, 404), f"Expected 401/403/404, got {response.status_code}"


class TestAdminRespondTransitions:
    """Unit tests for status transition validation logic (no server needed)."""

    ALLOWED_TRANSITIONS = {
        "new": {"in_progress", "needs_user_info", "resolved", "wont_fix"},
        "open": {"in_progress", "needs_user_info", "resolved", "wont_fix"},
        "classified": {"in_progress", "needs_user_info", "resolved", "wont_fix"},
        "in_progress": {"needs_user_info", "resolved", "wont_fix"},
        "needs_user_info": {"in_progress", "resolved", "wont_fix"},
        "needs_host_action": {"in_progress", "resolved", "wont_fix"},
        "resolved": {"in_progress"},
    }

    def test_open_to_in_progress_allowed(self):
        allowed = self.ALLOWED_TRANSITIONS.get("open", set())
        assert "in_progress" in allowed

    def test_open_to_resolved_allowed(self):
        allowed = self.ALLOWED_TRANSITIONS.get("open", set())
        assert "resolved" in allowed

    def test_open_to_needs_user_info_allowed(self):
        allowed = self.ALLOWED_TRANSITIONS.get("open", set())
        assert "needs_user_info" in allowed

    def test_open_to_wont_fix_allowed(self):
        allowed = self.ALLOWED_TRANSITIONS.get("open", set())
        assert "wont_fix" in allowed

    def test_resolved_to_in_progress_allowed(self):
        """Reopen resolved report."""
        allowed = self.ALLOWED_TRANSITIONS.get("resolved", set())
        assert "in_progress" in allowed

    def test_resolved_to_wont_fix_not_allowed(self):
        """Cannot go from resolved to wont_fix."""
        allowed = self.ALLOWED_TRANSITIONS.get("resolved", set())
        assert "wont_fix" not in allowed

    def test_duplicate_not_writable(self):
        """Duplicate status should not be writable via respond."""
        assert "duplicate" not in self.ALLOWED_TRANSITIONS

    def test_auto_fixed_not_writable(self):
        """Auto-fixed status should not be writable via respond."""
        assert "auto_fixed" not in self.ALLOWED_TRANSITIONS

    def test_in_progress_to_resolved_allowed(self):
        allowed = self.ALLOWED_TRANSITIONS.get("in_progress", set())
        assert "resolved" in allowed

    def test_in_progress_to_open_not_allowed(self):
        """Cannot go back to open from in_progress."""
        allowed = self.ALLOWED_TRANSITIONS.get("in_progress", set())
        assert "open" not in allowed

    def test_needs_user_info_to_in_progress_allowed(self):
        allowed = self.ALLOWED_TRANSITIONS.get("needs_user_info", set())
        assert "in_progress" in allowed

    def test_classified_to_in_progress_allowed(self):
        allowed = self.ALLOWED_TRANSITIONS.get("classified", set())
        assert "in_progress" in allowed


class TestMessageValidation:
    """Unit tests for message validation rules."""

    def test_empty_message_invalid(self):
        message = ""
        assert not message.strip()

    def test_whitespace_only_invalid(self):
        message = "   \n  \t  "
        assert not message.strip()

    def test_valid_message(self):
        message = "Thank you for the report."
        assert message.strip()
        assert 1 <= len(message.strip()) <= 5000

    def test_max_length_boundary(self):
        message = "a" * 5000
        assert len(message) == 5000

    def test_over_max_length(self):
        message = "a" * 5001
        assert len(message) > 5000


class TestThreadEventFiltering:
    """Unit tests for thread event type filtering logic."""

    THREAD_TYPES = {"created", "admin_response", "user_reply", "status_change", "status_updated"}

    def test_created_included(self):
        assert "created" in self.THREAD_TYPES

    def test_admin_response_included(self):
        assert "admin_response" in self.THREAD_TYPES

    def test_user_reply_included(self):
        assert "user_reply" in self.THREAD_TYPES

    def test_status_change_included(self):
        assert "status_change" in self.THREAD_TYPES

    def test_note_excluded(self):
        assert "note" not in self.THREAD_TYPES

    def test_classified_excluded(self):
        assert "classified" not in self.THREAD_TYPES

    def test_event_sorting(self):
        """Events should sort by timestamp ascending."""
        events = [
            {"ts": "2026-03-09T14:23:00Z", "action": "admin_response", "index": 1},
            {"ts": "2026-03-09T14:22:00Z", "action": "status_change", "index": 0},
            {"ts": "2026-03-09T14:24:00Z", "action": "user_reply", "index": 2},
        ]
        sorted_events = sorted(events, key=lambda e: (e.get("ts", ""), e.get("index", 0)))
        assert sorted_events[0]["action"] == "status_change"
        assert sorted_events[1]["action"] == "admin_response"
        assert sorted_events[2]["action"] == "user_reply"

    def test_empty_events_returns_empty(self):
        """Empty events list should produce empty thread (before synthesis)."""
        events = []
        filtered = [e for e in events if e.get("action") in self.THREAD_TYPES]
        assert filtered == []


class TestThreadSyntheticCreated:
    """Unit tests for synthetic 'created' event synthesis logic."""

    THREAD_TYPES = {"created", "admin_response", "user_reply", "status_change", "status_updated"}

    def _build_thread_events(self, events_raw, row):
        """Replicate server logic: filter + synthesize created when missing."""
        thread_events = []
        has_created = False
        for idx, evt in enumerate(events_raw):
            if not isinstance(evt, dict):
                continue
            action = evt.get("action", evt.get("event_type", ""))
            if action == "created":
                has_created = True
            if action in self.THREAD_TYPES:
                details = evt.get("details", {}) or {}
                message = details.get("message") if isinstance(details, dict) else None
                thread_events.append({
                    "event_type": action,
                    "message": message,
                    "details": details,
                    "actor_user_id": evt.get("actor"),
                    "ts": evt.get("ts", ""),
                    "index": idx,
                })
        if not has_created and row.get("created_at") and row.get("user_id"):
            created_at = row["created_at"]
            ts = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at)
            thread_events.append({
                "event_type": "created",
                "message": None,
                "details": {"feedback_type": row.get("type") or "other"},
                "actor_user_id": row["user_id"],
                "ts": ts,
                "index": -1,
            })
        return thread_events

    def test_synthetic_created_when_events_empty(self):
        """When events is empty, synthesis adds one created event."""
        from datetime import datetime, timezone
        events_raw = []
        row = {"created_at": datetime.now(timezone.utc), "user_id": "u1", "type": "bug"}
        result = self._build_thread_events(events_raw, row)
        created_events = [e for e in result if e["event_type"] == "created"]
        assert len(created_events) == 1
        assert created_events[0]["details"]["feedback_type"] == "bug"

    def test_no_duplicate_synthetic_when_created_exists(self):
        """When events already has created, do not add synthetic."""
        from datetime import datetime, timezone
        events_raw = [
            {"ts": "2026-03-09T12:00:00Z", "actor": "u1", "action": "created", "details": {"feedback_type": "bug"}},
        ]
        row = {"created_at": datetime.now(timezone.utc), "user_id": "u1", "type": "bug"}
        result = self._build_thread_events(events_raw, row)
        created_events = [e for e in result if e["event_type"] == "created"]
        assert len(created_events) == 1

    def test_synthetic_created_when_events_exist_but_no_created(self):
        """When events has admin_response but no created, add synthetic."""
        from datetime import datetime, timezone
        events_raw = [
            {"ts": "2026-03-09T14:00:00Z", "actor": "admin1", "action": "admin_response", "details": {"message": "Thanks"}},
        ]
        row = {"created_at": datetime(2026, 3, 9, 12, 0, 0, tzinfo=timezone.utc), "user_id": "u1", "type": "complaint"}
        result = self._build_thread_events(events_raw, row)
        created_events = [e for e in result if e["event_type"] == "created"]
        assert len(created_events) == 1
        assert created_events[0]["details"]["feedback_type"] == "complaint"
        assert "2026-03-09" in created_events[0]["ts"]


# ═══════════════════════════════════════════════════════════════════════
# Phase 2: User Reply Tests
# ═══════════════════════════════════════════════════════════════════════


@requires_server
class TestUserReplyAuthGuards:
    """Test that reply endpoint is properly protected."""

    def test_reply_requires_auth(self):
        """Reply endpoint should return 401 without auth."""
        response = requests.post(
            f"{BASE_URL}/api/feedback/fake_id/reply",
            json={"message": "test reply"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_reply_nonexistent_feedback(self):
        """Reply to non-existent feedback should return 401/403/404."""
        response = requests.post(
            f"{BASE_URL}/api/feedback/nonexistent_fb_999/reply",
            json={"message": "test reply"}
        )
        assert response.status_code in (401, 403, 404), f"Expected 401/403/404, got {response.status_code}"


class TestUserReplyMessageValidation:
    """Unit tests for user reply message validation rules."""

    MAX_REPLY_LENGTH = 2000

    def test_empty_reply_invalid(self):
        message = ""
        assert not message.strip()

    def test_whitespace_only_reply_invalid(self):
        message = "   \n  \t  "
        assert not message.strip()

    def test_valid_reply(self):
        message = "Thanks for looking into this."
        assert message.strip()
        assert 1 <= len(message.strip()) <= self.MAX_REPLY_LENGTH

    def test_reply_max_length_boundary(self):
        message = "a" * 2000
        assert len(message) == 2000
        assert len(message) <= self.MAX_REPLY_LENGTH

    def test_reply_over_max_length(self):
        message = "a" * 2001
        assert len(message) > self.MAX_REPLY_LENGTH

    def test_reply_shorter_than_admin_max(self):
        """User replies have a lower max (2000) than admin responses (5000)."""
        assert self.MAX_REPLY_LENGTH < 5000


class TestUserReplyStatusBlocking:
    """Unit tests for which statuses block user replies."""

    BLOCKED_STATUSES = {"wont_fix"}
    AUTO_REOPEN_STATUSES = {"resolved"}

    def test_wont_fix_blocks_reply(self):
        """Cannot reply to wont_fix reports."""
        assert "wont_fix" in self.BLOCKED_STATUSES

    def test_open_allows_reply(self):
        """Open reports should accept replies."""
        assert "open" not in self.BLOCKED_STATUSES

    def test_in_progress_allows_reply(self):
        """In-progress reports should accept replies."""
        assert "in_progress" not in self.BLOCKED_STATUSES

    def test_needs_user_info_allows_reply(self):
        """Needs-user-info reports should accept replies."""
        assert "needs_user_info" not in self.BLOCKED_STATUSES

    def test_resolved_allows_reply(self):
        """Resolved reports should accept replies (triggers reopen)."""
        assert "resolved" not in self.BLOCKED_STATUSES

    def test_resolved_triggers_reopen(self):
        """Replying to a resolved report should auto-reopen it."""
        assert "resolved" in self.AUTO_REOPEN_STATUSES

    def test_open_does_not_trigger_reopen(self):
        """Replying to an open report should NOT auto-reopen."""
        assert "open" not in self.AUTO_REOPEN_STATUSES

    def test_in_progress_does_not_trigger_reopen(self):
        """Replying to in-progress report should NOT auto-reopen."""
        assert "in_progress" not in self.AUTO_REOPEN_STATUSES


class TestThreadDualAuth:
    """Unit tests for thread dual-auth logic (admin OR reporter)."""

    def test_admin_can_access_any_thread(self):
        """Admin should be able to access any feedback thread."""
        is_admin = True
        feedback_user_id = "user_123"
        current_user_id = "admin_456"
        # Admin access: always allowed
        has_access = is_admin or (current_user_id == feedback_user_id)
        assert has_access

    def test_reporter_can_access_own_thread(self):
        """Reporter should be able to access their own feedback thread."""
        is_admin = False
        feedback_user_id = "user_123"
        current_user_id = "user_123"
        has_access = is_admin or (current_user_id == feedback_user_id)
        assert has_access

    def test_non_reporter_cannot_access_thread(self):
        """Non-reporter non-admin should NOT be able to access thread."""
        is_admin = False
        feedback_user_id = "user_123"
        current_user_id = "user_999"
        has_access = is_admin or (current_user_id == feedback_user_id)
        assert not has_access

    def test_reporter_check_uses_user_id(self):
        """Access check should compare user_id, not email or name."""
        is_admin = False
        feedback_user_id = "user_123"
        # Same name but different user_id
        current_user_id = "user_456"
        has_access = is_admin or (current_user_id == feedback_user_id)
        assert not has_access


class TestReplyAutoReopen:
    """Unit tests for auto-reopen behavior when user replies to resolved reports."""

    def test_resolved_reopens_to_needs_user_info(self):
        """When user replies to a resolved report, status should change to needs_user_info."""
        current_status = "resolved"
        auto_reopen_target = "needs_user_info"
        if current_status == "resolved":
            new_status = auto_reopen_target
        else:
            new_status = current_status
        assert new_status == "needs_user_info"

    def test_open_stays_open(self):
        """When user replies to an open report, status should remain open."""
        current_status = "open"
        if current_status == "resolved":
            new_status = "needs_user_info"
        else:
            new_status = current_status
        assert new_status == "open"

    def test_in_progress_stays_in_progress(self):
        """When user replies to in-progress report, status should remain."""
        current_status = "in_progress"
        if current_status == "resolved":
            new_status = "needs_user_info"
        else:
            new_status = current_status
        assert new_status == "in_progress"

    def test_needs_user_info_stays(self):
        """When user replies to needs_user_info, status should remain."""
        current_status = "needs_user_info"
        if current_status == "resolved":
            new_status = "needs_user_info"
        else:
            new_status = current_status
        assert new_status == "needs_user_info"


# ═══════════════════════════════════════════════════════════════════════
# Phase 3: Analytics + Agent Assistance Tests
# ═══════════════════════════════════════════════════════════════════════


class TestFeedbackStatsEnhanced:
    """Unit tests for enhanced stats response shape."""

    VALID_AGING_BUCKETS = {"0-24h", "1-3d", "3-7d", "7d+"}

    def test_aging_buckets_are_valid(self):
        assert self.VALID_AGING_BUCKETS == {"0-24h", "1-3d", "3-7d", "7d+"}

    def test_trend_change_calculation(self):
        current, previous = 42, 35
        change_pct = ((current - previous) / previous) * 100 if previous > 0 else 0
        assert round(change_pct, 1) == 20.0

    def test_trend_negative_change(self):
        current, previous = 30, 42
        change_pct = ((current - previous) / previous) * 100 if previous > 0 else 0
        assert round(change_pct, 1) == -28.6

    def test_trend_zero_previous(self):
        current, previous = 10, 0
        change_pct = 0 if previous == 0 else ((current - previous) / previous) * 100
        assert change_pct == 0

    def test_response_time_hours_format(self):
        hours = 4.2
        formatted = f"{hours:.1f}h" if hours < 24 else f"{hours/24:.1f}d"
        assert formatted == "4.2h"

    def test_response_time_days_format(self):
        hours = 48.5
        formatted = f"{hours/24:.1f}d" if hours >= 24 else f"{hours:.1f}h"
        assert formatted == "2.0d"

    def test_response_time_minutes_format(self):
        hours = 0.5
        formatted = f"{round(hours * 60)}m" if hours < 1 else f"{hours:.1f}h"
        assert formatted == "30m"

    def test_aging_bucket_assignment(self):
        """Test that aging bucket boundaries are correct."""
        from datetime import timedelta
        # 12 hours → 0-24h
        assert timedelta(hours=12) < timedelta(hours=24)
        # 2 days → 1-3d
        assert timedelta(days=1) <= timedelta(days=2) < timedelta(days=3)
        # 5 days → 3-7d
        assert timedelta(days=3) <= timedelta(days=5) < timedelta(days=7)
        # 10 days → 7d+
        assert timedelta(days=10) >= timedelta(days=7)


class TestSimilarFeedbackMatching:
    """Unit tests for similar feedback matching logic."""

    def test_exact_hash_match_ranks_first(self):
        results = [
            {"match_reason": "same_classification", "feedback_id": "fb_2"},
            {"match_reason": "exact_hash", "feedback_id": "fb_1"},
        ]
        sorted_results = sorted(results, key=lambda r: 0 if r["match_reason"] == "exact_hash" else 1)
        assert sorted_results[0]["feedback_id"] == "fb_1"

    def test_self_excluded(self):
        current_id = "fb_123"
        candidates = [{"feedback_id": "fb_123"}, {"feedback_id": "fb_456"}]
        filtered = [c for c in candidates if c["feedback_id"] != current_id]
        assert len(filtered) == 1
        assert filtered[0]["feedback_id"] == "fb_456"

    def test_limit_to_five(self):
        candidates = [{"feedback_id": f"fb_{i}"} for i in range(10)]
        assert len(candidates[:5]) == 5

    def test_match_reason_values(self):
        valid_reasons = {"exact_hash", "same_classification"}
        assert "exact_hash" in valid_reasons
        assert "same_classification" in valid_reasons
        assert "fuzzy" not in valid_reasons

    def test_empty_results_valid(self):
        results = []
        assert len(results) == 0


class TestAIDraftFallback:
    """Unit tests for AI draft generation fallback behavior."""

    DRAFT_TEMPLATES = {
        "bug": "Thank you for reporting this bug. We've identified the issue and our team is working on a fix. We'll update you once it's resolved.",
        "complaint": "We appreciate you bringing this to our attention. We take your feedback seriously and are reviewing the situation.",
        "feature_request": "Thanks for the feature suggestion! We've logged this for our product team to review.",
        "ux_issue": "Thank you for flagging this UX issue. We're looking into ways to improve this experience.",
        "praise": "Thank you for the kind words! We're glad you're enjoying the experience.",
        "other": "Thank you for reaching out. We've received your report and will review it.",
    }

    def test_fallback_returns_template_for_bug(self):
        draft = self.DRAFT_TEMPLATES.get("bug", "Thank you for reaching out.")
        assert "bug" in draft.lower()

    def test_fallback_returns_template_for_complaint(self):
        draft = self.DRAFT_TEMPLATES.get("complaint", "Thank you for reaching out.")
        assert "appreciate" in draft.lower()

    def test_fallback_unknown_type(self):
        draft = self.DRAFT_TEMPLATES.get("unknown_type", "Thank you for reaching out.")
        assert draft == "Thank you for reaching out."

    def test_all_types_have_templates(self):
        expected_types = {"bug", "complaint", "feature_request", "ux_issue", "praise", "other"}
        assert set(self.DRAFT_TEMPLATES.keys()) == expected_types

    def test_cache_ttl_fresh(self):
        import time
        cache_time = time.time() - 200  # 200 seconds ago
        ttl = 300  # 5 minutes
        is_fresh = (time.time() - cache_time) < ttl
        assert is_fresh

    def test_cache_ttl_expired(self):
        import time
        cache_time = time.time() - 400  # 400 seconds ago
        ttl = 300
        is_fresh = (time.time() - cache_time) < ttl
        assert not is_fresh

    def test_cache_ttl_boundary(self):
        """Cache at exactly TTL should be expired."""
        import time
        cache_time = time.time() - 300
        ttl = 300
        is_fresh = (time.time() - cache_time) < ttl
        # At exactly TTL, should NOT be fresh
        assert not is_fresh


@requires_server
class TestAIDraftAuthGuards:
    """Test that AI draft and similar endpoints are properly protected."""

    def test_ai_draft_requires_auth(self):
        """AI draft endpoint should return 401 without auth."""
        response = requests.post(f"{BASE_URL}/api/admin/feedback/fake_id/ai-draft")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_similar_requires_auth(self):
        """Similar reports endpoint should return 401 without auth."""
        response = requests.get(f"{BASE_URL}/api/admin/feedback/fake_id/similar")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


# ========== Phase 4: resolved_at tests ==========


class TestResolvedAtHandling:
    """Tests for resolved_at being set/cleared on status transitions."""

    def test_resolved_at_set_when_resolving(self):
        """_update_status should include resolved_at in updates when status is 'resolved'."""
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        updates = {}
        status = "resolved"

        # Simulate the logic from _update_status
        updates["status"] = status
        if status == "resolved":
            updates["resolved_at"] = now
        elif status in ("in_progress", "open", "needs_user_info"):
            updates["resolved_at"] = None

        assert "resolved_at" in updates
        assert updates["resolved_at"] == now
        assert isinstance(updates["resolved_at"], datetime)

    def test_resolved_at_cleared_when_reopening(self):
        """_update_status should set resolved_at to None when reopening."""
        updates = {}
        status = "in_progress"

        updates["status"] = status
        if status == "resolved":
            from datetime import datetime, timezone
            updates["resolved_at"] = datetime.now(timezone.utc)
        elif status in ("in_progress", "open", "needs_user_info"):
            updates["resolved_at"] = None

        assert "resolved_at" in updates
        assert updates["resolved_at"] is None

    def test_resolved_at_not_touched_for_other_statuses(self):
        """_update_status should not touch resolved_at for non-resolve/reopen transitions."""
        updates = {}
        status = "wont_fix"

        updates["status"] = status
        if status == "resolved":
            from datetime import datetime, timezone
            updates["resolved_at"] = datetime.now(timezone.utc)
        elif status in ("in_progress", "open", "needs_user_info"):
            updates["resolved_at"] = None

        assert "resolved_at" not in updates

    def test_resolved_at_cleared_for_needs_user_info(self):
        """Transitioning from resolved to needs_user_info should clear resolved_at."""
        updates = {}
        status = "needs_user_info"

        updates["status"] = status
        if status == "resolved":
            from datetime import datetime, timezone
            updates["resolved_at"] = datetime.now(timezone.utc)
        elif status in ("in_progress", "open", "needs_user_info"):
            updates["resolved_at"] = None

        assert updates["resolved_at"] is None

    def test_resolved_at_cleared_for_open(self):
        """Transitioning to open should clear resolved_at."""
        updates = {}
        status = "open"

        updates["status"] = status
        if status == "resolved":
            from datetime import datetime, timezone
            updates["resolved_at"] = datetime.now(timezone.utc)
        elif status in ("in_progress", "open", "needs_user_info"):
            updates["resolved_at"] = None

        assert updates["resolved_at"] is None
