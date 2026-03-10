"""
Unit tests for Voice router extraction.

Verifies that:
- routers/voice.py exports the correct symbols and routes
- parse_voice_command helper correctly parses voice commands
- All modified files parse without syntax errors
- Voice routes are NOT in server.py anymore
"""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestVoiceRouterRegistration:
    """Verify Voice router is properly registered with correct routes."""

    def test_voice_router_import(self):
        from routers.voice import router
        assert router is not None

    def test_voice_router_prefix(self):
        from routers.voice import router
        assert router.prefix == "/api"

    def test_voice_router_has_routes(self):
        from routers.voice import router
        paths = [r.path for r in router.routes]
        assert "/api/voice/transcribe" in paths

    def test_voice_router_route_count(self):
        from routers.voice import router
        assert len(router.routes) == 1


class TestParseVoiceCommand:
    """Verify parse_voice_command helper works correctly."""

    def test_buy_in_command(self):
        from routers.voice import parse_voice_command
        result = parse_voice_command("buy in for $50")
        assert result is not None
        assert result["type"] == "buy_in"
        assert result["amount"] == 50

    def test_buy_in_without_amount(self):
        from routers.voice import parse_voice_command
        result = parse_voice_command("I want to buy in")
        assert result is not None
        assert result["type"] == "buy_in"
        assert result["amount"] is None

    def test_rebuy_command(self):
        from routers.voice import parse_voice_command
        result = parse_voice_command("rebuy for 100")
        assert result is not None
        assert result["type"] == "rebuy"
        assert result["amount"] == 100

    def test_cash_out_command(self):
        from routers.voice import parse_voice_command
        result = parse_voice_command("cash out 500 chips")
        assert result is not None
        assert result["type"] == "cash_out"
        assert result["chips"] == 500

    def test_start_game_command(self):
        from routers.voice import parse_voice_command
        result = parse_voice_command("start game")
        assert result is not None
        assert result["type"] == "start_game"

    def test_end_game_command(self):
        from routers.voice import parse_voice_command
        result = parse_voice_command("end the game")
        assert result is not None
        assert result["type"] == "end_game"

    def test_check_balance_command(self):
        from routers.voice import parse_voice_command
        result = parse_voice_command("how much do I have")
        assert result is not None
        assert result["type"] == "check_balance"

    def test_ai_help_command(self):
        from routers.voice import parse_voice_command
        result = parse_voice_command("help me decide")
        assert result is not None
        assert result["type"] == "ai_help"

    def test_unknown_command(self):
        from routers.voice import parse_voice_command
        result = parse_voice_command("the weather is nice today")
        assert result is None

    def test_case_insensitive(self):
        from routers.voice import parse_voice_command
        result = parse_voice_command("BUY IN for $25")
        assert result is not None
        assert result["type"] == "buy_in"


class TestVoiceNotInServer:
    """Verify Voice routes have been removed from server.py."""

    def test_no_voice_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        voice_functions = [
            "transcribe_voice",
            "parse_voice_command",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in voice_functions:
            assert fn not in server_functions, f"Voice function {fn} still in server.py"


class TestSyntaxCheck:
    def test_voice_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'voice.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
