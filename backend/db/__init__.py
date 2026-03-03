"""
Kvitt Database Module

This module provides the database abstraction layer for Kvitt.
Uses PostgreSQL (asyncpg) with Supabase.

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
_backend_type = "postgres"


def get_backend_type() -> str:
    """Get the database backend type (always postgres now)."""
    return "postgres"


async def init_db() -> None:
    """
    Initialize the PostgreSQL database connection.
    Call once at application startup.
    """
    global _db_instance, _backend_type
    
    _backend_type = "postgres"
    
    from .pg import init_db as init_pg
    await init_pg()
    
    # Create a PostgreSQL database wrapper
    from . import queries as pg_queries
    _db_instance = PostgresDB(pg_queries)
    logger.info("Database initialized: PostgreSQL (Supabase)")


async def close_db() -> None:
    """Close database connections. Call at application shutdown."""
    global _db_instance
    
    from .pg import close_db as close_pg
    await close_pg()
    
    _db_instance = None
    logger.info("Database connections closed")


def get_db() -> Any:
    """
    Get the database instance.
    Returns a wrapper that provides a consistent interface.
    """
    if _db_instance is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db_instance


def is_postgres() -> bool:
    """Check if using PostgreSQL backend (always True now)."""
    return True


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
    
    # Cache for table columns to avoid repeated queries
    _column_cache: dict = {}
    
    def __init__(self, table_name: str, queries_module):
        self._table = table_name
        self._queries = queries_module
    
    async def _get_table_columns(self) -> set:
        """Get valid column names for this table (cached)."""
        if self._table in PostgresCollection._column_cache:
            return PostgresCollection._column_cache[self._table]
        
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            return set()
        
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1
                """,
                self._table
            )
            columns = {r['column_name'] for r in rows}
            PostgresCollection._column_cache[self._table] = columns
            return columns
    
    def _filter_document(self, document: dict, valid_columns: set) -> tuple[dict, list]:
        """
        Filter document to only include valid columns.
        Returns (filtered_doc, dropped_keys) for logging.
        """
        filtered = {}
        dropped = []
        for k, v in document.items():
            if k in valid_columns:
                filtered[k] = v
            else:
                dropped.append(k)
        return filtered, dropped
    
    async def find_one(self, filter_dict: dict, projection: dict = None) -> Optional[dict]:
        """Find a single document matching the filter. Projection is ignored (MongoDB compat)."""
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
        """Insert a single document, filtering to valid columns only."""
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        
        # Filter document to only include valid columns
        valid_columns = await self._get_table_columns()
        if valid_columns:
            filtered_doc, dropped_keys = self._filter_document(document, valid_columns)
            if dropped_keys:
                logger.debug(f"[{self._table}] insert_one dropped keys: {dropped_keys}")
        else:
            filtered_doc = document
        
        if not filtered_doc:
            logger.warning(f"[{self._table}] No valid columns to insert")
            return InsertResult(None)
        
        columns = list(filtered_doc.keys())
        placeholders = [f"${i+1}" for i in range(len(columns))]
        values = list(filtered_doc.values())
        
        async with pool.acquire() as conn:
            try:
                await conn.execute(
                    f"INSERT INTO {self._table} ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) ON CONFLICT DO NOTHING",
                    *values
                )
            except Exception as e:
                logger.error(f"[{self._table}] insert_one failed: {e}")
                raise
        
        return InsertResult(document.get("_id") or document.get("id") or filtered_doc.get(f"{self._table[:-1]}_id"))
    
    async def upsert_one(self, filter_dict: dict, document: dict, conflict_columns: list = None) -> Any:
        """
        Insert or update a document (upsert).
        conflict_columns: columns to check for conflict (defaults to filter keys)
        """
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        
        # Filter document to only include valid columns
        valid_columns = await self._get_table_columns()
        if valid_columns:
            filtered_doc, dropped_keys = self._filter_document(document, valid_columns)
            if dropped_keys:
                logger.debug(f"[{self._table}] upsert_one dropped keys: {dropped_keys}")
        else:
            filtered_doc = document
        
        if not filtered_doc:
            logger.warning(f"[{self._table}] No valid columns to upsert")
            return InsertResult(None)
        
        # Merge filter into document for insert
        for k, v in filter_dict.items():
            if k not in filtered_doc and (not valid_columns or k in valid_columns):
                filtered_doc[k] = v
        
        columns = list(filtered_doc.keys())
        placeholders = [f"${i+1}" for i in range(len(columns))]
        values = list(filtered_doc.values())
        
        # Determine conflict columns
        conflict_cols = conflict_columns or list(filter_dict.keys())
        conflict_clause = ", ".join(conflict_cols)
        
        # Build UPDATE SET clause (exclude conflict columns)
        update_cols = [c for c in columns if c not in conflict_cols]
        if update_cols:
            update_parts = [f"{c} = EXCLUDED.{c}" for c in update_cols]
            on_conflict = f"ON CONFLICT ({conflict_clause}) DO UPDATE SET {', '.join(update_parts)}"
        else:
            on_conflict = f"ON CONFLICT ({conflict_clause}) DO NOTHING"
        
        async with pool.acquire() as conn:
            try:
                await conn.execute(
                    f"INSERT INTO {self._table} ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) {on_conflict}",
                    *values
                )
            except Exception as e:
                logger.error(f"[{self._table}] upsert_one failed: {e}")
                raise
        
        return InsertResult(filtered_doc.get("_id") or filtered_doc.get("id"))
    
    async def update_one(self, filter_dict: dict, update: dict) -> Any:
        """Update a single document, filtering to valid columns only."""
        from .pg import get_pool
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database not initialized")
        
        # Handle $set and $inc operators
        update_data = {}
        inc_data = {}
        
        if "$set" in update:
            update_data = dict(update["$set"])
        if "$inc" in update:
            inc_data = update["$inc"]
        if not update_data and not inc_data and "$set" not in update and "$inc" not in update:
            update_data = dict(update)
        
        if not update_data and not inc_data:
            return UpdateResult(0, 0)
        
        # Filter update data to only include valid columns
        valid_columns = await self._get_table_columns()
        if valid_columns:
            if update_data:
                update_data, dropped = self._filter_document(update_data, valid_columns)
                if dropped:
                    logger.debug(f"[{self._table}] update_one dropped keys: {dropped}")
            if inc_data:
                inc_data, dropped = self._filter_document(inc_data, valid_columns)
                if dropped:
                    logger.debug(f"[{self._table}] update_one $inc dropped keys: {dropped}")
        
        if not update_data and not inc_data:
            logger.warning(f"[{self._table}] No valid columns to update")
            return UpdateResult(0, 0)
        
        # Build SET clause
        set_parts = []
        values = []
        idx = 1
        
        for k, v in update_data.items():
            set_parts.append(f"{k} = ${idx}")
            values.append(v)
            idx += 1
        
        for k, v in inc_data.items():
            set_parts.append(f"{k} = COALESCE({k}, 0) + ${idx}")
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
            try:
                result = await conn.execute(
                    f"UPDATE {self._table} SET {', '.join(set_parts)} WHERE {where_clause}",
                    *values
                )
                # Parse result like "UPDATE 1"
                count = int(result.split()[-1]) if result else 0
                return UpdateResult(count, count)
            except Exception as e:
                logger.error(f"[{self._table}] update_one failed: {e}")
                raise
    
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
