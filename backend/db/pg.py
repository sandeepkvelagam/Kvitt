"""
Kvitt DB layer — asyncpg direct Postgres connection.
Supabase provides the database; this module talks to it directly.
"""
import asyncpg
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

pool: Optional[asyncpg.Pool] = None


async def init_db() -> None:
    """
    Initialize asyncpg pool. Call once at startup.
    
    Requires SUPABASE_DB_URL environment variable.
    Get this from Supabase Dashboard: Project Settings → Database → Connection String (Direct)
    """
    global pool
    url = os.getenv("SUPABASE_DB_URL")
    if not url:
        logger.warning("SUPABASE_DB_URL not set, PostgreSQL database not available")
        return
    
    try:
        pool = await asyncpg.create_pool(
            url,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )
        logger.info("✅ PostgreSQL connection pool initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize PostgreSQL pool: {e}")
        raise


async def close_db() -> None:
    """Close pool. Call at shutdown."""
    global pool
    if pool:
        await pool.close()
        pool = None
        logger.info("PostgreSQL connection pool closed")


def get_pool() -> Optional[asyncpg.Pool]:
    """Get the connection pool. Returns None if not initialized."""
    return pool


def is_initialized() -> bool:
    """Check if the database pool is initialized."""
    return pool is not None
