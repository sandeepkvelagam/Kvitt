#!/usr/bin/env python3
"""
Run Supabase security remediation migrations (009, 010, 011).

Usage:
    python scripts/run_security_migrations.py
    python scripts/run_security_migrations.py --phase 1      # Only 009
    python scripts/run_security_migrations.py --phase 1 2    # 009 + 010
    python scripts/run_security_migrations.py --phase 1 2 3  # All three
"""
import asyncio
import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend', '.env'))

import asyncpg

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'supabase', 'migrations')

PHASE_FILES = {
    1: '009_enable_rls.sql',
    2: '010_lockdown_grants.sql',
    3: '011_create_kvitt_backend_role.sql',
}


async def run_migration(conn, phase: int):
    filename = PHASE_FILES[phase]
    path = os.path.join(MIGRATIONS_DIR, filename)
    if not os.path.exists(path):
        print(f"  [ERROR] File not found: {path}")
        return False

    with open(path, 'r', encoding='utf-8') as f:
        sql = f.read()

    print(f"  Running {filename} ({len(sql)} chars)...")
    try:
        await conn.execute(sql)
        print(f"  [OK] {filename} completed successfully")
        return True
    except Exception as e:
        print(f"  [ERROR] {filename} failed: {e}")
        return False


async def verify_rls(conn):
    """Check RLS status on all public tables."""
    rows = await conn.fetch("""
        SELECT c.relname AS table_name,
               c.relrowsecurity AS rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY c.relname
    """)
    enabled = [r['table_name'] for r in rows if r['rls_enabled']]
    disabled = [r['table_name'] for r in rows if not r['rls_enabled']]
    print(f"\n  RLS Status: {len(enabled)} enabled, {len(disabled)} disabled")
    if disabled:
        print(f"  Tables without RLS: {', '.join(disabled)}")
    else:
        print("  All public tables have RLS enabled")
    return len(disabled) == 0


async def verify_grants(conn):
    """Check if anon/authenticated have privileges on public tables."""
    rows = await conn.fetch("""
        SELECT grantee, table_name, privilege_type
        FROM information_schema.table_privileges
        WHERE table_schema = 'public'
          AND grantee IN ('anon', 'authenticated')
        ORDER BY grantee, table_name
    """)
    if rows:
        print(f"\n  [WARN] {len(rows)} grants still exist for anon/authenticated:")
        for r in rows[:10]:
            print(f"    {r['grantee']}: {r['privilege_type']} on {r['table_name']}")
        if len(rows) > 10:
            print(f"    ... and {len(rows) - 10} more")
    else:
        print("\n  Grants: No table privileges for anon/authenticated")
    return len(rows) == 0


async def verify_role(conn):
    """Check if kvitt_backend role exists."""
    row = await conn.fetchrow("SELECT 1 FROM pg_roles WHERE rolname = 'kvitt_backend'")
    if row:
        print("\n  Role kvitt_backend: EXISTS")
    else:
        print("\n  Role kvitt_backend: NOT FOUND")
    return row is not None


async def main():
    parser = argparse.ArgumentParser(description='Run security migrations')
    parser.add_argument('--phase', nargs='+', type=int, default=[1, 2, 3],
                        help='Phases to run (1=RLS, 2=grants, 3=role)')
    parser.add_argument('--verify-only', action='store_true',
                        help='Only verify current state, do not run migrations')
    args = parser.parse_args()

    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("[ERROR] SUPABASE_DB_URL not set")
        sys.exit(1)

    print("=" * 60)
    print("Kvitt Security Remediation — Migration Runner")
    print("=" * 60)

    try:
        conn = await asyncpg.connect(db_url, timeout=30)
        version = await conn.fetchval("SELECT version()")
        print(f"[OK] Connected to PostgreSQL")
        print(f"  {version[:60]}...")
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        sys.exit(1)

    if args.verify_only:
        print("\n--- Verification Only ---")
        await verify_rls(conn)
        await verify_grants(conn)
        await verify_role(conn)
        await conn.close()
        return

    results = {}
    for phase in sorted(args.phase):
        if phase not in PHASE_FILES:
            print(f"\n[WARN] Unknown phase {phase}, skipping")
            continue
        print(f"\n--- Phase {phase}: {PHASE_FILES[phase]} ---")
        results[phase] = await run_migration(conn, phase)

    print("\n--- Post-Migration Verification ---")
    await verify_rls(conn)
    if 2 in args.phase:
        await verify_grants(conn)
    if 3 in args.phase:
        await verify_role(conn)

    await conn.close()

    print("\n" + "=" * 60)
    all_ok = all(results.values())
    for phase, ok in results.items():
        status = "[OK]" if ok else "[FAIL]"
        print(f"  {status} Phase {phase}: {PHASE_FILES[phase]}")

    if all_ok:
        print("\nAll migrations completed successfully.")
        if 3 in args.phase:
            print("\nNEXT STEPS for Phase 3:")
            print("  1. Set the kvitt_backend password in SQL Editor:")
            print("     ALTER ROLE kvitt_backend PASSWORD 'your_strong_password';")
            print("  2. Update SUPABASE_DB_URL in backend/.env")
            print("  3. Restart backend and verify endpoints")
    else:
        print("\nSome migrations failed. Check errors above.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
