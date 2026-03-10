"""
Unit tests for Subscribers router extraction.

Verifies that:
- routers/subscribers.py exports the correct symbols and routes
- Subscriber and SubscribeRequest models work correctly
- All modified files parse without syntax errors
- Subscriber routes are NOT in server.py anymore
"""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestSubscribersRouterRegistration:
    """Verify Subscribers router is properly registered with correct routes."""

    def test_subscribers_router_import(self):
        from routers.subscribers import router
        assert router is not None

    def test_subscribers_router_prefix(self):
        from routers.subscribers import router
        assert router.prefix == "/api"

    def test_subscribers_router_has_routes(self):
        from routers.subscribers import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/subscribe",
            "/api/subscribers/stats",
            "/api/unsubscribe",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_subscribers_router_route_count(self):
        from routers.subscribers import router
        assert len(router.routes) == 3


class TestSubscriberModels:
    """Verify Subscriber Pydantic models work correctly."""

    def test_subscriber_defaults(self):
        from routers.subscribers import Subscriber
        sub = Subscriber(email="test@example.com")
        assert sub.email == "test@example.com"
        assert sub.source == "landing"
        assert sub.interests == []
        assert sub.verified is False
        assert sub.unsubscribed is False
        assert sub.unsubscribed_at is None
        assert sub.subscriber_id.startswith("sub_")

    def test_subscriber_with_values(self):
        from routers.subscribers import Subscriber
        sub = Subscriber(
            email="user@test.com",
            source="waitlist_ai",
            interests=["ai_assistant", "charts"],
            ip_address="1.2.3.4",
        )
        assert sub.source == "waitlist_ai"
        assert sub.interests == ["ai_assistant", "charts"]
        assert sub.ip_address == "1.2.3.4"

    def test_subscriber_ignores_extra(self):
        from routers.subscribers import Subscriber
        sub = Subscriber(email="x@y.com", unknown_field="should_be_ignored")
        assert not hasattr(sub, "unknown_field") or sub.model_fields_set == {"email"}

    def test_subscribe_request_defaults(self):
        from routers.subscribers import SubscribeRequest
        req = SubscribeRequest(email="test@example.com")
        assert req.email == "test@example.com"
        assert req.source == "landing"
        assert req.interests == []

    def test_subscribe_request_with_values(self):
        from routers.subscribers import SubscribeRequest
        req = SubscribeRequest(
            email="user@test.com",
            source="hero",
            interests=["newsletter"],
        )
        assert req.source == "hero"
        assert req.interests == ["newsletter"]


class TestSubscribersNotInServer:
    """Verify Subscriber routes and models have been removed from server.py."""

    def test_no_subscriber_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        subscriber_functions = [
            "subscribe",
            "get_subscriber_stats",
            "unsubscribe",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in subscriber_functions:
            assert fn not in server_functions, f"Subscriber function {fn} still in server.py"

    def test_no_subscriber_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        subscriber_models = ["Subscriber", "SubscribeRequest"]

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        for model in subscriber_models:
            assert model not in server_classes, f"Subscriber model {model} still in server.py"


class TestSyntaxCheck:
    """Verify all modified files parse without syntax errors."""

    def test_subscribers_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'subscribers.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
