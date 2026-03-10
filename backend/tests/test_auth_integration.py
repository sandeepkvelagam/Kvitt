"""
Integration tests for auth endpoints (requires running server).

These tests verify the extracted auth routes still work end-to-end.
Skipped gracefully when no server URL is configured.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.mark.skipif(not BASE_URL, reason="No server URL configured (set REACT_APP_BACKEND_URL)")
class TestAuthEndpointsLive:
    """Integration tests that hit a running server."""

    def test_health_returns_ok(self):
        """GET /api/health should return status ok without auth."""
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["database"] == "postgres"
        assert "version" in data

    def test_me_requires_auth(self):
        """GET /api/auth/me should return 401 without a token."""
        resp = requests.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 401

    def test_me_rejects_invalid_token(self):
        """GET /api/auth/me should reject an invalid JWT."""
        resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"}
        )
        assert resp.status_code == 401

    def test_logout_succeeds(self):
        """POST /api/auth/logout should return 200 (no-op endpoint)."""
        resp = requests.post(f"{BASE_URL}/api/auth/logout")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Logged out successfully"

    def test_session_rejects_invalid_id(self):
        """POST /api/auth/session should reject an invalid session_id."""
        resp = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": "invalid-session-id"}
        )
        # Returns 401 or 500 depending on auth service availability
        assert resp.status_code in (401, 500)

    def test_session_requires_body(self):
        """POST /api/auth/session should return 422 without a body."""
        resp = requests.post(f"{BASE_URL}/api/auth/session")
        assert resp.status_code == 422
