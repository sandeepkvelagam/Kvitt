"""
Unit tests for AI Assistant router extraction.

Verifies that:
- routers/assistant.py exports the correct symbols and routes
- Helper functions and constants are present
- All modified files parse without syntax errors
- Assistant routes are NOT in server.py anymore
"""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestAssistantRouterRegistration:
    """Verify Assistant router is properly registered with correct routes."""

    def test_assistant_router_import(self):
        from routers.assistant import router
        assert router is not None

    def test_assistant_router_prefix(self):
        from routers.assistant import router
        assert router.prefix == "/api"

    def test_assistant_router_has_routes(self):
        from routers.assistant import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/assistant/usage",
            "/api/assistant/ask",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_assistant_router_route_count(self):
        from routers.assistant import router
        assert len(router.routes) == 2


class TestAssistantModels:
    """Verify Pydantic models are correctly defined."""

    def test_ask_assistant_request_model(self):
        from routers.assistant import AskAssistantRequest
        obj = AskAssistantRequest(message="hello")
        assert obj.message == "hello"
        assert obj.context is None
        assert obj.conversation_history is None
        assert obj.flow_event is None

    def test_ask_assistant_request_with_all_fields(self):
        from routers.assistant import AskAssistantRequest
        obj = AskAssistantRequest(
            message="test",
            context={"key": "value"},
            conversation_history=[{"role": "user", "content": "hi"}],
            flow_event={"flow_id": "test_flow", "step": 0},
        )
        assert obj.message == "test"
        assert obj.context == {"key": "value"}
        assert len(obj.conversation_history) == 1
        assert obj.flow_event["flow_id"] == "test_flow"


class TestAssistantConstants:
    """Verify constants and maps are correctly defined."""

    def test_daily_limits(self):
        from routers.assistant import AI_DAILY_LIMIT_FREE, AI_DAILY_LIMIT_PREMIUM
        assert AI_DAILY_LIMIT_FREE == 10
        assert AI_DAILY_LIMIT_PREMIUM == 50

    def test_screen_map(self):
        from routers.assistant import SCREEN_MAP
        assert "groups" in SCREEN_MAP
        assert "wallet" in SCREEN_MAP
        assert "settings" in SCREEN_MAP
        assert SCREEN_MAP["groups"]["screen"] == "Groups"

    def test_nav_triggers(self):
        from routers.assistant import NAV_TRIGGERS
        assert "groups" in NAV_TRIGGERS
        assert "wallet" in NAV_TRIGGERS
        assert isinstance(NAV_TRIGGERS["groups"], list)
        assert len(NAV_TRIGGERS["groups"]) > 0


class TestAssistantHelpers:
    """Verify helper functions are exported."""

    def test_detect_navigation(self):
        from routers.assistant import detect_navigation
        result = detect_navigation("go to groups", "")
        assert result is not None
        assert result["screen"] == "Groups"

    def test_detect_navigation_no_match(self):
        from routers.assistant import detect_navigation
        result = detect_navigation("hello there", "how can I help")
        assert result is None

    def test_validate_ai_input_empty(self):
        from routers.assistant import validate_ai_input
        assert validate_ai_input("") is not None
        assert validate_ai_input("   ") is not None

    def test_validate_ai_input_too_long(self):
        from routers.assistant import validate_ai_input
        assert validate_ai_input("x" * 1001) is not None

    def test_validate_ai_input_ok(self):
        from routers.assistant import validate_ai_input
        assert validate_ai_input("Hello!") is None

    def test_extract_follow_ups_no_match(self):
        from routers.assistant import extract_follow_ups
        text, follow_ups = extract_follow_ups("Just a normal response")
        assert text == "Just a normal response"
        assert follow_ups == []

    def test_extract_follow_ups_with_match(self):
        from routers.assistant import extract_follow_ups
        text = 'Some answer\n---FOLLOW_UPS---\n["Q1", "Q2", "Q3"]\n---END_FOLLOW_UPS---'
        cleaned, follow_ups = extract_follow_ups(text)
        assert cleaned == "Some answer"
        assert follow_ups == ["Q1", "Q2", "Q3"]


class TestAssistantNotInServer:
    """Verify Assistant routes have been removed from server.py."""

    def test_no_assistant_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        assistant_functions = [
            "get_assistant_usage",
            "ask_assistant",
            "check_ai_rate_limit",
            "get_ai_requests_remaining",
            "get_user_ai_limit",
            "detect_navigation",
            "validate_ai_input",
            "extract_follow_ups",
            "fetch_user_context_summary",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in assistant_functions:
            assert fn not in server_functions, f"Assistant function {fn} still in server.py"

    def test_no_assistant_model_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        assert "AskAssistantRequest" not in server_classes

    def test_orchestrator_still_in_server(self):
        """get_orchestrator must remain in server.py (used by lifespan handler)."""
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        assert "get_orchestrator" in server_functions


class TestSyntaxCheck:
    def test_assistant_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'assistant.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
