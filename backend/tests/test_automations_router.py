"""
Unit tests for Automations router extraction.

Verifies that:
- routers/automations.py exports the correct symbols and routes
- Automation models work correctly
- AUTOMATION_ID_PATTERN regex works correctly
- All modified files parse without syntax errors
- Automation routes are NOT in server.py anymore
"""

import pytest
import re
import sys
import os
import ast

# Ensure backend/ is on the path so we can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestAutomationsRouterRegistration:
    """Verify Automations router is properly registered with correct routes."""

    def test_automations_router_import(self):
        from routers.automations import router
        assert router is not None

    def test_automations_router_prefix(self):
        from routers.automations import router
        assert router.prefix == "/api"

    def test_automations_router_has_routes(self):
        from routers.automations import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/automations",
            "/api/automations/templates",
            "/api/automations/triggers/available",
            "/api/automations/actions/available",
            "/api/automations/usage/cost-budget",
            "/api/automations/{automation_id}",
            "/api/automations/{automation_id}/toggle",
            "/api/automations/{automation_id}/run",
            "/api/automations/{automation_id}/history",
            "/api/automations/{automation_id}/replay",
            "/api/automations/{automation_id}/health",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_automations_router_route_count(self):
        from routers.automations import router
        # 14 routes: /automations has GET and POST, /automations/{id} has GET, PUT, DELETE
        assert len(router.routes) == 14

    def test_static_routes_before_dynamic(self):
        """Static routes like /templates must be registered before /{automation_id}."""
        from routers.automations import router
        paths = [r.path for r in router.routes]
        templates_idx = paths.index("/api/automations/templates")
        dynamic_idx = paths.index("/api/automations/{automation_id}")
        assert templates_idx < dynamic_idx, "Static /templates must come before /{automation_id}"


class TestAutomationModels:
    """Verify Automation Pydantic models work correctly."""

    def test_automation_create_required_fields(self):
        from routers.automations import AutomationCreate
        req = AutomationCreate(
            name="Test Automation",
            trigger={"type": "game_ended"},
            actions=[{"type": "send_notification"}],
        )
        assert req.name == "Test Automation"
        assert req.trigger == {"type": "game_ended"}
        assert req.actions == [{"type": "send_notification"}]
        assert req.description is None
        assert req.conditions is None
        assert req.execution_options is None
        assert req.group_id is None

    def test_automation_create_with_optionals(self):
        from routers.automations import AutomationCreate
        req = AutomationCreate(
            name="Full Automation",
            trigger={"type": "game_ended"},
            actions=[{"type": "send_notification"}],
            description="A test automation",
            conditions={"min_players": 3},
            execution_options={"retry": True},
            group_id="grp_123",
        )
        assert req.description == "A test automation"
        assert req.conditions == {"min_players": 3}
        assert req.group_id == "grp_123"

    def test_automation_update_all_optional(self):
        from routers.automations import AutomationUpdate
        req = AutomationUpdate()
        assert req.name is None
        assert req.description is None
        assert req.trigger is None
        assert req.actions is None
        assert req.conditions is None
        assert req.execution_options is None
        assert req.enabled is None

    def test_automation_update_partial(self):
        from routers.automations import AutomationUpdate
        req = AutomationUpdate(name="Renamed", enabled=False)
        assert req.name == "Renamed"
        assert req.enabled is False

    def test_automation_toggle(self):
        from routers.automations import AutomationToggle
        req = AutomationToggle(enabled=True)
        assert req.enabled is True

    def test_automation_toggle_disabled(self):
        from routers.automations import AutomationToggle
        req = AutomationToggle(enabled=False)
        assert req.enabled is False


class TestAutomationIdPattern:
    """Verify AUTOMATION_ID_PATTERN regex works correctly."""

    def test_valid_automation_id(self):
        from routers.automations import AUTOMATION_ID_PATTERN
        assert re.match(AUTOMATION_ID_PATTERN, "auto_1a2b3c4d5e6f")

    def test_valid_automation_id_all_hex(self):
        from routers.automations import AUTOMATION_ID_PATTERN
        assert re.match(AUTOMATION_ID_PATTERN, "auto_abcdef012345")

    def test_invalid_automation_id_wrong_prefix(self):
        from routers.automations import AUTOMATION_ID_PATTERN
        assert not re.match(AUTOMATION_ID_PATTERN, "aut_1a2b3c4d5e6f")

    def test_invalid_automation_id_too_short(self):
        from routers.automations import AUTOMATION_ID_PATTERN
        assert not re.match(AUTOMATION_ID_PATTERN, "auto_1a2b3c")

    def test_invalid_automation_id_too_long(self):
        from routers.automations import AUTOMATION_ID_PATTERN
        assert not re.match(AUTOMATION_ID_PATTERN, "auto_1a2b3c4d5e6f7")

    def test_invalid_automation_id_uppercase(self):
        from routers.automations import AUTOMATION_ID_PATTERN
        assert not re.match(AUTOMATION_ID_PATTERN, "auto_1A2B3C4D5E6F")


class TestAutomationsNotInServer:
    """Verify Automation routes and models have been removed from server.py."""

    def test_no_automation_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        automation_functions = [
            "list_automations",
            "create_automation",
            "get_automation_templates",
            "list_available_triggers",
            "list_available_actions",
            "get_cost_budget",
            "get_automation",
            "update_automation",
            "delete_automation",
            "toggle_automation",
            "run_automation",
            "get_automation_history",
            "replay_automation",
            "get_automation_health",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in automation_functions:
            assert fn not in server_functions, f"Automation function {fn} still in server.py"

    def test_no_automation_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        automation_models = [
            "AutomationCreate",
            "AutomationUpdate",
            "AutomationToggle",
        ]

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        for model in automation_models:
            assert model not in server_classes, f"Automation model {model} still in server.py"


class TestSyntaxCheck:
    """Verify all modified files parse without syntax errors."""

    def test_automations_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'automations.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
