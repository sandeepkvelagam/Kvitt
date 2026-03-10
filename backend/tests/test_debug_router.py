"""
Unit tests for Debug router extraction.

Verifies that:
- routers/debug.py exports the correct symbols and routes
- All modified files parse without syntax errors
- Debug routes are NOT in server.py anymore
"""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestDebugRouterRegistration:
    """Verify Debug router is properly registered with correct routes."""

    def test_debug_router_import(self):
        from routers.debug import router
        assert router is not None

    def test_debug_router_prefix(self):
        from routers.debug import router
        assert router.prefix == "/api"

    def test_debug_router_has_routes(self):
        from routers.debug import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/debug/user-data",
            "/api/debug/fix-user-data",
            "/api/debug/my-data",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_debug_router_route_count(self):
        from routers.debug import router
        assert len(router.routes) == 3


class TestDebugNotInServer:
    """Verify Debug routes have been removed from server.py."""

    def test_no_debug_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        debug_functions = [
            "debug_user_data",
            "fix_user_data",
            "debug_my_data",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in debug_functions:
            assert fn not in server_functions, f"Debug function {fn} still in server.py"


class TestSyntaxCheck:
    def test_debug_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'debug.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
