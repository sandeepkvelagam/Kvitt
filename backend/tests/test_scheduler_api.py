"""
Backend API Tests for Game Scheduler & Invites System
Tests: Event creation, RSVP, invite statuses, start game, calendar, templates
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_1770401937136')
USER_ID = os.environ.get('TEST_USER_ID', 'test-user-1770401937136')
SESSION_TOKEN_2 = os.environ.get('TEST_SESSION_TOKEN_2', 'test_session_player2_1770402119637')
USER_ID_2 = os.environ.get('TEST_USER_ID_2', 'test-user-player2-1770402119637')

# Skip all tests if server is not running
def _server_available():
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False

SERVER_AVAILABLE = _server_available()
skip_if_no_server = pytest.mark.skipif(
    not SERVER_AVAILABLE,
    reason="Backend server not available"
)


@skip_if_no_server
class TestEventCreation:
    """Test scheduled event creation and listing."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}
        self.headers_2 = {"Authorization": f"Bearer {SESSION_TOKEN_2}"}

    def _create_group(self):
        """Helper: create a test group."""
        payload = {
            "name": f"TEST_SchedGroup_{int(time.time())}",
            "description": "Test group for scheduler",
            "default_buy_in": 20,
            "chips_per_buy_in": 20,
        }
        r = requests.post(f"{BASE_URL}/api/groups", json=payload, headers=self.headers)
        assert r.status_code == 200
        return r.json()["group_id"]

    def _create_event(self, group_id, **overrides):
        """Helper: create a scheduled event."""
        payload = {
            "group_id": group_id,
            "title": f"TEST_Event_{int(time.time())}",
            "starts_at": "2026-12-01T19:00:00-05:00",
            "duration_minutes": 180,
            "location": "Test location",
            "game_category": "poker",
            "recurrence": "none",
            "default_buy_in": 20.0,
            "default_chips_per_buy_in": 20,
            "timezone": "America/New_York",
        }
        payload.update(overrides)
        r = requests.post(f"{BASE_URL}/api/events", json=payload, headers=self.headers)
        return r

    def test_create_one_time_event(self):
        """POST /api/events — creates event + 1 occurrence + invites."""
        group_id = self._create_group()
        r = self._create_event(group_id)
        assert r.status_code == 200, f"Failed: {r.text}"
        data = r.json()
        assert data["event_id"].startswith("evt_")
        assert data["status"] == "published"
        assert data["occurrences_generated"] == 1
        assert data["next_occurrence"] is not None
        assert data["next_occurrence"]["occurrence_id"].startswith("occ_")
        print(f"SUCCESS: Created event {data['event_id']}")

    def test_create_event_past_date_rejected(self):
        """POST /api/events — starts_at in the past should fail."""
        group_id = self._create_group()
        r = self._create_event(group_id, starts_at="2020-01-01T19:00:00Z")
        assert r.status_code == 422

    def test_create_event_non_member_rejected(self):
        """POST /api/events — non-member cannot create event."""
        group_id = self._create_group()
        payload = {
            "group_id": group_id,
            "title": "Unauthorized event",
            "starts_at": "2026-12-01T19:00:00Z",
        }
        r = requests.post(f"{BASE_URL}/api/events", json=payload, headers=self.headers_2)
        assert r.status_code == 403

    def test_list_events(self):
        """GET /api/events — returns upcoming events for user."""
        group_id = self._create_group()
        self._create_event(group_id)
        r = requests.get(f"{BASE_URL}/api/events", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert "events" in data
        assert "total" in data

    def test_list_events_by_group(self):
        """GET /api/events?group_id=... — filters by group."""
        group_id = self._create_group()
        self._create_event(group_id)
        r = requests.get(f"{BASE_URL}/api/events?group_id={group_id}", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert all(e["group_id"] == group_id for e in data["events"])

    def test_get_event_detail(self):
        """GET /api/events/{event_id} — returns event with occurrences."""
        group_id = self._create_group()
        create_r = self._create_event(group_id)
        event_id = create_r.json()["event_id"]

        r = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert data["event_id"] == event_id
        assert "occurrences" in data
        assert len(data["occurrences"]) >= 1


@skip_if_no_server
class TestRSVP:
    """Test RSVP flow."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}

    def _create_group_and_event(self):
        group_id = TestEventCreation._create_group(self)
        r = TestEventCreation._create_event(self, group_id)
        data = r.json()
        return data["event_id"], data["next_occurrence"]["occurrence_id"]

    def test_rsvp_accept(self):
        """POST /api/occurrences/{id}/rsvp — accept."""
        _, occ_id = self._create_group_and_event()
        r = requests.post(
            f"{BASE_URL}/api/occurrences/{occ_id}/rsvp",
            json={"status": "accepted", "note": "Count me in!"},
            headers=self.headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "accepted"
        assert "stats" in data
        assert data["stats"]["total"] > 0

    def test_rsvp_decline(self):
        """POST /api/occurrences/{id}/rsvp — decline."""
        _, occ_id = self._create_group_and_event()
        r = requests.post(
            f"{BASE_URL}/api/occurrences/{occ_id}/rsvp",
            json={"status": "declined"},
            headers=self.headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "declined"

    def test_rsvp_maybe(self):
        """POST /api/occurrences/{id}/rsvp — maybe."""
        _, occ_id = self._create_group_and_event()
        r = requests.post(
            f"{BASE_URL}/api/occurrences/{occ_id}/rsvp",
            json={"status": "maybe"},
            headers=self.headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "maybe"

    def test_rsvp_invalid_status(self):
        """POST /api/occurrences/{id}/rsvp — invalid status rejected."""
        _, occ_id = self._create_group_and_event()
        r = requests.post(
            f"{BASE_URL}/api/occurrences/{occ_id}/rsvp",
            json={"status": "invalid"},
            headers=self.headers,
        )
        assert r.status_code == 422

    def test_rsvp_not_found(self):
        """POST /api/occurrences/fake/rsvp — 404."""
        r = requests.post(
            f"{BASE_URL}/api/occurrences/occ_nonexistent/rsvp",
            json={"status": "accepted"},
            headers=self.headers,
        )
        assert r.status_code == 404

    def test_rsvp_update_changes_status(self):
        """Changing RSVP from accepted to declined should update."""
        _, occ_id = self._create_group_and_event()
        # First accept
        requests.post(
            f"{BASE_URL}/api/occurrences/{occ_id}/rsvp",
            json={"status": "accepted"},
            headers=self.headers,
        )
        # Then decline
        r = requests.post(
            f"{BASE_URL}/api/occurrences/{occ_id}/rsvp",
            json={"status": "declined"},
            headers=self.headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "declined"


@skip_if_no_server
class TestInviteStatus:
    """Test invite status dashboard endpoint."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}

    def test_get_invites(self):
        """GET /api/occurrences/{id}/invites — returns invite list + stats."""
        group_id = TestEventCreation._create_group(
            type("obj", (), {"headers": self.headers})()
        )
        r = TestEventCreation._create_event(
            type("obj", (), {"headers": self.headers})(), group_id
        )
        occ_id = r.json()["next_occurrence"]["occurrence_id"]

        r = requests.get(
            f"{BASE_URL}/api/occurrences/{occ_id}/invites",
            headers=self.headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "invites" in data
        assert "stats" in data
        assert data["stats"]["total"] >= 1  # At least the host


@skip_if_no_server
class TestStartGame:
    """Test starting a game from an occurrence."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}

    def test_start_game_from_occurrence(self):
        """POST /api/occurrences/{id}/start-game — creates game_night."""
        group_id = TestEventCreation._create_group(
            type("obj", (), {"headers": self.headers})()
        )
        r = TestEventCreation._create_event(
            type("obj", (), {"headers": self.headers})(), group_id
        )
        occ_id = r.json()["next_occurrence"]["occurrence_id"]

        r = requests.post(
            f"{BASE_URL}/api/occurrences/{occ_id}/start-game",
            headers=self.headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["game_id"].startswith("game_")
        assert data["status"] == "active"

    def test_start_game_duplicate_rejected(self):
        """Starting a game twice for same occurrence should fail."""
        group_id = TestEventCreation._create_group(
            type("obj", (), {"headers": self.headers})()
        )
        r = TestEventCreation._create_event(
            type("obj", (), {"headers": self.headers})(), group_id
        )
        occ_id = r.json()["next_occurrence"]["occurrence_id"]

        # First start
        requests.post(
            f"{BASE_URL}/api/occurrences/{occ_id}/start-game",
            headers=self.headers,
        )
        # Second start should fail
        r = requests.post(
            f"{BASE_URL}/api/occurrences/{occ_id}/start-game",
            headers=self.headers,
        )
        assert r.status_code == 409


@skip_if_no_server
class TestTemplatesAndCalendar:
    """Test templates list and calendar endpoint."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}

    def test_list_templates(self):
        """GET /api/templates — returns system templates."""
        r = requests.get(f"{BASE_URL}/api/templates", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert "templates" in data
        assert len(data["templates"]) >= 1
        # Check template shape
        t = data["templates"][0]
        assert "template_id" in t
        assert "name" in t
        assert "game_category" in t

    def test_group_calendar(self):
        """GET /api/groups/{group_id}/calendar — returns occurrences in range."""
        group_id = TestEventCreation._create_group(
            type("obj", (), {"headers": self.headers})()
        )
        TestEventCreation._create_event(
            type("obj", (), {"headers": self.headers})(), group_id
        )

        r = requests.get(
            f"{BASE_URL}/api/groups/{group_id}/calendar",
            headers=self.headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "occurrences" in data
        assert "total" in data

    def test_calendar_empty_group(self):
        """Calendar for group with no events returns empty array."""
        group_id = TestEventCreation._create_group(
            type("obj", (), {"headers": self.headers})()
        )
        r = requests.get(
            f"{BASE_URL}/api/groups/{group_id}/calendar",
            headers=self.headers,
        )
        assert r.status_code == 200
        assert r.json()["total"] == 0
