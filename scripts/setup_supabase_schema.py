#!/usr/bin/env python3
"""
Setup Supabase PostgreSQL Schema

This script connects to Supabase PostgreSQL and creates all required tables.
Run this before the data migration.

Usage:
    python scripts/setup_supabase_schema.py
"""
import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables from .env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend', '.env'))

import asyncpg


async def test_connection():
    """Test connection to Supabase PostgreSQL."""
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("[ERROR] SUPABASE_DB_URL not set in environment")
        return False
    
    print(f"[INFO] Connecting to Supabase PostgreSQL...")
    print(f"   URL: {db_url[:50]}...")
    
    # Try different connection approaches
    try:
        # First try with SSL required (Supabase default)
        conn = await asyncpg.connect(
            db_url,
            ssl='require',
            timeout=30
        )
        version = await conn.fetchval("SELECT version()")
        print(f"[OK] Connected successfully!")
        print(f"   PostgreSQL: {version[:60]}...")
        await conn.close()
        return True
    except Exception as e:
        print(f"[WARN] SSL connection failed: {e}")
        print("[INFO] Trying without explicit SSL...")
        try:
            conn = await asyncpg.connect(db_url, timeout=30)
            version = await conn.fetchval("SELECT version()")
            print(f"[OK] Connected successfully!")
            print(f"   PostgreSQL: {version[:60]}...")
            await conn.close()
            return True
        except Exception as e2:
            print(f"[ERROR] Connection failed: {e2}")
            return False


async def run_schema():
    """Run the schema SQL file against Supabase."""
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("[ERROR] SUPABASE_DB_URL not set")
        return False
    
    schema_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'supabase', 'migrations', '001_initial_schema.sql'
    )
    
    if not os.path.exists(schema_path):
        print(f"[ERROR] Schema file not found: {schema_path}")
        return False
    
    print(f"[INFO] Reading schema from: {schema_path}")
    
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    
    print(f"   Schema size: {len(schema_sql)} characters")
    
    try:
        conn = await asyncpg.connect(db_url)
        
        print("[INFO] Running schema...")
        await conn.execute(schema_sql)
        
        # Verify tables were created
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        
        print(f"\n[OK] Schema created successfully!")
        print(f"   Tables created: {len(tables)}")
        print("\n   Tables:")
        for t in tables:
            print(f"   - {t['table_name']}")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"[ERROR] Schema creation failed: {e}")
        return False


async def main():
    print("=" * 50)
    print("Kvitt Supabase Schema Setup")
    print("=" * 50)
    print()
    
    # Test connection first
    if not await test_connection():
        print("\n[WARN] Fix the connection issue and try again.")
        return
    
    print()
    
    # Run schema
    if await run_schema():
        print("\n" + "=" * 50)
        print("[OK] Schema setup complete!")
        print("   Next: Run data migration with:")
        print("   python scripts/migrate_mongo_to_postgres.py")
        print("=" * 50)
    else:
        print("\n[WARN] Schema setup failed. Check errors above.")


if __name__ == "__main__":
    asyncio.run(main())
