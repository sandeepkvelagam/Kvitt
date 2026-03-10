"""
Unit tests for Wallet router extraction.

Verifies that:
- routers/wallet.py exports the correct symbols and routes
- Wallet data models and request models work correctly
- All modified files parse without syntax errors
- Wallet routes are NOT in server.py anymore
"""

import pytest
import sys
import os
import ast

# Ensure backend/ is on the path so we can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestWalletRouterRegistration:
    """Verify Wallet router is properly registered with correct routes."""

    def test_wallet_router_import(self):
        from routers.wallet import router
        assert router is not None

    def test_wallet_router_prefix(self):
        from routers.wallet import router
        assert router.prefix == "/api"

    def test_wallet_router_has_routes(self):
        from routers.wallet import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/wallet",
            "/api/wallet/setup",
            "/api/wallet/pin/set",
            "/api/wallet/pin/change",
            "/api/wallet/pin/verify",
            "/api/wallet/lookup/{wallet_id}",
            "/api/wallet/search",
            "/api/wallet/transfer",
            "/api/wallet/transactions",
            "/api/wallet/deposit",
            "/api/wallet/deposit/status/{session_id}",
            "/api/wallet/reconcile",
            "/api/wallet/withdraw",
            "/api/wallet/withdrawals",
            "/api/webhook/stripe-wallet",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_wallet_router_route_count(self):
        from routers.wallet import router
        assert len(router.routes) == 15


class TestWalletDataModels:
    """Verify Wallet data models work correctly."""

    def test_wallet_model_defaults(self):
        from routers.wallet import Wallet
        w = Wallet(wallet_id="KVT-123456", user_id="user_1")
        assert w.wallet_id == "KVT-123456"
        assert w.user_id == "user_1"
        assert w.balance_cents == 0
        assert w.currency == "usd"
        assert w.status == "active"
        assert w.pin_hash is None
        assert w.pin_attempts == 0
        assert w.daily_transfer_limit_cents == 50000
        assert w.per_transaction_limit_cents == 20000
        assert w.version == 1

    def test_wallet_transaction_fields(self):
        from routers.wallet import WalletTransaction
        tx = WalletTransaction(
            wallet_id="KVT-123456",
            user_id="user_1",
            type="deposit",
            amount_cents=1000,
            direction="credit",
            balance_before_cents=0,
            balance_after_cents=1000,
        )
        assert tx.wallet_id == "KVT-123456"
        assert tx.amount_cents == 1000
        assert tx.direction == "credit"
        assert tx.status == "completed"
        assert tx.transaction_id.startswith("wtxn_")
        assert tx.transfer_id is None
        assert tx.stripe_payment_intent_id is None

    def test_wallet_audit_log_fields(self):
        from routers.wallet import WalletAuditLog
        log = WalletAuditLog(
            wallet_id="KVT-123456",
            user_id="user_1",
            action="wallet_created",
        )
        assert log.audit_id.startswith("waud_")
        assert log.action == "wallet_created"
        assert log.old_value is None
        assert log.risk_flags == []


class TestWalletRequestModels:
    """Verify Wallet request models with validation."""

    def test_set_pin_request_valid(self):
        from routers.wallet import SetPinRequest
        req = SetPinRequest(pin="1234")
        assert req.pin == "1234"

    def test_set_pin_request_six_digits(self):
        from routers.wallet import SetPinRequest
        req = SetPinRequest(pin="123456")
        assert req.pin == "123456"

    def test_set_pin_request_rejects_short(self):
        from routers.wallet import SetPinRequest
        with pytest.raises(Exception):
            SetPinRequest(pin="12")

    def test_set_pin_request_rejects_letters(self):
        from routers.wallet import SetPinRequest
        with pytest.raises(Exception):
            SetPinRequest(pin="abcd")

    def test_change_pin_request(self):
        from routers.wallet import ChangePinRequest
        req = ChangePinRequest(current_pin="1234", new_pin="5678")
        assert req.current_pin == "1234"
        assert req.new_pin == "5678"

    def test_verify_pin_request(self):
        from routers.wallet import VerifyPinRequest
        req = VerifyPinRequest(pin="9999")
        assert req.pin == "9999"

    def test_wallet_transfer_request(self):
        from routers.wallet import WalletTransferRequest
        req = WalletTransferRequest(
            to_wallet_id="KVT-999999",
            amount_cents=5000,
            pin="1234",
            idempotency_key="uuid-123",
        )
        assert req.to_wallet_id == "KVT-999999"
        assert req.amount_cents == 5000
        assert req.description is None
        assert req.risk_acknowledged is False

    def test_wallet_transfer_request_rejects_zero(self):
        from routers.wallet import WalletTransferRequest
        with pytest.raises(Exception):
            WalletTransferRequest(
                to_wallet_id="KVT-999999",
                amount_cents=0,
                pin="1234",
                idempotency_key="uuid-123",
            )

    def test_wallet_transfer_request_rejects_over_limit(self):
        from routers.wallet import WalletTransferRequest
        with pytest.raises(Exception):
            WalletTransferRequest(
                to_wallet_id="KVT-999999",
                amount_cents=30000,  # Over $200 limit
                pin="1234",
                idempotency_key="uuid-123",
            )

    def test_wallet_deposit_request(self):
        from routers.wallet import WalletDepositRequest
        req = WalletDepositRequest(amount_cents=5000, origin_url="http://localhost")
        assert req.amount_cents == 5000

    def test_wallet_deposit_request_rejects_below_min(self):
        from routers.wallet import WalletDepositRequest
        with pytest.raises(Exception):
            WalletDepositRequest(amount_cents=100, origin_url="http://localhost")

    def test_withdraw_request(self):
        from routers.wallet import WithdrawRequest
        req = WithdrawRequest(
            amount_cents=10000,
            method="venmo",
            destination_details="user@example.com",
            pin="1234",
        )
        assert req.method == "venmo"
        assert req.destination_details == "user@example.com"

    def test_withdraw_request_default_method(self):
        from routers.wallet import WithdrawRequest
        req = WithdrawRequest(
            amount_cents=5000,
            destination_details="acct_123",
            pin="1234",
        )
        assert req.method == "bank_transfer"


class TestWalletNotInServer:
    """Verify Wallet routes and models have been removed from server.py."""

    def test_no_wallet_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        wallet_functions = [
            "get_wallet",
            "setup_wallet",
            "set_wallet_pin",
            "change_wallet_pin",
            "verify_wallet_pin",
            "lookup_wallet",
            "search_wallets",
            "transfer_funds",
            "get_wallet_transactions",
            "create_wallet_deposit",
            "check_deposit_status",
            "reconcile_wallet",
            "request_withdrawal",
            "get_withdrawals",
            "stripe_wallet_webhook",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in wallet_functions:
            assert fn not in server_functions, f"Wallet function {fn} still in server.py"

    def test_no_wallet_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        wallet_models = [
            "Wallet",
            "WalletTransaction",
            "WalletAuditLog",
            "SetPinRequest",
            "ChangePinRequest",
            "VerifyPinRequest",
            "WalletTransferRequest",
            "WalletDepositRequest",
            "WithdrawRequest",
        ]

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        for model in wallet_models:
            assert model not in server_classes, f"Wallet model {model} still in server.py"


class TestSyntaxCheck:
    """Verify all modified files parse without syntax errors."""

    def test_wallet_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'wallet.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
