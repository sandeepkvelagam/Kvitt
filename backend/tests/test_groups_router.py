"""
Unit tests for group router and push_service extraction.

Verifies that:
- routers/groups.py exports the correct symbols and routes
- push_service.py exports the correct symbols
- Group models work correctly
- All modified files parse without syntax errors
- Group routes are NOT in server.py anymore
"""

import pytest
import sys
import os
import ast

# Ensure backend/ is on the path so we can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestGroupsRouterRegistration:
    """Verify groups router is properly registered with correct routes."""

    def test_groups_router_import(self):
        from routers.groups import router
        assert router is not None

    def test_groups_router_prefix(self):
        from routers.groups import router
        assert router.prefix == "/api"

    def test_groups_router_has_routes(self):
        from routers.groups import router
        paths = [r.path for r in router.routes]
        # Spot-check key group routes
        assert "/api/groups" in paths
        assert "/api/groups/{group_id}" in paths
        assert "/api/groups/buy-in-options" in paths
        assert "/api/groups/{group_id}/invite" in paths
        assert "/api/groups/{group_id}/messages" in paths
        assert "/api/groups/{group_id}/polls" in paths
        assert "/api/groups/{group_id}/ai-settings" in paths
        assert "/api/groups/{group_id}/calendar" in paths
        assert "/api/groups/{group_id}/smart-defaults" in paths
        assert "/api/groups/{group_id}/frequent-players" in paths
        assert "/api/users/invites" in paths
        assert "/api/users/invites/{invite_id}/respond" in paths
        assert "/api/groups/{group_id}/members/{member_id}" in paths
        assert "/api/groups/{group_id}/transfer-admin" in paths
        assert "/api/groups/{group_id}/host-updates" in paths
        assert "/api/groups/{group_id}/suggest-times" in paths

    def test_groups_router_route_count(self):
        from routers.groups import router
        # 29 routes total (consolidated from original, after removing duplicates)
        assert len(router.routes) == 29


class TestGroupModels:
    """Verify group Pydantic models work correctly."""

    def test_group_model(self):
        from routers.groups import Group
        g = Group(name="Test Group", created_by="user_123")
        assert g.name == "Test Group"
        assert g.created_by == "user_123"
        assert g.group_id.startswith("grp_")
        assert g.default_buy_in == 20.0
        assert g.currency == "USD"

    def test_group_create_model(self):
        from routers.groups import GroupCreate
        gc = GroupCreate(name="My Group")
        assert gc.name == "My Group"
        assert gc.default_buy_in == 20.0
        assert gc.chips_per_buy_in == 20
        assert gc.currency == "USD"

    def test_group_update_model(self):
        from routers.groups import GroupUpdate
        gu = GroupUpdate(name="New Name")
        assert gu.name == "New Name"
        assert gu.description is None

    def test_group_member_model(self):
        from routers.groups import GroupMember
        m = GroupMember(group_id="grp_123", user_id="user_123")
        assert m.role == "member"
        assert m.member_id.startswith("mem_")

    def test_group_invite_model(self):
        from routers.groups import GroupInvite
        inv = GroupInvite(
            group_id="grp_123",
            invited_by="user_123",
            invited_email="test@example.com"
        )
        assert inv.status == "pending"
        assert inv.invite_id.startswith("inv_")

    def test_group_message_model(self):
        from routers.groups import GroupMessage
        msg = GroupMessage(
            group_id="grp_123",
            user_id="user_123",
            content="Hello"
        )
        assert msg.type == "user"
        assert msg.deleted is False
        assert msg.message_id.startswith("gmsg_")

    def test_poll_model(self):
        from routers.groups import Poll
        p = Poll(
            group_id="grp_123",
            created_by="user_123",
            question="When to play?"
        )
        assert p.status == "active"
        assert p.poll_id.startswith("poll_")
        assert p.type == "availability"

    def test_poll_create_model(self):
        from routers.groups import PollCreate
        pc = PollCreate(
            question="When?",
            options=["Friday", "Saturday"]
        )
        assert pc.expires_in_hours == 48
        assert pc.type == "availability"

    def test_group_ai_settings_model(self):
        from routers.groups import GroupAISettings
        settings = GroupAISettings(group_id="grp_123")
        assert settings.ai_enabled is True
        assert settings.max_messages_per_hour == 5

    def test_invite_member_request(self):
        from routers.groups import InviteMemberRequest
        req = InviteMemberRequest(email="test@example.com")
        assert req.email == "test@example.com"

    def test_respond_to_invite_request(self):
        from routers.groups import RespondToInviteRequest
        req = RespondToInviteRequest(accept=True)
        assert req.accept is True


class TestPushServiceModule:
    """Verify push_service.py can be imported and contains expected exports."""

    def test_import_push_service(self):
        from push_service import (
            send_push_notification_to_user,
            send_push_to_users,
            check_notification_preferences,
            NOTIFICATION_CATEGORY_MAP,
            EXPO_PUSH_API_URL,
        )
        assert callable(send_push_notification_to_user)
        assert callable(send_push_to_users)
        assert callable(check_notification_preferences)

    def test_notification_category_map_keys(self):
        from push_service import NOTIFICATION_CATEGORY_MAP
        expected_keys = [
            "game_started", "game_ended", "buy_in_request",
            "settlement", "payment_request",
            "group_invite_request", "invite_accepted",
        ]
        for key in expected_keys:
            assert key in NOTIFICATION_CATEGORY_MAP

    def test_expo_push_url(self):
        from push_service import EXPO_PUSH_API_URL
        assert EXPO_PUSH_API_URL == "https://exp.host/--/api/v2/push/send"


class TestSharedModels:
    """Verify shared models in dependencies.py."""

    def test_notification_model(self):
        from dependencies import Notification
        n = Notification(
            user_id="user_123",
            type="game_invite",
            title="Test",
            message="Test message"
        )
        assert n.notification_id.startswith("ntf_")
        assert n.read is False

    def test_audit_log_model(self):
        from dependencies import AuditLog
        a = AuditLog(
            entity_type="group",
            entity_id="grp_123",
            action="update",
            changed_by="user_123"
        )
        assert a.audit_id.startswith("aud_")
        assert a.old_value is None


class TestSyntaxValidity:
    """Verify all modified/created files parse without syntax errors."""

    def _check_syntax(self, filepath):
        with open(filepath) as f:
            ast.parse(f.read())

    def test_groups_router_syntax(self):
        self._check_syntax(os.path.join(os.path.dirname(__file__), '..', 'routers', 'groups.py'))

    def test_push_service_syntax(self):
        self._check_syntax(os.path.join(os.path.dirname(__file__), '..', 'push_service.py'))

    def test_dependencies_syntax(self):
        self._check_syntax(os.path.join(os.path.dirname(__file__), '..', 'dependencies.py'))

    def test_server_syntax(self):
        self._check_syntax(os.path.join(os.path.dirname(__file__), '..', 'server.py'))


class TestNoDuplicateRoutes:
    """Verify group routes were fully removed from server.py."""

    def test_no_group_crud_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            source = f.read()
        # Group route decorators should NOT be in server.py
        assert '@api_router.post("/groups"' not in source
        assert '@api_router.get("/groups/buy-in-options")' not in source
        assert '@api_router.get("/groups/{group_id}/messages")' not in source
        assert '@api_router.post("/groups/{group_id}/polls")' not in source
        assert '@api_router.get("/groups/{group_id}/ai-settings")' not in source
        assert '@api_router.get("/groups/{group_id}/calendar")' not in source
        assert '@api_router.get("/groups/{group_id}/smart-defaults")' not in source
        assert '@api_router.get("/groups/{group_id}/frequent-players")' not in source

    def test_no_group_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            source = f.read()
        assert "class GroupInvite(BaseModel)" not in source
        assert "class Group(BaseModel)" not in source
        assert "class GroupMember(BaseModel)" not in source
        assert "class GroupMessage(BaseModel)" not in source
        assert "class GroupAISettings(BaseModel)" not in source
        assert "class Poll(BaseModel)" not in source
        assert "class PollOption(BaseModel)" not in source

    def test_no_push_helpers_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            source = f.read()
        assert "async def send_push_notification_to_user" not in source
        assert "async def send_push_to_users" not in source
        assert 'EXPO_PUSH_API_URL = "https://exp.host' not in source

    def test_no_notification_category_map_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            source = f.read()
        assert "NOTIFICATION_CATEGORY_MAP = {" not in source
        assert "async def check_notification_preferences" not in source

    def test_no_audit_notification_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            source = f.read()
        assert "class AuditLog(BaseModel)" not in source
        assert "class Notification(BaseModel)" not in source

    def test_user_endpoints_extracted_to_router(self):
        """User profile and search endpoints should be in routers/users.py."""
        from routers.users import router
        paths = [r.path for r in router.routes]
        assert "/api/users/me" in paths
        assert "/api/users/search" in paths

    def test_groups_router_registered_in_server(self):
        """Verify server.py imports and registers groups_router."""
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            source = f.read()
        assert "from routers.groups import router as groups_router" in source
        assert "fastapi_app.include_router(groups_router)" in source

    def test_push_service_imported_in_server(self):
        """Verify server.py imports push helpers from push_service."""
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            source = f.read()
        assert "from push_service import send_push_notification_to_user" in source


class TestGenerateGroupName:
    """Verify generate_default_group_name function."""

    def test_generate_group_name(self):
        from routers.groups import generate_default_group_name
        name = generate_default_group_name()
        assert "#" in name
        assert len(name) > 3

    def test_group_name_prefixes(self):
        from routers.groups import GROUP_NAME_PREFIXES
        assert len(GROUP_NAME_PREFIXES) > 0
        assert "High Rollers" in GROUP_NAME_PREFIXES
