"""User profile endpoints: update profile, search, badges, levels, game history.
Extracted from server.py — pure mechanical move, zero behavior changes."""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries

router = APIRouter(prefix="/api", tags=["users"])


# ── Constants ─────────────────────────────────────────────────────

LEVELS = [
    {"name": "Rookie", "min_games": 0, "min_profit": -999999, "icon": "🎯"},
    {"name": "Regular", "min_games": 5, "min_profit": -999999, "icon": "🃏"},
    {"name": "Pro", "min_games": 20, "min_profit": 0, "icon": "⭐"},
    {"name": "VIP", "min_games": 50, "min_profit": 100, "icon": "💎"},
    {"name": "Legend", "min_games": 100, "min_profit": 500, "icon": "👑"}
]

BADGES = [
    {"id": "first_win", "name": "First Blood", "description": "Win your first game", "icon": "🏆"},
    {"id": "winning_streak_3", "name": "Hot Streak", "description": "Win 3 games in a row", "icon": "🔥"},
    {"id": "winning_streak_5", "name": "On Fire", "description": "Win 5 games in a row", "icon": "💥"},
    {"id": "big_win", "name": "Big Winner", "description": "Win $100+ in a single game", "icon": "💰"},
    {"id": "huge_win", "name": "Jackpot", "description": "Win $500+ in a single game", "icon": "🎰"},
    {"id": "games_10", "name": "Dedicated", "description": "Play 10 games", "icon": "🎲"},
    {"id": "games_50", "name": "Veteran", "description": "Play 50 games", "icon": "🎖️"},
    {"id": "games_100", "name": "Centurion", "description": "Play 100 games", "icon": "🏅"},
    {"id": "host_5", "name": "Host Master", "description": "Host 5 games", "icon": "🏠"},
    {"id": "comeback", "name": "Comeback Kid", "description": "Win after being down 50%+", "icon": "💪"},
    {"id": "consistent", "name": "Consistent", "description": "Profit in 5 consecutive games", "icon": "📈"},
    {"id": "social", "name": "Social Butterfly", "description": "Play with 10+ different players", "icon": "🦋"},
]


# ── Routes ────────────────────────────────────────────────────────

@router.put("/users/me")
async def update_user_profile(data: dict, user: User = Depends(get_current_user)):
    """Update current user's profile."""
    allowed_fields = {"name", "nickname", "preferences", "help_improve_ai"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if update_data:
        await queries.update_user(user.user_id, update_data)

    updated_user = await queries.get_user(user.user_id)
    return updated_user or {"status": "updated"}

@router.get("/users/search")
async def search_users(query: str, user: User = Depends(get_current_user)):
    """Search for users by name or email."""
    if len(query) < 2:
        return []

    # Search by name or email (case-insensitive)
    users = await queries.search_users(query, exclude_user_id=user.user_id, limit=20)
    return users

@router.get("/users/me/badges")
async def get_my_badges(user: User = Depends(get_current_user)):
    """Get current user's badges and level progress."""
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
    earned_badges = user_doc.get("badges", [])
    all_badges = []
    for badge in BADGES:
        all_badges.append({
            **badge,
            "earned": badge["id"] in earned_badges
        })

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
        "total_badges": len(BADGES)
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
