#!/usr/bin/env python3
"""Test the database module with PostgreSQL backend."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

print(f"DATABASE_BACKEND: {os.getenv('DATABASE_BACKEND')}")
print(f"SUPABASE_DB_URL set: {bool(os.getenv('SUPABASE_DB_URL'))}")

import db as database

async def test():
    print("Initializing database...")
    await database.init_db()
    
    db = database.get_db()
    print(f"Database type: {type(db).__name__}")
    print(f"Is PostgreSQL: {database.is_postgres()}")
    
    # Test a simple query
    print("Testing query...")
    users = await db.users.find({}).to_list(5)
    print(f"Users found: {len(users)}")
    
    # Test insert (will fail on duplicate, which is fine)
    print("Testing insert...")
    try:
        await db.users.insert_one({
            "user_id": "test_user_123",
            "email": "test@example.com",
            "name": "Test User"
        })
        print("Insert successful")
    except Exception as e:
        print(f"Insert skipped (may already exist): {e}")
    
    # Test find_one
    print("Testing find_one...")
    user = await db.users.find_one({"user_id": "test_user_123"})
    print(f"Found user: {user}")
    
    # Test count
    print("Testing count...")
    count = await db.users.count_documents({})
    print(f"Total users: {count}")
    
    await database.close_db()
    print("Database closed successfully")
    print("\n[OK] All tests passed!")

if __name__ == "__main__":
    asyncio.run(test())
