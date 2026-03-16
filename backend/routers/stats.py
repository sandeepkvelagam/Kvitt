"""Stats endpoints: personal stats, group stats.
Extracted from server.py — pure mechanical move, zero behavior changes."""

from fastapi import APIRouter, HTTPException, Depends

from dependencies import User, get_current_user
from db import queries

router = APIRouter(prefix="/api", tags=["stats"])


# ── Routes ────────────────────────────────────────────────────────

@router.get("/stats/me")
async def get_my_stats(user: User = Depends(get_current_user)):
    """Get personal statistics."""
    # Get all player records for this user
    players = await queries.find_players_by_user_with_results(user.user_id)

    if not players:
        user_doc = await queries.get_user(user.user_id)
        streak = user_doc.get("current_streak", 0) or 0 if user_doc else 0
        return {
            "total_games": 0,
            "total_buy_ins": 0,
            "total_winnings": 0,
            "net_profit": 0,
            "win_rate": 0,
            "biggest_win": 0,
            "biggest_loss": 0,
            "recent_games": [],
            "streak": streak,
        }

    total_games = len(players)
    total_buy_ins = sum(p.get("total_buy_in", 0) for p in players)
    total_winnings = sum(p.get("cash_out", 0) for p in players)
    net_profit = sum(p.get("net_result", 0) for p in players)
    wins = sum(1 for p in players if p.get("net_result", 0) > 0)
    win_rate = (wins / total_games * 100) if total_games > 0 else 0

    results = [p.get("net_result", 0) for p in players]
    biggest_win = max(results) if results else 0
    biggest_loss = min(results) if results else 0

    # Get recent games
    recent = sorted(players, key=lambda x: x.get("player_id", ""), reverse=True)[:5]
    recent_games = []
    for p in recent:
        game = await queries.get_game_night(p["game_id"])
        if game:
            group = await queries.get_group(game["group_id"])
            recent_games.append({
                "game_id": p["game_id"],
                "group_name": group["name"] if group else "Unknown",
                "net_result": p.get("net_result", 0),
                "date": game.get("ended_at") or game.get("started_at")
            })

    # Get streak data from user record
    user_doc = await queries.get_user(user.user_id)
    streak = user_doc.get("current_streak", 0) or 0 if user_doc else 0

    return {
        "total_games": total_games,
        "total_buy_ins": round(total_buy_ins, 2),
        "total_winnings": round(total_winnings, 2),
        "net_profit": round(net_profit, 2),
        "win_rate": round(win_rate, 1),
        "biggest_win": round(biggest_win, 2),
        "biggest_loss": round(biggest_loss, 2),
        "recent_games": recent_games,
        "streak": streak,
    }

@router.get("/stats/group/{group_id}")
async def get_group_stats(group_id: str, user: User = Depends(get_current_user)):
    """Get group statistics."""
    # Verify membership
    membership = await queries.get_group_member(group_id, user.user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Get all games in group
    games = await queries.find_game_nights({"group_id": group_id}, limit=1000)
    games = [g for g in games if g.get("status") in ("ended", "settled")]

    game_ids = [g["game_id"] for g in games]

    # Get player stats across all games
    leaderboard = await queries.get_leaderboard_by_games(game_ids)

    # Add user info
    for entry in leaderboard:
        user_info = await queries.get_user(entry["user_id"])
        entry["user"] = user_info

    return {
        "total_games": len(games),
        "leaderboard": leaderboard
    }
