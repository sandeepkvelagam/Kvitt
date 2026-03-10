"""Unit tests for Admin Platform router extraction."""

import sys, os, ast
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestAdminPlatformRouterRegistration:
    def test_router_import(self):
        from routers.admin_platform import router
        assert router is not None

    def test_router_prefix(self):
        from routers.admin_platform import router
        assert router.prefix == "/api"

    def test_router_has_routes(self):
        from routers.admin_platform import router
        paths = [r.path for r in router.routes]
        for path in ["/api/admin/overview", "/api/admin/health/rollups",
                     "/api/admin/health/metrics", "/api/admin/health/top-endpoints",
                     "/api/admin/crashes", "/api/admin/security/overview",
                     "/api/admin/users/metrics", "/api/admin/funnel",
                     "/api/admin/users", "/api/admin/users/{user_id}/role"]:
            assert path in paths, f"Missing route: {path}"

    def test_router_route_count(self):
        from routers.admin_platform import router
        assert len(router.routes) == 10


class TestAdminPlatformModels:
    def test_update_user_role_request(self):
        from routers.admin_platform import UpdateUserRoleRequest
        obj = UpdateUserRoleRequest(app_role="super_admin")
        assert obj.app_role == "super_admin"


class TestAdminPlatformNotInServer:
    def test_no_admin_platform_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_fns = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
        for fn in ["admin_get_overview", "admin_get_health_rollups", "admin_get_health_metrics",
                    "admin_get_top_endpoints", "admin_get_crashes", "admin_get_security_overview",
                    "admin_get_user_metrics", "admin_get_funnel", "admin_list_users", "admin_update_user_role"]:
            assert fn not in server_fns, f"{fn} still in server.py"

    def test_no_admin_platform_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_classes = {n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)}
        assert "UpdateUserRoleRequest" not in server_classes


class TestSyntaxCheck:
    def test_admin_platform_router_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'routers', 'admin_platform.py')) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'server.py')) as f:
            ast.parse(f.read())
