"""
Unit tests for Engagement router extraction.

Verifies that:
- routers/engagement.py exports the correct symbols and routes
- Engagement models work correctly
- All modified files parse without syntax errors
- Engagement routes are NOT in server.py anymore
"""

import pytest
import sys
import os
import ast

# Ensure backend/ is on the path so we can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestEngagementRouterRegistration:
    """Verify Engagement router is properly registered with correct routes."""

    def test_engagement_router_import(self):
        from routers.engagement import router
        assert router is not None

    def test_engagement_router_prefix(self):
        from routers.engagement import router
        assert router.prefix == "/api"

    def test_engagement_router_has_routes(self):
        from routers.engagement import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/engagement/scores/group/{group_id}",
            "/api/engagement/scores/user/{user_id}",
            "/api/engagement/scores/me",
            "/api/engagement/inactive-groups",
            "/api/engagement/inactive-users/{group_id}",
            "/api/engagement/settings/{group_id}",
            "/api/engagement/trigger-check/{group_id}",
            "/api/engagement/nudge-history/{group_id}",
            "/api/engagement/report/{group_id}",
            "/api/engagement/preferences",
            "/api/engagement/mute",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_engagement_router_route_count(self):
        from routers.engagement import router
        # 13 routes: /settings/{group_id} has GET and PUT, /preferences has GET and PUT
        assert len(router.routes) == 13


class TestEngagementModels:
    """Verify Engagement Pydantic models work correctly."""

    def test_engagement_settings_update_defaults(self):
        from routers.engagement import EngagementSettingsUpdate
        req = EngagementSettingsUpdate()
        assert req.engagement_enabled is None
        assert req.inactive_group_nudge_days is None
        assert req.inactive_user_nudge_days is None
        assert req.milestone_celebrations is None
        assert req.big_winner_celebrations is None
        assert req.weekly_digest is None
        assert req.show_amounts_in_celebrations is None

    def test_engagement_settings_update_with_values(self):
        from routers.engagement import EngagementSettingsUpdate
        req = EngagementSettingsUpdate(
            engagement_enabled=True,
            inactive_group_nudge_days=7,
            milestone_celebrations=False,
        )
        assert req.engagement_enabled is True
        assert req.inactive_group_nudge_days == 7
        assert req.milestone_celebrations is False

    def test_engagement_preferences_update_defaults(self):
        from routers.engagement import EngagementPreferencesUpdate
        req = EngagementPreferencesUpdate()
        assert req.muted_all is None
        assert req.muted_categories is None
        assert req.preferred_channels is None
        assert req.preferred_tone is None
        assert req.timezone_offset_hours is None
        assert req.quiet_start is None
        assert req.quiet_end is None

    def test_engagement_preferences_update_with_values(self):
        from routers.engagement import EngagementPreferencesUpdate
        req = EngagementPreferencesUpdate(
            muted_all=True,
            preferred_tone="friendly",
            quiet_start=22,
            quiet_end=8,
        )
        assert req.muted_all is True
        assert req.preferred_tone == "friendly"
        assert req.quiet_start == 22
        assert req.quiet_end == 8


class TestEngagementNotInServer:
    """Verify Engagement routes and models have been removed from server.py."""

    def test_no_engagement_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        engagement_functions = [
            "get_group_engagement_score",
            "get_user_engagement_score",
            "get_my_engagement_score",
            "get_inactive_groups",
            "get_inactive_users",
            "get_engagement_settings",
            "update_engagement_settings",
            "trigger_engagement_check",
            "get_nudge_history",
            "get_engagement_report",
            "get_engagement_preferences",
            "update_engagement_preferences",
            "mute_engagement",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in engagement_functions:
            assert fn not in server_functions, f"Engagement function {fn} still in server.py"

    def test_no_engagement_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        engagement_models = [
            "EngagementSettingsUpdate",
            "EngagementPreferencesUpdate",
        ]

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        for model in engagement_models:
            assert model not in server_classes, f"Engagement model {model} still in server.py"


class TestSyntaxCheck:
    """Verify all modified files parse without syntax errors."""

    def test_engagement_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'engagement.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
