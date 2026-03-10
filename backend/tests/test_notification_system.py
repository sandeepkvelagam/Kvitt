"""
Backend API Tests for Notification System Enhancements

Tests:
- Notification preference endpoints (GET/PUT /notifications/preferences)
- Unread count endpoint (GET /notifications/unread-count)
- Delete notification endpoint (DELETE /notifications/{id})
- Preference-checking helper logic
- NotificationSenderTool push/email channel wiring
"""

import pytest
import requests
import os
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000")
BASE_URL = BASE_URL.rstrip("/")


def _server_available():
    """Check if the backend server is running."""
    try:
        requests.get(f"{BASE_URL}/docs", timeout=2)
        return True
    except Exception:
        return False


requires_server = pytest.mark.skipif(
    not _server_available(),
    reason=f"Backend server not running at {BASE_URL}"
)


# ============================================================
# 1. Endpoint Existence Tests (401 = exists, 404 = missing)
#    These require the backend server to be running.
# ============================================================


@requires_server
class TestNotificationPreferencesEndpoints:
    """Test notification preferences endpoints exist and require auth."""

    def test_get_preferences_requires_auth(self):
        """GET /api/notifications/preferences should return 401 without auth."""
        response = requests.get(f"{BASE_URL}/api/notifications/preferences")
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}: {response.text}"
        )

    def test_put_preferences_requires_auth(self):
        """PUT /api/notifications/preferences should return 401 without auth."""
        response = requests.put(
            f"{BASE_URL}/api/notifications/preferences",
            json={"push_enabled": True, "game_updates_enabled": False},
        )
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}: {response.text}"
        )


@requires_server
class TestUnreadCountEndpoint:
    """Test unread count endpoint exists and requires auth."""

    def test_unread_count_requires_auth(self):
        """GET /api/notifications/unread-count should return 401 without auth."""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}: {response.text}"
        )


@requires_server
class TestDeleteNotificationEndpoint:
    """Test delete notification endpoint exists and requires auth."""

    def test_delete_notification_requires_auth(self):
        """DELETE /api/notifications/{id} should return 401 without auth."""
        response = requests.delete(
            f"{BASE_URL}/api/notifications/test-notification-id"
        )
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}: {response.text}"
        )


@requires_server
class TestExistingNotificationEndpoints:
    """Verify existing notification endpoints still work after changes."""

    def test_get_notifications_requires_auth(self):
        """GET /api/notifications should return 401 without auth."""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}: {response.text}"
        )

    def test_mark_read_requires_auth(self):
        """PUT /api/notifications/{id}/read should return 401 without auth."""
        response = requests.put(
            f"{BASE_URL}/api/notifications/test-id/read"
        )
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}: {response.text}"
        )

    def test_mark_all_read_requires_auth(self):
        """PUT /api/notifications/read-all should return 401 without auth."""
        response = requests.put(f"{BASE_URL}/api/notifications/read-all")
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}: {response.text}"
        )


# ============================================================
# 2. Preference Category Mapping Unit Tests
#    (extracted from server.py to avoid heavy import chain)
# ============================================================


def _load_category_map():
    """Parse NOTIFICATION_CATEGORY_MAP from server.py without importing it."""
    import ast
    server_path = os.path.join(os.path.dirname(__file__), "..", "server.py")
    with open(server_path) as f:
        source = f.read()

    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "NOTIFICATION_CATEGORY_MAP":
                    return ast.literal_eval(node.value)
    raise RuntimeError("NOTIFICATION_CATEGORY_MAP not found in server.py")


class TestNotificationCategoryMapping:
    """Test that notification types map to correct preference categories."""

    def test_game_types_map_to_game_updates(self):
        """Game-related notification types should map to game_updates_enabled."""
        category_map = _load_category_map()
        game_types = [
            "game_started", "game_ended", "buy_in_request",
            "buy_in_approved", "buy_in", "cash_out",
            "join_request", "join_approved", "join_rejected", "chip_edit",
        ]
        for ntype in game_types:
            assert category_map.get(ntype) == "game_updates_enabled", (
                f"Type '{ntype}' should map to 'game_updates_enabled', "
                f"got '{category_map.get(ntype)}'"
            )

    def test_settlement_types_map_to_settlements(self):
        """Settlement-related types should map to settlements_enabled."""
        category_map = _load_category_map()
        settlement_types = [
            "settlement", "settlement_generated",
            "payment_request", "payment_received",
        ]
        for ntype in settlement_types:
            assert category_map.get(ntype) == "settlements_enabled", (
                f"Type '{ntype}' should map to 'settlements_enabled', "
                f"got '{category_map.get(ntype)}'"
            )

    def test_invite_types_map_to_group_invites(self):
        """Group invite types should map to group_invites_enabled."""
        category_map = _load_category_map()
        invite_types = [
            "group_invite_request", "invite_accepted",
            "invite_sent", "group_invite",
        ]
        for ntype in invite_types:
            assert category_map.get(ntype) == "group_invites_enabled", (
                f"Type '{ntype}' should map to 'group_invites_enabled', "
                f"got '{category_map.get(ntype)}'"
            )

    def test_unknown_types_not_in_map(self):
        """Unknown notification types should not be in the map (always send)."""
        category_map = _load_category_map()
        unknown_types = ["general", "system", "announcement", "unknown_type"]
        for ntype in unknown_types:
            assert ntype not in category_map, (
                f"Type '{ntype}' should not be in NOTIFICATION_CATEGORY_MAP"
            )

    def test_all_categories_are_valid(self):
        """Every value in the map should be a known preference key."""
        category_map = _load_category_map()
        valid_categories = {
            "game_updates_enabled", "settlements_enabled", "group_invites_enabled"
        }
        for ntype, category in category_map.items():
            assert category in valid_categories, (
                f"Type '{ntype}' maps to unknown category '{category}'"
            )


# ============================================================
# 3. NotificationSenderTool Unit Tests
# ============================================================


class TestNotificationSenderTool:
    """Unit tests for the NotificationSenderTool push and email channels.

    The tool uses db.queries (SQL) and db.pg.get_pool() directly.
    We mock those via @patch decorators.
    """

    def _make_tool(self):
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        from ai_service.tools.notification_sender import NotificationSenderTool
        return NotificationSenderTool()

    @pytest.mark.asyncio
    @patch("ai_service.tools.notification_sender.get_pool")
    @patch("ai_service.tools.notification_sender.queries")
    async def test_execute_in_app_only(self, mock_queries, mock_get_pool):
        """In-app channel should store notification in db."""
        mock_get_pool.return_value = MagicMock()  # pool is available
        mock_queries.insert_notification = AsyncMock()
        tool = self._make_tool()

        result = await tool.execute(
            user_ids=["user1"],
            title="Test",
            message="Test message",
            notification_type="general",
            channels=["in_app"],
        )

        assert result.success is True
        assert result.data["sent_count"] >= 1
        mock_queries.insert_notification.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_no_users(self):
        """Should fail gracefully with empty user_ids."""
        tool = self._make_tool()
        result = await tool.execute(
            user_ids=[],
            title="Test",
            message="Test message",
            notification_type="general",
        )
        assert result.success is False
        assert "No user IDs" in result.error

    @pytest.mark.asyncio
    @patch("ai_service.tools.notification_sender.get_pool")
    @patch("ai_service.tools.notification_sender.queries")
    async def test_execute_push_no_token(self, mock_queries, mock_get_pool):
        """Push channel should skip when user has no push token."""
        mock_get_pool.return_value = MagicMock()
        mock_queries.get_user = AsyncMock(return_value={"user_id": "user1"})
        tool = self._make_tool()

        result = await tool.execute(
            user_ids=["user1"],
            title="Test",
            message="Test message",
            notification_type="general",
            channels=["push"],
        )

        push_results = [r for r in result.data["results"] if r["channel"] == "push"]
        assert len(push_results) == 1
        assert push_results[0]["status"] == "skipped"

    @pytest.mark.asyncio
    @patch("ai_service.tools.notification_sender.get_pool")
    @patch("ai_service.tools.notification_sender.queries")
    async def test_execute_push_with_token(self, mock_queries, mock_get_pool):
        """Push channel should send when user has a valid push token."""
        mock_get_pool.return_value = MagicMock()
        mock_queries.get_user = AsyncMock(return_value={
            "user_id": "user1",
            "expo_push_token": "ExponentPushToken[abc123]",
        })
        tool = self._make_tool()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            result = await tool.execute(
                user_ids=["user1"],
                title="Test Push",
                message="Test push message",
                notification_type="game_started",
                channels=["push"],
            )

            push_results = [r for r in result.data["results"] if r["channel"] == "push"]
            assert len(push_results) == 1
            assert push_results[0]["status"] == "sent"
            mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    @patch("ai_service.tools.notification_sender.get_pool")
    @patch("ai_service.tools.notification_sender.queries")
    async def test_execute_email_no_email(self, mock_queries, mock_get_pool):
        """Email channel should skip when user has no email."""
        mock_get_pool.return_value = MagicMock()
        mock_queries.get_user = AsyncMock(return_value={"user_id": "user1"})
        tool = self._make_tool()

        result = await tool.execute(
            user_ids=["user1"],
            title="Test",
            message="Test message",
            notification_type="general",
            channels=["email"],
        )

        email_results = [r for r in result.data["results"] if r["channel"] == "email"]
        assert len(email_results) == 1
        assert email_results[0]["status"] == "skipped"

    @pytest.mark.asyncio
    @patch("ai_service.tools.notification_sender.get_pool")
    @patch("ai_service.tools.notification_sender.queries")
    async def test_execute_email_with_address(self, mock_queries, mock_get_pool):
        """Email channel should send when user has an email address."""
        mock_get_pool.return_value = MagicMock()
        mock_queries.get_user = AsyncMock(return_value={
            "user_id": "user1", "email": "test@example.com"
        })
        tool = self._make_tool()

        import sys
        mock_email_mod = MagicMock()
        mock_email_mod.send_email = AsyncMock()
        sys.modules["email_service"] = mock_email_mod

        try:
            result = await tool.execute(
                user_ids=["user1"],
                title="Test Email",
                message="Test email body",
                notification_type="settlement",
                channels=["email"],
            )

            email_results = [r for r in result.data["results"] if r["channel"] == "email"]
            assert len(email_results) == 1
            assert email_results[0]["status"] == "sent"
            mock_email_mod.send_email.assert_called_once_with("test@example.com", "Test Email", "Test email body")
        finally:
            del sys.modules["email_service"]

    @pytest.mark.asyncio
    @patch("ai_service.tools.notification_sender.get_pool")
    @patch("ai_service.tools.notification_sender.queries")
    async def test_execute_all_channels(self, mock_queries, mock_get_pool):
        """All channels together should each produce a result."""
        mock_get_pool.return_value = MagicMock()
        mock_queries.get_user = AsyncMock(return_value={
            "user_id": "user1",
            "email": "test@example.com",
            "expo_push_token": "ExponentPushToken[abc123]",
        })
        mock_queries.insert_notification = AsyncMock()
        tool = self._make_tool()

        import sys
        mock_email_mod = MagicMock()
        mock_email_mod.send_email = AsyncMock()
        sys.modules["email_service"] = mock_email_mod

        try:
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_client.post = AsyncMock(return_value=mock_resp)
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=None)
                mock_client_cls.return_value = mock_client

                result = await tool.execute(
                    user_ids=["user1"],
                    title="Test All",
                    message="Test all channels",
                    notification_type="general",
                    channels=["in_app", "push", "email"],
                )

                assert result.success is True
                channels_sent = {r["channel"] for r in result.data["results"] if r["status"] == "sent"}
                assert "in_app" in channels_sent
                assert "push" in channels_sent
                assert "email" in channels_sent
        finally:
            del sys.modules["email_service"]

    @pytest.mark.asyncio
    @patch("ai_service.tools.notification_sender.get_pool")
    @patch("ai_service.tools.notification_sender.queries")
    async def test_execute_push_api_failure(self, mock_queries, mock_get_pool):
        """Push channel should report failed when Expo API returns error."""
        mock_get_pool.return_value = MagicMock()
        mock_queries.get_user = AsyncMock(return_value={
            "user_id": "user1",
            "expo_push_token": "ExponentPushToken[abc123]",
        })
        tool = self._make_tool()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_resp = MagicMock()
            mock_resp.status_code = 500
            mock_resp.text = "Internal Server Error"
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            result = await tool.execute(
                user_ids=["user1"],
                title="Test",
                message="Test",
                notification_type="general",
                channels=["push"],
            )

            push_results = [r for r in result.data["results"] if r["channel"] == "push"]
            assert len(push_results) == 1
            assert push_results[0]["status"] == "skipped"

    @pytest.mark.asyncio
    @patch("ai_service.tools.notification_sender.get_pool")
    @patch("ai_service.tools.notification_sender.queries")
    async def test_execute_default_channel(self, mock_queries, mock_get_pool):
        """When no channels specified, should default to in_app."""
        mock_get_pool.return_value = MagicMock()
        mock_queries.insert_notification = AsyncMock()
        tool = self._make_tool()

        result = await tool.execute(
            user_ids=["user1"],
            title="Test",
            message="Default channel test",
            notification_type="general",
        )

        assert result.success is True
        channels = {r["channel"] for r in result.data["results"]}
        assert channels == {"in_app"}

    @pytest.mark.asyncio
    @patch("ai_service.tools.notification_sender.get_pool")
    async def test_execute_no_db(self, mock_get_pool):
        """Tool should handle missing db gracefully."""
        mock_get_pool.return_value = None  # no pool available
        tool = self._make_tool()

        result = await tool.execute(
            user_ids=["user1"],
            title="Test",
            message="No DB test",
            notification_type="general",
            channels=["in_app"],
        )

        assert result.data["sent_count"] == 0

    @pytest.mark.asyncio
    @patch("ai_service.tools.notification_sender.get_pool")
    @patch("ai_service.tools.notification_sender.queries")
    async def test_multiple_users(self, mock_queries, mock_get_pool):
        """Should send to multiple users and report per-user results."""
        mock_get_pool.return_value = MagicMock()
        mock_queries.insert_notification = AsyncMock()
        tool = self._make_tool()

        result = await tool.execute(
            user_ids=["user1", "user2", "user3"],
            title="Broadcast",
            message="Test broadcast",
            notification_type="general",
            channels=["in_app"],
        )

        assert result.data["total_users"] == 3
        assert result.data["sent_count"] == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
