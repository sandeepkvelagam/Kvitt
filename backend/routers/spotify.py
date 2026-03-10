"""
Spotify integration: OAuth, playback control, library browsing.

Extracted from server.py — pure mechanical move, zero behavior changes.
"""

import os
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["spotify"])

# Spotify config from environment
SPOTIFY_CLIENT_ID = os.environ.get('SPOTIFY_CLIENT_ID', '')
SPOTIFY_CLIENT_SECRET = os.environ.get('SPOTIFY_CLIENT_SECRET', '')
SPOTIFY_REDIRECT_URI = os.environ.get('SPOTIFY_REDIRECT_URI', os.environ.get('APP_URL', '') + '/spotify/callback')

# Spotify scopes needed for playback and library access
SPOTIFY_SCOPES = "user-read-playback-state user-modify-playback-state user-read-private streaming user-read-currently-playing playlist-read-private playlist-read-collaborative user-library-read"


class SpotifyTokenRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = None

class SpotifyRefreshRequest(BaseModel):
    refresh_token: str

class SpotifyPlayRequest(BaseModel):
    track_uri: Optional[str] = None
    context_uri: Optional[str] = None
    position_ms: int = 0
    device_id: Optional[str] = None

class SpotifyVolumeRequest(BaseModel):
    volume_percent: int
    device_id: Optional[str] = None


@router.get("/spotify/auth-url")
async def get_spotify_auth_url(
    user: User = Depends(get_current_user),
    redirect_uri: str = None
):
    """Get Spotify authorization URL for OAuth flow."""
    if not SPOTIFY_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Spotify integration not configured. Please add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to environment.")

    # Use provided redirect_uri or fall back to environment variable
    final_redirect_uri = redirect_uri or SPOTIFY_REDIRECT_URI

    # Create state with user_id for security
    state = base64.urlsafe_b64encode(user.user_id.encode()).decode()

    auth_url = (
        f"https://accounts.spotify.com/authorize?"
        f"client_id={SPOTIFY_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={final_redirect_uri}&"
        f"scope={SPOTIFY_SCOPES.replace(' ', '%20')}&"
        f"state={state}"
    )

    return {"auth_url": auth_url, "redirect_uri": final_redirect_uri}

@router.post("/spotify/token")
async def exchange_spotify_token(data: SpotifyTokenRequest, user: User = Depends(get_current_user)):
    """Exchange authorization code for access token."""
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Spotify integration not configured")

    redirect_uri = data.redirect_uri or SPOTIFY_REDIRECT_URI

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        auth_header = base64.b64encode(f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}".encode()).decode()
        response = await client.post(
            "https://accounts.spotify.com/api/token",
            headers={
                "Authorization": f"Basic {auth_header}",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data={
                "grant_type": "authorization_code",
                "code": data.code,
                "redirect_uri": redirect_uri
            }
        )

        if response.status_code != 200:
            logger.error(f"Spotify token exchange failed: {response.text}")
            raise HTTPException(status_code=400, detail="Failed to exchange Spotify token")

        token_data = response.json()

        # Get user profile from Spotify
        profile_response = await client.get(
            "https://api.spotify.com/v1/me",
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        spotify_profile = profile_response.json() if profile_response.status_code == 200 else {}

        # Store tokens in database
        spotify_data = {
            "user_id": user.user_id,
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in", 3600),
            "token_type": token_data.get("token_type", "Bearer"),
            "spotify_user_id": spotify_profile.get("id"),
            "spotify_display_name": spotify_profile.get("display_name"),
            "spotify_product": spotify_profile.get("product", "free"),  # free or premium
            "is_premium": spotify_profile.get("product") == "premium",
            "updated_at": datetime.now(timezone.utc)
        }

        # Upsert spotify token for user
        await queries.upsert_spotify_token(user.user_id, spotify_data)

        return {
            "access_token": token_data["access_token"],
            "expires_in": token_data.get("expires_in", 3600),
            "spotify_user": spotify_profile.get("display_name"),
            "is_premium": spotify_profile.get("product") == "premium"
        }

@router.post("/spotify/refresh")
async def refresh_spotify_token(data: SpotifyRefreshRequest, user: User = Depends(get_current_user)):
    """Refresh expired Spotify access token."""
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Spotify integration not configured")

    async with httpx.AsyncClient() as client:
        auth_header = base64.b64encode(f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}".encode()).decode()
        response = await client.post(
            "https://accounts.spotify.com/api/token",
            headers={
                "Authorization": f"Basic {auth_header}",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data={
                "grant_type": "refresh_token",
                "refresh_token": data.refresh_token
            }
        )

        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to refresh token")

        token_data = response.json()

        # Update stored token
        await queries.upsert_spotify_token(user.user_id, {
                "access_token": token_data["access_token"],
                "expires_in": token_data.get("expires_in", 3600),
                "updated_at": datetime.now(timezone.utc)
            })

        return {
            "access_token": token_data["access_token"],
            "expires_in": token_data.get("expires_in", 3600)
        }

@router.get("/spotify/status")
async def get_spotify_status(user: User = Depends(get_current_user)):
    """Check if user has Spotify connected."""
    token_data = await queries.get_spotify_token(user.user_id)

    if not token_data:
        return {"connected": False}

    # Check if token needs refresh
    expires_at = token_data.get("expires_at")
    access_token = token_data.get("access_token")

    if expires_at and datetime.utcnow().timestamp() > expires_at:
        # Token expired, try to refresh
        refresh_token = token_data.get("refresh_token")
        if refresh_token:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        "https://accounts.spotify.com/api/token",
                        data={
                            "grant_type": "refresh_token",
                            "refresh_token": refresh_token,
                            "client_id": SPOTIFY_CLIENT_ID,
                            "client_secret": SPOTIFY_CLIENT_SECRET,
                        },
                    )
                    if response.status_code == 200:
                        token_info = response.json()
                        access_token = token_info["access_token"]
                        new_expires_at = datetime.utcnow().timestamp() + token_info.get("expires_in", 3600)

                        await queries.upsert_spotify_token(user.user_id, {
                                "access_token": access_token,
                                "expires_at": new_expires_at
                            })
            except Exception as e:
                print(f"Error refreshing Spotify token: {e}")

    return {
        "connected": True,
        "spotify_user": token_data.get("spotify_display_name"),
        "is_premium": token_data.get("is_premium", False),
        "access_token": access_token
    }

@router.delete("/spotify/disconnect")
async def disconnect_spotify(user: User = Depends(get_current_user)):
    """Disconnect Spotify account."""
    await queries.delete_spotify_token(user.user_id)
    return {"message": "Spotify disconnected"}

@router.get("/spotify/search")
async def search_spotify(q: str, type: str = "track", limit: int = 20, user: User = Depends(get_current_user)):
    """Search Spotify for tracks, albums, or playlists."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.spotify.com/v1/search",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
            params={"q": q, "type": type, "limit": limit}
        )

        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="Spotify token expired, please refresh")

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Spotify search failed")

        return response.json()

@router.get("/spotify/playback")
async def get_playback_state(user: User = Depends(get_current_user)):
    """Get current playback state."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.spotify.com/v1/me/player",
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code == 204:
            return {"is_playing": False, "device": None, "item": None}

        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="Spotify token expired")

        if response.status_code != 200:
            return {"is_playing": False, "device": None, "item": None}

        return response.json()

@router.put("/spotify/play")
async def start_playback(data: SpotifyPlayRequest, user: User = Depends(get_current_user)):
    """Start or resume playback."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    if not token_data.get("is_premium"):
        raise HTTPException(status_code=403, detail="Spotify Premium required for playback control")

    async with httpx.AsyncClient() as client:
        url = "https://api.spotify.com/v1/me/player/play"
        if data.device_id:
            url += f"?device_id={data.device_id}"

        body = {}
        if data.track_uri:
            body["uris"] = [data.track_uri]
        if data.context_uri:
            body["context_uri"] = data.context_uri
        if data.position_ms:
            body["position_ms"] = data.position_ms

        response = await client.put(
            url,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
            json=body if body else None
        )

        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="Spotify token expired")

        if response.status_code not in [200, 204]:
            logger.error(f"Spotify play failed: {response.status_code} - {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Failed to start playback")

        return {"status": "playing"}

@router.put("/spotify/pause")
async def pause_playback(device_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Pause playback."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        url = "https://api.spotify.com/v1/me/player/pause"
        if device_id:
            url += f"?device_id={device_id}"

        response = await client.put(
            url,
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code not in [200, 204]:
            raise HTTPException(status_code=response.status_code, detail="Failed to pause")

        return {"status": "paused"}

@router.post("/spotify/next")
async def skip_to_next(device_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Skip to next track."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        url = "https://api.spotify.com/v1/me/player/next"
        if device_id:
            url += f"?device_id={device_id}"

        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code not in [200, 204]:
            raise HTTPException(status_code=response.status_code, detail="Failed to skip")

        return {"status": "skipped"}

@router.post("/spotify/previous")
async def skip_to_previous(device_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Skip to previous track."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        url = "https://api.spotify.com/v1/me/player/previous"
        if device_id:
            url += f"?device_id={device_id}"

        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code not in [200, 204]:
            raise HTTPException(status_code=response.status_code, detail="Failed to go back")

        return {"status": "previous"}

@router.put("/spotify/volume")
async def set_volume(data: SpotifyVolumeRequest, user: User = Depends(get_current_user)):
    """Set playback volume."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        url = f"https://api.spotify.com/v1/me/player/volume?volume_percent={data.volume_percent}"
        if data.device_id:
            url += f"&device_id={data.device_id}"

        response = await client.put(
            url,
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code not in [200, 204]:
            raise HTTPException(status_code=response.status_code, detail="Failed to set volume")

        return {"status": "volume_set", "volume": data.volume_percent}

@router.put("/spotify/seek")
async def seek_to_position(position_ms: int, device_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Seek to position in current track."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        url = f"https://api.spotify.com/v1/me/player/seek?position_ms={position_ms}"
        if device_id:
            url += f"&device_id={device_id}"

        response = await client.put(
            url,
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code not in [200, 204]:
            raise HTTPException(status_code=response.status_code, detail="Failed to seek")

        return {"status": "seeked", "position_ms": position_ms}

@router.get("/spotify/devices")
async def get_devices(user: User = Depends(get_current_user)):
    """Get available playback devices."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.spotify.com/v1/me/player/devices",
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to get devices")

        return response.json()

@router.put("/spotify/shuffle")
async def set_shuffle(state: bool, device_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Toggle shuffle state."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        url = f"https://api.spotify.com/v1/me/player/shuffle?state={str(state).lower()}"
        if device_id:
            url += f"&device_id={device_id}"

        response = await client.put(
            url,
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code not in [200, 204]:
            raise HTTPException(status_code=response.status_code, detail="Failed to set shuffle")

        return {"status": "shuffle_set", "state": state}

@router.put("/spotify/repeat")
async def set_repeat(state: str, device_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Set repeat mode: off, context, or track."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    if state not in ["off", "context", "track"]:
        raise HTTPException(status_code=400, detail="Invalid repeat state. Must be: off, context, or track")

    async with httpx.AsyncClient() as client:
        url = f"https://api.spotify.com/v1/me/player/repeat?state={state}"
        if device_id:
            url += f"&device_id={device_id}"

        response = await client.put(
            url,
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code not in [200, 204]:
            raise HTTPException(status_code=response.status_code, detail="Failed to set repeat")

        return {"status": "repeat_set", "state": state}

@router.get("/spotify/me/playlists")
async def get_user_playlists(limit: int = 50, offset: int = 0, user: User = Depends(get_current_user)):
    """Get current user's playlists."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.spotify.com/v1/me/playlists?limit={limit}&offset={offset}",
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to get playlists")

        data = response.json()
        # Return simplified playlist data
        playlists = []
        for item in data.get("items", []):
            playlists.append({
                "id": item["id"],
                "name": item["name"],
                "description": item.get("description", ""),
                "image": item["images"][0]["url"] if item.get("images") else None,
                "track_count": item["tracks"]["total"],
                "owner": item["owner"]["display_name"],
                "uri": item["uri"]
            })

        return {
            "playlists": playlists,
            "total": data.get("total", 0),
            "offset": offset,
            "limit": limit
        }

@router.get("/spotify/playlists/{playlist_id}/tracks")
async def get_playlist_tracks(playlist_id: str, limit: int = 50, offset: int = 0, user: User = Depends(get_current_user)):
    """Get tracks from a specific playlist."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks?limit={limit}&offset={offset}",
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to get playlist tracks")

        data = response.json()
        # Return simplified track data
        tracks = []
        for item in data.get("items", []):
            track = item.get("track")
            if track and track.get("id"):  # Skip local files and null tracks
                tracks.append({
                    "id": track["id"],
                    "name": track["name"],
                    "artists": [a["name"] for a in track.get("artists", [])],
                    "album": track["album"]["name"] if track.get("album") else "",
                    "album_image": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
                    "duration_ms": track["duration_ms"],
                    "uri": track["uri"]
                })

        return {
            "tracks": tracks,
            "total": data.get("total", 0),
            "offset": offset,
            "limit": limit
        }

@router.get("/spotify/me/tracks")
async def get_saved_tracks(limit: int = 50, offset: int = 0, user: User = Depends(get_current_user)):
    """Get user's saved/liked tracks."""
    token_data = await queries.get_spotify_token(user.user_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="Spotify not connected")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.spotify.com/v1/me/tracks?limit={limit}&offset={offset}",
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to get saved tracks")

        data = response.json()
        # Return simplified track data
        tracks = []
        for item in data.get("items", []):
            track = item.get("track")
            if track and track.get("id"):
                tracks.append({
                    "id": track["id"],
                    "name": track["name"],
                    "artists": [a["name"] for a in track.get("artists", [])],
                    "album": track["album"]["name"] if track.get("album") else "",
                    "album_image": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
                    "duration_ms": track["duration_ms"],
                    "uri": track["uri"],
                    "added_at": item.get("added_at")
                })

        return {
            "tracks": tracks,
            "total": data.get("total", 0),
            "offset": offset,
            "limit": limit
        }
