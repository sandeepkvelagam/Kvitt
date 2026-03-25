"""
Kvitt Database Queries — asyncpg implementation.

This module provides typed query methods for all database operations.
All queries use direct SQL via asyncpg against PostgreSQL (Supabase).
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from .pg import get_pool

logger = logging.getLogger(__name__)


# ============================================
# HELPER FUNCTIONS
# ============================================

def _row_to_dict(row) -> Optional[Dict[str, Any]]:
    """Convert asyncpg Record to dict."""
    if row is None:
        return None
    return dict(row)


def _rows_to_list(rows) -> List[Dict[str, Any]]:
    """Convert list of asyncpg Records to list of dicts."""
    return [dict(r) for r in rows] if rows else []


# Known timestamp column names for auto-conversion
_TIMESTAMP_COLUMNS = frozenset({
    "created_at", "updated_at", "joined_at", "timestamp", "started_at", "starts_at",
    "ended_at", "scheduled_at", "paid_at", "cashed_out_at", "responded_at",
    "completed_at", "expires_at", "subscribed_at", "unsubscribed_at",
    "consolidated_at", "resolved_at", "edited_at", "closed_at",
    "generated_at", "rrule_until", "pin_locked_until",
    "premium_until", "premium_started_at", "premium_expired_at",
    "daily_transferred_reset_at",
})


def _parse_dt(val):
    """Convert ISO-format string to datetime if needed. Passes through datetime objects unchanged."""
    if val is None:
        return None
    if isinstance(val, str):
        return datetime.fromisoformat(val)
    return val


def _coerce_timestamps(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert any ISO-format string values for known timestamp columns to datetime objects."""
    out = {}
    for k, v in data.items():
        if k in _TIMESTAMP_COLUMNS and isinstance(v, str):
            out[k] = _parse_dt(v)
        else:
            out[k] = v
    return out



def _build_update_query(table: str, id_column: str, update: Dict[str, Any]) -> tuple:
    """
    Build a parameterized UPDATE query from a dict.
    Returns (query_string, values_list) where the last value is the id.
    """
    update = _coerce_timestamps(update)
    set_parts = []
    values = []
    for i, (k, v) in enumerate(update.items(), 1):
        set_parts.append(f"{k} = ${i}")
        values.append(v)
    query = f"UPDATE {table} SET {', '.join(set_parts)} WHERE {id_column} = ${len(values) + 1}"
    return query, values


async def execute_raw(query: str, *args) -> str:
    """Execute a raw SQL query. Returns status string."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


async def fetch_raw(query: str, *args) -> List[Dict[str, Any]]:
    """Fetch multiple rows with a raw SQL query."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *args)
        return _rows_to_list(rows)


async def fetchrow_raw(query: str, *args) -> Optional[Dict[str, Any]]:
    """Fetch a single row with a raw SQL query."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *args)
        return _row_to_dict(row)


# ============================================
# USERS
# ============================================

async def get_user(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user by user_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM users WHERE user_id = $1",
            user_id
        )
        return _row_to_dict(row)


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get user by email."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM users WHERE email = $1",
            email
        )
        return _row_to_dict(row)


async def get_user_by_supabase_id(supabase_id: str) -> Optional[Dict[str, Any]]:
    """Get user by Supabase auth ID."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM users WHERE supabase_id = $1",
            supabase_id
        )
        return _row_to_dict(row)


async def insert_user(data: Dict[str, Any]) -> None:
    """Insert a new user."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO users (
                user_id, supabase_id, email, name, picture, level,
                total_games, total_profit, badges, is_premium,
                premium_plan, premium_until, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            """,
            data.get("user_id"),
            data.get("supabase_id"),
            data.get("email"),
            data.get("name"),
            data.get("picture"),
            data.get("level", "Rookie"),
            data.get("total_games", 0),
            data.get("total_profit", 0),
            data.get("badges", []),
            data.get("is_premium", False),
            data.get("premium_plan"),
            data.get("premium_until"),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def update_user(user_id: str, update: Dict[str, Any]) -> None:
    """Update user by user_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("users", "user_id", update)
    values.append(user_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


async def find_users(where: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
    """Find users matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        if isinstance(v, list):
            conditions.append(f"{k} = ANY(${i})")
        else:
            conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM users WHERE {where_clause} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


async def find_users_by_ids(user_ids: List[str]) -> List[Dict[str, Any]]:
    """Find users by a list of user_ids."""
    pool = get_pool()
    if not pool or not user_ids:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM users WHERE user_id = ANY($1)",
            user_ids
        )
        return _rows_to_list(rows)


async def search_users(query: str, exclude_user_id: str = None, limit: int = 20) -> List[Dict[str, Any]]:
    """Search users by name or email (case-insensitive regex)."""
    pool = get_pool()
    if not pool:
        return []
    pattern = query
    if exclude_user_id:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM users WHERE (name ~* $1 OR email ~* $1) AND user_id != $2 LIMIT $3",
                pattern, exclude_user_id, limit
            )
            return _rows_to_list(rows)
    else:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM users WHERE (name ~* $1 OR email ~* $1) LIMIT $2",
                pattern, limit
            )
            return _rows_to_list(rows)


async def update_user_push_token(user_id: str, token: str) -> None:
    """Set expo push token for a user."""
    pool = get_pool()
    if not pool:
        return
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET expo_push_token = $1, push_token_updated_at = $2 WHERE user_id = $3",
            token, datetime.now(timezone.utc), user_id
        )


async def clear_user_push_token(user_id: str) -> None:
    """Remove expo push token (on logout)."""
    pool = get_pool()
    if not pool:
        return
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET expo_push_token = NULL, push_token_updated_at = NULL WHERE user_id = $1",
            user_id
        )


async def find_users_with_push_tokens(user_ids: List[str]) -> List[Dict[str, Any]]:
    """Find users who have push tokens from a list of user_ids."""
    pool = get_pool()
    if not pool or not user_ids:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM users WHERE user_id = ANY($1) AND expo_push_token IS NOT NULL",
            user_ids
        )
        return _rows_to_list(rows)


async def delete_users_by_ids(user_ids: List[str]) -> int:
    """Delete users by a list of user_ids. Returns count deleted."""
    pool = get_pool()
    if not pool or not user_ids:
        return 0
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM users WHERE user_id = ANY($1)",
            user_ids
        )
        return int(result.split()[-1]) if result else 0


async def find_duplicate_users_by_email(email: str, exclude_user_id: str) -> List[Dict[str, Any]]:
    """Find other users with the same email (for dedup)."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM users WHERE email = $1 AND user_id != $2",
            email, exclude_user_id
        )
        return _rows_to_list(rows)


async def insert_user_session(data: Dict[str, Any]) -> None:
    """Insert a new user session."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO user_sessions (session_id, user_id, session_token, expires_at, created_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
            """,
            data.get("session_id"),
            data.get("user_id"),
            data.get("session_token"),
            _parse_dt(data.get("expires_at")),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


# ============================================
# GROUPS
# ============================================

async def get_group(group_id: str) -> Optional[Dict[str, Any]]:
    """Get group by group_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM groups WHERE group_id = $1",
            group_id
        )
        return _row_to_dict(row)


async def insert_group(data: Dict[str, Any]) -> None:
    """Insert a new group."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO groups (
                group_id, name, description, created_by,
                default_buy_in, currency, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            data.get("group_id"),
            data.get("name"),
            data.get("description"),
            data.get("created_by"),
            data.get("default_buy_in", 20.0),
            data.get("currency", "USD"),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def update_group(group_id: str, update: Dict[str, Any]) -> None:
    """Update group by group_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("groups", "group_id", update)
    values.append(group_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


async def find_groups(where: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
    """Find groups matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM groups WHERE {where_clause} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


# ============================================
# GROUP MEMBERS
# ============================================

async def get_group_member(group_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Get group member by group_id and user_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2",
            group_id, user_id
        )
        return _row_to_dict(row)


async def insert_group_member(data: Dict[str, Any]) -> None:
    """Insert a new group member."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO group_members (
                member_id, group_id, user_id, role, nickname, joined_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
            """,
            data.get("member_id"),
            data.get("group_id"),
            data.get("user_id"),
            data.get("role", "member"),
            data.get("nickname"),
            _parse_dt(data.get("joined_at", datetime.now(timezone.utc))),
        )


async def update_group_member(group_id: str, user_id: str, update: Dict[str, Any]) -> None:
    """Update group member."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    
    update = _coerce_timestamps(update)
    set_parts = []
    values = []
    for i, (k, v) in enumerate(update.items(), 1):
        set_parts.append(f"{k} = ${i}")
        values.append(v)
    values.extend([group_id, user_id])

    async with pool.acquire() as conn:
        await conn.execute(
            f"UPDATE group_members SET {', '.join(set_parts)} WHERE group_id = ${len(values)-1} AND user_id = ${len(values)}",
            *values
        )


async def delete_group_member(group_id: str, user_id: str) -> None:
    """Delete group member."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2",
            group_id, user_id
        )


async def find_group_members(where: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
    """Find group members matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM group_members WHERE {where_clause} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


async def count_group_members(where: Dict[str, Any]) -> int:
    """Count group members matching criteria."""
    pool = get_pool()
    if not pool:
        return 0
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            f"SELECT COUNT(*) FROM group_members WHERE {where_clause}",
            *values
        )
        return result or 0


async def find_groups_by_ids(group_ids: List[str]) -> List[Dict[str, Any]]:
    """Find groups by a list of group_ids."""
    pool = get_pool()
    if not pool or not group_ids:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM groups WHERE group_id = ANY($1)",
            group_ids
        )
        return _rows_to_list(rows)


async def find_group_members_by_user(user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all group memberships for a user."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM group_members WHERE user_id = $1 LIMIT $2",
            user_id, limit
        )
        return _rows_to_list(rows)


async def find_group_members_by_group(group_id: str, limit: int = 200) -> List[Dict[str, Any]]:
    """Get all members in a group."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM group_members WHERE group_id = $1 LIMIT $2",
            group_id, limit
        )
        return _rows_to_list(rows)


async def count_group_members_for_group(group_id: str) -> int:
    """Count members in a specific group."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            "SELECT COUNT(*) FROM group_members WHERE group_id = $1",
            group_id
        )
        return result or 0


async def get_group_message(message_id: str) -> Optional[Dict[str, Any]]:
    """Get a single group message by message_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM group_messages WHERE message_id = $1",
            message_id
        )
        return _row_to_dict(row)


async def update_group_message(message_id: str, update: Dict[str, Any]) -> None:
    """Update a group message."""
    pool = get_pool()
    if not pool:
        return
    if not update:
        return
    query, values = _build_update_query("group_messages", "message_id", update)
    values.append(message_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


async def find_group_invites_for_user(user_id: str, status: str = "pending", limit: int = 50) -> List[Dict[str, Any]]:
    """Find group invites for a user with a given status.

    Uses precedence: first by invited_user_id (linked invites), then by email
    for legacy invites where invited_user_id was never set.
    """
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        # 1. Query by invited_user_id (linked invites)
        rows = await conn.fetch(
            "SELECT * FROM group_invites WHERE invited_user_id = $1 AND status = $2 "
            "ORDER BY created_at DESC LIMIT $3",
            user_id, status, limit
        )
        # 2. Also get legacy email-based invites (invited_user_id IS NULL)
        user = await conn.fetchrow("SELECT email FROM users WHERE user_id = $1", user_id)
        if user:
            email_rows = await conn.fetch(
                "SELECT * FROM group_invites WHERE email = $1 AND invited_user_id IS NULL "
                "AND status = $2 ORDER BY created_at DESC LIMIT $3",
                user["email"], status, limit
            )
            rows = list(rows) + list(email_rows)
        return _rows_to_list(rows)


async def find_group_invites_by_email(email: str, status: str = "pending", limit: int = 50) -> List[Dict[str, Any]]:
    """Find group invites by email."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM group_invites WHERE email = $1 AND status = $2 LIMIT $3",
            email, status, limit
        )
        return _rows_to_list(rows)


async def find_pending_invite(group_id: str, email: str) -> Optional[Dict[str, Any]]:
    """Find a pending invite for a specific group and email."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM group_invites WHERE group_id = $1 AND email = $2 AND status = 'pending' LIMIT 1",
            group_id, email
        )
        return _row_to_dict(row)


async def find_group_messages_paginated(
    group_id: str,
    before_time: Optional[str] = None,
    limit: int = 50,
    exclude_deleted: bool = True
) -> List[Dict[str, Any]]:
    """Find group messages with cursor-based pagination."""
    pool = get_pool()
    if not pool:
        return []
    conditions = ["group_id = $1"]
    values: list = [group_id]
    idx = 2
    if exclude_deleted:
        conditions.append("(deleted IS NULL OR deleted = FALSE)")
    if before_time:
        conditions.append(f"created_at < ${idx}")
        values.append(_parse_dt(before_time))
        idx += 1
    values.append(limit)
    where = " AND ".join(conditions)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM group_messages WHERE {where} ORDER BY created_at DESC LIMIT ${idx}",
            *values
        )
        return _rows_to_list(rows)


# ============================================
# GAME NIGHTS
# ============================================

async def get_game_night(game_id: str) -> Optional[Dict[str, Any]]:
    """Get game night by game_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM game_nights WHERE game_id = $1",
            game_id
        )
        return _row_to_dict(row)


async def insert_game_night(data: Dict[str, Any]) -> None:
    """Insert a new game night."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO game_nights (
                game_id, group_id, host_id, title, location, status,
                chip_value, chips_per_buy_in, buy_in_amount,
                scheduled_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """,
            data.get("game_id"),
            data.get("group_id"),
            data.get("host_id"),
            data.get("title"),
            data.get("location"),
            data.get("status", "scheduled"),
            data.get("chip_value", 1.0),
            data.get("chips_per_buy_in", 20),
            data.get("buy_in_amount", 20.0),
            _parse_dt(data.get("scheduled_at")),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def update_game_night(game_id: str, update: Dict[str, Any], conn=None) -> None:
    """Update game night by game_id."""
    if not update:
        return
    query, values = _build_update_query("game_nights", "game_id", update)
    values.append(game_id)
    if conn:
        await conn.execute(query, *values)
    else:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        async with pool.acquire() as c:
            await c.execute(query, *values)


async def find_game_nights(
    where: Dict[str, Any],
    order_by: str = "created_at DESC",
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Find game nights matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        if isinstance(v, list):
            conditions.append(f"{k} = ANY(${i})")
        else:
            conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM game_nights WHERE {where_clause} ORDER BY {order_by} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


async def find_game_nights_by_group_ids(
    group_ids: List[str],
    group_id: str = None,
    order_by: str = "created_at DESC",
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Find game nights for a list of group_ids (optionally filtered to one)."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        if group_id:
            rows = await conn.fetch(
                f"SELECT * FROM game_nights WHERE group_id = $1 ORDER BY {order_by} LIMIT $2",
                group_id, limit
            )
        else:
            rows = await conn.fetch(
                f"SELECT * FROM game_nights WHERE group_id = ANY($1) ORDER BY {order_by} LIMIT $2",
                group_ids, limit
            )
        return _rows_to_list(rows)


async def find_active_games_by_group(group_id: str) -> List[Dict[str, Any]]:
    """Find active games in a group."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM game_nights WHERE group_id = $1 AND status = 'active'",
            group_id
        )
        return _rows_to_list(rows)


async def increment_game_night_field(game_id: str, field: str, amount, conn=None) -> None:
    """Increment a numeric field on a game night."""
    allowed_fields = {"total_chips_distributed", "total_chips_returned"}
    if field not in allowed_fields:
        raise ValueError(f"Field {field} not allowed for increment")
    sql = f"UPDATE game_nights SET {field} = COALESCE({field}, 0) + $1 WHERE game_id = $2"
    if conn:
        await conn.execute(sql, amount, game_id)
    else:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        async with pool.acquire() as c:
            await c.execute(sql, amount, game_id)


async def count_game_nights(where: Dict[str, Any]) -> int:
    """Count game nights matching criteria."""
    pool = get_pool()
    if not pool:
        return 0

    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        if isinstance(v, list):
            conditions.append(f"{k} = ANY(${i})")
        else:
            conditions.append(f"{k} = ${i}")
        values.append(v)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    async with pool.acquire() as conn:
        result = await conn.fetchval(
            f"SELECT COUNT(*) FROM game_nights WHERE {where_clause}",
            *values
        )
        return result or 0


# ============================================
# PLAYERS
# ============================================

async def get_player(player_id: str) -> Optional[Dict[str, Any]]:
    """Get player by player_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM players WHERE player_id = $1",
            player_id
        )
        return _row_to_dict(row)


async def get_player_by_game_user(game_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Get player by game_id and user_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM players WHERE game_id = $1 AND user_id = $2",
            game_id, user_id
        )
        return _row_to_dict(row)


async def insert_player(data: Dict[str, Any], conn=None) -> None:
    """Insert a new player."""
    sql = """
        INSERT INTO players (
            player_id, game_id, user_id, total_buy_in, total_chips,
            chips_returned, cash_out, net_result, rsvp_status, joined_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    """
    args = (
        data.get("player_id"),
        data.get("game_id"),
        data.get("user_id"),
        data.get("total_buy_in", 0),
        data.get("total_chips", 0),
        data.get("chips_returned"),
        data.get("cash_out"),
        data.get("net_result"),
        data.get("rsvp_status", "pending"),
        _parse_dt(data.get("joined_at", datetime.now(timezone.utc))),
    )
    if conn:
        await conn.execute(sql, *args)
    else:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        async with pool.acquire() as c:
            await c.execute(sql, *args)


async def update_player(player_id: str, update: Dict[str, Any]) -> None:
    """Update player by player_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("players", "player_id", update)
    values.append(player_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


async def find_players(where: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
    """Find players matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM players WHERE {where_clause} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


async def update_player_by_game_user(game_id: str, user_id: str, update: Dict[str, Any], conn=None) -> int:
    """Update player by game_id and user_id. Returns number of rows modified."""
    if not update:
        return 0
    update = _coerce_timestamps(update)
    sets = []
    values = []
    for i, (k, v) in enumerate(update.items(), 1):
        sets.append(f"{k} = ${i}")
        values.append(v)
    n = len(values)
    values.extend([game_id, user_id])
    sql = f"UPDATE players SET {', '.join(sets)} WHERE game_id = ${n+1} AND user_id = ${n+2}"
    if conn:
        result = await conn.execute(sql, *values)
    else:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        async with pool.acquire() as c:
            result = await c.execute(sql, *values)
    # asyncpg returns "UPDATE N" string
    return int(result.split()[-1])


async def update_player_by_game_user_rsvp(
    game_id: str, user_id: str, rsvp_status: str, update: Dict[str, Any]
) -> int:
    """Update player by game_id, user_id, and rsvp_status filter. Returns rows modified."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return 0
    sets = []
    values = []
    for i, (k, v) in enumerate(update.items(), 1):
        sets.append(f"{k} = ${i}")
        values.append(v)
    n = len(values)
    values.extend([game_id, user_id, rsvp_status])
    async with pool.acquire() as conn:
        result = await conn.execute(
            f"UPDATE players SET {', '.join(sets)} WHERE game_id = ${n+1} AND user_id = ${n+2} AND rsvp_status = ${n+3}",
            *values
        )
        return int(result.split()[-1])


async def increment_player_fields(game_id: str, user_id: str, increments: Dict[str, Any]) -> int:
    """Increment numeric fields on a player. Returns rows modified."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not increments:
        return 0
    sets = []
    values = []
    for i, (k, v) in enumerate(increments.items(), 1):
        sets.append(f"{k} = COALESCE({k}, 0) + ${i}")
        values.append(v)
    n = len(values)
    values.extend([game_id, user_id])
    async with pool.acquire() as conn:
        result = await conn.execute(
            f"UPDATE players SET {', '.join(sets)} WHERE game_id = ${n+1} AND user_id = ${n+2}",
            *values
        )
        return int(result.split()[-1])


async def delete_player_by_game_user(game_id: str, user_id: str, rsvp_status: str = None) -> int:
    """Delete player by game_id and user_id. Optionally filter by rsvp_status. Returns rows deleted."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        if rsvp_status:
            result = await conn.execute(
                "DELETE FROM players WHERE game_id = $1 AND user_id = $2 AND rsvp_status = $3",
                game_id, user_id, rsvp_status
            )
        else:
            result = await conn.execute(
                "DELETE FROM players WHERE game_id = $1 AND user_id = $2",
                game_id, user_id
            )
        return int(result.split()[-1])


async def find_players_by_game(game_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Find all players in a game."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM players WHERE game_id = $1 LIMIT $2",
            game_id, limit
        )
        return _rows_to_list(rows)


async def find_players_by_game_with_buyin(game_id: str, min_buyin: float = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Find players in a game with total_buy_in > min_buyin."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM players WHERE game_id = $1 AND total_buy_in > $2 LIMIT $3",
            game_id, min_buyin, limit
        )
        return _rows_to_list(rows)


async def find_players_by_game_rsvp(game_id: str, rsvp_status: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Find players in a game with a specific rsvp_status."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM players WHERE game_id = $1 AND rsvp_status = $2 LIMIT $3",
            game_id, rsvp_status, limit
        )
        return _rows_to_list(rows)


async def find_players_by_game_active(game_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Find players in a game with rsvp_status in ('yes', 'pending')."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM players WHERE game_id = $1 AND rsvp_status IN ('yes', 'pending') LIMIT $2",
            game_id, limit
        )
        return _rows_to_list(rows)


async def find_players_by_user(user_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
    """Find all player records for a user."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM players WHERE user_id = $1 LIMIT $2",
            user_id, limit
        )
        return _rows_to_list(rows)


async def find_players_by_user_with_results(user_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
    """Find player records for a user where net_result is not null."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM players WHERE user_id = $1 AND net_result IS NOT NULL LIMIT $2",
            user_id, limit
        )
        return _rows_to_list(rows)


async def get_player_stats_by_games(game_ids: List[str]) -> List[Dict[str, Any]]:
    """Get player count and total pot per game."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT game_id, COUNT(*) as count, COALESCE(SUM(total_buy_in), 0) as total_pot
            FROM players
            WHERE game_id = ANY($1)
            GROUP BY game_id
            """,
            game_ids
        )
        return _rows_to_list(rows)


async def find_players_by_games_user(game_ids: List[str], user_id: str) -> List[Dict[str, Any]]:
    """Find user's player records across multiple games."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM players WHERE game_id = ANY($1) AND user_id = $2",
            game_ids, user_id
        )
        return _rows_to_list(rows)


async def count_players_by_game_rsvp(game_id: str, rsvp_status: str) -> int:
    """Count players in a game with a specific rsvp_status."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            "SELECT COUNT(*) FROM players WHERE game_id = $1 AND rsvp_status = $2",
            game_id, rsvp_status
        )
        return result or 0


async def get_leaderboard_by_games(game_ids: List[str], limit: int = 100) -> List[Dict[str, Any]]:
    """Get leaderboard stats across multiple games."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT user_id, COUNT(*) as total_games,
                   COALESCE(SUM(net_result), 0) as total_profit,
                   COALESCE(SUM(total_buy_in), 0) as total_buy_in
            FROM players
            WHERE game_id = ANY($1) AND net_result IS NOT NULL
            GROUP BY user_id
            ORDER BY total_profit DESC
            LIMIT $2
            """,
            game_ids, limit
        )
        return _rows_to_list(rows)


async def get_frequent_players_by_games(game_ids: List[str], limit: int = 10) -> List[Dict[str, Any]]:
    """Get player frequency stats across multiple games."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT user_id, COUNT(*) as game_count
            FROM players
            WHERE game_id = ANY($1)
            GROUP BY user_id
            ORDER BY game_count DESC
            LIMIT $2
            """,
            game_ids, limit
        )
        return _rows_to_list(rows)


async def find_players_by_user_ids(user_ids: List[str], limit: int = 100) -> List[Dict[str, Any]]:
    """Find player records for multiple user_ids."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM players WHERE user_id = ANY($1) LIMIT $2",
            user_ids, limit
        )
        return _rows_to_list(rows)


async def update_players_user_id(old_user_ids: List[str], new_user_id: str) -> int:
    """Reassign player records from old user_ids to a new user_id. Returns rows updated."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE players SET user_id = $1 WHERE user_id = ANY($2)",
            new_user_id, old_user_ids
        )
        return int(result.split()[-1])


async def count_players(where: Dict[str, Any]) -> int:
    """Count players matching criteria."""
    pool = get_pool()
    if not pool:
        return 0
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            f"SELECT COUNT(*) FROM players WHERE {where_clause}",
            *values
        )
        return result or 0


# ============================================
# TRANSACTIONS
# ============================================

async def get_transaction(transaction_id: str) -> Optional[Dict[str, Any]]:
    """Get transaction by transaction_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM transactions WHERE transaction_id = $1",
            transaction_id
        )
        return _row_to_dict(row)


async def insert_transaction(data: Dict[str, Any], conn=None) -> None:
    """Insert a new transaction."""
    sql = """
        INSERT INTO transactions (
            transaction_id, game_id, user_id, type,
            amount, chips, chip_value, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    """
    args = (
        data.get("transaction_id"),
        data.get("game_id"),
        data.get("user_id"),
        data.get("type"),
        data.get("amount"),
        data.get("chips"),
        data.get("chip_value"),
        data.get("notes"),
        _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
    )
    if conn:
        await conn.execute(sql, *args)
    else:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        async with pool.acquire() as c:
            await c.execute(sql, *args)


async def find_transactions_by_game(game_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
    """Find all transactions for a game."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM transactions WHERE game_id = $1 ORDER BY created_at DESC LIMIT $2",
            game_id, limit
        )
        return _rows_to_list(rows)


async def find_transactions(where: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
    """Find transactions matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM transactions WHERE {where_clause} ORDER BY created_at DESC LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


async def update_transactions_user_id(old_user_ids: List[str], new_user_id: str) -> int:
    """Reassign transaction records from old user_ids to a new user_id."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE transactions SET user_id = $1 WHERE user_id = ANY($2)",
            new_user_id, old_user_ids
        )
        return int(result.split()[-1])


async def update_game_threads_user_id(old_user_ids: List[str], new_user_id: str) -> int:
    """Reassign game thread records from old user_ids to a new user_id."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE game_threads SET user_id = $1 WHERE user_id = ANY($2)",
            new_user_id, old_user_ids
        )
        return int(result.split()[-1])


# ============================================
# GAME THREADS
# ============================================

async def insert_game_thread(data: Dict[str, Any], conn=None) -> None:
    """Insert a game thread message."""
    sql = """
        INSERT INTO game_threads (
            message_id, game_id, user_id, content, type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
    """
    args = (
        data.get("message_id"),
        data.get("game_id"),
        data.get("user_id"),
        data.get("content"),
        data.get("type", "user"),
        _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
    )
    if conn:
        await conn.execute(sql, *args)
    else:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        async with pool.acquire() as c:
            await c.execute(sql, *args)


async def find_game_threads_by_game(
    game_id: str, limit: int = 100, order_by: str = "created_at DESC"
) -> List[Dict[str, Any]]:
    """Find game thread messages for a game."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM game_threads WHERE game_id = $1 ORDER BY {order_by} LIMIT $2",
            game_id, limit
        )
        return _rows_to_list(rows)


# ============================================
# LEDGER ENTRIES
# ============================================

async def get_ledger_entry(ledger_id: str) -> Optional[Dict[str, Any]]:
    """Get ledger entry by ledger_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM ledger_entries WHERE ledger_id = $1",
            ledger_id
        )
        return _row_to_dict(row)


async def insert_ledger_entry(data: Dict[str, Any]) -> None:
    """Insert a new ledger entry."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO ledger_entries (
                ledger_id, group_id, game_id, from_user_id, to_user_id,
                amount, status, paid_at, is_locked, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            data.get("ledger_id"),
            data.get("group_id"),
            data.get("game_id"),
            data.get("from_user_id"),
            data.get("to_user_id"),
            data.get("amount"),
            data.get("status", "pending"),
            _parse_dt(data.get("paid_at")),
            data.get("is_locked", False),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def update_ledger_entry(ledger_id: str, update: Dict[str, Any]) -> None:
    """Update ledger entry by ledger_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("ledger_entries", "ledger_id", update)
    values.append(ledger_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


async def delete_ledger_entries_by_game(game_id: str) -> None:
    """Delete all ledger entries for a game."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM ledger_entries WHERE game_id = $1",
            game_id
        )


async def find_ledger_entries(
    where: Dict[str, Any],
    order_by: str = "created_at DESC",
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Find ledger entries matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        if isinstance(v, list):
            conditions.append(f"{k} = ANY(${i})")
        else:
            conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM ledger_entries WHERE {where_clause} ORDER BY {order_by} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


async def count_ledger_entries(where: Dict[str, Any]) -> int:
    """Count ledger entries matching criteria."""
    pool = get_pool()
    if not pool:
        return 0

    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    async with pool.acquire() as conn:
        result = await conn.fetchval(
            f"SELECT COUNT(*) FROM ledger_entries WHERE {where_clause}",
            *values
        )
        return result or 0


async def find_ledger_entries_by_game(game_id: str) -> List[Dict[str, Any]]:
    """Find all ledger entries for a game."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM ledger_entries WHERE game_id = $1 ORDER BY created_at DESC",
            game_id
        )
        return _rows_to_list(rows)


async def find_ledger_entries_by_user(
    user_id: str,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Find ledger entries where user is from_user_id or to_user_id."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        if status:
            rows = await conn.fetch(
                "SELECT * FROM ledger_entries WHERE (from_user_id = $1 OR to_user_id = $1) AND status = $2 ORDER BY created_at DESC",
                user_id, status
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM ledger_entries WHERE (from_user_id = $1 OR to_user_id = $1) ORDER BY created_at DESC",
                user_id
            )
        return _rows_to_list(rows)


async def update_ledger_entries_user_id(
    old_user_ids: List[str],
    new_user_id: str
) -> None:
    """Reassign ledger entries from old user IDs to new user ID (merge/dedup)."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not old_user_ids:
        return
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE ledger_entries SET from_user_id = $1 WHERE from_user_id = ANY($2)",
            new_user_id, old_user_ids
        )
        await conn.execute(
            "UPDATE ledger_entries SET to_user_id = $1 WHERE to_user_id = ANY($2)",
            new_user_id, old_user_ids
        )


# ============================================
# WALLETS
# ============================================

async def get_wallet(wallet_id: str) -> Optional[Dict[str, Any]]:
    """Get wallet by wallet_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM wallets WHERE wallet_id = $1",
            wallet_id
        )
        return _row_to_dict(row)


async def get_wallet_by_user(user_id: str) -> Optional[Dict[str, Any]]:
    """Get wallet by user_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM wallets WHERE user_id = $1",
            user_id
        )
        return _row_to_dict(row)


async def insert_wallet(data: Dict[str, Any]) -> None:
    """Insert a new wallet."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO wallets (
                wallet_id, user_id, balance_cents, status,
                pin_hash, version, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            data.get("wallet_id"),
            data.get("user_id"),
            data.get("balance_cents", 0),
            data.get("status", "active"),
            data.get("pin_hash"),
            data.get("version", 1),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def update_wallet(wallet_id: str, update: Dict[str, Any]) -> None:
    """Update wallet by wallet_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("wallets", "wallet_id", update)
    values.append(wallet_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


async def find_wallets(where: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
    """Find wallets matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM wallets WHERE {where_clause} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


async def insert_wallet_withdrawal(data: Dict[str, Any]) -> None:
    """Insert a wallet withdrawal record."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO wallet_withdrawals ({', '.join(columns)}) VALUES ({', '.join(placeholders)})",
            *data.values()
        )


async def find_wallet_withdrawals(user_id: str) -> List[Dict[str, Any]]:
    """Find all wallet withdrawals for a user."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM wallet_withdrawals WHERE user_id = $1 ORDER BY created_at DESC",
            user_id
        )
        return _rows_to_list(rows)


# ============================================
# WALLET TRANSACTIONS
# ============================================

async def get_wallet_transaction(transaction_id: str) -> Optional[Dict[str, Any]]:
    """Get wallet transaction by transaction_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM wallet_transactions WHERE transaction_id = $1",
            transaction_id
        )
        return _row_to_dict(row)


async def insert_wallet_transaction(data: Dict[str, Any]) -> None:
    """Insert a new wallet transaction."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO wallet_transactions (
                transaction_id, wallet_id, type, amount_cents, direction,
                balance_before_cents, balance_after_cents,
                stripe_payment_intent_id, counterparty_wallet_id,
                counterparty_user_id, description, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            """,
            data.get("transaction_id"),
            data.get("wallet_id"),
            data.get("type"),
            data.get("amount_cents"),
            data.get("direction"),
            data.get("balance_before_cents"),
            data.get("balance_after_cents"),
            data.get("stripe_payment_intent_id"),
            data.get("counterparty_wallet_id"),
            data.get("counterparty_user_id"),
            data.get("description"),
            data.get("status", "completed"),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def insert_wallet_transactions(transactions: List[Dict[str, Any]]) -> None:
    """Insert multiple wallet transactions."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    for txn in transactions:
        await insert_wallet_transaction(txn)


async def find_wallet_transactions(
    where: Dict[str, Any],
    order_by: str = "created_at DESC",
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Find wallet transactions matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM wallet_transactions WHERE {where_clause} ORDER BY {order_by} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


async def count_wallet_transactions(where: Dict[str, Any]) -> int:
    """Count wallet transactions matching criteria."""
    pool = get_pool()
    if not pool:
        return 0
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            f"SELECT COUNT(*) FROM wallet_transactions WHERE {where_clause}",
            *values
        )
        return result or 0


# ============================================
# NOTIFICATIONS
# ============================================

async def get_notification(notification_id: str) -> Optional[Dict[str, Any]]:
    """Get notification by notification_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM notifications WHERE notification_id = $1",
            notification_id
        )
        return _row_to_dict(row)


async def insert_notification(data: Dict[str, Any]) -> None:
    """Insert a new notification."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO notifications (
                notification_id, user_id, type, title, message, data, read, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            data.get("notification_id"),
            data.get("user_id"),
            data.get("type"),
            data.get("title"),
            data.get("message"),
            data.get("data"),
            data.get("read", False),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def update_notification(notification_id: str, update: Dict[str, Any]) -> int:
    """Update notification by notification_id. Returns rows updated."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return 0
    query, values = _build_update_query("notifications", "notification_id", update)
    values.append(notification_id)
    async with pool.acquire() as conn:
        result = await conn.execute(query, *values)
        return int(result.split()[-1])


async def find_notifications(
    where: Dict[str, Any],
    order_by: str = "created_at DESC",
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Find notifications matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM notifications WHERE {where_clause} ORDER BY {order_by} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


async def mark_all_notifications_read(user_id: str) -> int:
    """Mark all unread notifications as read for a user."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE",
            user_id
        )
        return int(result.split()[-1])


async def count_unread_notifications(user_id: str) -> int:
    """Count unread notifications for a user."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE",
            user_id
        )
        return result or 0


async def delete_notification(notification_id: str, user_id: str) -> int:
    """Delete a notification by id and user. Returns rows deleted."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM notifications WHERE notification_id = $1 AND user_id = $2",
            notification_id, user_id
        )
        return int(result.split()[-1])


async def find_notifications_by_user_ids(user_ids: List[str], limit: int = 50) -> List[Dict[str, Any]]:
    """Find notifications for multiple user_ids."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM notifications WHERE user_id = ANY($1) LIMIT $2",
            user_ids, limit
        )
        return _rows_to_list(rows)


async def update_notifications_user_id(old_user_ids: List[str], new_user_id: str) -> int:
    """Reassign notification records from old user_ids to a new user_id."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE notifications SET user_id = $1 WHERE user_id = ANY($2)",
            new_user_id, old_user_ids
        )
        return int(result.split()[-1])


# ============================================
# GROUP MESSAGES
# ============================================

async def insert_group_message(data: Dict[str, Any]) -> None:
    """Insert a new group message."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO group_messages (
                message_id, group_id, user_id, content, type,
                reply_to, metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            data.get("message_id"),
            data.get("group_id"),
            data.get("user_id"),
            data.get("content"),
            data.get("type", "user"),
            data.get("reply_to"),
            data.get("metadata"),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def find_group_messages(
    where: Dict[str, Any],
    order_by: str = "created_at DESC",
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Find group messages matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM group_messages WHERE {where_clause} ORDER BY {order_by} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


# ============================================
# GROUP INVITES
# ============================================

async def get_group_invite(invite_id: str) -> Optional[Dict[str, Any]]:
    """Get group invite by invite_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM group_invites WHERE invite_id = $1",
            invite_id
        )
        return _row_to_dict(row)


async def insert_group_invite(data: Dict[str, Any]) -> None:
    """Insert a new group invite."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO group_invites (
                invite_id, group_id, email, invited_by, invited_user_id, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            data.get("invite_id"),
            data.get("group_id"),
            data.get("invited_email") or data.get("email"),
            data.get("invited_by"),
            data.get("invited_user_id"),
            data.get("status", "pending"),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def update_group_invite(invite_id: str, update: Dict[str, Any]) -> None:
    """Update group invite by invite_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("group_invites", "invite_id", update)
    values.append(invite_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


async def find_group_invites(where: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
    """Find group invites matching criteria."""
    pool = get_pool()
    if not pool:
        return []
    
    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM group_invites WHERE {where_clause} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


# ============================================
# USER SESSIONS
# ============================================
# NOTE: insert_user_session() is defined earlier (line ~315) with ON CONFLICT DO NOTHING.
# Do NOT redefine it here — Python would silently overwrite the safe version.


async def get_user_session(session_token: str) -> Optional[Dict[str, Any]]:
    """Get user session by session_token."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM user_sessions WHERE session_token = $1",
            session_token
        )
        return _row_to_dict(row)


async def delete_user_sessions(session_token: str) -> None:
    """Delete user sessions by session_token."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM user_sessions WHERE session_token = $1",
            session_token
        )


# ============================================
# PAYMENT TRANSACTIONS (Stripe premium)
# ============================================

async def get_payment_transaction(session_id: str) -> Optional[Dict[str, Any]]:
    """Get payment transaction by session_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM payment_transactions WHERE session_id = $1",
            session_id
        )
        return _row_to_dict(row)


async def insert_payment_transaction(data: Dict[str, Any]) -> None:
    """Insert a new payment transaction."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO payment_transactions (
                transaction_id, session_id, user_id, user_email,
                plan_id, plan_name, amount, currency, status,
                payment_status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            """,
            data.get("transaction_id"),
            data.get("session_id"),
            data.get("user_id"),
            data.get("user_email"),
            data.get("plan_id"),
            data.get("plan_name"),
            data.get("amount"),
            data.get("currency", "usd"),
            data.get("status", "pending"),
            data.get("payment_status", "initiated"),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
            _parse_dt(data.get("updated_at", datetime.now(timezone.utc))),
        )


async def update_payment_transaction(session_id: str, update: Dict[str, Any]) -> None:
    """Update payment transaction by session_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("payment_transactions", "session_id", update)
    values.append(session_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


# ============================================
# DEBT PAYMENTS (Stripe game settlement)
# ============================================

async def get_debt_payment(session_id: str) -> Optional[Dict[str, Any]]:
    """Get debt payment by session_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM debt_payments WHERE session_id = $1",
            session_id
        )
        return _row_to_dict(row)


async def insert_debt_payment(data: Dict[str, Any]) -> None:
    """Insert a new debt payment."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO debt_payments (
                payment_id, session_id, ledger_id, from_user_id,
                from_user_email, to_user_id, to_user_name, game_id,
                amount, currency, status, payment_status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            """,
            data.get("payment_id"),
            data.get("session_id"),
            data.get("ledger_id"),
            data.get("from_user_id"),
            data.get("from_user_email"),
            data.get("to_user_id"),
            data.get("to_user_name"),
            data.get("game_id"),
            data.get("amount"),
            data.get("currency", "usd"),
            data.get("status", "pending"),
            data.get("payment_status", "initiated"),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
            _parse_dt(data.get("updated_at", datetime.now(timezone.utc))),
        )


async def update_debt_payment(session_id: str, update: Dict[str, Any]) -> None:
    """Update debt payment by session_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("debt_payments", "session_id", update)
    values.append(session_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


# ============================================
# WALLET DEPOSITS (Stripe wallet top-up)
# ============================================

async def get_wallet_deposit(stripe_session_id: str) -> Optional[Dict[str, Any]]:
    """Get wallet deposit by stripe_session_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM wallet_deposits WHERE stripe_session_id = $1",
            stripe_session_id
        )
        return _row_to_dict(row)


async def insert_wallet_deposit(data: Dict[str, Any]) -> None:
    """Insert a new wallet deposit."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO wallet_deposits (
                deposit_id, wallet_id, user_id, amount_cents,
                stripe_session_id, status, expires_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            data.get("deposit_id"),
            data.get("wallet_id"),
            data.get("user_id"),
            data.get("amount_cents"),
            data.get("stripe_session_id"),
            data.get("status", "pending"),
            _parse_dt(data.get("expires_at")),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def update_wallet_deposit(stripe_session_id: str, update: Dict[str, Any]) -> None:
    """Update wallet deposit by stripe_session_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("wallet_deposits", "stripe_session_id", update)
    values.append(stripe_session_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


# ============================================
# WALLET AUDIT
# ============================================

async def insert_wallet_audit(data: Dict[str, Any]) -> None:
    """Insert a new wallet audit entry."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO wallet_audit (
                audit_id, wallet_id, user_id, action,
                old_value, new_value, risk_score, risk_flags,
                ip_address, user_agent, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """,
            data.get("audit_id"),
            data.get("wallet_id"),
            data.get("user_id"),
            data.get("action"),
            data.get("old_value"),
            data.get("new_value"),
            data.get("risk_score"),
            data.get("risk_flags"),
            data.get("ip_address"),
            data.get("user_agent"),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


# ============================================
# AUDIT LOGS
# ============================================

async def insert_audit_log(data: Dict[str, Any]) -> None:
    """Insert a new audit log entry."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO audit_logs (
                audit_id, entity_type, entity_id, action,
                old_value, new_value, changed_by, reason, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            data.get("audit_id"),
            data.get("entity_type"),
            data.get("entity_id"),
            data.get("action"),
            data.get("old_value"),
            data.get("new_value"),
            data.get("changed_by"),
            data.get("reason"),
            _parse_dt(data.get("created_at", datetime.now(timezone.utc))),
        )


async def find_audit_logs(
    where: Dict[str, Any],
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Find audit logs matching criteria."""
    pool = get_pool()
    if not pool:
        return []

    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM audit_logs WHERE {where_clause} ORDER BY created_at DESC LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


# ============================================
# SETTLEMENT
# ============================================

async def insert_settlement_run(data: Dict[str, Any]) -> None:
    """Insert a settlement run record."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO settlement_runs ({', '.join(columns)}) VALUES ({', '.join(placeholders)})",
            *data.values()
        )


async def count_settlement_runs_by_game(game_id: str) -> int:
    """Count settlement runs for a game."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            "SELECT COUNT(*) FROM settlement_runs WHERE game_id = $1",
            game_id
        )
        return result or 0


async def insert_settlement_dispute(data: Dict[str, Any]) -> None:
    """Insert a settlement dispute record."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO settlement_disputes ({', '.join(columns)}) VALUES ({', '.join(placeholders)})",
            *data.values()
        )


async def get_settlement_dispute(dispute_id: str) -> Optional[Dict[str, Any]]:
    """Get settlement dispute by dispute_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM settlement_disputes WHERE dispute_id = $1",
            dispute_id
        )
        return _row_to_dict(row)


async def update_settlement_dispute(dispute_id: str, update: Dict[str, Any]) -> None:
    """Update settlement dispute by dispute_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("settlement_disputes", "dispute_id", update)
    values.append(dispute_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


async def find_settlement_disputes_by_game(game_id: str) -> List[Dict[str, Any]]:
    """Find settlement disputes for a game."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM settlement_disputes WHERE game_id = $1 ORDER BY created_at DESC",
            game_id
        )
        return _rows_to_list(rows)


# ============================================
# SPOTIFY TOKENS
# ============================================

async def get_spotify_token(user_id: str) -> Optional[Dict[str, Any]]:
    """Get Spotify token by user_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM spotify_tokens WHERE user_id = $1",
            user_id
        )
        return _row_to_dict(row)


async def upsert_spotify_token(user_id: str, data: Dict[str, Any]) -> None:
    """Upsert Spotify token for a user."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data["user_id"] = user_id
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    update_parts = [f"{col} = EXCLUDED.{col}" for col in columns if col != "user_id"]
    async with pool.acquire() as conn:
        await conn.execute(
            f"""INSERT INTO spotify_tokens ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
                ON CONFLICT (user_id) DO UPDATE SET {', '.join(update_parts)}""",
            *data.values()
        )


async def delete_spotify_token(user_id: str) -> None:
    """Delete Spotify token for a user."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM spotify_tokens WHERE user_id = $1",
            user_id
        )


# ============================================
# POLLS
# ============================================

async def insert_poll(data: Dict[str, Any]) -> None:
    """Insert a new poll."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO polls ({', '.join(columns)}) VALUES ({', '.join(placeholders)})",
            *data.values()
        )


async def get_poll(poll_id: str) -> Optional[Dict[str, Any]]:
    """Get poll by poll_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM polls WHERE poll_id = $1",
            poll_id
        )
        return _row_to_dict(row)


async def update_poll(poll_id: str, update: Dict[str, Any]) -> None:
    """Update poll by poll_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("polls", "poll_id", update)
    values.append(poll_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


async def find_polls_by_group(group_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Find polls for a group."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM polls WHERE group_id = $1 ORDER BY created_at DESC LIMIT $2",
            group_id, limit
        )
        return _rows_to_list(rows)


# ============================================
# AI / ASSISTANT
# ============================================

async def insert_poker_analysis_log(data: Dict[str, Any]) -> None:
    """Insert a poker analysis log entry."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO poker_analysis_logs ({', '.join(columns)}) VALUES ({', '.join(placeholders)})",
            *data.values()
        )


async def find_poker_analysis_logs(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Find poker analysis logs for a user."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM poker_analysis_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
            user_id, limit
        )
        return _rows_to_list(rows)


async def insert_assistant_event(data: Dict[str, Any]) -> None:
    """Insert an assistant event."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO assistant_events ({', '.join(columns)}) VALUES ({', '.join(placeholders)})",
            *data.values()
        )


async def find_assistant_events(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Find assistant events for a user."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM assistant_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
            user_id, limit
        )
        return _rows_to_list(rows)


async def get_group_ai_settings(group_id: str) -> Optional[Dict[str, Any]]:
    """Get AI settings for a group."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM group_ai_settings WHERE group_id = $1",
            group_id
        )
        return _row_to_dict(row)


async def get_host_persona_settings(user_id: str) -> Optional[Dict[str, Any]]:
    """Get host persona settings for a user."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM host_persona_settings WHERE user_id = $1",
            user_id
        )
        return _row_to_dict(row)


async def upsert_host_persona_settings(user_id: str, data: Dict[str, Any]) -> None:
    """Upsert host persona settings for a user."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data["user_id"] = user_id
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    update_parts = [f"{col} = EXCLUDED.{col}" for col in columns if col != "user_id"]
    async with pool.acquire() as conn:
        await conn.execute(
            f"""INSERT INTO host_persona_settings ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
                ON CONFLICT (user_id) DO UPDATE SET {', '.join(update_parts)}""",
            *data.values()
        )


async def insert_host_decision(data: Dict[str, Any]) -> None:
    """Insert a host decision record."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO host_decisions ({', '.join(columns)}) VALUES ({', '.join(placeholders)})",
            *data.values()
        )


async def get_host_decision(decision_id: str) -> Optional[Dict[str, Any]]:
    """Get host decision by decision_id."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM host_decisions WHERE decision_id = $1",
            decision_id
        )
        return _row_to_dict(row)


async def update_host_decision(decision_id: str, update: Dict[str, Any]) -> None:
    """Update host decision by decision_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("host_decisions", "decision_id", update)
    values.append(decision_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


async def find_pending_host_decisions(host_id: str) -> List[Dict[str, Any]]:
    """Find pending host decisions for a host."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM host_decisions WHERE host_id = $1 AND status = 'pending' ORDER BY created_at DESC",
            host_id
        )
        return _rows_to_list(rows)


# ============================================
# ENGAGEMENT
# ============================================

async def get_engagement_preferences(user_id: str) -> Optional[Dict[str, Any]]:
    """Get engagement preferences for a user."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM engagement_preferences WHERE user_id = $1",
            user_id
        )
        return _row_to_dict(row)


async def upsert_engagement_preferences(user_id: str, data: Dict[str, Any]) -> None:
    """Upsert engagement preferences for a user."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data["user_id"] = user_id
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    update_parts = [f"{col} = EXCLUDED.{col}" for col in columns if col != "user_id"]
    async with pool.acquire() as conn:
        await conn.execute(
            f"""INSERT INTO engagement_preferences ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
                ON CONFLICT (user_id) DO UPDATE SET {', '.join(update_parts)}""",
            *data.values()
        )


async def get_notification_preferences(user_id: str) -> Optional[Dict[str, Any]]:
    """Get notification preferences for a user."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM notification_preferences WHERE user_id = $1",
            user_id
        )
        return _row_to_dict(row)


async def upsert_notification_preferences(user_id: str, data: Dict[str, Any]) -> None:
    """Upsert notification preferences for a user."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data["user_id"] = user_id
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    update_parts = [f"{col} = EXCLUDED.{col}" for col in columns if col != "user_id"]
    async with pool.acquire() as conn:
        await conn.execute(
            f"""INSERT INTO notification_preferences ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
                ON CONFLICT (user_id) DO UPDATE SET {', '.join(update_parts)}""",
            *data.values()
        )


# ============================================
# GENERIC HELPERS
# ============================================

ALLOWED_TABLES = {
    "subscribers", "user_automations", "automation_runs", "engagement_nudges_log",
    "scheduled_events", "event_occurrences", "event_invites", "rsvp_history",
    "rate_limits", "game_templates", "pay_net_plans", "auto_fix_log",
    "feedback", "engagement_settings", "engagement_events", "feedback_surveys",
    "payment_reminders_log", "payment_reconciliation_log", "payment_settings",
    "payment_logs", "automation_event_dedupe", "email_logs", "counters",
    "reminders", "scheduled_reminders", "host_updates", "wallet_audit",
    "notification_outbox", "scheduled_jobs", "event_logs", "debt_payments",
    "payment_transactions", "engagement_preferences",
    "ai_orchestrator_logs", "group_messages",
    "engagement_jobs", "game_nights", "group_ai_settings",
    "host_decisions", "host_persona_settings", "ledger_entries",
    "notifications", "settlement_disputes", "wallet_deposits",
    "wallet_transactions", "wallet_withdrawals",
    "feature_requests", "feature_request_votes", "feature_request_comments",
}


def _check_table_allowed(table: str) -> None:
    """Raise ValueError if table is not in the allowed set."""
    if table not in ALLOWED_TABLES:
        raise ValueError(f"Table '{table}' is not in the allowed set for generic queries")


async def generic_insert(table: str, data: Dict[str, Any]) -> None:
    """Insert a dict into an allowed table."""
    _check_table_allowed(table)
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    data = _coerce_timestamps(data)
    columns = list(data.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join(placeholders)})",
            *data.values()
        )


async def generic_find_one(table: str, where: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Find one record from an allowed table."""
    _check_table_allowed(table)
    pool = get_pool()
    if not pool:
        return None

    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT * FROM {table} WHERE {where_clause} LIMIT 1",
            *values
        )
        return _row_to_dict(row)


async def generic_find(
    table: str,
    where: Dict[str, Any],
    limit: int = 100,
    order_by: str = "created_at DESC"
) -> List[Dict[str, Any]]:
    """Find records from an allowed table."""
    _check_table_allowed(table)
    pool = get_pool()
    if not pool:
        return []

    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    values.append(limit)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM {table} WHERE {where_clause} ORDER BY {order_by} LIMIT ${len(values)}",
            *values
        )
        return _rows_to_list(rows)


async def generic_update(table: str, where: Dict[str, Any], update: Dict[str, Any]) -> int:
    """Update records in an allowed table. Returns number of rows updated."""
    _check_table_allowed(table)
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return 0

    update = _coerce_timestamps(update)
    set_parts = []
    values = []
    idx = 1
    for k, v in update.items():
        set_parts.append(f"{k} = ${idx}")
        values.append(v)
        idx += 1

    conditions = []
    for k, v in where.items():
        conditions.append(f"{k} = ${idx}")
        values.append(v)
        idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    async with pool.acquire() as conn:
        result = await conn.execute(
            f"UPDATE {table} SET {', '.join(set_parts)} WHERE {where_clause}",
            *values
        )
        return int(result.split()[-1])


async def generic_count(table: str, where: Dict[str, Any]) -> int:
    """Count records in an allowed table."""
    _check_table_allowed(table)
    pool = get_pool()
    if not pool:
        return 0

    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    async with pool.acquire() as conn:
        result = await conn.fetchval(
            f"SELECT COUNT(*) FROM {table} WHERE {where_clause}",
            *values
        )
        return result or 0


async def generic_delete(table: str, where: Dict[str, Any]) -> None:
    """Delete records from an allowed table."""
    _check_table_allowed(table)
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not where:
        raise ValueError("Cannot delete without conditions")

    conditions = []
    values = []
    for i, (k, v) in enumerate(where.items(), 1):
        conditions.append(f"{k} = ${i}")
        values.append(v)

    where_clause = " AND ".join(conditions)

    async with pool.acquire() as conn:
        await conn.execute(
            f"DELETE FROM {table} WHERE {where_clause}",
            *values
        )


async def generic_upsert(table: str, key_columns: Dict[str, Any], data: Dict[str, Any]) -> None:
    """Upsert into an allowed table. key_columns identifies the row, data is merged in."""
    _check_table_allowed(table)
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    merged = _coerce_timestamps({**key_columns, **data})
    columns = list(merged.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    update_cols = [k for k in data.keys() if k not in key_columns]
    update_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols) if update_cols else columns[0] + " = EXCLUDED." + columns[0]
    conflict_cols = ", ".join(key_columns.keys())
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) "
            f"ON CONFLICT ({conflict_cols}) DO UPDATE SET {update_clause}",
            *merged.values()
        )


# ============================================
# POLL VOTE HELPERS (JSONB manipulation)
# ============================================

async def poll_remove_user_vote(poll_id: str, user_id: str) -> None:
    """Remove a user's vote from all options in a poll (JSONB array manipulation)."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    # Each option has a 'votes' array. Remove user_id from every option's votes.
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE polls SET options = (
                SELECT jsonb_agg(
                    jsonb_set(opt, '{votes}',
                        COALESCE((SELECT jsonb_agg(v) FROM jsonb_array_elements(COALESCE(opt->'votes', '[]'::jsonb)) v WHERE v #>> '{}' != $2), '[]'::jsonb)
                    )
                )
                FROM jsonb_array_elements(options) opt
            )
            WHERE poll_id = $1
            """,
            poll_id, user_id
        )


async def poll_add_user_vote(poll_id: str, option_id: str, user_id: str) -> None:
    """Add a user's vote to a specific option in a poll (JSONB $addToSet equivalent)."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE polls SET options = (
                SELECT jsonb_agg(
                    CASE
                        WHEN opt->>'option_id' = $2
                             AND NOT COALESCE(opt->'votes', '[]'::jsonb) @> to_jsonb($3::text)
                        THEN jsonb_set(opt, '{votes}', COALESCE(opt->'votes', '[]'::jsonb) || to_jsonb($3::text))
                        ELSE opt
                    END
                )
                FROM jsonb_array_elements(options) opt
            )
            WHERE poll_id = $1
            """,
            poll_id, option_id, user_id
        )


# ============================================
# GROUP MEMBERS - BATCH UPDATE
# ============================================

async def update_group_members_user_id(old_user_ids: List[str], new_user_id: str) -> int:
    """Update user_id for group members matching old user IDs."""
    pool = get_pool()
    if not pool:
        return 0
    if not old_user_ids:
        return 0
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE group_members SET user_id = $1 WHERE user_id = ANY($2)",
            new_user_id, old_user_ids
        )
        return int(result.split()[-1])


# ============================================
# RATE LIMITS
# ============================================

async def find_rate_limit(key: str, endpoint: str, window_start) -> Optional[Dict[str, Any]]:
    """Find a rate limit entry with window_start >= given time."""
    pool = get_pool()
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM rate_limits WHERE key = $1 AND endpoint = $2 AND window_start >= $3",
            key, endpoint, window_start
        )
        return _row_to_dict(row)


# ============================================
# POKER ANALYSIS LOGS - EXTENDED
# ============================================

async def find_poker_analysis_logs_with_response(
    user_id: str, limit: int = 20, offset: int = 0
) -> List[Dict[str, Any]]:
    """Find poker analysis logs that have ai_response, with pagination."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM poker_analysis_logs WHERE user_id = $1 AND ai_response IS NOT NULL "
            "ORDER BY timestamp DESC OFFSET $2 LIMIT $3",
            user_id, offset, limit
        )
        return _rows_to_list(rows)


async def count_poker_analysis_logs_with_response(user_id: str) -> int:
    """Count poker analysis logs that have ai_response."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            "SELECT COUNT(*) FROM poker_analysis_logs WHERE user_id = $1 AND ai_response IS NOT NULL",
            user_id
        )
        return result or 0


async def find_all_poker_analysis_logs_with_response(user_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
    """Find all poker analysis logs with ai_response (no offset)."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM poker_analysis_logs WHERE user_id = $1 AND ai_response IS NOT NULL "
            "ORDER BY timestamp DESC LIMIT $2",
            user_id, limit
        )
        return _rows_to_list(rows)


# ============================================
# HOST DECISIONS - EXTENDED
# ============================================

async def find_host_decisions_by_query(
    where: Dict[str, Any],
    limit: int = 50,
    order_by: str = "created_at DESC",
    where_gt: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Find host decisions with equality and optional > conditions.

    Args:
        where: Equality conditions (column = value).
        limit: Max rows to return.
        order_by: SQL ORDER BY clause.
        where_gt: Column-value pairs for > conditions.
    """
    pool = get_pool()
    if not pool:
        return []
    conditions: list[str] = []
    values: list[Any] = []
    idx = 1
    for k, v in where.items():
        conditions.append(f"{k} = ${idx}")
        values.append(v)
        idx += 1
    for k, v in (where_gt or {}).items():
        conditions.append(f"{k} > ${idx}")
        values.append(v)
        idx += 1
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM host_decisions WHERE {where_clause} ORDER BY {order_by} LIMIT ${idx}",
            *values, limit
        )
        return _rows_to_list(rows)


# ============================================
# WALLET TRANSACTIONS - EXTENDED
# ============================================

async def find_wallet_transactions_paginated(
    where: Dict[str, Any], limit: int = 20, offset: int = 0
) -> List[Dict[str, Any]]:
    """Find wallet transactions with pagination."""
    pool = get_pool()
    if not pool:
        return []
    conditions = []
    values = []
    idx = 1
    for k, v in where.items():
        conditions.append(f"{k} = ${idx}")
        values.append(v)
        idx += 1
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM wallet_transactions WHERE {where_clause} ORDER BY created_at DESC OFFSET ${idx} LIMIT ${idx + 1}",
            *values, offset, limit
        )
        return _rows_to_list(rows)


# ============================================
# UPSERT HELPERS (non-generic, for known tables)
# ============================================

async def upsert_group_ai_settings(group_id: str, data: Dict[str, Any]) -> None:
    """Upsert group AI settings."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    merged = _coerce_timestamps({"group_id": group_id, **data})
    columns = list(merged.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    update_cols = [c for c in columns if c != "group_id"]
    update_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO group_ai_settings ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) "
            f"ON CONFLICT (group_id) DO UPDATE SET {update_clause}",
            *merged.values()
        )


async def upsert_engagement_settings(group_id: str, data: Dict[str, Any]) -> None:
    """Upsert engagement settings for a group."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    merged = _coerce_timestamps({"group_id": group_id, **data})
    columns = list(merged.keys())
    placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
    update_cols = [c for c in columns if c != "group_id"]
    update_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    async with pool.acquire() as conn:
        await conn.execute(
            f"INSERT INTO engagement_settings ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) "
            f"ON CONFLICT (group_id) DO UPDATE SET {update_clause}",
            *merged.values()
        )


# ============================================
# GENERIC HELPERS - EXTENDED
# ============================================

async def generic_find_one_and_update(
    table: str,
    where: Dict[str, Any],
    update: Dict[str, Any],
    upsert: bool = False,
    increment: Optional[Dict[str, Any]] = None,
    where_gte: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Atomic find+update. Returns the updated row. Used for counters, rate limits, etc.

    Args:
        table: Target table (must be in ALLOWED_TABLES).
        where: Equality conditions for the WHERE clause.
        update: Column-value pairs to SET.
        upsert: If True, insert when no matching row exists.
        increment: Column-value pairs to increment (SET col = COALESCE(col, 0) + val).
        where_gte: Column-value pairs for >= conditions in WHERE clause.
    """
    _check_table_allowed(table)
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")

    set_parts: list[str] = []
    values: list[Any] = []
    idx = 1
    inc_data = increment or {}

    for k, v in update.items():
        set_parts.append(f"{k} = ${idx}")
        values.append(v)
        idx += 1

    for k, v in inc_data.items():
        set_parts.append(f"{k} = COALESCE({k}, 0) + ${idx}")
        values.append(v)
        idx += 1

    if not set_parts:
        return None

    conditions: list[str] = []
    for k, v in where.items():
        conditions.append(f"{k} = ${idx}")
        values.append(v)
        idx += 1

    for k, v in (where_gte or {}).items():
        conditions.append(f"{k} >= ${idx}")
        values.append(v)
        idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    async with pool.acquire() as conn:
        if upsert:
            # Try update first, then insert if not found
            row = await conn.fetchrow(
                f"UPDATE {table} SET {', '.join(set_parts)} WHERE {where_clause} RETURNING *",
                *values
            )
            if not row:
                # Insert
                merged = {**where, **update, **{k: v for k, v in inc_data.items()}}
                cols = list(merged.keys())
                placeholders = [f"${i}" for i in range(1, len(cols) + 1)]
                row = await conn.fetchrow(
                    f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(placeholders)}) RETURNING *",
                    *merged.values()
                )
            return _row_to_dict(row)
        else:
            row = await conn.fetchrow(
                f"UPDATE {table} SET {', '.join(set_parts)} WHERE {where_clause} RETURNING *",
                *values
            )
            return _row_to_dict(row)


async def generic_distinct(table: str, field: str, where: Optional[Dict[str, Any]] = None) -> List[Any]:
    """Get distinct values for a column. Returns list of values."""
    _check_table_allowed(table)
    pool = get_pool()
    if not pool:
        return []
    conditions = []
    values = []
    idx = 1
    if where:
        for k, v in where.items():
            conditions.append(f"{k} = ${idx}")
            values.append(v)
            idx += 1
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT DISTINCT {field} FROM {table} WHERE {where_clause}",
            *values
        )
        return [row[field] for row in rows if row[field] is not None]


async def atomic_wallet_debit(wallet_id: str, amount_cents: int, daily_increment: int = 0) -> Optional[Dict[str, Any]]:
    """Atomically debit wallet if sufficient balance. Returns updated wallet or None."""
    pool = get_pool()
    if not pool:
        return None
    now = datetime.now(timezone.utc)
    daily_clause = ", daily_transferred_cents = COALESCE(daily_transferred_cents, 0) + $3" if daily_increment else ""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"UPDATE wallets SET balance_cents = balance_cents - $1, version = COALESCE(version, 0) + 1, "
            f"updated_at = $2{daily_clause} "
            f"WHERE wallet_id = ${'4' if daily_increment else '3'} AND balance_cents >= $1 RETURNING *",
            amount_cents, now, *([daily_increment, wallet_id] if daily_increment else [wallet_id])
        )
        return _row_to_dict(row)


async def atomic_wallet_credit(wallet_id: str, amount_cents: int) -> Optional[Dict[str, Any]]:
    """Atomically credit wallet. Returns updated wallet."""
    pool = get_pool()
    if not pool:
        return None
    now = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE wallets SET balance_cents = balance_cents + $1, version = COALESCE(version, 0) + 1, "
            "updated_at = $2 WHERE wallet_id = $3 RETURNING *",
            amount_cents, now, wallet_id
        )
        return _row_to_dict(row)


async def reconcile_wallet_balance_sql(wallet_id: str) -> Dict[str, int]:
    """Calculate wallet balance from transactions ledger (source of truth)."""
    pool = get_pool()
    if not pool:
        return {"credits": 0, "debits": 0}
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END), 0) AS credits,
                COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END), 0) AS debits
            FROM wallet_transactions
            WHERE wallet_id = $1 AND status = 'completed'
            """,
            wallet_id
        )
        return {"credits": row["credits"] if row else 0, "debits": row["debits"] if row else 0}


async def get_wallet_balance_aggregate(user_id: str) -> Dict[str, int]:
    """Get wallet balance from wallet_transactions aggregate. Returns {total_in, total_out, net}."""
    pool = get_pool()
    if not pool:
        return {"total_in": 0, "total_out": 0, "net": 0}
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COALESCE(SUM(CASE WHEN type IN ('deposit', 'credit', 'refund') THEN amount_cents ELSE 0 END), 0) AS total_in,
                COALESCE(SUM(CASE WHEN type IN ('withdrawal', 'debit', 'fee') THEN amount_cents ELSE 0 END), 0) AS total_out
            FROM wallet_transactions
            WHERE user_id = $1 AND status = 'completed'
            """,
            user_id
        )
        total_in = row["total_in"] if row else 0
        total_out = row["total_out"] if row else 0
        return {"total_in": total_in, "total_out": total_out, "net": total_in - total_out}


async def find_games_for_player(
    user_id: str,
    group_id: str = None,
    statuses: List[str] = None,
    limit: int = 100,
    order_by: str = "gn.created_at DESC"
) -> List[Dict[str, Any]]:
    """Find games where a user is a player via JOIN on players table."""
    pool = get_pool()
    if not pool:
        return []
    conditions = ["p.user_id = $1"]
    values: list = [user_id]
    idx = 2
    if group_id:
        conditions.append(f"gn.group_id = ${idx}")
        values.append(group_id)
        idx += 1
    if statuses:
        conditions.append(f"gn.status = ANY(${idx})")
        values.append(statuses)
        idx += 1
    values.append(limit)
    where_clause = " AND ".join(conditions)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT DISTINCT gn.* FROM game_nights gn "
            f"JOIN players p ON gn.game_id = p.game_id "
            f"WHERE {where_clause} ORDER BY {order_by} LIMIT ${idx}",
            *values
        )
        return _rows_to_list(rows)


async def count_games_for_player(
    user_id: str,
    group_id: str = None,
    statuses: List[str] = None
) -> int:
    """Count games where a user is a player via JOIN on players table."""
    pool = get_pool()
    if not pool:
        return 0
    conditions = ["p.user_id = $1"]
    values: list = [user_id]
    idx = 2
    if group_id:
        conditions.append(f"gn.group_id = ${idx}")
        values.append(group_id)
        idx += 1
    if statuses:
        conditions.append(f"gn.status = ANY(${idx})")
        values.append(statuses)
        idx += 1
    where_clause = " AND ".join(conditions)
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            f"SELECT COUNT(DISTINCT gn.game_id) FROM game_nights gn "
            f"JOIN players p ON gn.game_id = p.game_id "
            f"WHERE {where_clause}",
            *values
        )
        return result or 0


async def count_records_since(
    table: str,
    where: Dict[str, Any],
    since_field: str = "created_at",
    since: str = None
) -> int:
    """Count records in an allowed table with an optional >= date filter."""
    _check_table_allowed(table)
    pool = get_pool()
    if not pool:
        return 0
    conditions = []
    values = []
    idx = 1
    for k, v in where.items():
        conditions.append(f"{k} = ${idx}")
        values.append(v)
        idx += 1
    if since:
        conditions.append(f"{since_field} >= ${idx}")
        values.append(since)
        idx += 1
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            f"SELECT COUNT(*) FROM {table} WHERE {where_clause}",
            *values
        )
        return result or 0


async def count_group_members_since(group_id: str, since: str) -> int:
    """Count group members who joined since a given date."""
    pool = get_pool()
    if not pool:
        return 0
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            "SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND joined_at >= $2",
            group_id, _parse_dt(since)
        )
        return result or 0


async def find_all_user_ids(limit: int = 500) -> List[str]:
    """Get all user IDs."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT user_id FROM users LIMIT $1", limit
        )
        return [row["user_id"] for row in rows]
