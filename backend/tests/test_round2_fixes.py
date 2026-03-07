"""
Tests for Round 2 fixes:
1. Notification insert calls wrapped in try-except (non-critical side effects)
2. Settlement uses dedicated functions, not generic_count/generic_insert
3. Wallet functions pass datetime objects, not ISO strings
4. find_games_for_player / count_games_for_player use JOIN on players table

All tests use file-based source inspection to avoid import dependencies on asyncpg.
"""
import re
import ast
import pytest

QUERIES_PATH = "backend/db/queries.py"
SERVER_PATH = "backend/server.py"


def _read_source(path):
    with open(path, "r") as f:
        return f.read()


def _extract_function_source(filepath, func_name):
    """Extract a function's source from a file using AST parsing."""
    source = _read_source(filepath)
    tree = ast.parse(source)
    lines = source.split("\n")
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
            start = node.lineno - 1
            end = node.end_lineno
            return "\n".join(lines[start:end])
    raise ValueError(f"Function {func_name} not found in {filepath}")


# ---------------------------------------------------------------------------
# Fix 1: Notification resilience — all insert_notification calls wrapped
# ---------------------------------------------------------------------------

class TestNotificationResilience:
    """Every insert_notification call in server.py must be inside a try block."""

    def test_no_bare_insert_notification_calls(self):
        """Every await queries.insert_notification(...) must be preceded by 'try:' in context."""
        source = _read_source(SERVER_PATH)
        lines = source.split("\n")

        bare_calls = []
        for i, line in enumerate(lines):
            stripped = line.strip()
            if "await queries.insert_notification(" in stripped:
                # Check if there's a try: above this line (within 10 lines)
                found_try = False
                for j in range(max(0, i - 10), i):
                    if lines[j].strip() == "try:":
                        found_try = True
                        break
                if not found_try:
                    bare_calls.append(f"  Line {i+1}: {stripped}")

        assert len(bare_calls) == 0, (
            f"Found {len(bare_calls)} bare insert_notification calls without try-except:\n"
            + "\n".join(bare_calls)
        )


# ---------------------------------------------------------------------------
# Fix 2: Settlement uses dedicated functions
# ---------------------------------------------------------------------------

class TestSettlementDedicatedFunctions:
    """auto_generate_settlement must not use generic_count/generic_insert for settlement_runs."""

    def test_no_generic_count_settlement_runs(self):
        """server.py should not call generic_count('settlement_runs', ...)."""
        source = _read_source(SERVER_PATH)
        matches = re.findall(r'generic_count\(\s*["\']settlement_runs["\']', source)
        assert len(matches) == 0, (
            f"Found {len(matches)} calls to generic_count('settlement_runs') — "
            "use count_settlement_runs_by_game() instead"
        )

    def test_no_generic_insert_settlement_runs(self):
        """server.py should not call generic_insert('settlement_runs', ...)."""
        source = _read_source(SERVER_PATH)
        matches = re.findall(r'generic_insert\(\s*["\']settlement_runs["\']', source)
        assert len(matches) == 0, (
            f"Found {len(matches)} calls to generic_insert('settlement_runs') — "
            "use insert_settlement_run() instead"
        )

    def test_uses_dedicated_settlement_functions(self):
        """server.py should use count_settlement_runs_by_game and insert_settlement_run."""
        source = _read_source(SERVER_PATH)
        assert "count_settlement_runs_by_game" in source, (
            "Expected count_settlement_runs_by_game() call in server.py"
        )
        assert "insert_settlement_run" in source, (
            "Expected insert_settlement_run() call in server.py"
        )


# ---------------------------------------------------------------------------
# Fix 3: Wallet functions use datetime, not ISO strings
# ---------------------------------------------------------------------------

class TestWalletTimestamps:
    """atomic_wallet_debit and atomic_wallet_credit must use datetime objects."""

    def test_atomic_wallet_debit_no_isoformat(self):
        """atomic_wallet_debit should not call .isoformat() for timestamps."""
        source = _extract_function_source(QUERIES_PATH, "atomic_wallet_debit")
        assert ".isoformat()" not in source, (
            "atomic_wallet_debit still uses .isoformat() — asyncpg needs datetime objects"
        )

    def test_atomic_wallet_credit_no_isoformat(self):
        """atomic_wallet_credit should not call .isoformat() for timestamps."""
        source = _extract_function_source(QUERIES_PATH, "atomic_wallet_credit")
        assert ".isoformat()" not in source, (
            "atomic_wallet_credit still uses .isoformat() — asyncpg needs datetime objects"
        )

    def test_atomic_wallet_debit_uses_datetime(self):
        """atomic_wallet_debit should use datetime.now(timezone.utc) directly."""
        source = _extract_function_source(QUERIES_PATH, "atomic_wallet_debit")
        assert "datetime.now(timezone.utc)" in source, (
            "atomic_wallet_debit should use datetime.now(timezone.utc)"
        )

    def test_atomic_wallet_credit_uses_datetime(self):
        """atomic_wallet_credit should use datetime.now(timezone.utc) directly."""
        source = _extract_function_source(QUERIES_PATH, "atomic_wallet_credit")
        assert "datetime.now(timezone.utc)" in source, (
            "atomic_wallet_credit should use datetime.now(timezone.utc)"
        )


# ---------------------------------------------------------------------------
# Fix 4: Game player queries use JOIN, not JSONB
# ---------------------------------------------------------------------------

class TestGamePlayerQueries:
    """find_games_for_player and count_games_for_player must use JOIN on players table."""

    def test_find_games_for_player_uses_join(self):
        """find_games_for_player should JOIN on the players table."""
        source = _extract_function_source(QUERIES_PATH, "find_games_for_player")
        assert "JOIN players" in source, (
            "find_games_for_player should use JOIN players, not JSONB @>"
        )

    def test_find_games_for_player_no_jsonb_containment(self):
        """find_games_for_player should not use @> JSONB operator."""
        source = _extract_function_source(QUERIES_PATH, "find_games_for_player")
        assert "@>" not in source, (
            "find_games_for_player should not use @> JSONB containment operator"
        )

    def test_count_games_for_player_uses_join(self):
        """count_games_for_player should JOIN on the players table."""
        source = _extract_function_source(QUERIES_PATH, "count_games_for_player")
        assert "JOIN players" in source, (
            "count_games_for_player should use JOIN players, not JSONB @>"
        )

    def test_count_games_for_player_no_jsonb_containment(self):
        """count_games_for_player should not use @> JSONB operator."""
        source = _extract_function_source(QUERIES_PATH, "count_games_for_player")
        assert "@>" not in source, (
            "count_games_for_player should not use @> JSONB containment operator"
        )

    def test_find_games_for_player_uses_distinct(self):
        """find_games_for_player should use DISTINCT to avoid duplicate rows from JOIN."""
        source = _extract_function_source(QUERIES_PATH, "find_games_for_player")
        assert "DISTINCT" in source, (
            "find_games_for_player should SELECT DISTINCT to avoid duplicates from JOIN"
        )

    def test_count_games_for_player_uses_distinct(self):
        """count_games_for_player should COUNT(DISTINCT) to avoid over-counting from JOIN."""
        source = _extract_function_source(QUERIES_PATH, "count_games_for_player")
        assert "DISTINCT" in source, (
            "count_games_for_player should COUNT(DISTINCT) to avoid over-counting"
        )
