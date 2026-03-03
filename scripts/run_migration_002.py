#!/usr/bin/env python3
"""Run migration 002 to add missing columns."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

import asyncpg

async def run_migration():
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("[ERROR] SUPABASE_DB_URL not set")
        return False
    
    migration_path = os.path.join(
        os.path.dirname(__file__), '..', 
        'supabase', 'migrations', '002_add_missing_columns.sql'
    )
    
    print("[INFO] Reading migration file...")
    with open(migration_path, 'r') as f:
        migration_sql = f.read()
    
    print(f"[INFO] Connecting to database...")
    try:
        conn = await asyncpg.connect(db_url)
        
        print("[INFO] Running migration 002...")
        await conn.execute(migration_sql)
        
        # Verify columns were added
        result = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'groups' 
            ORDER BY ordinal_position
        """)
        
        columns = [r['column_name'] for r in result]
        print(f"[OK] Groups table columns: {columns}")
        
        # Check for required columns
        required = ['default_chip_value', 'chips_per_buy_in', 'max_players']
        missing = [c for c in required if c not in columns]
        
        if missing:
            print(f"[WARN] Missing columns: {missing}")
        else:
            print("[OK] All required columns present!")
        
        await conn.close()
        print("[OK] Migration 002 completed successfully!")
        return True
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(run_migration())
    sys.exit(0 if success else 1)
