"""
Unit tests for Premium router extraction.

Verifies that:
- routers/premium.py exports the correct symbols and routes
- All modified files parse without syntax errors
- Premium routes are NOT in server.py anymore
"""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestPremiumRouterRegistration:
    """Verify Premium router is properly registered with correct routes."""

    def test_premium_router_import(self):
        from routers.premium import router
        assert router is not None

    def test_premium_router_prefix(self):
        from routers.premium import router
        assert router.prefix == "/api"

    def test_premium_router_has_routes(self):
        from routers.premium import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/premium/plans",
            "/api/premium/checkout",
            "/api/premium/status/{session_id}",
            "/api/premium/me",
            "/api/webhook/stripe",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_premium_router_route_count(self):
        from routers.premium import router
        assert len(router.routes) == 5

    def test_stripe_checkout_request_model(self):
        from routers.premium import StripeCheckoutRequest
        obj = StripeCheckoutRequest(plan_id="pro", origin_url="https://example.com")
        assert obj.plan_id == "pro"
        assert obj.origin_url == "https://example.com"


class TestPremiumNotInServer:
    """Verify Premium routes have been removed from server.py."""

    def test_no_premium_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        premium_functions = [
            "get_premium_plans",
            "create_premium_checkout",
            "get_premium_payment_status",
            "get_my_premium_status",
            "stripe_webhook",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in premium_functions:
            assert fn not in server_functions, f"Premium function {fn} still in server.py"

    def test_no_stripe_checkout_model_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        assert "StripeCheckoutRequest" not in server_classes


class TestSyntaxCheck:
    def test_premium_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'premium.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
