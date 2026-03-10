"""
Unit tests for Spotify router extraction.

Verifies that:
- routers/spotify.py exports the correct symbols and routes
- Spotify models work correctly
- All modified files parse without syntax errors
- Spotify routes are NOT in server.py anymore
"""

import pytest
import sys
import os
import ast

# Ensure backend/ is on the path so we can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestSpotifyRouterRegistration:
    """Verify Spotify router is properly registered with correct routes."""

    def test_spotify_router_import(self):
        from routers.spotify import router
        assert router is not None

    def test_spotify_router_prefix(self):
        from routers.spotify import router
        assert router.prefix == "/api"

    def test_spotify_router_has_routes(self):
        from routers.spotify import router
        paths = [r.path for r in router.routes]
        expected_paths = [
            "/api/spotify/auth-url",
            "/api/spotify/token",
            "/api/spotify/refresh",
            "/api/spotify/status",
            "/api/spotify/disconnect",
            "/api/spotify/search",
            "/api/spotify/playback",
            "/api/spotify/play",
            "/api/spotify/pause",
            "/api/spotify/next",
            "/api/spotify/previous",
            "/api/spotify/volume",
            "/api/spotify/seek",
            "/api/spotify/devices",
            "/api/spotify/shuffle",
            "/api/spotify/repeat",
            "/api/spotify/me/playlists",
            "/api/spotify/playlists/{playlist_id}/tracks",
            "/api/spotify/me/tracks",
        ]
        for path in expected_paths:
            assert path in paths, f"Missing route: {path}"

    def test_spotify_router_route_count(self):
        from routers.spotify import router
        assert len(router.routes) == 19


class TestSpotifyModels:
    """Verify Spotify Pydantic models work correctly."""

    def test_spotify_token_request(self):
        from routers.spotify import SpotifyTokenRequest
        req = SpotifyTokenRequest(code="abc123")
        assert req.code == "abc123"
        assert req.redirect_uri is None

    def test_spotify_token_request_with_redirect(self):
        from routers.spotify import SpotifyTokenRequest
        req = SpotifyTokenRequest(code="abc", redirect_uri="http://localhost/callback")
        assert req.redirect_uri == "http://localhost/callback"

    def test_spotify_refresh_request(self):
        from routers.spotify import SpotifyRefreshRequest
        req = SpotifyRefreshRequest(refresh_token="xyz789")
        assert req.refresh_token == "xyz789"

    def test_spotify_play_request_defaults(self):
        from routers.spotify import SpotifyPlayRequest
        req = SpotifyPlayRequest()
        assert req.track_uri is None
        assert req.context_uri is None
        assert req.position_ms == 0
        assert req.device_id is None

    def test_spotify_play_request_with_values(self):
        from routers.spotify import SpotifyPlayRequest
        req = SpotifyPlayRequest(
            track_uri="spotify:track:123",
            device_id="dev1",
            position_ms=5000
        )
        assert req.track_uri == "spotify:track:123"
        assert req.device_id == "dev1"
        assert req.position_ms == 5000

    def test_spotify_volume_request(self):
        from routers.spotify import SpotifyVolumeRequest
        req = SpotifyVolumeRequest(volume_percent=75)
        assert req.volume_percent == 75
        assert req.device_id is None

    def test_spotify_volume_request_with_device(self):
        from routers.spotify import SpotifyVolumeRequest
        req = SpotifyVolumeRequest(volume_percent=50, device_id="dev1")
        assert req.device_id == "dev1"


class TestSpotifyConfig:
    """Verify Spotify config constants are importable."""

    def test_spotify_config_constants_exist(self):
        from routers.spotify import SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES
        # These should be strings (possibly empty from env)
        assert isinstance(SPOTIFY_CLIENT_ID, str)
        assert isinstance(SPOTIFY_CLIENT_SECRET, str)
        assert isinstance(SPOTIFY_REDIRECT_URI, str)
        assert isinstance(SPOTIFY_SCOPES, str)

    def test_spotify_scopes_contains_required(self):
        from routers.spotify import SPOTIFY_SCOPES
        assert "user-read-playback-state" in SPOTIFY_SCOPES
        assert "user-modify-playback-state" in SPOTIFY_SCOPES
        assert "streaming" in SPOTIFY_SCOPES
        assert "user-library-read" in SPOTIFY_SCOPES


class TestSpotifyNotInServer:
    """Verify Spotify routes have been removed from server.py."""

    def test_no_spotify_routes_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        spotify_functions = [
            "get_spotify_auth_url",
            "exchange_spotify_token",
            "refresh_spotify_token",
            "get_spotify_status",
            "disconnect_spotify",
            "search_spotify",
            "get_playback_state",
            "start_playback",
            "pause_playback",
            "skip_to_next",
            "skip_to_previous",
            "set_volume",
            "seek_to_position",
            "get_devices",
            "set_shuffle",
            "set_repeat",
            "get_user_playlists",
            "get_playlist_tracks",
            "get_saved_tracks",
        ]

        server_functions = {
            node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

        for fn in spotify_functions:
            assert fn not in server_functions, f"Spotify function {fn} still in server.py"

    def test_no_spotify_models_in_server(self):
        server_path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(server_path) as f:
            tree = ast.parse(f.read())

        spotify_models = [
            "SpotifyTokenRequest",
            "SpotifyRefreshRequest",
            "SpotifyPlayRequest",
            "SpotifyVolumeRequest",
        ]

        server_classes = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }

        for model in spotify_models:
            assert model not in server_classes, f"Spotify model {model} still in server.py"


class TestSyntaxCheck:
    """Verify all modified files parse without syntax errors."""

    def test_spotify_router_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'spotify.py')
        with open(path) as f:
            ast.parse(f.read())

    def test_server_syntax(self):
        path = os.path.join(os.path.dirname(__file__), '..', 'server.py')
        with open(path) as f:
            ast.parse(f.read())
