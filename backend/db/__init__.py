"""
Kvitt Database Module

PostgreSQL (asyncpg) database layer for Supabase.
All queries go through db.queries (typed helpers) or db.pg.get_pool() (raw SQL).

Usage:
    from db import queries
    from db.pg import get_pool

    user = await queries.get_user("abc")
"""

import logging

logger = logging.getLogger(__name__)


async def init_db() -> None:
    """
    Initialize the PostgreSQL connection pool.
    Call once at application startup.
    """
    from .pg import init_db as init_pg
    await init_pg()
    logger.info("Database initialized: PostgreSQL (Supabase)")


async def close_db() -> None:
    """Close database connections. Call at application shutdown."""
    from .pg import close_db as close_pg
    await close_pg()
    logger.info("Database connections closed")


def get_backend_type() -> str:
    """Get the database backend type (always postgres)."""
    return "postgres"
