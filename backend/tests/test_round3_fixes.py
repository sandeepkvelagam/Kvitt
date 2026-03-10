"""
Tests for Round 3 fixes: AI integration hardening + transaction safety.

Verifies:
1. ai_orchestrator_logs is in ALLOWED_TABLES
2. logger.error upgraded to logger.exception in AI files
3. Orchestrator log insert is wrapped in try-except
4. transaction() context manager exists in pg.py
5. Critical query functions accept optional conn parameter
6. buy_in, cash_out, end_game handlers use transaction()
7. Notifications remain outside transaction blocks
"""
import ast
import inspect
import os
import re
import unittest

# Resolve paths relative to backend/
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUERIES_PATH = os.path.join(BACKEND_DIR, "db", "queries.py")
PG_PATH = os.path.join(BACKEND_DIR, "db", "pg.py")
SERVER_PATH = os.path.join(BACKEND_DIR, "server.py")
ORCHESTRATOR_PATH = os.path.join(BACKEND_DIR, "ai_service", "orchestrator.py")
CLAUDE_CLIENT_PATH = os.path.join(BACKEND_DIR, "ai_service", "claude_client.py")
AI_ASSISTANT_PATH = os.path.join(BACKEND_DIR, "ai_assistant.py")
GROUP_CHAT_AGENT_PATH = os.path.join(BACKEND_DIR, "ai_service", "agents", "group_chat_agent.py")
FEEDBACK_CLASSIFIER_PATH = os.path.join(BACKEND_DIR, "ai_service", "tools", "feedback_classifier.py")


def _read(path: str) -> str:
    with open(path) as f:
        return f.read()


def _extract_function_source(file_path: str, func_name: str) -> str:
    """Extract a function's source from a file using AST."""
    source = _read(file_path)
    tree = ast.parse(source)
    lines = source.splitlines()
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
            start = node.lineno - 1
            end = node.end_lineno
            return "\n".join(lines[start:end])
    raise ValueError(f"Function {func_name} not found in {file_path}")


class TestAIIntegrationHardening(unittest.TestCase):
    """Task 1: AI integration fixes."""

    def test_ai_orchestrator_logs_in_allowed_tables(self):
        """ai_orchestrator_logs must be in ALLOWED_TABLES."""
        source = _read(QUERIES_PATH)
        self.assertIn(
            '"ai_orchestrator_logs"',
            source,
            "ai_orchestrator_logs should be in ALLOWED_TABLES"
        )

    def test_orchestrator_log_insert_wrapped_in_try_except(self):
        """The orchestrator log insert must be wrapped in try-except."""
        source = _extract_function_source(ORCHESTRATOR_PATH, "process")
        # The generic_insert call should be inside a try block
        self.assertIn("try:", source, "Log insert should be in a try block")
        self.assertIn(
            "generic_insert",
            source,
            "Should still use generic_insert for logging"
        )
        # Should have except that catches the log error
        self.assertIn(
            "Failed to log orchestrator request",
            source,
            "Should have specific error message for failed log insert"
        )

    def test_orchestrator_uses_logger_exception(self):
        """Orchestrator should use logger.exception, not logger.error."""
        source = _extract_function_source(ORCHESTRATOR_PATH, "process")
        self.assertIn(
            "logger.exception",
            source,
            "Orchestrator.process should use logger.exception for error tracebacks"
        )

    def test_claude_client_uses_logger_exception(self):
        """Claude client should use logger.exception for all API errors."""
        source = _read(CLAUDE_CLIENT_PATH)
        # Check that logger.error is NOT used for API errors
        # (it may still exist in fallback methods, which is fine)
        error_calls = re.findall(r'logger\.error\(.*Claude.*\)', source)
        self.assertEqual(
            len(error_calls), 0,
            f"Found logger.error calls that should be logger.exception: {error_calls}"
        )
        # Check that logger.exception IS used
        exception_calls = re.findall(r'logger\.exception\(', source)
        self.assertGreaterEqual(
            len(exception_calls), 5,
            "Claude client should have at least 5 logger.exception calls (one per API method)"
        )

    def test_ai_assistant_uses_logger_exception(self):
        """ai_assistant.py should use logger.exception for API errors."""
        source = _read(AI_ASSISTANT_PATH)
        self.assertIn(
            "logger.exception",
            source,
            "ai_assistant.py should use logger.exception"
        )
        # Should not have logger.error for AI errors
        error_calls = re.findall(r'logger\.error\(.*AI assistant.*\)', source)
        self.assertEqual(len(error_calls), 0, "Should use logger.exception, not logger.error")

    def test_migration_023_exists(self):
        """Migration 023 for ai_orchestrator_logs should exist."""
        migration_dir = os.path.join(BACKEND_DIR, "..", "supabase", "migrations")
        migration_files = os.listdir(migration_dir)
        matching = [f for f in migration_files if "023" in f and "orchestrator" in f.lower()]
        self.assertTrue(matching, "Migration 023 for ai_orchestrator_logs should exist")

        # Check it creates the table
        migration_path = os.path.join(migration_dir, matching[0])
        content = _read(migration_path)
        self.assertIn("ai_orchestrator_logs", content)
        self.assertIn("CREATE TABLE", content)


class TestTransactionSafety(unittest.TestCase):
    """Task 2: Transaction wrapping for game operations."""

    def test_transaction_context_manager_exists(self):
        """pg.py should define a transaction() async context manager."""
        source = _read(PG_PATH)
        self.assertIn("async def transaction", source, "transaction() should be defined in pg.py")
        self.assertIn("asynccontextmanager", source, "Should use asynccontextmanager decorator")
        self.assertIn("conn.transaction()", source, "Should use asyncpg connection transaction")
        self.assertIn("await tr.commit()", source, "Should commit on success")
        self.assertIn("await tr.rollback()", source, "Should rollback on error")

    def test_insert_transaction_accepts_conn(self):
        """insert_transaction should accept optional conn parameter."""
        source = _extract_function_source(QUERIES_PATH, "insert_transaction")
        self.assertIn("conn=None", source, "insert_transaction should accept conn=None")

    def test_update_player_by_game_user_accepts_conn(self):
        """update_player_by_game_user should accept optional conn parameter."""
        source = _extract_function_source(QUERIES_PATH, "update_player_by_game_user")
        self.assertIn("conn=None", source, "update_player_by_game_user should accept conn=None")

    def test_increment_game_night_field_accepts_conn(self):
        """increment_game_night_field should accept optional conn parameter."""
        source = _extract_function_source(QUERIES_PATH, "increment_game_night_field")
        self.assertIn("conn=None", source, "increment_game_night_field should accept conn=None")

    def test_update_game_night_accepts_conn(self):
        """update_game_night should accept optional conn parameter."""
        source = _extract_function_source(QUERIES_PATH, "update_game_night")
        self.assertIn("conn=None", source, "update_game_night should accept conn=None")

    def test_insert_player_accepts_conn(self):
        """insert_player should accept optional conn parameter."""
        source = _extract_function_source(QUERIES_PATH, "insert_player")
        self.assertIn("conn=None", source, "insert_player should accept conn=None")

    def test_insert_game_thread_accepts_conn(self):
        """insert_game_thread should accept optional conn parameter."""
        source = _extract_function_source(QUERIES_PATH, "insert_game_thread")
        self.assertIn("conn=None", source, "insert_game_thread should accept conn=None")

    def test_buy_in_handler_uses_transaction(self):
        """add_buy_in handler should wrap critical writes in transaction()."""
        # Handler moved from server.py to routers/games/chips.py
        chips_path = os.path.join(BACKEND_DIR, "routers", "games", "chips.py")
        source = _extract_function_source(chips_path, "add_buy_in")
        self.assertIn("transaction()", source, "add_buy_in should use transaction()")
        self.assertIn("conn=conn", source, "add_buy_in should pass conn to query functions")
        # Verify insert_transaction is inside the transaction
        self.assertIn("insert_transaction(txn_dict, conn=conn)", source)
        self.assertIn("update_player_by_game_user(game_id, user.user_id", source)
        self.assertIn("increment_game_night_field(game_id", source)

    def test_cash_out_handler_uses_transaction(self):
        """cash_out handler should wrap critical writes in transaction()."""
        # Handler moved from server.py to routers/games/chips.py
        chips_path = os.path.join(BACKEND_DIR, "routers", "games", "chips.py")
        source = _extract_function_source(chips_path, "cash_out")
        self.assertIn("transaction()", source, "cash_out should use transaction()")
        self.assertIn("conn=conn", source, "cash_out should pass conn to query functions")
        self.assertIn("insert_transaction(txn_dict, conn=conn)", source)

    def test_end_game_handler_uses_transaction(self):
        """end_game handler should wrap critical writes in transaction()."""
        # Handler moved from server.py to routers/games/lifecycle.py
        lifecycle_path = os.path.join(BACKEND_DIR, "routers", "games", "lifecycle.py")
        source = _extract_function_source(lifecycle_path, "end_game")
        self.assertIn("transaction()", source, "end_game should use transaction()")
        self.assertIn("conn=conn", source, "end_game should pass conn to query functions")
        # update_game_night should be inside transaction
        self.assertIn("update_game_night(game_id", source)
        self.assertIn("insert_game_thread(msg_dict, conn=conn)", source)

    def test_notifications_outside_transaction_in_end_game(self):
        """Notifications in end_game should be OUTSIDE the transaction block."""
        # Handler moved from server.py to routers/games/lifecycle.py
        lifecycle_path = os.path.join(BACKEND_DIR, "routers", "games", "lifecycle.py")
        source = _extract_function_source(lifecycle_path, "end_game")
        # Find the transaction block end and notification insert
        txn_start = source.find("async with")
        txn_block_end = source.find("# Non-critical side effects")
        notif_insert = source.find("insert_notification")
        self.assertGreater(
            notif_insert, txn_block_end,
            "insert_notification should appear after the transaction block"
        )


class TestEventListenerFixes(unittest.TestCase):
    """Bug fixes for event_listener.py."""

    def test_group_messages_in_allowed_tables(self):
        """group_messages must be in ALLOWED_TABLES for AI message posting."""
        source = _read(QUERIES_PATH)
        self.assertIn(
            '"group_messages"',
            source,
            "group_messages should be in ALLOWED_TABLES"
        )

    def test_engagement_cutoff_no_isoformat(self):
        """_handle_engagement_outcome_tracking must pass datetime, not ISO string."""
        event_listener_path = os.path.join(
            BACKEND_DIR, "ai_service", "event_listener.py"
        )
        source = _extract_function_source(
            event_listener_path, "_handle_engagement_outcome_tracking"
        )
        # Should NOT have .isoformat() on the cutoff variable
        self.assertNotIn(
            ".isoformat()",
            source,
            "cutoff should be a datetime, not ISO string (asyncpg needs datetime for TIMESTAMPTZ)"
        )

    def test_post_ai_message_no_isoformat_on_now(self):
        """_post_ai_message must use datetime for created_at, not ISO string."""
        event_listener_path = os.path.join(
            BACKEND_DIR, "ai_service", "event_listener.py"
        )
        source = _extract_function_source(
            event_listener_path, "_post_ai_message"
        )
        # now should be datetime.now(timezone.utc), NOT .isoformat()
        self.assertNotIn(
            "isoformat()",
            source,
            "now should be a raw datetime (generic_insert + _coerce_timestamps handles conversion)"
        )


if __name__ == "__main__":
    unittest.main()
