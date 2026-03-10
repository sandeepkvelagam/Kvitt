"""Integration tests for the games router (require running server)."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

BASE_URL = os.environ.get("TEST_BASE_URL", "")

pytestmark = pytest.mark.skipif(not BASE_URL, reason="TEST_BASE_URL not set — server not running")


@pytest.fixture
def client():
    import httpx
    return httpx.Client(base_url=BASE_URL, timeout=10)


def test_get_games_requires_auth(client):
    """GET /api/games should return 401 without auth."""
    resp = client.get("/api/games")
    assert resp.status_code == 401


def test_create_game_requires_auth(client):
    """POST /api/games should return 401 without auth."""
    resp = client.post("/api/games", json={"group_id": "test"})
    assert resp.status_code == 401


def test_get_game_requires_auth(client):
    """GET /api/games/{id} should return 401 without auth."""
    resp = client.get("/api/games/fake_id_12345")
    assert resp.status_code == 401


def test_settle_requires_auth(client):
    """POST /api/games/{id}/settle should return 401 without auth."""
    resp = client.post("/api/games/fake_id_12345/settle")
    assert resp.status_code == 401


def test_thread_requires_auth(client):
    """GET /api/games/{id}/thread should return 401 without auth."""
    resp = client.get("/api/games/fake_id_12345/thread")
    assert resp.status_code == 401
