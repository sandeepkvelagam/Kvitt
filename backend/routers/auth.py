"""
Auth endpoints: health check, session exchange, current user, logout.

Extracted from server.py — pure mechanical move, zero behavior changes.
"""

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, Response, HTTPException
from pydantic import BaseModel

import db as database
from db import queries
from dependencies import User, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["auth"])


class SessionRequest(BaseModel):
    session_id: str


@router.get("/health")
async def health():
    """Cheap health check for load balancers and monitoring. No auth, no DB query."""
    return {"status": "ok", "database": database.get_backend_type(), "version": "2026-03-09-feedback-fix"}


@router.post("/auth/session")
async def create_session(request: SessionRequest, response: Response):
    """Exchange session_id for session_token after OAuth."""
    try:
        auth_service_url = os.environ.get('AUTH_SERVICE_URL', os.environ.get('SUPABASE_URL', ''))
        async with httpx.AsyncClient() as client_http:
            resp = await client_http.get(
                f"{auth_service_url}/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )

            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session ID")

            data = resp.json()
    except httpx.RequestError as e:
        logger.error(f"Auth service error: {e}")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")

    # Create or update user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing_user = await queries.get_user_by_email(data["email"])

    if existing_user:
        user_id = existing_user["user_id"]
        await queries.update_user(user_id, {
            "name": data.get("name", existing_user.get("name")),
            "picture": data.get("picture", existing_user.get("picture"))
        })
    else:
        new_user = {
            "user_id": user_id,
            "email": data["email"],
            "name": data.get("name", "Player"),
            "picture": data.get("picture"),
            "created_at": datetime.now(timezone.utc),
        }
        await queries.insert_user(new_user)

    # Create session
    session_token = data.get("session_token", str(uuid.uuid4()))
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    }
    await queries.insert_user_session(session_doc)

    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )

    user_doc = await queries.get_user(user_id)
    return user_doc


@router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user data."""
    return user.model_dump()


@router.post("/auth/logout")
async def logout():
    """Logout — session is managed by Supabase client-side."""
    return {"message": "Logged out successfully"}
