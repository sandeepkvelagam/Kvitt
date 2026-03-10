"""
Unit tests for auth router extraction.

Verifies that:
- dependencies.py exports the correct symbols
- User model works correctly
- Auth router has the expected routes
- All modified files parse without syntax errors
- role_middleware.py imports from dependencies (not server)
"""

import pytest
import sys
import os
import ast

# Ensure backend/ is on the path so we can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestDependenciesModule:
    """Verify dependencies.py can be imported and contains expected exports."""

    def test_import_dependencies(self):
        from dependencies import User, get_current_user, verify_supabase_jwt
        assert callable(get_current_user)
        assert callable(verify_supabase_jwt)

    def test_user_model_required_fields(self):
        from dependencies import User
        u = User(user_id="u1", email="a@b.com", name="Test")
        assert u.user_id == "u1"
        assert u.email == "a@b.com"
        assert u.name == "Test"

    def test_user_model_defaults(self):
        from dependencies import User
        u = User(user_id="u1", email="a@b.com", name="Test")
        assert u.app_role == "user"
        assert u.level == "Rookie"
        assert u.total_games == 0
        assert u.total_profit == 0.0
        assert u.badges == []
        assert u.picture is None
        assert u.supabase_id is None

    def test_user_model_ignores_extra_fields(self):
        from dependencies import User
        u = User(user_id="u1", email="a@b.com", name="Test", unknown_field="x")
        assert not hasattr(u, "unknown_field")

    def test_user_model_super_admin(self):
        from dependencies import User
        u = User(user_id="u1", email="a@b.com", name="Admin", app_role="super_admin")
        assert u.app_role == "super_admin"

    def test_user_session_model(self):
        from dependencies import UserSession
        from datetime import datetime, timezone
        s = UserSession(
            user_id="u1",
            session_token="tok_abc",
            expires_at=datetime.now(timezone.utc),
        )
        assert s.user_id == "u1"
        assert s.session_token == "tok_abc"
        assert s.session_id  # auto-generated


class TestAuthRouterRegistration:
    """Verify auth router is properly registered with correct routes."""

    def test_auth_router_has_routes(self):
        from routers.auth import router
        paths = [r.path for r in router.routes]
        # Routes include the router prefix in their path
        assert "/api/health" in paths
        assert "/api/auth/session" in paths
        assert "/api/auth/me" in paths
        assert "/api/auth/logout" in paths

    def test_auth_router_prefix(self):
        from routers.auth import router
        assert router.prefix == "/api"

    def test_auth_router_route_count(self):
        from routers.auth import router
        # Exactly 4 routes
        assert len(router.routes) == 4

    def test_session_request_model(self):
        from routers.auth import SessionRequest
        req = SessionRequest(session_id="test-session-123")
        assert req.session_id == "test-session-123"


class TestSyntaxValidity:
    """Verify all modified/created files parse without syntax errors."""

    def _check_syntax(self, filepath):
        with open(filepath) as f:
            ast.parse(f.read())

    def test_dependencies_syntax(self):
        self._check_syntax(os.path.join(os.path.dirname(__file__), '..', 'dependencies.py'))

    def test_auth_router_syntax(self):
        self._check_syntax(os.path.join(os.path.dirname(__file__), '..', 'routers', 'auth.py'))

    def test_server_syntax(self):
        self._check_syntax(os.path.join(os.path.dirname(__file__), '..', 'server.py'))

    def test_role_middleware_syntax(self):
        self._check_syntax(os.path.join(os.path.dirname(__file__), '..', 'role_middleware.py'))


class TestRoleMiddlewareImport:
    """Verify role_middleware imports from dependencies, not server."""

    def test_no_server_import(self):
        """role_middleware should import from dependencies, not server."""
        rm_path = os.path.join(os.path.dirname(__file__), '..', 'role_middleware.py')
        with open(rm_path) as f:
            source = f.read()
        assert "from dependencies import" in source
        assert "from server import" not in source


class TestNoDuplicateRoutes:
    """Verify auth routes were fully removed from server.py."""

    def test_no_auth_routes_in_server(self):
        """Auth route definitions should not appear in server.py."""
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            source = f.read()
        # These exact route decorators should NOT be in server.py anymore
        assert '@api_router.get("/health")' not in source
        assert '@api_router.post("/auth/session")' not in source
        assert '@api_router.get("/auth/me")' not in source
        assert '@api_router.post("/auth/logout")' not in source

    def test_no_auth_functions_in_server(self):
        """Auth helper functions should not be defined in server.py."""
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            source = f.read()
        assert "async def verify_supabase_jwt" not in source
        # get_current_user is imported, not defined — check it's not defined
        assert "async def get_current_user" not in source
