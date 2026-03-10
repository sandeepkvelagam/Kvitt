"""
Unit tests for Notifications router extraction.

Verifies that:
- routers/notifications.py exports the correct symbols and routes
- NotificationPreferencesUpdate model works correctly
- All modified files parse without syntax errors
- Notification routes are NOT in server.py anymore
"""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestNotificationsRouterRegistration:
    """Verify Notifications router is properly registered with correct routes."""

    def test_notifications_router_import(self):
        from routers.notifications import router
        assert router is not None

    def test_notifications_router_prefix(self):
        from routers.notifications import router
        assert router.prefix == "/api"

    def test_notifications_router_has_routes(self):
        from routers.notifications import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/notifications",
            "/api/notifications/{notification_id}/read",
            "/api/notifications/read-all",
            "/api/notifications/unread-count",
            "/api/notifications/{notification_id}",
            "/api/notifications/preferences",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_notifications_router_route_count(self):
        from routers.notifications import router
        # 7 routes: preferences has GET and PUT
        assert len(router.routes) == 7


class TestNotificationModels:
    """Verify Notification Pydantic models work correctly."""

    def test_notification_preferences_update_defaults(self):
        from routers.notifications import NotificationPreferencesUpdate
        req = NotificationPreferencesUpdate()
        assert req.push_enabled is None
        assert req.game_updates_enabled is None
        assert req.settlements_enabled is None
        assert req.group_invites_enabled is None

    def test_notification_preferences_update_with_values(self):
        from routers.notifications import NotificationPreferencesUpdate
        req = NotificationPreferencesUpdate(
            push_enabled=True,
            game_updates_enabled=False,
        )
        assert req.push_enabled is True
        assert req.game_updates_enabled is False
        assert req.settlements_enabled is None


class TestNotificationsNotInServer:
    """Verify Notification routes and models have been removed from server.py."""

    def test_no_notification_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        notification_functions = [
            "get_notifications",
            "mark_notification_read",
            "mark_all_read",
            "get_unread_count",
            "delete_notification",
            "get_notification_preferences",
            "update_notification_preferences",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in notification_functions:
            assert fn not in server_functions, f"Notification function {fn} still in server.py"

    def test_no_notification_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        assert "NotificationPreferencesUpdate" not in server_classes


class TestSyntaxCheck:
    """Verify all modified files parse without syntax errors."""

    def test_notifications_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'notifications.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
