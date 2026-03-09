"""
Unit tests for admin feedback Socket.IO room auth.

Tests join_admin_feedback auth logic (auth rules verified in isolation):
- non-super_admin denied
- unknown feedback_id denied
- missing user_id or feedback_id rejected
"""

import pytest


def _would_reject_join(user_id, feedback_id, user_row, feedback_row):
    """
    Replicate join_admin_feedback auth logic for unit testing.
    Returns (reject: bool, error_message: str | None).
    """
    if not user_id or not feedback_id:
        return True, "Missing user_id or feedback_id"
    if not user_row or user_row.get("app_role") != "super_admin":
        return True, "Not authorized to join admin feedback room"
    if not feedback_row:
        return True, "Feedback not found"
    return False, None


class TestJoinAdminFeedbackAuth:
    """Unit tests for join_admin_feedback auth rules."""

    def test_rejects_missing_user_id(self):
        result, err = _would_reject_join(None, "KV-2603-0001", {"app_role": "super_admin"}, {"feedback_id": "x"})
        assert result is True
        assert "Missing" in err

    def test_rejects_missing_feedback_id(self):
        result, err = _would_reject_join("u1", None, {"app_role": "super_admin"}, {"feedback_id": "x"})
        assert result is True
        assert "Missing" in err

    def test_rejects_non_super_admin(self):
        result, err = _would_reject_join(
            "u1", "KV-2603-0001",
            {"user_id": "u1", "app_role": "user"},
            {"feedback_id": "KV-2603-0001"}
        )
        assert result is True
        assert "Not authorized" in err

    def test_rejects_unknown_feedback(self):
        result, err = _would_reject_join(
            "u1", "KV-9999-9999",
            {"user_id": "u1", "app_role": "super_admin"},
            None
        )
        assert result is True
        assert "Feedback not found" in err

    def test_allows_super_admin_with_valid_feedback(self):
        result, err = _would_reject_join(
            "u1", "KV-2603-0001",
            {"user_id": "u1", "app_role": "super_admin"},
            {"feedback_id": "KV-2603-0001"}
        )
        assert result is False
        assert err is None
