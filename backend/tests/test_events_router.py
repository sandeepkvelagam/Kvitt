"""Unit tests for Events/Scheduling router extraction."""

import sys, os, ast
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestEventsRouterRegistration:
    def test_events_router_import(self):
        from routers.events import router
        assert router is not None

    def test_events_router_prefix(self):
        from routers.events import router
        assert router.prefix == "/api"

    def test_events_router_has_routes(self):
        from routers.events import router
        paths = [r.path for r in router.routes]
        for path in ["/api/events", "/api/events/{event_id}",
                     "/api/occurrences/{occurrence_id}/rsvp",
                     "/api/occurrences/{occurrence_id}/invites",
                     "/api/occurrences/{occurrence_id}/start-game",
                     "/api/templates"]:
            assert path in paths, f"Missing route: {path}"

    def test_events_router_route_count(self):
        from routers.events import router
        assert len(router.routes) == 7


class TestEventsModels:
    def test_create_event_request(self):
        from routers.events import CreateEventRequest
        from datetime import datetime, timezone
        obj = CreateEventRequest(group_id="grp_123", title="Poker Night", starts_at=datetime.now(timezone.utc))
        assert obj.group_id == "grp_123"
        assert obj.duration_minutes == 180
        assert obj.timezone == "America/New_York"

    def test_event_rsvp_request(self):
        from routers.events import EventRSVPRequest
        obj = EventRSVPRequest(status="accepted")
        assert obj.status == "accepted"

    def test_propose_time_request(self):
        from routers.events import ProposeTimeRequest
        from datetime import datetime, timezone
        obj = ProposeTimeRequest(proposed_starts_at=datetime.now(timezone.utc))
        assert obj.proposed_duration_minutes is None

    def test_decide_proposal_request(self):
        from routers.events import DecideProposalRequest
        obj = DecideProposalRequest(decision="accepted")
        assert obj.decision == "accepted"


class TestEventsNotInServer:
    def test_no_event_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_fns = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
        for fn in ["create_event", "list_events", "get_event", "rsvp_to_occurrence",
                    "get_occurrence_invites", "start_game_from_occurrence", "list_templates"]:
            assert fn not in server_fns, f"{fn} still in server.py"

    def test_no_event_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())
        server_classes = {n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)}
        for model in ["CreateEventRequest", "EventRSVPRequest", "ProposeTimeRequest", "DecideProposalRequest"]:
            assert model not in server_classes, f"{model} still in server.py"


class TestSyntaxCheck:
    def test_events_router_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'routers', 'events.py')) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        with open(os.path.join(os.path.dirname(__file__), '..', 'server.py')) as f:
            ast.parse(f.read())
