"""
Unit tests for Stats router extraction.

Verifies that:
- routers/stats.py exports the correct symbols and routes
- All modified files parse without syntax errors
- Stats routes are NOT in server.py anymore
"""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestStatsRouterRegistration:
    """Verify Stats router is properly registered with correct routes."""

    def test_stats_router_import(self):
        from routers.stats import router
        assert router is not None

    def test_stats_router_prefix(self):
        from routers.stats import router
        assert router.prefix == "/api"

    def test_stats_router_has_routes(self):
        from routers.stats import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/stats/me",
            "/api/stats/group/{group_id}",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_stats_router_route_count(self):
        from routers.stats import router
        assert len(router.routes) == 2


class TestStatsNotInServer:
    """Verify Stats routes have been removed from server.py."""

    def test_no_stats_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        stats_functions = [
            "get_my_stats",
            "get_group_stats",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in stats_functions:
            assert fn not in server_functions, f"Stats function {fn} still in server.py"


class TestSyntaxCheck:
    def test_stats_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'stats.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
