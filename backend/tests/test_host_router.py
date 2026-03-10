"""
Unit tests for Host Persona router extraction.

Verifies that:
- routers/host.py exports the correct symbols and routes
- Host models work correctly
- _execute_host_decision helper exists
- All modified files parse without syntax errors
- Host persona routes are NOT in server.py anymore
"""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestHostRouterRegistration:
    """Verify Host router is properly registered with correct routes."""

    def test_host_router_import(self):
        from routers.host import router
        assert router is not None

    def test_host_router_prefix(self):
        from routers.host import router
        assert router.prefix == "/api"

    def test_host_router_has_routes(self):
        from routers.host import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/host/decisions",
            "/api/host/decisions/{decision_id}/approve",
            "/api/host/decisions/{decision_id}/reject",
            "/api/host/decisions/bulk-approve",
            "/api/host/persona/status",
            "/api/host/persona/settings",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_host_router_route_count(self):
        from routers.host import router
        assert len(router.routes) == 6


class TestHostModels:
    """Verify Host Pydantic models work correctly."""

    def test_host_decision_request_defaults(self):
        from routers.host import HostDecisionRequest
        req = HostDecisionRequest()
        assert req.decision_id is None
        assert req.decision_ids is None
        assert req.reason is None

    def test_host_decision_request_with_values(self):
        from routers.host import HostDecisionRequest
        req = HostDecisionRequest(
            decision_id="d1",
            decision_ids=["d1", "d2"],
            reason="Not enough chips",
        )
        assert req.decision_id == "d1"
        assert req.decision_ids == ["d1", "d2"]
        assert req.reason == "Not enough chips"

    def test_host_persona_settings_defaults(self):
        from routers.host import HostPersonaSettingsRequest
        req = HostPersonaSettingsRequest()
        assert req.auto_approve_standard_buyin is False
        assert req.auto_send_reminders is True
        assert req.auto_generate_settlement is True
        assert req.auto_send_summary is True
        assert req.payment_reminder_days == [1, 3, 7]
        assert req.notify_on_rsvp_change is True
        assert req.suggest_next_game is True

    def test_host_persona_settings_custom(self):
        from routers.host import HostPersonaSettingsRequest
        req = HostPersonaSettingsRequest(
            auto_approve_standard_buyin=True,
            payment_reminder_days=[2, 5],
            suggest_next_game=False,
        )
        assert req.auto_approve_standard_buyin is True
        assert req.payment_reminder_days == [2, 5]
        assert req.suggest_next_game is False

    def test_execute_host_decision_exists(self):
        from routers.host import _execute_host_decision
        assert callable(_execute_host_decision)


class TestHostNotInServer:
    """Verify Host persona routes and models have been removed from server.py."""

    def test_no_host_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        host_functions = [
            "get_pending_decisions",
            "approve_decision",
            "reject_decision",
            "bulk_approve_decisions",
            "get_host_persona_status",
            "update_host_persona_settings",
            "_execute_host_decision",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in host_functions:
            assert fn not in server_functions, f"Host function {fn} still in server.py"

    def test_no_host_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        host_models = ["HostDecisionRequest", "HostPersonaSettingsRequest"]

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        for model in host_models:
            assert model not in server_classes, f"Host model {model} still in server.py"


class TestSyntaxCheck:
    """Verify all modified files parse without syntax errors."""

    def test_host_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'host.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
