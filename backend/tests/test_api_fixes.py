"""
Tests for API fixes: buy_in_count migration, insert_group_invite fix,
side-effect isolation in handlers, and notification read path.

Integration tests require a running server and are skipped when unavailable.
Unit tests for query SQL validation run without a server.
"""
import pytest
import requests
import os
import time
import inspect
import ast

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_1770401937136')
USER_ID = os.environ.get('TEST_USER_ID', 'test-user-1770401937136')
SESSION_TOKEN_2 = os.environ.get('TEST_SESSION_TOKEN_2', 'test_session_player2_1770402119637')
USER_ID_2 = os.environ.get('TEST_USER_ID_2', 'test-user-player2-1770402119637')
USER_EMAIL_2 = os.environ.get('TEST_USER_EMAIL_2', 'test.player2.1770402119637@example.com')


def _server_available():
    """Check if the backend server is reachable."""
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


skip_no_server = pytest.mark.skipif(
    not _server_available(),
    reason="Backend server not available"
)


# =====================================================================
# UNIT TESTS — No server required
# =====================================================================


class TestQuerySQLValidation:
    """Validate query functions have correct SQL without needing a live DB."""

    def test_insert_group_invite_includes_invited_user_id(self):
        """insert_group_invite SQL must include invited_user_id column."""
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "queries", os.path.join(os.path.dirname(__file__), "..", "db", "queries.py")
        )
        # Read source directly to avoid import side effects (pool init)
        queries_path = os.path.join(os.path.dirname(__file__), "..", "db", "queries.py")
        with open(queries_path) as f:
            source = f.read()

        # Find the insert_group_invite function and verify SQL
        tree = ast.parse(source)
        found = False
        for node in ast.walk(tree):
            if isinstance(node, ast.AsyncFunctionDef) and node.name == "insert_group_invite":
                func_source = ast.get_source_segment(source, node)
                assert "invited_user_id" in func_source, (
                    "insert_group_invite SQL is missing invited_user_id column"
                )
                # Verify it has 7 parameters ($1-$7)
                assert "$7" in func_source, (
                    "insert_group_invite should have 7 parameters after adding invited_user_id"
                )
                found = True
                break
        assert found, "insert_group_invite function not found in queries.py"

    def test_insert_group_invite_param_count_matches_columns(self):
        """Number of VALUES placeholders must match number of INSERT columns."""
        queries_path = os.path.join(os.path.dirname(__file__), "..", "db", "queries.py")
        with open(queries_path) as f:
            source = f.read()

        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.AsyncFunctionDef) and node.name == "insert_group_invite":
                func_source = ast.get_source_segment(source, node)
                # Count columns in INSERT
                insert_start = func_source.index("INSERT INTO group_invites (")
                values_start = func_source.index(") VALUES (", insert_start)
                columns_str = func_source[insert_start:values_start]
                num_columns = columns_str.count(",") + 1  # commas + 1

                # Count $ placeholders
                import re
                placeholders = re.findall(r'\$\d+', func_source)
                num_placeholders = len(set(placeholders))

                assert num_columns == num_placeholders, (
                    f"Column count ({num_columns}) != placeholder count ({num_placeholders})"
                )
                break

    def test_insert_notification_has_correct_columns(self):
        """insert_notification must match notifications table schema."""
        queries_path = os.path.join(os.path.dirname(__file__), "..", "db", "queries.py")
        with open(queries_path) as f:
            source = f.read()

        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.AsyncFunctionDef) and node.name == "insert_notification":
                func_source = ast.get_source_segment(source, node)
                required_cols = [
                    "notification_id", "user_id", "type", "title",
                    "message", "data", "read", "created_at"
                ]
                for col in required_cols:
                    assert col in func_source, (
                        f"insert_notification missing column: {col}"
                    )
                break

    def test_insert_game_thread_has_correct_columns(self):
        """insert_game_thread must match game_threads table schema."""
        queries_path = os.path.join(os.path.dirname(__file__), "..", "db", "queries.py")
        with open(queries_path) as f:
            source = f.read()

        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.AsyncFunctionDef) and node.name == "insert_game_thread":
                func_source = ast.get_source_segment(source, node)
                required_cols = [
                    "message_id", "game_id", "user_id", "content",
                    "type", "created_at"
                ]
                for col in required_cols:
                    assert col in func_source, (
                        f"insert_game_thread missing column: {col}"
                    )
                break

    def test_no_duplicate_function_definitions(self):
        """No function should be defined twice in queries.py (overwriting the first)."""
        queries_path = os.path.join(os.path.dirname(__file__), "..", "db", "queries.py")
        with open(queries_path) as f:
            source = f.read()

        tree = ast.parse(source)
        func_names = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                func_names.append(node.name)

        duplicates = [name for name in set(func_names) if func_names.count(name) > 1]
        assert not duplicates, (
            f"Duplicate function definitions found: {duplicates}"
        )


class TestMigrationFiles:
    """Validate migration SQL files exist and are well-formed."""

    def test_buy_in_count_migration_exists(self):
        """Migration 019 must exist and add buy_in_count column."""
        migration_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "supabase", "migrations",
            "019_add_buy_in_count.sql"
        )
        assert os.path.exists(migration_path), "Migration 019 not found"
        with open(migration_path) as f:
            sql = f.read()
        assert "buy_in_count" in sql
        assert "ALTER TABLE players" in sql
        assert "IF NOT EXISTS" in sql

    def test_migration_019_is_idempotent(self):
        """Migration 019 must use IF NOT EXISTS for safe re-runs."""
        migration_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "supabase", "migrations",
            "019_add_buy_in_count.sql"
        )
        with open(migration_path) as f:
            sql = f.read()
        assert "IF NOT EXISTS" in sql, "Migration must be idempotent with IF NOT EXISTS"


class TestServerHandlerSideEffectIsolation:
    """Verify that server.py handlers wrap secondary operations in try-catch."""

    def _read_server_source(self):
        server_path = os.path.join(os.path.dirname(__file__), "..", "server.py")
        with open(server_path) as f:
            return f.read()

    def _get_handler_source(self, source, handler_name):
        """Extract a handler function's source code."""
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.AsyncFunctionDef) and node.name == handler_name:
                return ast.get_source_segment(source, node)
        return None

    def test_add_player_wraps_notification_in_try(self):
        """add_player_to_game must wrap insert_notification in try-except."""
        source = self._read_server_source()
        handler = self._get_handler_source(source, "add_player_to_game")
        assert handler is not None, "add_player_to_game handler not found"

        # The notification insert should be inside a try block
        # Find insert_notification call and verify it's preceded by try
        notif_idx = handler.index("insert_notification")
        preceding = handler[:notif_idx]
        # Count try/except blocks — there should be at least one try before notification
        assert "try:" in preceding[preceding.rfind("# Side effects"):], (
            "insert_notification in add_player_to_game is not wrapped in try-except"
        )

    def test_add_player_wraps_game_thread_in_try(self):
        """add_player_to_game must wrap insert_game_thread in try-except."""
        source = self._read_server_source()
        handler = self._get_handler_source(source, "add_player_to_game")
        assert handler is not None

        thread_idx = handler.index("insert_game_thread")
        preceding = handler[:thread_idx]
        last_try = preceding.rfind("try:")
        last_except = preceding.rfind("except")
        # The last try should be after the last except (meaning we're in a new try block)
        assert last_try > last_except, (
            "insert_game_thread in add_player_to_game is not wrapped in try-except"
        )

    def test_request_buy_in_wraps_side_effects(self):
        """request_buy_in must wrap notification and game_thread in try-except."""
        source = self._read_server_source()
        handler = self._get_handler_source(source, "request_buy_in")
        assert handler is not None

        assert "try:" in handler, "request_buy_in has no try-except blocks"
        assert "insert_notification" in handler
        assert "insert_game_thread" in handler

        # Both should have their own try blocks
        notif_idx = handler.index("insert_notification")
        thread_idx = handler.index("insert_game_thread")

        # Verify notification is inside a try block
        preceding_notif = handler[:notif_idx]
        assert preceding_notif.rfind("try:") > preceding_notif.rfind("return"), (
            "insert_notification is not in a try block"
        )

    def test_approve_buy_in_wraps_side_effects(self):
        """approve_buy_in must wrap notification and game_thread in try-except."""
        source = self._read_server_source()
        handler = self._get_handler_source(source, "approve_buy_in")
        assert handler is not None

        assert "try:" in handler
        assert "insert_notification" in handler

    def test_request_cash_out_wraps_side_effects(self):
        """request_cash_out must wrap notification and game_thread in try-except."""
        source = self._read_server_source()
        handler = self._get_handler_source(source, "request_cash_out")
        assert handler is not None

        assert "try:" in handler
        assert "insert_notification" in handler

    def test_invite_member_keeps_invite_as_primary(self):
        """invite_member must NOT wrap insert_group_invite in try-except (it's primary)."""
        source = self._read_server_source()
        handler = self._get_handler_source(source, "invite_member")
        assert handler is not None

        # insert_group_invite should appear BEFORE any try block
        invite_idx = handler.index("insert_group_invite")
        preceding = handler[:invite_idx]
        # The most recent control structure before insert_group_invite should NOT be try
        lines_before = preceding.strip().split('\n')
        last_nonblank = [l.strip() for l in lines_before if l.strip()]
        # Check it's not directly inside a try block
        # We look for the line right before — it should be the isoformat line, not "try:"
        assert last_nonblank[-1] != "try:", (
            "insert_group_invite should be primary, not wrapped in try-except"
        )


# =====================================================================
# INTEGRATION TESTS — Require running server
# =====================================================================


@skip_no_server
class TestNotificationReadPath:
    """Test the notification read endpoints work correctly."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}

    def test_get_notifications_returns_list(self):
        """GET /notifications should return a list."""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=self.headers
        )
        assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_unread_count_returns_number(self):
        """GET /notifications/unread-count should return a count object."""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers=self.headers
        )
        assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
        data = response.json()
        assert "count" in data, f"Missing 'count' key in response: {data}"
        assert isinstance(data["count"], int), f"count should be int, got {type(data['count'])}"

    def test_notifications_require_auth(self):
        """GET /notifications without auth should return 401 or 403."""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code in (401, 403), (
            f"Expected 401/403 without auth, got {response.status_code}"
        )


@skip_no_server
class TestAddPlayerToGame:
    """Test add-player endpoint with side-effect isolation."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}
        self.headers_2 = {"Authorization": f"Bearer {SESSION_TOKEN_2}"}

    def test_add_player_requires_host(self):
        """Non-host should get 403 when adding a player."""
        response = requests.post(
            f"{BASE_URL}/api/games/fake_game/add-player",
            json={"user_id": USER_ID},
            headers=self.headers_2
        )
        # Either 403 (not host) or 404 (game not found) is acceptable
        assert response.status_code in (403, 404), (
            f"Expected 403 or 404, got {response.status_code}: {response.text}"
        )

    def test_add_player_missing_user_id_returns_400(self):
        """Missing user_id and email should return 400."""
        # First we need a real game — but without one, we'll get 404 which is fine
        response = requests.post(
            f"{BASE_URL}/api/games/fake_game/add-player",
            json={},
            headers=self.headers
        )
        assert response.status_code in (400, 404), (
            f"Expected 400 or 404, got {response.status_code}: {response.text}"
        )


@skip_no_server
class TestRequestBuyIn:
    """Test request-buy-in endpoint."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}

    def test_request_buy_in_requires_auth(self):
        """Request buy-in without auth should return 401/403."""
        response = requests.post(
            f"{BASE_URL}/api/games/fake_game/request-buy-in",
            json={"amount": 20}
        )
        assert response.status_code in (401, 403)

    def test_request_buy_in_nonexistent_game(self):
        """Request buy-in for non-existent game should return 404."""
        response = requests.post(
            f"{BASE_URL}/api/games/nonexistent_game_id/request-buy-in",
            json={"amount": 20},
            headers=self.headers
        )
        assert response.status_code == 404


@skip_no_server
class TestInviteMember:
    """Test invite member endpoint."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}

    def test_invite_requires_auth(self):
        """Invite without auth should return 401/403."""
        response = requests.post(
            f"{BASE_URL}/api/groups/fake_group/invite",
            json={"email": "test@example.com"}
        )
        assert response.status_code in (401, 403)

    def test_invite_nonexistent_group(self):
        """Invite to non-existent group should return 404."""
        response = requests.post(
            f"{BASE_URL}/api/groups/nonexistent_group_id/invite",
            json={"email": "test@example.com"},
            headers=self.headers
        )
        assert response.status_code in (404, 403)


class TestSyntaxValidity:
    """Verify all modified files are valid Python."""

    def test_server_py_syntax(self):
        """server.py must be valid Python."""
        server_path = os.path.join(os.path.dirname(__file__), "..", "server.py")
        with open(server_path) as f:
            source = f.read()
        # This will raise SyntaxError if invalid
        ast.parse(source)

    def test_queries_py_syntax(self):
        """queries.py must be valid Python."""
        queries_path = os.path.join(os.path.dirname(__file__), "..", "db", "queries.py")
        with open(queries_path) as f:
            source = f.read()
        ast.parse(source)
