"""
Unit tests for Analytics router extraction.

Verifies that:
- routers/analytics.py exports the correct symbols and routes
- Analytics models work correctly
- All modified files parse without syntax errors
- Analytics routes are NOT in server.py anymore
"""

import pytest
import sys
import os
import ast

# Ensure backend/ is on the path so we can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestAnalyticsRouterRegistration:
    """Verify Analytics router is properly registered with correct routes."""

    def test_analytics_router_import(self):
        from routers.analytics import router
        assert router is not None

    def test_analytics_router_prefix(self):
        from routers.analytics import router
        assert router.prefix == "/api"

    def test_analytics_router_has_routes(self):
        from routers.analytics import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/analytics/device",
            "/api/analytics/session/start",
            "/api/analytics/session/end",
            "/api/analytics/event",
            "/api/analytics/events",
            "/api/analytics/funnel",
            "/api/analytics/error",
            "/api/analytics/consent",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_analytics_router_route_count(self):
        from routers.analytics import router
        # 8 routes, all POST
        assert len(router.routes) == 8


class TestAnalyticsModels:
    """Verify Analytics Pydantic models work correctly."""

    def test_device_context_request(self):
        from routers.analytics import DeviceContextRequest
        req = DeviceContextRequest(device_id="dev_1", platform="ios")
        assert req.device_id == "dev_1"
        assert req.platform == "ios"
        assert req.os_version is None
        assert req.device_model is None
        assert req.app_version is None

    def test_analytics_event_request_defaults(self):
        from routers.analytics import AnalyticsEventRequest
        req = AnalyticsEventRequest(event_name="button_click")
        assert req.event_name == "button_click"
        assert req.event_version == 1
        assert req.user_id is None
        assert req.properties == {}

    def test_analytics_event_request_with_values(self):
        from routers.analytics import AnalyticsEventRequest
        req = AnalyticsEventRequest(
            event_name="page_view",
            event_version=2,
            user_id="u1",
            platform="android",
            properties={"page": "/home"},
        )
        assert req.event_version == 2
        assert req.user_id == "u1"
        assert req.properties == {"page": "/home"}

    def test_analytics_event_batch_request(self):
        from routers.analytics import AnalyticsEventBatchRequest, AnalyticsEventRequest
        events = [
            AnalyticsEventRequest(event_name="ev1"),
            AnalyticsEventRequest(event_name="ev2"),
        ]
        req = AnalyticsEventBatchRequest(events=events)
        assert len(req.events) == 2
        assert req.events[0].event_name == "ev1"

    def test_session_start_request(self):
        from routers.analytics import SessionStartRequest
        req = SessionStartRequest(
            session_id="sess_1",
            device_id="dev_1",
            platform="web",
        )
        assert req.session_id == "sess_1"
        assert req.device_id == "dev_1"
        assert req.user_id is None
        assert req.metadata == {}

    def test_session_end_request(self):
        from routers.analytics import SessionEndRequest
        req = SessionEndRequest(session_id="sess_1")
        assert req.session_id == "sess_1"
        assert req.crash_flag is False

    def test_session_end_request_crash(self):
        from routers.analytics import SessionEndRequest
        req = SessionEndRequest(session_id="sess_1", crash_flag=True)
        assert req.crash_flag is True

    def test_app_error_request_defaults(self):
        from routers.analytics import AppErrorRequest
        req = AppErrorRequest(error_type="crash")
        assert req.error_type == "crash"
        assert req.severity == "error"
        assert req.breadcrumbs == []
        assert req.metadata == {}

    def test_app_error_request_with_values(self):
        from routers.analytics import AppErrorRequest
        req = AppErrorRequest(
            error_type="network",
            error_message="Timeout",
            severity="warning",
            breadcrumbs=[{"action": "tap"}],
        )
        assert req.error_message == "Timeout"
        assert req.severity == "warning"
        assert len(req.breadcrumbs) == 1

    def test_funnel_event_request(self):
        from routers.analytics import FunnelEventRequest
        req = FunnelEventRequest(funnel_step="signup_start")
        assert req.funnel_step == "signup_start"
        assert req.user_id is None
        assert req.metadata == {}

    def test_consent_request_defaults(self):
        from routers.analytics import ConsentRequest
        req = ConsentRequest(consent_type="analytics", version="1.0")
        assert req.consent_type == "analytics"
        assert req.version == "1.0"
        assert req.status == "granted"

    def test_consent_request_denied(self):
        from routers.analytics import ConsentRequest
        req = ConsentRequest(consent_type="marketing", version="2.0", status="denied")
        assert req.status == "denied"


class TestAnalyticsNotInServer:
    """Verify Analytics routes and models have been removed from server.py."""

    def test_no_analytics_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        analytics_functions = [
            "register_device",
            "start_analytics_session",
            "end_analytics_session",
            "track_analytics_event",
            "track_analytics_events_batch",
            "track_funnel_step",
            "log_client_error",
            "record_user_consent",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in analytics_functions:
            assert fn not in server_functions, f"Analytics function {fn} still in server.py"

    def test_no_analytics_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        analytics_models = [
            "DeviceContextRequest",
            "AnalyticsEventRequest",
            "AnalyticsEventBatchRequest",
            "SessionStartRequest",
            "SessionEndRequest",
            "AppErrorRequest",
            "FunnelEventRequest",
            "ConsentRequest",
        ]

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        for model in analytics_models:
            assert model not in server_classes, f"Analytics model {model} still in server.py"


class TestSyntaxCheck:
    """Verify all modified files parse without syntax errors."""

    def test_analytics_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'analytics.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
