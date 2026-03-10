"""Unit tests for Admin Feedback router extraction."""

import sys, os, ast
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestAdminFeedbackRouterRegistration:
    def test_router_import(self):
        from routers.admin_feedback import router
        assert router is not None

    def test_router_prefix(self):
        from routers.admin_feedback import router
        assert router.prefix == "/api"

    def test_router_has_routes(self):
        from routers.admin_feedback import router
        paths = [r.path for r in router.routes]
        for path in ["/api/admin/feedback/stats", "/api/admin/feedback/{feedback_id}",
                     "/api/admin/feedback",
                     "/api/admin/feedback/{feedback_id}/respond",
                     "/api/admin/feedback/{feedback_id}/ai-draft",
                     "/api/admin/feedback/{feedback_id}/similar"]:
            assert path in paths, f"Missing route: {path}"

    def test_router_route_count(self):
        from routers.admin_feedback import router
        # 6 unique paths but /admin/feedback/{feedback_id} appears in GET, POST (respond), POST (ai-draft), GET (similar)
        assert len(router.routes) == 6


class TestAdminFeedbackModels:
    def test_admin_feedback_response(self):
        from routers.admin_feedback import AdminFeedbackResponse
        obj = AdminFeedbackResponse(message="Thank you for your report")
        assert obj.message == "Thank you for your report"
        assert obj.new_status is None
        assert obj.idempotency_key is None

    def test_admin_feedback_response_with_status(self):
        from routers.admin_feedback import AdminFeedbackResponse
        obj = AdminFeedbackResponse(message="Fixed", new_status="resolved", idempotency_key="abc123")
        assert obj.new_status == "resolved"
        assert obj.idempotency_key == "abc123"


class TestAdminFeedbackHelpers:
    def test_feedback_json_safe_none(self):
        from routers.admin_feedback import _feedback_json_safe
        assert _feedback_json_safe(None) is None

    def test_feedback_json_safe_string(self):
        from routers.admin_feedback import _feedback_json_safe
        assert _feedback_json_safe("hello") == "hello"

    def test_feedback_json_safe_dict(self):
        from routers.admin_feedback import _feedback_json_safe
        result = _feedback_json_safe({"a": 1, "b": "two"})
        assert result == {"a": 1, "b": "two"}

    def test_feedback_json_safe_decimal(self):
        from routers.admin_feedback import _feedback_json_safe
        from decimal import Decimal
        assert _feedback_json_safe(Decimal("10.50")) == 10.50

    def test_admin_respond_transitions(self):
        from routers.admin_feedback import _ADMIN_RESPOND_TRANSITIONS
        assert "resolved" in _ADMIN_RESPOND_TRANSITIONS["new"]
        assert "in_progress" in _ADMIN_RESPOND_TRANSITIONS["resolved"]


class TestAdminFeedbackNotInServer:
    def test_no_admin_feedback_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_fns = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
        for fn in ["admin_get_feedback_stats", "admin_get_feedback_detail", "admin_get_feedback",
                    "admin_respond_to_feedback", "generate_feedback_ai_draft", "get_similar_feedback"]:
            assert fn not in server_fns, f"{fn} still in server.py"

    def test_no_admin_feedback_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_classes = {n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)}
        assert "AdminFeedbackResponse" not in server_classes

    def test_no_feedback_helpers_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_fns = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
        assert "_feedback_json_safe" not in server_fns


class TestSyntaxCheck:
    def test_admin_feedback_router_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'routers', 'admin_feedback.py')) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'server.py')) as f:
            ast.parse(f.read())
