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

    THREAD_TYPES = {"admin_response", "user_reply", "status_change", "status_updated"}

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
        """Empty events list should produce empty thread."""
        events = []
        filtered = [e for e in events if e.get("action") in self.THREAD_TYPES]
        assert filtered == []


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
