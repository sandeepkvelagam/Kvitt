"""
Integration tests for group router endpoints.

These tests require a running backend server. They are skipped gracefully
when the server is unavailable (via @pytest.mark.skipif).
"""

import pytest
import os
import httpx

BASE_URL = os.environ.get("TEST_BASE_URL", "")


@pytest.mark.skipif(not BASE_URL, reason="TEST_BASE_URL not set — skip integration tests")
class TestGroupEndpointsIntegration:
    """Integration tests for group endpoints (require running server)."""

    def test_groups_requires_auth(self):
        """GET /api/groups should return 401 without auth."""
        resp = httpx.get(f"{BASE_URL}/api/groups", timeout=10)
        assert resp.status_code == 401

    def test_buy_in_options_no_auth(self):
        """GET /api/groups/buy-in-options should return denominations (no auth required)."""
        resp = httpx.get(f"{BASE_URL}/api/groups/buy-in-options", timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "denominations" in data
        assert 20 in data["denominations"]

    def test_create_group_requires_auth(self):
        """POST /api/groups should return 401 without auth."""
        resp = httpx.post(
            f"{BASE_URL}/api/groups",
            json={"name": "Test Group"},
            timeout=10
        )
        assert resp.status_code == 401

    def test_group_messages_requires_auth(self):
        """GET /api/groups/{id}/messages should return 401 without auth."""
        resp = httpx.get(f"{BASE_URL}/api/groups/fake_id/messages", timeout=10)
        assert resp.status_code == 401

    def test_user_invites_requires_auth(self):
        """GET /api/users/invites should return 401 without auth."""
        resp = httpx.get(f"{BASE_URL}/api/users/invites", timeout=10)
        assert resp.status_code == 401

    def test_group_polls_requires_auth(self):
        """GET /api/groups/{id}/polls should return 401 without auth."""
        resp = httpx.get(f"{BASE_URL}/api/groups/fake_id/polls", timeout=10)
        assert resp.status_code == 401
