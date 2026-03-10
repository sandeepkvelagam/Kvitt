"""Unit tests for Admin Incidents router extraction."""

import sys, os, ast
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestAdminIncidentsRouterRegistration:
    def test_router_import(self):
        from routers.admin_incidents import router
        assert router is not None

    def test_router_prefix(self):
        from routers.admin_incidents import router
        assert router.prefix == "/api"

    def test_router_has_routes(self):
        from routers.admin_incidents import router
        paths = [r.path for r in router.routes]
        for path in ["/api/admin/alerts", "/api/admin/alerts/{alert_id}/ack",
                     "/api/admin/alerts/{alert_id}/resolve",
                     "/api/admin/incidents", "/api/admin/incidents/{incident_id}",
                     "/api/admin/incidents/{incident_id}/timeline",
                     "/api/admin/reports/daily"]:
            assert path in paths, f"Missing route: {path}"

    def test_router_route_count(self):
        from routers.admin_incidents import router
        assert len(router.routes) == 7


class TestAdminIncidentsModels:
    def test_incident_timeline_request(self):
        from routers.admin_incidents import IncidentTimelineRequest
        obj = IncidentTimelineRequest(event_type="detected", message="Issue detected")
        assert obj.event_type == "detected"
        assert obj.message == "Issue detected"


class TestAdminIncidentsNotInServer:
    def test_no_admin_incidents_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_fns = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
        for fn in ["admin_list_alerts", "admin_ack_alert", "admin_resolve_alert",
                    "admin_list_incidents", "admin_get_incident", "admin_add_incident_timeline",
                    "admin_get_daily_report"]:
            assert fn not in server_fns, f"{fn} still in server.py"

    def test_no_admin_incidents_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_classes = {n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)}
        assert "IncidentTimelineRequest" not in server_classes


class TestSyntaxCheck:
    def test_admin_incidents_router_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'routers', 'admin_incidents.py')) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'server.py')) as f:
            ast.parse(f.read())
