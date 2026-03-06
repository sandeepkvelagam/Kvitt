"""
Kvitt Database Queries — asyncpg implementation.

This module provides typed query methods for all database operations.
Each method mirrors the Motor (MongoDB) patterns used in the codebase.
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


def _build_update_query(table: str, id_column: str, update: Dict[str, Any]) -> tuple:
    """
    Build a parameterized UPDATE query from a dict.
    Returns (query_string, values_list) where the last value is the id.
    """
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
            data.get("created_at", datetime.now(timezone.utc)),
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
            data.get("expires_at"),
            data.get("created_at", datetime.now(timezone.utc)),
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
            data.get("created_at", datetime.now(timezone.utc)),
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
            data.get("joined_at", datetime.now(timezone.utc)),
        )


async def update_group_member(group_id: str, user_id: str, update: Dict[str, Any]) -> None:
    """Update group member."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    
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
    """Find group invites for a user with a given status."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM group_invites WHERE invited_user_id = $1 AND status = $2 LIMIT $3",
            user_id, status, limit
        )
        return _rows_to_list(rows)


async def find_group_invites_by_email(email: str, status: str = "pending", limit: int = 50) -> List[Dict[str, Any]]:
    """Find group invites by email."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM group_invites WHERE invited_email = $1 AND status = $2 LIMIT $3",
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
            "SELECT * FROM group_invites WHERE group_id = $1 AND invited_email = $2 AND status = 'pending' LIMIT 1",
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
        values.append(before_time)
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
            data.get("scheduled_at"),
            data.get("created_at", datetime.now(timezone.utc)),
        )


async def update_game_night(game_id: str, update: Dict[str, Any]) -> None:
    """Update game night by game_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("game_nights", "game_id", update)
    values.append(game_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


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


async def count_game_nights(where: Dict[str, Any]) -> int:
    """Count game nights matching criteria."""
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


async def insert_player(data: Dict[str, Any]) -> None:
    """Insert a new player."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO players (
                player_id, game_id, user_id, total_buy_in, total_chips,
                chips_returned, cash_out, net_result, rsvp_status, joined_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            data.get("player_id"),
            data.get("game_id"),
            data.get("user_id"),
            data.get("total_buy_in", 0),
            data.get("total_chips", 0),
            data.get("chips_returned"),
            data.get("cash_out"),
            data.get("net_result"),
            data.get("rsvp_status", "pending"),
            data.get("joined_at", datetime.now(timezone.utc)),
        )


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


async def insert_transaction(data: Dict[str, Any]) -> None:
    """Insert a new transaction."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO transactions (
                transaction_id, game_id, user_id, type,
                amount, chips, chip_value, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            data.get("transaction_id"),
            data.get("game_id"),
            data.get("user_id"),
            data.get("type"),
            data.get("amount"),
            data.get("chips"),
            data.get("chip_value"),
            data.get("notes"),
            data.get("created_at", datetime.now(timezone.utc)),
        )


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
            data.get("paid_at"),
            data.get("is_locked", False),
            data.get("created_at", datetime.now(timezone.utc)),
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
            data.get("created_at", datetime.now(timezone.utc)),
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
            data.get("created_at", datetime.now(timezone.utc)),
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
            data.get("created_at", datetime.now(timezone.utc)),
        )


async def update_notification(notification_id: str, update: Dict[str, Any]) -> None:
    """Update notification by notification_id."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    if not update:
        return
    query, values = _build_update_query("notifications", "notification_id", update)
    values.append(notification_id)
    async with pool.acquire() as conn:
        await conn.execute(query, *values)


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
            data.get("created_at", datetime.now(timezone.utc)),
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
                invite_id, group_id, email, invited_by, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
            """,
            data.get("invite_id"),
            data.get("group_id"),
            data.get("email"),
            data.get("invited_by"),
            data.get("status", "pending"),
            data.get("created_at", datetime.now(timezone.utc)),
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

async def insert_user_session(data: Dict[str, Any]) -> None:
    """Insert a new user session."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database not initialized")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO user_sessions (
                session_id, user_id, session_token, expires_at, created_at
            ) VALUES ($1, $2, $3, $4, $5)
            """,
            data.get("session_id"),
            data.get("user_id"),
            data.get("session_token"),
            data.get("expires_at"),
            data.get("created_at", datetime.now(timezone.utc)),
        )


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
            data.get("created_at", datetime.now(timezone.utc)),
            data.get("updated_at", datetime.now(timezone.utc)),
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
            data.get("created_at", datetime.now(timezone.utc)),
            data.get("updated_at", datetime.now(timezone.utc)),
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
            data.get("expires_at"),
            data.get("created_at", datetime.now(timezone.utc)),
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
            data.get("created_at", datetime.now(timezone.utc)),
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
            data.get("created_at", datetime.now(timezone.utc)),
        )
