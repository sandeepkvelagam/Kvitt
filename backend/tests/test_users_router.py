"""
Unit tests for Users router extraction.

Verifies that:
- routers/users.py exports the correct symbols and routes
- LEVELS and BADGES constants are properly defined
- All modified files parse without syntax errors
- User profile routes are NOT in server.py anymore
"""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestUsersRouterRegistration:
    """Verify Users router is properly registered with correct routes."""

    def test_users_router_import(self):
        from routers.users import router
        assert router is not None

    def test_users_router_prefix(self):
        from routers.users import router
        assert router.prefix == "/api"

    def test_users_router_has_routes(self):
        from routers.users import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/users/me",
            "/api/users/search",
            "/api/users/me/badges",
            "/api/levels",
            "/api/users/game-history",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_users_router_route_count(self):
        from routers.users import router
        assert len(router.routes) == 5


class TestUsersConstants:
    """Verify LEVELS and BADGES constants are properly defined."""

    def test_levels_defined(self):
        from routers.users import LEVELS
        assert isinstance(LEVELS, list)
        assert len(LEVELS) == 5
        assert LEVELS[0]["name"] == "Rookie"
        assert LEVELS[-1]["name"] == "Legend"

    def test_levels_have_required_fields(self):
        from routers.users import LEVELS
        for level in LEVELS:
            assert "name" in level
            assert "min_games" in level
            assert "min_profit" in level
            assert "icon" in level

    def test_badges_defined(self):
        from routers.users import BADGES
        assert isinstance(BADGES, list)
        assert len(BADGES) == 12

    def test_badges_have_required_fields(self):
        from routers.users import BADGES
        for badge in BADGES:
            assert "id" in badge
            assert "name" in badge
            assert "description" in badge
            assert "icon" in badge

    def test_badge_ids_unique(self):
        from routers.users import BADGES
        ids = [b["id"] for b in BADGES]
        assert len(ids) == len(set(ids)), "Badge IDs must be unique"


class TestUsersNotInServer:
    """Verify User profile routes and constants have been removed from server.py."""

    def test_no_user_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        user_functions = [
            "update_user_profile",
            "search_users",
            "get_my_badges",
            "get_levels",
            "get_game_history",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in user_functions:
            assert fn not in server_functions, f"User function {fn} still in server.py"

    def test_no_levels_badges_constants_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            source = f.read()
        # LEVELS and BADGES as standalone assignments should not exist
        tree = ast.parse(source)
        top_level_assigns = {
            target.id for node in ast.iter_child_nodes(tree)
            if isinstance(node, ast.Assign)
            for target in node.targets
            if isinstance(target, ast.Name)
        }
        assert "LEVELS" not in top_level_assigns, "LEVELS constant still in server.py"
        assert "BADGES" not in top_level_assigns, "BADGES constant still in server.py"


class TestSyntaxCheck:
    def test_users_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'users.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
