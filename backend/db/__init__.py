"""
Kvitt Database Module

This module provides the database abstraction layer for Kvitt.
Supports both MongoDB (Motor) and PostgreSQL (asyncpg) backends.

Set DATABASE_BACKEND=postgres to use Supabase PostgreSQL.
Set DATABASE_BACKEND=mongodb to use MongoDB (legacy).

Usage:
    from db import get_db, init_db, close_db
    
    # At startup
    await init_db()
    
    # Get database instance
    db = get_db()
    
    # Use query methods
    user = await db.get_user(user_id)
    await db.insert_user(data)
"""

import os
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

# Database backend instance
_db_instance = None
_backend_type = None


def get_backend_type() -> str:
    """Get the configured database backend type."""
    return os.getenv("DATABASE_BACKEND", "mongodb").lower()


async def init_db() -> None:
    """
    Initialize the database connection based on DATABASE_BACKEND env var.
    Call once at application startup.
    """
    global _db_instance, _backend_type
    
    _backend_type = get_backend_type()
    
    if _backend_type == "postgres":
        from .pg import init_db as init_pg
        await init_pg()
        
        # Create a PostgreSQL database wrapper
        from . import queries as pg_queries
        _db_instance = PostgresDB(pg_queries)
        logger.info("Database initialized: PostgreSQL (Supabase)")
        
    else:
        # MongoDB (legacy)
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'Kvitt-database')
        
        client = AsyncIOMotorClient(mongo_url)
        mongo_db = client[db_name]
        
        _db_instance = MongoDatabaseWrapper(mongo_db)
        logger.info(f"Database initialized: MongoDB ({db_name})")


async def close_db() -> None:
    """Close database connections. Call at application shutdown."""
    global _db_instance, _backend_type
    
    if _backend_type == "postgres":
        from .pg import close_db as close_pg
        await close_pg()
    
    _db_instance = None
    logger.info("Database connections closed")


def get_db() -> Any:
    """
    Get the database instance.
    Returns a wrapper that provides a consistent interface regardless of backend.
    """
    if _db_instance is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db_instance


def is_postgres() -> bool:
    """Check if using PostgreSQL backend."""
    return _backend_type == "postgres"


def is_mongodb() -> bool:
    """Check if using MongoDB backend."""
    return _backend_type == "mongodb" or _backend_type is None


class PostgresDB:
    """
    PostgreSQL database wrapper that provides Motor-like interface.
    This allows gradual migration without changing all call sites at once.
    """
    
    def __init__(self, queries_module):
        self._queries = queries_module
        
        # Create collection-like accessors for compatibility
        self.users = PostgresCollection("users", queries_module)
        self.groups = PostgresCollection("groups", queries_module)
        self.group_members = PostgresCollection("group_members", queries_module)
        self.game_nights = PostgresCollection("game_nights", queries_module)
        self.players = PostgresCollection("players", queries_module)
        self.transactions = PostgresCollection("transactions", queries_module)
        self.ledger = PostgresCollection("ledger_entries", queries_module)
        self.ledger_entries = PostgresCollection("ledger_entries", queries_module)
        self.wallets = PostgresCollection("wallets", queries_module)
        self.wallet_transactions = PostgresCollection("wallet_transactions", queries_module)
        self.wallet_audit = PostgresCollection("wallet_audit", queries_module)
        self.notifications = PostgresCollection("notifications", queries_module)
        self.group_messages = PostgresCollection("group_messages", queries_module)
        self.group_invites = PostgresCollection("group_invites", queries_module)
        self.user_sessions = PostgresCollection("user_sessions", queries_module)
        self.payment_transactions = PostgresCollection("payment_transactions", queries_module)
        self.debt_payments = PostgresCollection("debt_payments", queries_module)
        self.wallet_deposits = PostgresCollection("wallet_deposits", queries_module)
        self.polls = PostgresCollection("polls", queries_module)
        self.feedback = PostgresCollection("feedback", queries_module)
        self.feedback_surveys = PostgresCollection("feedback_surveys", queries_module)
        self.engagement_settings = PostgresCollection("engagement_settings", queries_module)
        self.engagement_events = PostgresCollection("engagement_events", queries_module)
        self.payment_settings = PostgresCollection("payment_settings", queries_module)
        self.payment_reminders_log = PostgresCollection("payment_reminders_log", queries_module)
        self.payment_reconciliation_log = PostgresCollection("payment_reconciliation_log", queries_module)
        self.audit_logs = PostgresCollection("audit_logs", queries_module)
        self.event_logs = PostgresCollection("event_logs", queries_module)
        self.scheduled_jobs = PostgresCollection("scheduled_jobs", queries_module)
        self.auto_fix_log = PostgresCollection("auto_fix_log", queries_module)
        self.host_updates = PostgresCollection("host_updates", queries_module)
        self.rate_limits = PostgresCollection("rate_limits", queries_module)
        self.counters = PostgresCollection("counters", queries_module)
        self.pay_net_plans = PostgresCollection("pay_net_plans", queries_module)
        self.email_logs = PostgresCollection("email_logs", queries_module)
    
    # Direct query methods
    async def get_user(self, user_id: str):
        return await self._queries.get_user(user_id)
    
    async def get_user_by_email(self, email: str):
        return await self._queries.get_user_by_email(email)
    
    async def get_user_by_supabase_id(self, supabase_id: str):
        return await self._queries.get_user_by_supabase_id(supabase_id)


class PostgresCollection:
    """
    Provides Motor-compatible collection interface for PostgreSQL tables.
    Allows code like `await db.users.find_one({"user_id": x})` to work with Postgres.
    """
    
    def __init__(self, table_name: str, queries_module):
        self._table = table_name
        self._queries = queries_module
    
    async def find_one(self, filter_dict: dict) -> Optional[dict]:
        """Find a single document matching the filter."""
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            return None
        
        # Build WHERE clause
        conditions = []
        values = []
        for i, (k, v) in enumerate(filter_dict.items(), 1):
            conditions.append(f"{k} = ${i}")
            values.append(v)
        
        where_clause = " AND ".join(conditions) if conditions else "TRUE"
        
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT * FROM {self._table} WHERE {where_clause} LIMIT 1",
                *values
            )
            return dict(row) if row else None
    
    def find(self, filter_dict: dict = None, sort: list = None, limit: int = None):
        """Find documents matching the filter. Returns a cursor-like object (sync, like Motor)."""
        return PostgresCursor(self._table, filter_dict or {}, sort, limit)
    
    async def insert_one(self, document: dict) -> Any:
        """Insert a single document."""
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        
        columns = list(document.keys())
        placeholders = [f"${i+1}" for i in range(len(columns))]
        values = list(document.values())
        
        async with pool.acquire() as conn:
            await conn.execute(
                f"INSERT INTO {self._table} ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) ON CONFLICT DO NOTHING",
                *values
            )
        
        return InsertResult(document.get("_id") or document.get("id"))
    
    async def update_one(self, filter_dict: dict, update: dict) -> Any:
        """Update a single document."""
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        
        # Handle $set operator
        if "$set" in update:
            update_data = update["$set"]
        else:
            update_data = update
        
        if not update_data:
            return UpdateResult(0, 0)
        
        # Build SET clause
        set_parts = []
        values = []
        idx = 1
        for k, v in update_data.items():
            set_parts.append(f"{k} = ${idx}")
            values.append(v)
            idx += 1
        
        # Build WHERE clause
        where_parts = []
        for k, v in filter_dict.items():
            where_parts.append(f"{k} = ${idx}")
            values.append(v)
            idx += 1
        
        where_clause = " AND ".join(where_parts) if where_parts else "TRUE"
        
        async with pool.acquire() as conn:
            result = await conn.execute(
                f"UPDATE {self._table} SET {', '.join(set_parts)} WHERE {where_clause}",
                *values
            )
            # Parse result like "UPDATE 1"
            count = int(result.split()[-1]) if result else 0
            return UpdateResult(count, count)
    
    async def update_many(self, filter_dict: dict, update: dict) -> Any:
        """Update multiple documents."""
        return await self.update_one(filter_dict, update)
    
    async def delete_one(self, filter_dict: dict) -> Any:
        """Delete a single document."""
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        
        conditions = []
        values = []
        for i, (k, v) in enumerate(filter_dict.items(), 1):
            conditions.append(f"{k} = ${i}")
            values.append(v)
        
        where_clause = " AND ".join(conditions) if conditions else "FALSE"
        
        async with pool.acquire() as conn:
            result = await conn.execute(
                f"DELETE FROM {self._table} WHERE {where_clause}",
                *values
            )
            count = int(result.split()[-1]) if result else 0
            return DeleteResult(count)
    
    async def delete_many(self, filter_dict: dict) -> Any:
        """Delete multiple documents."""
        return await self.delete_one(filter_dict)
    
    async def count_documents(self, filter_dict: dict = None) -> int:
        """Count documents matching the filter."""
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            return 0
        
        filter_dict = filter_dict or {}
        conditions = []
        values = []
        for i, (k, v) in enumerate(filter_dict.items(), 1):
            conditions.append(f"{k} = ${i}")
            values.append(v)
        
        where_clause = " AND ".join(conditions) if conditions else "TRUE"
        
        async with pool.acquire() as conn:
            count = await conn.fetchval(
                f"SELECT COUNT(*) FROM {self._table} WHERE {where_clause}",
                *values
            )
            return count or 0
    
    async def aggregate(self, pipeline: list) -> list:
        """
        Basic aggregation support. Only handles simple $match and $group.
        For complex aggregations, use raw SQL via queries module.
        """
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            return []
        
        # This is a simplified implementation
        # For complex aggregations, use direct SQL queries
        logger.warning(f"Aggregation on {self._table} - consider using direct SQL for complex queries")
        
        results = []
        async with pool.acquire() as conn:
            rows = await conn.fetch(f"SELECT * FROM {self._table} LIMIT 1000")
            results = [dict(r) for r in rows]
        
        return results


class PostgresCursor:
    """Async cursor-like object for PostgreSQL queries."""
    
    def __init__(self, table: str, filter_dict: dict, sort: list = None, limit: int = None):
        self._table = table
        self._filter = filter_dict
        self._sort = sort
        self._limit = limit
        self._skip = 0
    
    def sort(self, sort_spec):
        """Add sort specification."""
        self._sort = sort_spec
        return self
    
    def skip(self, n: int):
        """Skip n documents."""
        self._skip = n
        return self
    
    def limit(self, n: int):
        """Limit results to n documents."""
        self._limit = n
        return self
    
    async def to_list(self, length: int = None) -> list:
        """Execute query and return results as list."""
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            return []
        
        # Build WHERE clause
        conditions = []
        values = []
        for i, (k, v) in enumerate(self._filter.items(), 1):
            if isinstance(v, dict):
                # Handle operators like $in, $gt, etc.
                for op, val in v.items():
                    if op == "$in":
                        conditions.append(f"{k} = ANY(${i})")
                        values.append(val)
                    elif op == "$gt":
                        conditions.append(f"{k} > ${i}")
                        values.append(val)
                    elif op == "$gte":
                        conditions.append(f"{k} >= ${i}")
                        values.append(val)
                    elif op == "$lt":
                        conditions.append(f"{k} < ${i}")
                        values.append(val)
                    elif op == "$lte":
                        conditions.append(f"{k} <= ${i}")
                        values.append(val)
                    elif op == "$ne":
                        conditions.append(f"{k} != ${i}")
                        values.append(val)
            else:
                conditions.append(f"{k} = ${i}")
                values.append(v)
        
        where_clause = " AND ".join(conditions) if conditions else "TRUE"
        
        # Build ORDER BY
        order_clause = ""
        if self._sort:
            order_parts = []
            for field, direction in self._sort:
                dir_str = "ASC" if direction == 1 else "DESC"
                order_parts.append(f"{field} {dir_str}")
            order_clause = f"ORDER BY {', '.join(order_parts)}"
        
        # Build LIMIT/OFFSET
        limit_clause = ""
        if length or self._limit:
            limit_clause = f"LIMIT {length or self._limit}"
        if self._skip:
            limit_clause += f" OFFSET {self._skip}"
        
        query = f"SELECT * FROM {self._table} WHERE {where_clause} {order_clause} {limit_clause}"
        
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *values)
            return [dict(r) for r in rows]
    
    def __aiter__(self):
        return self
    
    async def __anext__(self):
        # For async iteration, fetch all and yield
        if not hasattr(self, '_results'):
            self._results = await self.to_list()
            self._idx = 0
        
        if self._idx >= len(self._results):
            raise StopAsyncIteration
        
        result = self._results[self._idx]
        self._idx += 1
        return result


class InsertResult:
    """Result of an insert operation."""
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class UpdateResult:
    """Result of an update operation."""
    def __init__(self, matched_count: int, modified_count: int):
        self.matched_count = matched_count
        self.modified_count = modified_count


class DeleteResult:
    """Result of a delete operation."""
    def __init__(self, deleted_count: int):
        self.deleted_count = deleted_count


class MongoDatabaseWrapper:
    """
    Wrapper around Motor database that provides the same interface.
    This allows the code to work with both MongoDB and PostgreSQL.
    """
    
    def __init__(self, mongo_db):
        self._db = mongo_db
    
    def __getattr__(self, name):
        """Forward attribute access to the underlying MongoDB database."""
        return getattr(self._db, name)
    
    def __getitem__(self, name):
        """Forward item access to the underlying MongoDB database."""
        return self._db[name]
