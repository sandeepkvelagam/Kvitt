"""Debug/diagnostics endpoints: user data inspection and data fixes.
Extracted from server.py — pure mechanical move, zero behavior changes."""

from fastapi import APIRouter, Depends

from dependencies import User, get_current_user
from db import queries

router = APIRouter(prefix="/api", tags=["debug"])


# ── Routes ────────────────────────────────────────────────────────

@router.get("/debug/user-data")
async def debug_user_data(user: User = Depends(get_current_user)):
    """Debug endpoint to diagnose user data issues."""
    result = {
        "current_user": {
            "user_id": user.user_id,
            "email": user.email,
            "name": user.name
        },
        "user_record": None,
        "group_memberships": [],
        "player_records": [],
        "notifications": [],
        "issues": []
    }

    # Get full user record
    user_doc = await queries.get_user(user.user_id)
    result["user_record"] = user_doc

    # Check for duplicate users with same email
    duplicate_users = await queries.find_users({"email": user.email}, limit=10)
    if len(duplicate_users) > 1:
        result["issues"].append({
            "type": "duplicate_users",
            "message": f"Found {len(duplicate_users)} users with same email",
            "users": duplicate_users
        })

    # Get group memberships
    memberships = await queries.find_group_members_by_user(user.user_id, limit=100)
    result["group_memberships"] = memberships

    # Get player records
    players = await queries.find_players_by_user(user.user_id, limit=100)
    result["player_records"] = players

    # Get recent notifications
    notifications = await queries.find_notifications({"user_id": user.user_id}, limit=10)
    result["notifications"] = notifications

    # Check for orphaned records (records with mismatched user_id)
    # Check memberships by email
    if user.email:
        alt_user_ids = [u["user_id"] for u in duplicate_users if u["user_id"] != user.user_id]
        if alt_user_ids:
            # Check for records with alternate user_ids
            alt_memberships = await queries.find_group_members_by_user_ids(alt_user_ids)
            if alt_memberships:
                result["issues"].append({
                    "type": "orphaned_memberships",
                    "message": f"Found {len(alt_memberships)} group memberships with alternate user_id",
                    "records": alt_memberships
                })

            alt_players = await queries.find_players_by_user_ids(alt_user_ids)
            if alt_players:
                result["issues"].append({
                    "type": "orphaned_players",
                    "message": f"Found {len(alt_players)} player records with alternate user_id",
                    "records": alt_players
                })

            alt_notifications = await queries.find_notifications_by_user_ids(alt_user_ids)
            if alt_notifications:
                result["issues"].append({
                    "type": "orphaned_notifications",
                    "message": f"Found {len(alt_notifications)} notifications with alternate user_id",
                    "records": alt_notifications
                })

    return result

@router.post("/debug/fix-user-data")
async def fix_user_data(user: User = Depends(get_current_user)):
    """Fix user data issues by consolidating records to the current user_id."""
    fixes = {
        "memberships_fixed": 0,
        "players_fixed": 0,
        "notifications_fixed": 0,
        "duplicate_users_merged": 0
    }

    # Find duplicate users with same email
    duplicate_users = await queries.find_duplicate_users_by_email(user.email, user.user_id)

    alt_user_ids = [u["user_id"] for u in duplicate_users]

    if alt_user_ids:
        # Update group memberships
        memberships_fixed = await queries.update_group_members_user_id(alt_user_ids, user.user_id)
        fixes["memberships_fixed"] = memberships_fixed

        # Update player records
        players_fixed = await queries.update_players_user_id(alt_user_ids, user.user_id)
        fixes["players_fixed"] = players_fixed

        # Update notifications
        notifications_fixed = await queries.update_notifications_user_id(alt_user_ids, user.user_id)
        fixes["notifications_fixed"] = notifications_fixed

        # Update transactions
        await queries.update_transactions_user_id(alt_user_ids, user.user_id)

        # Update game threads
        await queries.update_game_threads_user_id(alt_user_ids, user.user_id)

        # Update ledger entries
        await queries.update_ledger_entries_user_id(alt_user_ids, user.user_id)

        # Delete duplicate user records
        deleted_count = await queries.delete_users_by_ids(alt_user_ids)
        fixes["duplicate_users_merged"] = deleted_count

    return {
        "message": "User data fixed",
        "fixes": fixes,
        "current_user_id": user.user_id
    }

@router.get("/debug/my-data")
async def debug_my_data(user: User = Depends(get_current_user)):
    """Debug endpoint to show all user data"""
    # Current memberships
    memberships = await queries.find_group_members_by_user(user.user_id, limit=100)

    membership_groups = []
    for m in memberships:
        group = await queries.get_group(m["group_id"])
        membership_groups.append({
            "group_id": m["group_id"],
            "group_name": group["name"] if group else "Unknown",
            "role": m["role"],
            "joined_at": m.get("joined_at")
        })

    # All games played
    players = await queries.find_players_by_user(user.user_id, limit=100)

    games_by_group = {}
    for p in players:
        game = await queries.get_game_night(p["game_id"])
        if game:
            group_id = game["group_id"]
            if group_id not in games_by_group:
                group = await queries.get_group(group_id)
                is_member = any(m["group_id"] == group_id for m in memberships)
                games_by_group[group_id] = {
                    "group_name": group["name"] if group else "Deleted Group",
                    "is_current_member": is_member,
                    "games": []
                }
            games_by_group[group_id]["games"].append({
                "game_id": p["game_id"],
                "net_result": p.get("net_result"),
                "status": game["status"]
            })

    return {
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "name": user.name
        },
        "current_memberships": len(memberships),
        "membership_details": membership_groups,
        "total_games_played": len(players),
        "groups_with_games": games_by_group
    }
