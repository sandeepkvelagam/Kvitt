"""Unit tests for Ledger router extraction."""

import sys, os, ast
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestLedgerRouterRegistration:
    def test_ledger_router_import(self):
        from routers.ledger import router
        assert router is not None

    def test_ledger_router_prefix(self):
        from routers.ledger import router
        assert router.prefix == "/api"

    def test_ledger_router_has_routes(self):
        from routers.ledger import router
        paths = [r.path for r in router.routes]
        for path in ["/api/ledger/{ledger_id}/paid", "/api/ledger/{ledger_id}/request-payment",
                     "/api/ledger/{ledger_id}/confirm-received", "/api/ledger/{ledger_id}/edit",
                     "/api/ledger/balances", "/api/ledger/consolidated",
                     "/api/ledger/consolidated-detailed", "/api/ledger/optimize"]:
            assert path in paths, f"Missing route: {path}"

    def test_ledger_router_route_count(self):
        from routers.ledger import router
        assert len(router.routes) == 8


class TestLedgerModels:
    def test_mark_paid_request(self):
        from routers.ledger import MarkPaidRequest
        assert MarkPaidRequest(paid=True).paid is True

    def test_ledger_edit_request(self):
        from routers.ledger import LedgerEditRequest
        obj = LedgerEditRequest(amount=25.50, reason="Correction")
        assert obj.amount == 25.50
        assert obj.reason == "Correction"


class TestLedgerNotInServer:
    def test_no_ledger_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_fns = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
        for fn in ["mark_paid", "request_payment", "confirm_payment_received", "edit_ledger",
                    "get_balances", "get_consolidated_balances", "get_consolidated_balances_detailed", "optimize_ledger"]:
            assert fn not in server_fns, f"{fn} still in server.py"

    def test_no_ledger_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_classes = {n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)}
        assert "MarkPaidRequest" not in server_classes
        assert "LedgerEditRequest" not in server_classes


class TestSyntaxCheck:
    def test_ledger_router_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'routers', 'ledger.py')) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'server.py')) as f:
            ast.parse(f.read())
