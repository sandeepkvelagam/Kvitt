"""
Unit tests for Poker router extraction.

Verifies that:
- routers/poker.py exports the correct symbols and routes
- PokerAnalyzeRequest model works correctly
- All modified files parse without syntax errors
- Poker routes are NOT in server.py anymore
"""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestPokerRouterRegistration:
    """Verify Poker router is properly registered with correct routes."""

    def test_poker_router_import(self):
        from routers.poker import router
        assert router is not None

    def test_poker_router_prefix(self):
        from routers.poker import router
        assert router.prefix == "/api"

    def test_poker_router_has_routes(self):
        from routers.poker import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/poker/analyze",
            "/api/poker/history",
            "/api/poker/stats",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_poker_router_route_count(self):
        from routers.poker import router
        assert len(router.routes) == 3


class TestPokerModels:
    """Verify Poker Pydantic models work correctly."""

    def test_poker_analyze_request_defaults(self):
        from routers.poker import PokerAnalyzeRequest
        req = PokerAnalyzeRequest(
            your_hand=["A of spades", "K of spades"],
        )
        assert req.your_hand == ["A of spades", "K of spades"]
        assert req.community_cards == []
        assert req.game_id is None

    def test_poker_analyze_request_with_values(self):
        from routers.poker import PokerAnalyzeRequest
        req = PokerAnalyzeRequest(
            your_hand=["A of spades", "K of spades"],
            community_cards=["Q of hearts", "J of diamonds", "10 of clubs"],
            game_id="game_123",
        )
        assert len(req.community_cards) == 3
        assert req.game_id == "game_123"


class TestPokerNotInServer:
    """Verify Poker routes and models have been removed from server.py."""

    def test_no_poker_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        poker_functions = [
            "analyze_poker_hand",
            "get_poker_history",
            "get_poker_stats",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in poker_functions:
            assert fn not in server_functions, f"Poker function {fn} still in server.py"

    def test_no_poker_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        assert "PokerAnalyzeRequest" not in server_classes


class TestSyntaxCheck:
    """Verify all modified files parse without syntax errors."""

    def test_poker_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'poker.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
