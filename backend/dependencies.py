"""
Shared FastAPI dependencies — JWT verification, current user extraction.

This module is imported by all routers and by role_middleware.py.
It must NOT import from server.py to avoid circular imports.
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from fastapi import HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import jwt
from jwt import PyJWKClient
from db import queries

logger = logging.getLogger(__name__)

# --- Supabase JWT config ---
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')

jwks_client = None
if SUPABASE_URL:
    try:
        jwks_url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        jwks_client = PyJWKClient(jwks_url)
        logger.info(f"JWKS client initialized: {jwks_url}")
    except Exception as e:
        logger.warning(f"Failed to initialize JWKS client: {e}")


# --- Pydantic models used across routers ---

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    supabase_id: Optional[str] = None
    level: str = "Rookie"
    total_games: int = 0
    total_profit: float = 0.0
    badges: List[str] = []  # List of badge IDs earned
    app_role: str = "user"  # 'user' or 'super_admin'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# --- Shared models used across multiple routers ---

class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    audit_id: str = Field(default_factory=lambda: f"aud_{uuid.uuid4().hex[:12]}")
    entity_type: str  # ledger, game, transaction
    entity_id: str
    action: str  # create, update, delete
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    changed_by: str  # user_id
    reason: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LedgerEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ledger_id: str = Field(default_factory=lambda: f"led_{uuid.uuid4().hex[:12]}")
    group_id: str
    game_id: str
    from_user_id: str
    to_user_id: str
    amount: float
    status: str = "pending"  # pending, paid
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    paid_at: Optional[datetime] = None
    is_locked: bool = False


class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notification_id: str = Field(default_factory=lambda: f"ntf_{uuid.uuid4().hex[:12]}")
    user_id: str
    type: str  # game_invite, settlement_request, game_started, etc.
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# --- Auth helper functions ---

async def verify_supabase_jwt(token: str) -> dict:
    """
    Verify Supabase JWT using either:
    1. New JWKS method (ES256/RS256) - auto-fetches public keys
    2. Legacy secret method (HS256) - uses shared secret
    """
    # Try JWKS method first (ES256 or RS256)
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256"],
                audience="authenticated"
            )
            logger.debug("JWT verified using JWKS")
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except Exception as e:
            logger.debug(f"JWKS verification failed: {e}")

    # Fallback to legacy secret method (HS256)
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
            logger.debug("JWT verified using legacy secret (HS256)")
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except Exception as e:
            logger.debug(f"Legacy secret verification failed: {e}")

    return None


async def get_current_user(request: Request) -> User:
    """Get current authenticated user from Supabase JWT."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]
    payload = await verify_supabase_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    supabase_id = payload.get("sub")
    email = payload.get("email")

    # Find user — should always exist due to DB trigger on auth.users INSERT
    user_doc = await queries.get_user_by_supabase_id(supabase_id)
    if not user_doc and email:
        # Fallback: look up by email (covers pre-trigger existing users)
        user_doc = await queries.get_user_by_email(email)

    if user_doc:
        # Backfill supabase_id if the record was found by email only
        if user_doc.get("supabase_id") != supabase_id:
            await queries.update_user(user_doc["user_id"], {"supabase_id": supabase_id})
        return User(**user_doc)

    # Safety net: create user if the DB trigger didn't fire
    if email:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        name = payload.get("user_metadata", {}).get("full_name") or email.split('@')[0]
        picture = payload.get("user_metadata", {}).get("avatar_url")
        new_user = {
            "user_id": user_id,
            "supabase_id": supabase_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc),
        }
        await queries.insert_user(new_user)
        logger.info(f"Safety-net created user {user_id} for {email}")
        return User(**new_user)

    raise HTTPException(status_code=401, detail="Not authenticated")
