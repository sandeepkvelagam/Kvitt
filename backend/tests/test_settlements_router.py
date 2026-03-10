"""Unit tests for Settlements router extraction."""

import sys, os, ast
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestSettlementsRouterRegistration:
    def test_settlements_router_import(self):
        from routers.settlements import router
        assert router is not None

    def test_settlements_router_prefix(self):
        from routers.settlements import router
        assert router.prefix == "/api"

    def test_settlements_router_has_routes(self):
        from routers.settlements import router
        paths = [r.path for r in router.routes]
        for path in ["/api/settlements/{ledger_id}/pay", "/api/ledger/pay-net/prepare",
                     "/api/ledger/pay-net/status", "/api/webhook/stripe-debt"]:
            assert path in paths, f"Missing route: {path}"

    def test_settlements_router_route_count(self):
        from routers.settlements import router
        assert len(router.routes) == 4


class TestSettlementsNotInServer:
    def test_no_settlement_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_fns = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
        for fn in ["create_debt_payment", "prepare_pay_net", "get_pay_net_status", "stripe_debt_webhook"]:
            assert fn not in server_fns, f"{fn} still in server.py"


class TestSyntaxCheck:
    def test_settlements_router_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'routers', 'settlements.py')) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'server.py')) as f:
            ast.parse(f.read())
