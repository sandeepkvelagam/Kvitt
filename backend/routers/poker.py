"""Poker analysis endpoints: analyze hand, history, stats.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import logging
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["poker"])


# ── Pydantic models ──────────────────────────────────────────────

class PokerAnalyzeRequest(BaseModel):
    your_hand: List[str]  # ["A of spades", "K of spades"]
    community_cards: List[str] = []  # ["Q of hearts", "J of diamonds", "10 of clubs"]
    game_id: Optional[str] = None  # Optional link to active game for analytics


# ── Routes ────────────────────────────────────────────────────────

@router.post("/poker/analyze")
async def analyze_poker_hand(data: PokerAnalyzeRequest, user: User = Depends(get_current_user)):
    """
    Analyze poker hand using DETERMINISTIC code evaluation.

    Architecture:
    1. Code-based Hand Evaluator - Accurately identifies the poker hand (no LLM errors)
    2. Rule-based Strategy Advisor - Provides action suggestions based on hand strength
    3. Optional LLM Enhancement - Can add contextual advice (future feature)

    This approach eliminates LLM counting/math errors that caused incorrect hand identification.
    """
    from poker_evaluator import evaluate_hand, get_action_suggestion, get_hand_strength

    # Validation
    if len(data.your_hand) != 2:
        raise HTTPException(status_code=400, detail="Must provide exactly 2 hole cards")

    if len(data.community_cards) < 3:
        raise HTTPException(status_code=400, detail="Must provide at least 3 community cards (flop)")

    if len(data.community_cards) > 5:
        raise HTTPException(status_code=400, detail="Cannot have more than 5 community cards")

    # Check for duplicate cards
    all_cards = data.your_hand + data.community_cards
    normalized = [c.lower().strip() for c in all_cards]
    if len(normalized) != len(set(normalized)):
        raise HTTPException(status_code=400, detail="Duplicate cards detected - each card can only appear once")

    # Determine game stage
    stage = "Pre-flop"
    if len(data.community_cards) == 3:
        stage = "Flop"
    elif len(data.community_cards) == 4:
        stage = "Turn"
    elif len(data.community_cards) == 5:
        stage = "River"

    try:
        # Step 1: DETERMINISTIC hand evaluation (no LLM - 100% accurate)
        evaluation = evaluate_hand(data.your_hand, data.community_cards)

        if "error" in evaluation:
            raise HTTPException(status_code=400, detail=evaluation["error"])

        # Step 2: Rule-based action suggestion
        suggestion = get_action_suggestion(evaluation, stage)

        # Build the result
        analysis_result = {
            "action": suggestion["action"],
            "potential": suggestion["potential"],
            "reasoning": suggestion["reasoning"],
            # Include detailed evaluation for transparency
            "hand_details": {
                "hand_name": evaluation["hand_name"],
                "description": evaluation["description"],
                "strength": get_hand_strength(evaluation["hand_rank"])
            }
        }

        # Log the analysis for analytics
        log_entry = {
            "log_id": str(uuid.uuid4()),
            "user_id": user.user_id,
            "user_name": user.name,
            "game_id": data.game_id,
            "timestamp": datetime.utcnow(),
            "stage": stage,
            "hole_cards": data.your_hand,
            "community_cards": data.community_cards,
            "all_cards": all_cards,
            "evaluation": {
                "hand_rank": int(evaluation["hand_rank"]),
                "hand_name": evaluation["hand_name"],
                "description": evaluation["description"]
            },
            "ai_response": analysis_result,
            "model": "deterministic_v1"  # No longer using LLM for hand evaluation
        }
        await queries.insert_poker_analysis_log(log_entry)

        return analysis_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Poker analysis error: {e}")
        # Log errors for debugging
        error_log = {
            "log_id": str(uuid.uuid4()),
            "user_id": user.user_id,
            "timestamp": datetime.utcnow(),
            "stage": stage,
            "hole_cards": data.your_hand,
            "community_cards": data.community_cards,
            "error": str(e),
            "model": "deterministic_v1"
        }
        await queries.insert_poker_analysis_log(error_log)
        raise HTTPException(status_code=500, detail=f"Failed to analyze hand: {str(e)}")


@router.get("/poker/history")
async def get_poker_history(
    limit: int = 20,
    offset: int = 0,
    user: User = Depends(get_current_user)
):
    """Get user's poker analysis history."""
    logs = await queries.find_poker_analysis_logs_with_response(user.user_id, limit=limit, offset=offset)

    total = await queries.count_poker_analysis_logs_with_response(user.user_id)

    return {
        "history": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/poker/stats")
async def get_poker_stats(user: User = Depends(get_current_user)):
    """Get user's poker analysis statistics and insights."""
    # Get all user's analyses
    logs = await queries.find_all_poker_analysis_logs_with_response(user.user_id, limit=1000)

    if not logs:
        return {
            "total_analyses": 0,
            "message": "No poker hands analyzed yet. Use the AI Assistant to get started!"
        }

    # Calculate stats
    total = len(logs)
    actions = {"FOLD": 0, "CHECK": 0, "CALL": 0, "RAISE": 0}
    potentials = {"Low": 0, "Medium": 0, "High": 0}
    stages = {"Pre-flop": 0, "Flop": 0, "Turn": 0, "River": 0}

    for log in logs:
        ai_resp = log.get("ai_response", {})
        action = ai_resp.get("action", "CHECK")
        potential = ai_resp.get("potential", "Medium")
        stage = log.get("stage", "Flop")

        if action in actions:
            actions[action] += 1
        if potential in potentials:
            potentials[potential] += 1
        if stage in stages:
            stages[stage] += 1

    # Most common action
    most_common_action = max(actions, key=actions.get) if any(actions.values()) else None

    # Calculate percentages
    action_pcts = {k: round(v / total * 100, 1) for k, v in actions.items()}
    potential_pcts = {k: round(v / total * 100, 1) for k, v in potentials.items()}

    # Get recent trend (last 10 hands)
    recent = logs[:10] if len(logs) >= 10 else logs
    recent_high_potential = sum(
        1 for l in recent if l.get("ai_response", {}).get("potential") == "High"
    )

    return {
        "total_analyses": total,
        "action_breakdown": actions,
        "action_percentages": action_pcts,
        "potential_breakdown": potentials,
        "potential_percentages": potential_pcts,
        "stage_breakdown": stages,
        "most_common_suggestion": most_common_action,
        "recent_high_potential_hands": recent_high_potential,
        "insights": {
            "aggressive_play": action_pcts.get("RAISE", 0) > 30,
            "conservative_play": action_pcts.get("FOLD", 0) > 40,
            "strong_hands_ratio": potential_pcts.get("High", 0)
        },
        "first_analysis": logs[-1].get("timestamp") if logs else None,
        "last_analysis": logs[0].get("timestamp") if logs else None
    }
