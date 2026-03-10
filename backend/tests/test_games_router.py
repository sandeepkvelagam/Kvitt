"""Unit tests for the games router package (Step 3 extraction)."""

import ast
import os
import sys

import pytest

# Ensure backend is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---- Syntax checks ----

GAMES_FILES = [
    "routers/games/__init__.py",
    "routers/games/models.py",
    "routers/games/settlement.py",
    "routers/games/lifecycle.py",
    "routers/games/players.py",
    "routers/games/chips.py",
    "routers/games/settlements.py",
    "routers/games/thread.py",
]

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")


@pytest.mark.parametrize("filepath", GAMES_FILES)
def test_syntax(filepath):
    """Every game router file must be valid Python."""
    full = os.path.join(BACKEND_DIR, filepath)
    source = open(full).read()
    ast.parse(source)


def test_dependencies_syntax():
    """dependencies.py must parse after LedgerEntry addition."""
    source = open(os.path.join(BACKEND_DIR, "dependencies.py")).read()
    ast.parse(source)


def test_server_syntax():
    """server.py must parse after game route removal."""
    source = open(os.path.join(BACKEND_DIR, "server.py")).read()
    ast.parse(source)


# ---- Model tests ----

def test_game_night_model():
    from routers.games.models import GameNight
    g = GameNight(group_id="grp_1", host_id="user_1")
    assert g.group_id == "grp_1"
    assert g.host_id == "user_1"
    assert g.status == "scheduled"
    assert g.game_id.startswith("game_")
    assert g.chip_value == 1.0
    assert g.chips_per_buy_in == 20
    assert g.buy_in_amount == 20.0


def test_player_model():
    from routers.games.models import Player
    p = Player(game_id="game_1", user_id="user_1")
    assert p.player_id.startswith("plr_")
    assert p.total_buy_in == 0.0
    assert p.rsvp_status == "pending"


def test_transaction_model():
    from routers.games.models import Transaction
    t = Transaction(game_id="game_1", user_id="user_1", type="buy_in", amount=20.0)
    assert t.transaction_id.startswith("txn_")
    assert t.chips == 0
    assert t.chip_value == 1.0


def test_game_thread_model():
    from routers.games.models import GameThread
    m = GameThread(game_id="game_1", user_id="user_1", content="hello")
    assert m.message_id.startswith("msg_")
    assert m.type == "user"


def test_game_night_create():
    from routers.games.models import GameNightCreate
    c = GameNightCreate(group_id="grp_1")
    assert c.buy_in_amount == 20.0
    assert c.chips_per_buy_in == 20
    assert c.initial_players is None


def test_ledger_entry_in_dependencies():
    """LedgerEntry must be importable from dependencies."""
    from dependencies import LedgerEntry
    entry = LedgerEntry(group_id="g1", game_id="gm1", from_user_id="u1", to_user_id="u2", amount=10.0)
    assert entry.ledger_id.startswith("led_")
    assert entry.status == "pending"


# ---- Settlement algorithm test ----

def test_optimize_settlement_basic():
    """Verify deterministic min-transaction settlement."""
    from routers.games.settlement import optimize_settlement

    net_results = [
        {"user_id": "alice", "net_cents": 2000},    # won $20
        {"user_id": "bob", "net_cents": -1500},      # lost $15
        {"user_id": "charlie", "net_cents": -500},   # lost $5
    ]

    result = optimize_settlement(net_results)
    transfers = result["transfers"]
    stats = result["stats"]

    # Should produce 2 transfers (bob->alice $15, charlie->alice $5)
    assert stats["optimized_payments"] == 2
    assert stats["possible_payments"] == 3  # 3 players -> 3 possible

    # Total transferred should equal $20
    total_cents = sum(t["amount_cents"] for t in transfers)
    assert total_cents == 2000

    # All transfers go to alice
    for t in transfers:
        assert t["to_user_id"] == "alice"


def test_optimize_settlement_empty():
    """No players means no transfers."""
    from routers.games.settlement import optimize_settlement
    result = optimize_settlement([])
    assert result["transfers"] == []
    assert result["stats"]["optimized_payments"] == 0


def test_optimize_settlement_balanced():
    """All even = no transfers."""
    from routers.games.settlement import optimize_settlement
    result = optimize_settlement([
        {"user_id": "a", "net_cents": 0},
        {"user_id": "b", "net_cents": 0},
    ])
    assert result["transfers"] == []


# ---- Route registration tests ----

def test_router_import():
    """Games router must be importable."""
    from routers.games import router
    assert router is not None


def test_route_count():
    """Games router must have exactly 33 routes."""
    from routers.games import router
    routes = [r for r in router.routes if hasattr(r, "methods")]
    assert len(routes) == 33, f"Expected 33 routes, got {len(routes)}: {[r.path for r in routes]}"


def test_key_route_paths():
    """Spot-check that key game route paths exist."""
    from routers.games import router
    paths = {r.path for r in router.routes if hasattr(r, "methods")}

    expected = [
        "/api/games",
        "/api/games/{game_id}",
        "/api/games/{game_id}/start",
        "/api/games/{game_id}/end",
        "/api/games/{game_id}/join",
        "/api/games/{game_id}/buy-in",
        "/api/games/{game_id}/cash-out",
        "/api/games/{game_id}/settle",
        "/api/games/{game_id}/settlement",
        "/api/games/{game_id}/thread",
    ]

    for path in expected:
        assert path in paths, f"Missing route: {path}"


def test_no_game_routes_in_server():
    """Game routes must NOT exist in server.py anymore."""
    source = open(os.path.join(BACKEND_DIR, "server.py")).read()
    # No @api_router decorators with /games paths
    assert '@api_router.post("/games"' not in source
    assert '@api_router.get("/games"' not in source
    assert '@api_router.get("/games/{game_id}")' not in source
    assert '@api_router.post("/games/{game_id}/start")' not in source


def test_ledger_routes_still_in_server():
    """Ledger payment routes must still be in server.py."""
    source = open(os.path.join(BACKEND_DIR, "server.py")).read()
    assert '@api_router.put("/ledger/{ledger_id}/paid")' in source
    assert '@api_router.post("/ledger/{ledger_id}/request-payment")' in source
    assert '@api_router.post("/ledger/{ledger_id}/confirm-received")' in source
    assert '@api_router.put("/ledger/{ledger_id}/edit")' in source


def test_stats_routes_still_in_server():
    """Stats routes must still be in server.py."""
    source = open(os.path.join(BACKEND_DIR, "server.py")).read()
    assert '@api_router.get("/stats/me")' in source
    assert '@api_router.get("/stats/group/{group_id}")' in source


def test_server_line_count():
    """server.py should be significantly smaller after extraction."""
    source = open(os.path.join(BACKEND_DIR, "server.py")).read()
    line_count = len(source.splitlines())
    # Shrinks as more routers are extracted (started ~8,860, now ~4,500 after 6 extractions)
    assert line_count < 7000, f"server.py still has {line_count} lines — extraction may be incomplete"
    assert line_count > 3500, f"server.py only has {line_count} lines — too much may have been removed"


def test_generate_default_game_name():
    """Game name generator must return a string from the prefix list."""
    from routers.games.models import generate_default_game_name, GAME_NAME_PREFIXES
    name = generate_default_game_name()
    assert name in GAME_NAME_PREFIXES


def test_models_reexported_from_package():
    """Models must be importable from the games package directly."""
    from routers.games import GameNight, Player, Transaction, GameThread
    assert GameNight is not None
    assert Player is not None
    assert Transaction is not None
    assert GameThread is not None
