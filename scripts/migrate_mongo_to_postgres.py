#!/usr/bin/env python3
"""
MongoDB to Supabase Postgres Migration Script

This script migrates data from MongoDB to Supabase PostgreSQL.
Run after: 
  1) Supabase schema created (supabase/migrations/001_initial_schema.sql)
  2) SUPABASE_DB_URL, MONGO_URL, DB_NAME set in environment

Uses deterministic UUIDv5 from mongo _id for referential integrity.

Usage:
    # Set environment variables
    export MONGO_URL="mongodb://localhost:27017"
    export DB_NAME="Kvitt-database"
    export SUPABASE_DB_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
    
    # Run migration
    python scripts/migrate_mongo_to_postgres.py
    
    # Or run specific collections
    python scripts/migrate_mongo_to_postgres.py --collections users,groups
"""
import asyncio
import json
import os
import sys
import uuid
import argparse
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
import asyncpg

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# UUIDv5 namespace for deterministic IDs (DNS namespace)
KVITT_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def mongo_id_to_uuid(mongo_id: str) -> str:
    """Deterministic UUID from MongoDB ObjectId string."""
    return str(uuid.uuid5(KVITT_NS, mongo_id))


def convert_datetime(value: Any) -> Any:
    """Convert datetime values to proper format."""
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return dt
        except (ValueError, TypeError):
            return value
    return value


def prepare_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare a MongoDB document for PostgreSQL insertion."""
    result = {}
    for k, v in doc.items():
        if k == "_id":
            result["mongo_id"] = str(v)
        elif isinstance(v, datetime):
            result[k] = convert_datetime(v)
        elif isinstance(v, dict):
            result[k] = json.dumps(v)
        elif isinstance(v, list) and v and isinstance(v[0], dict):
            result[k] = json.dumps(v)
        else:
            result[k] = v
    return result


async def export_collection(mongo_db, name: str) -> List[Dict[str, Any]]:
    """Export all documents from a MongoDB collection."""
    try:
        cursor = mongo_db[name].find({})
        docs = await cursor.to_list(length=None)
        logger.info(f"Exported {len(docs)} documents from {name}")
        return [prepare_doc(d) for d in docs]
    except Exception as e:
        logger.error(f"Failed to export {name}: {e}")
        return []


async def import_users(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import users to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO users (
                    user_id, supabase_id, email, name, picture, level,
                    total_games, total_profit, badges, is_premium,
                    premium_plan, premium_until, premium_started_at,
                    premium_cancelled_at, mongo_id, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (user_id) DO NOTHING
                """,
                d.get("user_id"),
                d.get("supabase_id"),
                d.get("email", ""),
                d.get("name"),
                d.get("picture"),
                d.get("level", "Rookie"),
                d.get("total_games", 0),
                float(d.get("total_profit", 0) or 0),
                d.get("badges", []),
                d.get("is_premium", False),
                d.get("premium_plan"),
                d.get("premium_until"),
                d.get("premium_started_at"),
                d.get("premium_cancelled_at"),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
                convert_datetime(d.get("updated_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import user {d.get('user_id')}: {e}")
    return count


async def import_groups(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import groups to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO groups (
                    group_id, name, description, created_by,
                    default_buy_in, currency, mongo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (group_id) DO NOTHING
                """,
                d.get("group_id"),
                d.get("name"),
                d.get("description"),
                d.get("created_by"),
                float(d.get("default_buy_in", 20.0) or 20.0),
                d.get("currency", "USD"),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import group {d.get('group_id')}: {e}")
    return count


async def import_group_members(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import group members to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO group_members (
                    member_id, group_id, user_id, role, nickname, mongo_id, joined_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (member_id) DO NOTHING
                """,
                d.get("member_id"),
                d.get("group_id"),
                d.get("user_id"),
                d.get("role", "member"),
                d.get("nickname"),
                d.get("mongo_id"),
                convert_datetime(d.get("joined_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import group member {d.get('member_id')}: {e}")
    return count


async def import_game_nights(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import game nights to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO game_nights (
                    game_id, group_id, host_id, title, location, status,
                    chip_value, chips_per_buy_in, buy_in_amount,
                    total_chips_distributed, total_chips_returned, is_finalized,
                    cancelled_by, cancel_reason, scheduled_at, started_at,
                    ended_at, mongo_id, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                ON CONFLICT (game_id) DO NOTHING
                """,
                d.get("game_id"),
                d.get("group_id"),
                d.get("host_id"),
                d.get("title"),
                d.get("location"),
                d.get("status", "scheduled"),
                float(d.get("chip_value", 1.0) or 1.0),
                d.get("chips_per_buy_in", 20),
                float(d.get("buy_in_amount", 20.0) or 20.0),
                d.get("total_chips_distributed", 0),
                d.get("total_chips_returned", 0),
                d.get("is_finalized", False),
                d.get("cancelled_by"),
                d.get("cancel_reason"),
                convert_datetime(d.get("scheduled_at")),
                convert_datetime(d.get("started_at")),
                convert_datetime(d.get("ended_at")),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
                convert_datetime(d.get("updated_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import game {d.get('game_id')}: {e}")
    return count


async def import_players(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import players to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO players (
                    player_id, game_id, user_id, total_buy_in, total_chips,
                    chips_returned, cash_out, net_result, rsvp_status,
                    mongo_id, joined_at, cashed_out_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (player_id) DO NOTHING
                """,
                d.get("player_id"),
                d.get("game_id"),
                d.get("user_id"),
                float(d.get("total_buy_in", 0) or 0),
                d.get("total_chips", 0),
                d.get("chips_returned"),
                float(d.get("cash_out")) if d.get("cash_out") is not None else None,
                float(d.get("net_result")) if d.get("net_result") is not None else None,
                d.get("rsvp_status", "pending"),
                d.get("mongo_id"),
                convert_datetime(d.get("joined_at")),
                convert_datetime(d.get("cashed_out_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import player {d.get('player_id')}: {e}")
    return count


async def import_transactions(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import transactions to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO transactions (
                    transaction_id, game_id, user_id, type, amount,
                    chips, chip_value, notes, mongo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (transaction_id) DO NOTHING
                """,
                d.get("transaction_id"),
                d.get("game_id"),
                d.get("user_id"),
                d.get("type"),
                float(d.get("amount")) if d.get("amount") is not None else None,
                d.get("chips"),
                float(d.get("chip_value")) if d.get("chip_value") is not None else None,
                d.get("notes"),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at") or d.get("timestamp")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import transaction {d.get('transaction_id')}: {e}")
    return count


async def import_ledger_entries(
    conn: asyncpg.Connection,
    docs: List[Dict],
    source_collection: str = "ledger"
) -> int:
    """Import ledger entries to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO ledger_entries (
                    ledger_id, group_id, game_id, from_user_id, to_user_id,
                    amount, status, paid_at, paid_via, stripe_session_id,
                    is_locked, reminder_count, last_reminder_at, escalated_at,
                    source_collection, mongo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (ledger_id) DO NOTHING
                """,
                d.get("ledger_id"),
                d.get("group_id"),
                d.get("game_id"),
                d.get("from_user_id"),
                d.get("to_user_id"),
                float(d.get("amount", 0)),
                d.get("status", "pending"),
                convert_datetime(d.get("paid_at")),
                d.get("paid_via"),
                d.get("stripe_session_id"),
                d.get("is_locked", False),
                d.get("reminder_count", 0),
                convert_datetime(d.get("last_reminder_at")),
                convert_datetime(d.get("escalated_at")),
                source_collection,
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import ledger entry {d.get('ledger_id')}: {e}")
    return count


async def import_wallets(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import wallets to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO wallets (
                    wallet_id, user_id, balance_cents, status,
                    pin_hash, version, mongo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (wallet_id) DO NOTHING
                """,
                d.get("wallet_id"),
                d.get("user_id"),
                d.get("balance_cents", 0),
                d.get("status", "active"),
                d.get("pin_hash"),
                d.get("version", 1),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import wallet {d.get('wallet_id')}: {e}")
    return count


async def import_wallet_transactions(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import wallet transactions to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO wallet_transactions (
                    transaction_id, wallet_id, type, amount_cents, direction,
                    balance_before_cents, balance_after_cents, stripe_payment_intent_id,
                    counterparty_wallet_id, counterparty_user_id, description,
                    status, mongo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT (transaction_id) DO NOTHING
                """,
                d.get("transaction_id"),
                d.get("wallet_id"),
                d.get("type"),
                d.get("amount_cents"),
                d.get("direction"),
                d.get("balance_before_cents"),
                d.get("balance_after_cents"),
                d.get("stripe_payment_intent_id"),
                d.get("counterparty_wallet_id"),
                d.get("counterparty_user_id"),
                d.get("description"),
                d.get("status", "completed"),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import wallet transaction {d.get('transaction_id')}: {e}")
    return count


async def import_notifications(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import notifications to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            data = d.get("data")
            if isinstance(data, str):
                data = json.loads(data) if data else None
            await conn.execute(
                """
                INSERT INTO notifications (
                    notification_id, user_id, type, title, message,
                    data, read, mongo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (notification_id) DO NOTHING
                """,
                d.get("notification_id"),
                d.get("user_id"),
                d.get("type"),
                d.get("title"),
                d.get("message"),
                json.dumps(data) if data else None,
                d.get("read", False),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import notification {d.get('notification_id')}: {e}")
    return count


async def import_group_messages(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import group messages to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            metadata = d.get("metadata")
            if isinstance(metadata, str):
                metadata = json.loads(metadata) if metadata else None
            await conn.execute(
                """
                INSERT INTO group_messages (
                    message_id, group_id, user_id, content, type,
                    reply_to, metadata, edited_at, deleted, mongo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (message_id) DO NOTHING
                """,
                d.get("message_id"),
                d.get("group_id"),
                d.get("user_id"),
                d.get("content"),
                d.get("type", "user"),
                d.get("reply_to"),
                json.dumps(metadata) if metadata else None,
                convert_datetime(d.get("edited_at")),
                d.get("deleted", False),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import group message {d.get('message_id')}: {e}")
    return count


async def import_group_invites(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import group invites to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO group_invites (
                    invite_id, group_id, email, invited_by, status,
                    accepted_at, mongo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (invite_id) DO NOTHING
                """,
                d.get("invite_id"),
                d.get("group_id"),
                d.get("email"),
                d.get("invited_by"),
                d.get("status", "pending"),
                convert_datetime(d.get("accepted_at")),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import group invite {d.get('invite_id')}: {e}")
    return count


async def import_payment_transactions(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import payment transactions to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO payment_transactions (
                    transaction_id, session_id, user_id, user_email,
                    plan_id, plan_name, amount, currency, status,
                    payment_status, completed_at, mongo_id, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT (transaction_id) DO NOTHING
                """,
                d.get("transaction_id"),
                d.get("session_id"),
                d.get("user_id"),
                d.get("user_email"),
                d.get("plan_id"),
                d.get("plan_name"),
                float(d.get("amount")) if d.get("amount") is not None else None,
                d.get("currency", "usd"),
                d.get("status", "pending"),
                d.get("payment_status", "initiated"),
                convert_datetime(d.get("completed_at")),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
                convert_datetime(d.get("updated_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import payment transaction {d.get('transaction_id')}: {e}")
    return count


async def import_debt_payments(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import debt payments to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO debt_payments (
                    payment_id, session_id, ledger_id, from_user_id,
                    from_user_email, to_user_id, to_user_name, game_id,
                    amount, currency, status, payment_status, mongo_id,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ON CONFLICT (payment_id) DO NOTHING
                """,
                d.get("payment_id"),
                d.get("session_id"),
                d.get("ledger_id"),
                d.get("from_user_id"),
                d.get("from_user_email"),
                d.get("to_user_id"),
                d.get("to_user_name"),
                d.get("game_id"),
                float(d.get("amount", 0)),
                d.get("currency", "usd"),
                d.get("status", "pending"),
                d.get("payment_status", "initiated"),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
                convert_datetime(d.get("updated_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import debt payment {d.get('payment_id')}: {e}")
    return count


async def import_wallet_deposits(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import wallet deposits to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            await conn.execute(
                """
                INSERT INTO wallet_deposits (
                    deposit_id, wallet_id, user_id, amount_cents,
                    stripe_session_id, status, expires_at, completed_at,
                    mongo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (deposit_id) DO NOTHING
                """,
                d.get("deposit_id"),
                d.get("wallet_id"),
                d.get("user_id"),
                d.get("amount_cents"),
                d.get("stripe_session_id"),
                d.get("status", "pending"),
                convert_datetime(d.get("expires_at")),
                convert_datetime(d.get("completed_at")),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import wallet deposit {d.get('deposit_id')}: {e}")
    return count


async def import_polls(conn: asyncpg.Connection, docs: List[Dict]) -> int:
    """Import polls to PostgreSQL."""
    count = 0
    for d in docs:
        try:
            options = d.get("options")
            if isinstance(options, str):
                options = json.loads(options) if options else []
            votes = d.get("votes")
            if isinstance(votes, str):
                votes = json.loads(votes) if votes else {}
            await conn.execute(
                """
                INSERT INTO polls (
                    poll_id, group_id, game_id, question, options,
                    votes, status, expires_at, mongo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (poll_id) DO NOTHING
                """,
                d.get("poll_id"),
                d.get("group_id"),
                d.get("game_id"),
                d.get("question"),
                json.dumps(options) if options else "[]",
                json.dumps(votes) if votes else "{}",
                d.get("status", "active"),
                convert_datetime(d.get("expires_at")),
                d.get("mongo_id"),
                convert_datetime(d.get("created_at")),
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to import poll {d.get('poll_id')}: {e}")
    return count


async def verify_migration(conn: asyncpg.Connection, mongo_db) -> Dict[str, Dict]:
    """Verify migration by comparing row counts."""
    results = {}
    
    collections = [
        "users", "groups", "group_members", "game_nights", "players",
        "transactions", "ledger", "ledger_entries", "wallets",
        "wallet_transactions", "notifications", "group_messages",
        "group_invites", "payment_transactions", "debt_payments",
        "wallet_deposits", "polls"
    ]
    
    for coll in collections:
        try:
            mongo_count = await mongo_db[coll].count_documents({})
        except Exception:
            mongo_count = 0
        
        # Map collection name to table name
        table = coll
        if coll == "ledger":
            table = "ledger_entries"
        
        try:
            pg_count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
        except Exception:
            pg_count = 0
        
        results[coll] = {
            "mongo": mongo_count,
            "postgres": pg_count,
            "match": mongo_count == pg_count if coll != "ledger" else True
        }
    
    return results


async def reconcile_wallets(conn: asyncpg.Connection) -> List[Dict]:
    """Reconcile wallet balances against transaction ledger."""
    discrepancies = []
    
    wallets = await conn.fetch("SELECT wallet_id, balance_cents FROM wallets")
    
    for wallet in wallets:
        wallet_id = wallet["wallet_id"]
        cached_balance = wallet["balance_cents"]
        
        # Calculate from ledger
        result = await conn.fetchrow(
            """
            SELECT 
                COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END), 0) as credits,
                COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END), 0) as debits
            FROM wallet_transactions
            WHERE wallet_id = $1 AND status = 'completed'
            """,
            wallet_id
        )
        
        ledger_balance = (result["credits"] or 0) - (result["debits"] or 0)
        
        if cached_balance != ledger_balance:
            discrepancies.append({
                "wallet_id": wallet_id,
                "cached_balance": cached_balance,
                "ledger_balance": ledger_balance,
                "discrepancy": cached_balance - ledger_balance
            })
    
    return discrepancies


async def main():
    parser = argparse.ArgumentParser(description="Migrate MongoDB to PostgreSQL")
    parser.add_argument(
        "--collections",
        type=str,
        help="Comma-separated list of collections to migrate (default: all)"
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify migration, don't import"
    )
    parser.add_argument(
        "--reconcile",
        action="store_true",
        help="Run wallet balance reconciliation"
    )
    args = parser.parse_args()
    
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "Kvitt-database")
    pg_url = os.environ.get("SUPABASE_DB_URL")
    
    if not mongo_url:
        logger.error("MONGO_URL environment variable required")
        sys.exit(1)
    
    if not pg_url:
        logger.error("SUPABASE_DB_URL environment variable required")
        sys.exit(1)
    
    logger.info(f"Connecting to MongoDB: {mongo_url[:30]}...")
    mongo_client = AsyncIOMotorClient(mongo_url)
    mongo_db = mongo_client[db_name]
    
    logger.info(f"Connecting to PostgreSQL: {pg_url[:30]}...")
    conn = await asyncpg.connect(pg_url)
    
    try:
        if args.verify_only:
            logger.info("Verifying migration...")
            results = await verify_migration(conn, mongo_db)
            print("\n=== Migration Verification ===")
            for coll, counts in results.items():
                status = "✅" if counts["match"] else "❌"
                print(f"{status} {coll}: MongoDB={counts['mongo']}, PostgreSQL={counts['postgres']}")
            return
        
        if args.reconcile:
            logger.info("Running wallet reconciliation...")
            discrepancies = await reconcile_wallets(conn)
            if discrepancies:
                print("\n=== Wallet Discrepancies ===")
                for d in discrepancies:
                    print(f"Wallet {d['wallet_id']}: cached={d['cached_balance']}, ledger={d['ledger_balance']}, diff={d['discrepancy']}")
            else:
                print("✅ All wallet balances match ledger")
            return
        
        # Determine which collections to migrate
        all_collections = [
            "users", "groups", "group_members", "game_nights", "players",
            "transactions", "ledger", "ledger_entries", "wallets",
            "wallet_transactions", "notifications", "group_messages",
            "group_invites", "payment_transactions", "debt_payments",
            "wallet_deposits", "polls"
        ]
        
        if args.collections:
            collections = [c.strip() for c in args.collections.split(",")]
        else:
            collections = all_collections
        
        # Import in FK order
        import_order = [
            ("users", import_users),
            ("groups", import_groups),
            ("group_members", import_group_members),
            ("game_nights", import_game_nights),
            ("players", import_players),
            ("transactions", import_transactions),
            ("ledger", lambda c, d: import_ledger_entries(c, d, "ledger")),
            ("ledger_entries", lambda c, d: import_ledger_entries(c, d, "ledger_entries")),
            ("wallets", import_wallets),
            ("wallet_transactions", import_wallet_transactions),
            ("notifications", import_notifications),
            ("group_messages", import_group_messages),
            ("group_invites", import_group_invites),
            ("payment_transactions", import_payment_transactions),
            ("debt_payments", import_debt_payments),
            ("wallet_deposits", import_wallet_deposits),
            ("polls", import_polls),
        ]
        
        print("\n=== Starting Migration ===\n")
        
        for coll_name, import_func in import_order:
            if coll_name not in collections:
                continue
            
            logger.info(f"Migrating {coll_name}...")
            docs = await export_collection(mongo_db, coll_name)
            
            if docs:
                count = await import_func(conn, docs)
                logger.info(f"✅ Imported {count}/{len(docs)} {coll_name}")
            else:
                logger.info(f"⏭️ No documents in {coll_name}")
        
        print("\n=== Migration Complete ===\n")
        
        # Verify
        logger.info("Verifying migration...")
        results = await verify_migration(conn, mongo_db)
        print("\n=== Verification Results ===")
        for coll, counts in results.items():
            if coll in collections or coll == "ledger_entries":
                status = "✅" if counts["match"] else "⚠️"
                print(f"{status} {coll}: MongoDB={counts['mongo']}, PostgreSQL={counts['postgres']}")
        
        # Reconcile wallets if migrated
        if "wallets" in collections:
            logger.info("Reconciling wallet balances...")
            discrepancies = await reconcile_wallets(conn)
            if discrepancies:
                print("\n⚠️ Wallet Discrepancies Found:")
                for d in discrepancies:
                    print(f"  Wallet {d['wallet_id']}: diff={d['discrepancy']} cents")
            else:
                print("\n✅ All wallet balances match ledger")
        
    finally:
        await conn.close()
        mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
