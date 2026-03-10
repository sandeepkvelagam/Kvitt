"""
Unit tests for Feedback router extraction.

Verifies that:
- routers/feedback.py exports the correct symbols and routes
- Feedback models work correctly
- All modified files parse without syntax errors
- Feedback routes are NOT in server.py anymore
- Admin feedback routes are STILL in server.py
"""

import pytest
import sys
import os
import ast

# Ensure backend/ is on the path so we can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestFeedbackRouterRegistration:
    """Verify Feedback router is properly registered with correct routes."""

    def test_feedback_router_import(self):
        from routers.feedback import router
        assert router is not None

    def test_feedback_router_prefix(self):
        from routers.feedback import router
        assert router.prefix == "/api"

    def test_feedback_router_has_routes(self):
        from routers.feedback import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/feedback",  # POST (submit) and GET (list) share the path
            "/api/feedback/survey",
            "/api/feedback/surveys/{game_id}",
            "/api/feedback/trends",
            "/api/feedback/unresolved",
            "/api/feedback/{feedback_id}/resolve",
            "/api/feedback/{feedback_id}/status",
            "/api/feedback/{feedback_id}/events",
            "/api/feedback/auto-fix",
            "/api/feedback/policy/allowed-fixes",
            "/api/feedback/health",
            "/api/feedback/public-stats",
            "/api/feedback/my",
            "/api/feedback/{feedback_id}/confirm-fix",
            "/api/feedback/{feedback_id}/thread",
            "/api/feedback/{feedback_id}/reply",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_feedback_router_route_count(self):
        from routers.feedback import router
        # 17 routes: /feedback has both GET and POST on the same path
        assert len(router.routes) == 17


class TestFeedbackModels:
    """Verify Feedback Pydantic models work correctly."""

    def test_feedback_submit_defaults(self):
        from routers.feedback import FeedbackSubmit
        req = FeedbackSubmit(content="Test bug report")
        assert req.content == "Test bug report"
        assert req.feedback_type == "other"
        assert req.group_id is None
        assert req.game_id is None
        assert req.tags == []
        assert req.context == {}
        assert req.idempotency_key is None

    def test_feedback_submit_with_values(self):
        from routers.feedback import FeedbackSubmit
        req = FeedbackSubmit(
            content="Something broke",
            feedback_type="bug",
            group_id="g1",
            tags=["urgent"],
            idempotency_key="key-123"
        )
        assert req.feedback_type == "bug"
        assert req.group_id == "g1"
        assert req.tags == ["urgent"]
        assert req.idempotency_key == "key-123"

    def test_survey_submit(self):
        from routers.feedback import SurveySubmit
        req = SurveySubmit(game_id="game_1", rating=4)
        assert req.game_id == "game_1"
        assert req.rating == 4
        assert req.comment == ""
        assert req.group_id is None

    def test_survey_submit_with_comment(self):
        from routers.feedback import SurveySubmit
        req = SurveySubmit(game_id="game_1", rating=5, comment="Great game!")
        assert req.comment == "Great game!"

    def test_feedback_status_update(self):
        from routers.feedback import FeedbackStatusUpdate
        req = FeedbackStatusUpdate(status="resolved")
        assert req.status == "resolved"
        assert req.owner_type is None

    def test_feedback_event_add(self):
        from routers.feedback import FeedbackEventAdd
        req = FeedbackEventAdd()
        assert req.event_type == "note"
        assert req.details == {}

    def test_auto_fix_request(self):
        from routers.feedback import AutoFixRequest
        req = AutoFixRequest(fix_type="reset_password")
        assert req.fix_type == "reset_password"
        assert req.confirmed is False

    def test_confirm_fix_request(self):
        from routers.feedback import ConfirmFixRequest
        req = ConfirmFixRequest()
        assert req.confirmed is True

    def test_confirm_fix_request_rejected(self):
        from routers.feedback import ConfirmFixRequest
        req = ConfirmFixRequest(confirmed=False)
        assert req.confirmed is False

    def test_user_feedback_reply(self):
        from routers.feedback import UserFeedbackReply
        req = UserFeedbackReply(message="Thanks for fixing this!")
        assert req.message == "Thanks for fixing this!"

    def test_build_feedback_agent_exists(self):
        from routers.feedback import _build_feedback_agent
        assert callable(_build_feedback_agent)


class TestFeedbackNotInServer:
    """Verify Feedback routes and models have been removed from server.py."""

    def test_no_feedback_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        feedback_functions = [
            "submit_feedback",
            "submit_survey",
            "get_feedback",
            "get_game_surveys",
            "get_feedback_trends",
            "get_unresolved_feedback",
            "resolve_feedback",
            "update_feedback_status",
            "add_feedback_event",
            "attempt_auto_fix",
            "get_allowed_fixes",
            "get_feedback_health",
            "get_public_rating_stats",
            "get_my_feedback",
            "confirm_auto_fix",
            "get_feedback_thread",
            "user_reply_to_feedback",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in feedback_functions:
            assert fn not in server_functions, f"Feedback function {fn} still in server.py"

    def test_no_feedback_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        feedback_models = [
            "FeedbackSubmit",
            "SurveySubmit",
            "FeedbackStatusUpdate",
            "FeedbackEventAdd",
            "AutoFixRequest",
            "ConfirmFixRequest",
            "UserFeedbackReply",
        ]

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        for model in feedback_models:
            assert model not in server_classes, f"Feedback model {model} still in server.py"

    def test_no_build_feedback_agent_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        assert "_build_feedback_agent" not in server_functions


class TestAdminFeedbackStillInServer:
    """Verify admin feedback routes are STILL in server.py."""

    def test_admin_feedback_routes_still_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        admin_feedback_functions = [
            "admin_get_feedback_stats",
            "admin_get_feedback_detail",
            "admin_respond_to_feedback",
            "generate_feedback_ai_draft",
            "get_similar_feedback",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in admin_feedback_functions:
            assert fn in server_functions, f"Admin feedback function {fn} missing from server.py"

    def test_admin_feedback_response_model_still_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        assert "AdminFeedbackResponse" in server_classes


class TestSyntaxCheck:
    """Verify all modified files parse without syntax errors."""

    def test_feedback_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'feedback.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
