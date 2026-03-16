"""User profile endpoints: update profile, search, badges, levels, game history.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import os
from datetime import date, datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from dependencies import User, get_current_user
from db import queries

router = APIRouter(prefix="/api", tags=["users"])

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5 MB


# ── Constants ─────────────────────────────────────────────────────

LEVELS = [
    {"name": "Rookie", "min_games": 0, "min_profit": -999999, "icon": "🎯"},
    {"name": "Regular", "min_games": 5, "min_profit": -999999, "icon": "🃏"},
    {"name": "Pro", "min_games": 20, "min_profit": 0, "icon": "⭐"},
    {"name": "VIP", "min_games": 50, "min_profit": 100, "icon": "💎"},
    {"name": "Legend", "min_games": 100, "min_profit": 500, "icon": "👑"}
]

BADGES = [
    # Streak badges (6)
    {"id": "streak_3", "name": "Rookie", "description": "3 day streak", "icon": "🔥", "category": "streak"},
    {"id": "streak_10", "name": "Getting Serious", "description": "10 day streak", "icon": "🔥", "category": "streak"},
    {"id": "streak_50", "name": "Locked In", "description": "50 day streak", "icon": "🔥", "category": "streak"},
    {"id": "streak_100", "name": "Triple Threat", "description": "100 day streak", "icon": "🔥", "category": "streak"},
    {"id": "streak_365", "name": "No Days Off", "description": "365 day streak", "icon": "🔥", "category": "streak"},
    {"id": "streak_1000", "name": "Immortal", "description": "1000 day streak", "icon": "🔥", "category": "streak"},
    # Games played badges (6)
    {"id": "games_1", "name": "First Deal", "description": "Play your first game", "icon": "🃏", "category": "games"},
    {"id": "games_5", "name": "Forking Around", "description": "Play 5 games", "icon": "🎲", "category": "games"},
    {"id": "games_10", "name": "Dedicated", "description": "Play 10 games", "icon": "🎲", "category": "games"},
    {"id": "games_50", "name": "Mission: Poker", "description": "Play 50 games", "icon": "🎖️", "category": "games"},
    {"id": "games_100", "name": "Centurion", "description": "Play 100 games", "icon": "🏅", "category": "games"},
    {"id": "games_500", "name": "The Grinder", "description": "Play 500 games", "icon": "👑", "category": "games"},
    # Winning badges (6)
    {"id": "first_win", "name": "First Blood", "description": "Win your first game", "icon": "🏆", "category": "winning"},
    {"id": "winning_streak_3", "name": "Hot Streak", "description": "Win 3 games in a row", "icon": "🔥", "category": "winning"},
    {"id": "winning_streak_5", "name": "On Fire", "description": "Win 5 games in a row", "icon": "💥", "category": "winning"},
    {"id": "wins_10", "name": "Double Digits", "description": "Win 10 games", "icon": "🥇", "category": "winning"},
    {"id": "wins_50", "name": "Shark", "description": "Win 50 games", "icon": "🦈", "category": "winning"},
    {"id": "wins_100", "name": "Unstoppable", "description": "Win 100 games", "icon": "⚡", "category": "winning"},
    # Profit badges (6)
    {"id": "big_win", "name": "Big Winner", "description": "Win $100+ in a single game", "icon": "💰", "category": "profit"},
    {"id": "huge_win", "name": "Jackpot", "description": "Win $500+ in a single game", "icon": "🎰", "category": "profit"},
    {"id": "profit_1k", "name": "Four Figures", "description": "$1,000 total profit", "icon": "💵", "category": "profit"},
    {"id": "profit_5k", "name": "High Roller", "description": "$5,000 total profit", "icon": "💎", "category": "profit"},
    {"id": "profit_10k", "name": "The Whale", "description": "$10,000 total profit", "icon": "🐋", "category": "profit"},
    {"id": "profit_50k", "name": "Mogul", "description": "$50,000 total profit", "icon": "🏦", "category": "profit"},
    # Social badges (6)
    {"id": "first_group", "name": "Welcome", "description": "Join your first group", "icon": "👋", "category": "social"},
    {"id": "groups_3", "name": "Networker", "description": "Join 3 groups", "icon": "🤝", "category": "social"},
    {"id": "groups_5", "name": "Connector", "description": "Join 5 groups", "icon": "🌐", "category": "social"},
    {"id": "social_10", "name": "Social Butterfly", "description": "Play with 10+ different players", "icon": "🦋", "category": "social"},
    {"id": "social_20", "name": "Life of the Party", "description": "Play with 20+ different players", "icon": "🎉", "category": "social"},
    {"id": "host_5", "name": "Host Master", "description": "Host 5 games", "icon": "🏠", "category": "social"},
    # Special badges (6)
    {"id": "comeback", "name": "Comeback Kid", "description": "Win after being down 50%+", "icon": "💪", "category": "special"},
    {"id": "consistent", "name": "Consistent", "description": "Profit in 5 consecutive games", "icon": "📈", "category": "special"},
    {"id": "night_owl", "name": "Night Owl", "description": "Play a game past midnight", "icon": "🦉", "category": "special"},
    {"id": "marathon", "name": "Marathon", "description": "Play a 4+ hour game", "icon": "⏱️", "category": "special"},
    {"id": "perfect_host", "name": "Perfect Host", "description": "Host 10 games with 5+ players", "icon": "⭐", "category": "special"},
    {"id": "legend", "name": "Legend", "description": "Reach Legend level", "icon": "👑", "category": "special"},
]


# ── Routes ────────────────────────────────────────────────────────

@router.put("/users/me")
async def update_user_profile(data: dict, user: User = Depends(get_current_user)):
    """Update current user's profile."""
    allowed_fields = {"name", "nickname", "preferences", "help_improve_ai", "picture"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if update_data:
        await queries.update_user(user.user_id, update_data)

    updated_user = await queries.get_user(user.user_id)
    return updated_user or {"status": "updated"}

@router.post("/users/me/avatar")
async def upload_avatar(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Upload a profile picture to Supabase Storage and update the user's picture URL."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="Storage not configured")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")

    content = await file.read()
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB")

    # Determine file extension from content type
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[file.content_type]
    storage_path = f"{user.user_id}.{ext}"

    # Upload to Supabase Storage (avatars bucket)
    upload_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/avatars/{storage_path}"
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            upload_url,
            content=content,
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": file.content_type,
                "x-upsert": "true",
            },
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Failed to upload avatar to storage")

    # Build public URL and persist
    public_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/avatars/{storage_path}"
    await queries.update_user(user.user_id, {"picture": public_url})

    return {"picture": public_url}

@router.get("/users/search")
async def search_users(query: str, user: User = Depends(get_current_user)):
    """Search for users by name or email."""
    if len(query) < 2:
        return []

    # Search by name or email (case-insensitive)
    users = await queries.search_users(query, exclude_user_id=user.user_id, limit=20)
    return users

@router.post("/users/me/activity")
async def record_activity(user: User = Depends(get_current_user)):
    """Record daily activity for streak tracking."""
    user_doc = await queries.get_user(user.user_id)
    today = date.today()
    last_activity = user_doc.get("last_activity_date")

    # Convert to date if it's a datetime or string
    if isinstance(last_activity, datetime):
        last_activity = last_activity.date()
    elif isinstance(last_activity, str):
        last_activity = datetime.fromisoformat(last_activity).date()

    current_streak = user_doc.get("current_streak", 0) or 0
    longest_streak = user_doc.get("longest_streak", 0) or 0

    if last_activity == today:
        # Already recorded today
        return {
            "streak": current_streak,
            "longest_streak": longest_streak,
            "streak_start_date": user_doc.get("streak_start_date"),
        }

    if last_activity == today.fromordinal(today.toordinal() - 1):
        # Yesterday — extend streak
        current_streak += 1
    else:
        # Gap — reset streak
        current_streak = 1
        await queries.update_user(user.user_id, {
            "streak_start_date": datetime.now(timezone.utc),
        })

    longest_streak = max(longest_streak, current_streak)
    await queries.update_user(user.user_id, {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "last_activity_date": today,
    })

    return {
        "streak": current_streak,
        "longest_streak": longest_streak,
        "streak_start_date": user_doc.get("streak_start_date"),
    }


@router.get("/users/me/badges")
async def get_my_badges(user: User = Depends(get_current_user)):
    """Get current user's badges, level progress, and streak data."""
    user_doc = await queries.get_user(user.user_id)

    # Calculate stats
    players = await queries.find_players_by_user_with_results(user.user_id)

    total_games = len(players)
    total_profit = sum(p.get("net_result", 0) for p in players)
    wins = sum(1 for p in players if p.get("net_result", 0) > 0)
    win_rate = (wins / total_games * 100) if total_games > 0 else 0

    # Determine current level
    current_level = LEVELS[0]
    next_level = None
    for i, level in enumerate(LEVELS):
        if total_games >= level["min_games"] and total_profit >= level["min_profit"]:
            current_level = level
            if i < len(LEVELS) - 1:
                next_level = LEVELS[i + 1]

    # Calculate progress to next level
    progress = None
    if next_level:
        games_needed = max(0, next_level["min_games"] - total_games)
        profit_needed = max(0, next_level["min_profit"] - total_profit)
        progress = {
            "next_level": next_level["name"],
            "games_needed": games_needed,
            "profit_needed": round(profit_needed, 2),
            "games_progress": min(100, (total_games / next_level["min_games"]) * 100) if next_level["min_games"] > 0 else 100
        }

    # Get earned badges
    earned_badges = user_doc.get("badges") or []
    all_badges = []
    for badge in BADGES:
        all_badges.append({
            **badge,
            "earned": badge["id"] in earned_badges
        })

    # Streak data
    current_streak = user_doc.get("current_streak", 0) or 0
    longest_streak = user_doc.get("longest_streak", 0) or 0
    streak_start_date = user_doc.get("streak_start_date")

    return {
        "level": current_level,
        "progress": progress,
        "stats": {
            "total_games": total_games,
            "total_profit": round(total_profit, 2),
            "wins": wins,
            "win_rate": round(win_rate, 1)
        },
        "badges": all_badges,
        "earned_count": len(earned_badges),
        "total_badges": len(BADGES),
        "streak": {
            "current": current_streak,
            "longest": longest_streak,
            "start_date": streak_start_date,
        },
    }

@router.get("/levels")
async def get_levels():
    """Get all level definitions."""
    return {"levels": LEVELS, "badges": BADGES}

@router.get("/users/game-history")
async def get_game_history(user: User = Depends(get_current_user)):
    """Get user's complete game history with stats."""
    # Get all games where user was a player
    player_records = await queries.find_players_by_user(user.user_id)

    game_ids = [p["game_id"] for p in player_records]

    # Get game details
    games = []
    total_winnings = 0
    total_losses = 0
    wins = 0

    for player in player_records:
        game = await queries.get_game_night(player["game_id"])
        if game:
            # Get group info
            group = await queries.get_group(game["group_id"])

            net_result = player.get("net_result", 0)

            games.append({
                "game_id": game["game_id"],
                "title": game.get("title", "Game Night"),
                "status": game["status"],
                "created_at": game.get("created_at", game.get("started_at")),
                "group": {"name": group.get("name") if group else "Unknown"},
                "net_result": net_result if player.get("cashed_out") else None,
                "total_buy_in": player.get("total_buy_in", 0),
                "cashed_out": player.get("cashed_out", False)
            })

            if player.get("cashed_out") and net_result is not None:
                if net_result > 0:
                    total_winnings += net_result
                    wins += 1
                else:
                    total_losses += net_result

    # Sort by date (newest first)
    games.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    # Calculate stats
    completed_games = [g for g in games if g.get("cashed_out")]
    win_rate = (wins / len(completed_games) * 100) if completed_games else 0

    return {
        "games": games,
        "stats": {
            "totalGames": len(games),
            "totalWinnings": total_winnings,
            "totalLosses": total_losses,
            "winRate": win_rate
        }
    }
