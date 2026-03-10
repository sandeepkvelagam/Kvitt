"""Ledger endpoints: mark paid, request payment, confirm, edit, balances, consolidation.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from dependencies import User, get_current_user, AuditLog, LedgerEntry
from db import queries

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["ledger"])


# ── Pydantic models ──────────────────────────────────────────────

class MarkPaidRequest(BaseModel):
    paid: bool

class LedgerEditRequest(BaseModel):
    amount: float
    reason: str


# ── Routes: Ledger Operations ────────────────────────────────────

@router.put("/ledger/{ledger_id}/paid")
async def mark_paid(ledger_id: str, data: MarkPaidRequest, user: User = Depends(get_current_user)):
    """Mark a ledger entry as paid."""
    entry = await queries.get_ledger_entry(ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    # Only from_user or to_user can mark as paid
    if user.user_id not in [entry["from_user_id"], entry["to_user_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {
        "status": "paid" if data.paid else "pending",
        "paid_at": datetime.now(timezone.utc) if data.paid else None,
        "is_locked": True  # Lock after first status change
    }

    await queries.update_ledger_entry(ledger_id, update_data)

    return {"message": "Status updated"}

@router.post("/ledger/{ledger_id}/request-payment")
async def request_payment(ledger_id: str, user: User = Depends(get_current_user)):
    """Send payment request notification to debtor."""
    from websocket_manager import emit_notification

    entry = await queries.get_ledger_entry(ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    # Only creditor can request payment
    if entry["to_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the creditor can request payment")

    if entry["status"] == "paid":
        raise HTTPException(status_code=400, detail="This debt has already been paid")

    # Get debtor info
    debtor = await queries.get_user(entry["from_user_id"])

    # Create notification for debtor
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": entry["from_user_id"],
        "title": "Payment Requested",
        "message": f"{user.name} is requesting payment of ${entry['amount']:.2f}",
        "type": "payment_request",
        "data": {
            "ledger_id": ledger_id,
            "amount": entry["amount"],
            "creditor_name": user.name,
            "creditor_id": user.user_id
        },
        "channels": ["in_app"],
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    try:
        await queries.insert_notification(notification)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for request_payment: {e}")

    # Send real-time notification via WebSocket
    await emit_notification(entry["from_user_id"], notification)

    return {"status": "requested", "message": f"Payment request sent to {debtor['name'] if debtor else 'user'}"}

@router.post("/ledger/{ledger_id}/confirm-received")
async def confirm_payment_received(ledger_id: str, user: User = Depends(get_current_user)):
    """Creditor confirms they received cash payment."""
    from websocket_manager import emit_notification

    entry = await queries.get_ledger_entry(ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    # Only creditor (to_user_id) can confirm they received payment
    if entry["to_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the creditor can confirm payment received")

    if entry["status"] == "paid":
        raise HTTPException(status_code=400, detail="This payment has already been confirmed")

    # Mark as paid
    await queries.update_ledger_entry(ledger_id, {
            "status": "paid",
            "paid_at": datetime.now(timezone.utc),
            "payment_method": "cash",
            "confirmed_by": user.user_id,
            "is_locked": True
        })

    # Get debtor info for notification
    debtor = await queries.get_user(entry["from_user_id"])

    # Notify debtor that payment was confirmed
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": entry["from_user_id"],
        "title": "Payment Confirmed",
        "message": f"{user.name} confirmed receiving your payment of ${entry['amount']:.2f}",
        "type": "payment_confirmed",
        "data": {
            "ledger_id": ledger_id,
            "amount": entry["amount"],
            "creditor_name": user.name
        },
        "channels": ["in_app"],
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    try:
        await queries.insert_notification(notification)
    except Exception as e:
        logger.error(f"Non-critical: notification insert failed for confirm_payment: {e}")

    # Send real-time notification via WebSocket
    await emit_notification(entry["from_user_id"], notification)

    return {"status": "confirmed", "message": f"Payment of ${entry['amount']:.2f} confirmed as received"}

@router.put("/ledger/{ledger_id}/edit")
async def edit_ledger(ledger_id: str, data: LedgerEditRequest, user: User = Depends(get_current_user)):
    """Edit a locked ledger entry (admin only with reason)."""
    entry = await queries.get_ledger_entry(ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    # Check admin status
    membership = await queries.get_group_member(entry["group_id"], user.user_id)
    if not membership or membership["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Create audit log
    audit = AuditLog(
        entity_type="ledger",
        entity_id=ledger_id,
        action="update",
        old_value={"amount": entry["amount"]},
        new_value={"amount": data.amount},
        changed_by=user.user_id,
        reason=data.reason
    )
    audit_dict = audit.model_dump()
    await queries.insert_audit_log(audit_dict)

    # Update entry
    await queries.update_ledger_entry(ledger_id, {"amount": data.amount})

    return {"message": "Ledger entry updated"}


# ── Routes: Ledger Consolidation ─────────────────────────────────

@router.get("/ledger/balances")
async def get_balances(user: User = Depends(get_current_user)):
    """Get overall balance summary (who owes/is owed)."""
    # Amounts user owes
    owes = await queries.find_ledger_entries({'from_user_id': user.user_id, "status": "pending"}, limit=100)

    # Amounts owed to user
    owed = await queries.find_ledger_entries({'to_user_id': user.user_id, "status": "pending"}, limit=100)

    total_owes = sum(e["amount"] for e in owes)
    total_owed = sum(e["amount"] for e in owed)

    # Add user info to entries
    for entry in owes:
        to_user = await queries.get_user(entry["to_user_id"])
        entry["to_user"] = to_user

    for entry in owed:
        from_user = await queries.get_user(entry["from_user_id"])
        entry["from_user"] = from_user

    return {
        "total_owes": round(total_owes, 2),
        "total_owed": round(total_owed, 2),
        # Aliases for mobile compatibility
        "you_owe": round(total_owes, 2),
        "owed_to_you": round(total_owed, 2),
        "net_balance": round(total_owed - total_owes, 2),
        "owes": owes,
        "owed": owed
    }


@router.get("/ledger/consolidated")
async def get_consolidated_balances(user: User = Depends(get_current_user)):
    """
    Get consolidated balances - debts grouped by person across ALL games.

    This endpoint consolidates multiple game debts between the same two players
    into a single net balance, reducing transaction complexity.

    Example: If you owe John $20 from Game A and John owes you $15 from Game B,
    the consolidated view shows: You owe John $5 (net).
    """
    # Get all pending ledger entries involving this user
    all_entries = await queries.find_ledger_entries_by_user(user.user_id, status="pending")

    # Consolidate by person
    person_balances = {}  # other_user_id -> net_amount (positive = they owe you)

    for entry in all_entries:
        if entry["from_user_id"] == user.user_id:
            # You owe them
            other_user = entry["to_user_id"]
            person_balances[other_user] = person_balances.get(other_user, 0) - entry["amount"]
        else:
            # They owe you
            other_user = entry["from_user_id"]
            person_balances[other_user] = person_balances.get(other_user, 0) + entry["amount"]

    # Build response with user info
    consolidated = []
    for other_user_id, net_amount in person_balances.items():
        if abs(net_amount) < 0.01:
            continue  # Skip settled balances

        other_user = await queries.get_user(other_user_id)

        consolidated.append({
            "user": other_user,
            "net_amount": round(net_amount, 2),
            "direction": "owed_to_you" if net_amount > 0 else "you_owe",
            "display_amount": round(abs(net_amount), 2)
        })

    # Sort by absolute amount (largest debts first)
    consolidated.sort(key=lambda x: -x["display_amount"])

    # Calculate totals
    total_you_owe = sum(-b["net_amount"] for b in consolidated if b["net_amount"] < 0)
    total_owed_to_you = sum(b["net_amount"] for b in consolidated if b["net_amount"] > 0)

    return {
        "consolidated": consolidated,
        "total_you_owe": round(total_you_owe, 2),
        "total_owed_to_you": round(total_owed_to_you, 2),
        "net_balance": round(total_owed_to_you - total_you_owe, 2),
        "people_count": len(consolidated)
    }


@router.get("/ledger/consolidated-detailed")
async def get_consolidated_balances_detailed(user: User = Depends(get_current_user)):
    """
    Enhanced consolidated balances with per-game breakdown.
    Read-only computation — no mutations. Groups all pending ledger entries
    by (other_user, game_id) and computes netting explanation.
    """
    all_entries = await queries.find_ledger_entries_by_user(user.user_id, status="pending")

    # Group entries by (other_person, game_id)
    person_games = {}  # other_user_id -> {game_id -> {"entries": [], "net": 0}}

    for entry in all_entries:
        if entry["from_user_id"] == user.user_id:
            other_user = entry["to_user_id"]
            amount = -entry["amount"]  # negative = you owe
        else:
            other_user = entry["from_user_id"]
            amount = entry["amount"]  # positive = owed to you

        if other_user not in person_games:
            person_games[other_user] = {}

        game_id = entry.get("game_id", "unknown")
        if game_id not in person_games[other_user]:
            person_games[other_user][game_id] = {"entries": [], "net": 0}
        person_games[other_user][game_id]["entries"].append(entry)
        person_games[other_user][game_id]["net"] += amount

    # Build response with user info and game details
    consolidated = []
    for other_user_id, games in person_games.items():
        total_net = sum(g["net"] for g in games.values())

        if abs(total_net) < 0.01:
            continue  # Settled — skip

        other_user = await queries.get_user(other_user_id)

        # Fetch game details for each game
        game_breakdown = []
        for game_id, game_data in games.items():
            game_info = await queries.get_game_night(game_id)
            game_breakdown.append({
                "game_id": game_id,
                "game_title": game_info.get("title", "Game Night") if game_info else "Game",
                "game_date": game_info.get("ended_at") if game_info else None,
                "amount": round(abs(game_data["net"]), 2),
                "direction": "owed_to_you" if game_data["net"] > 0 else "you_owe",
                "ledger_ids": [e["ledger_id"] for e in game_data["entries"]]
            })

        # Sort game breakdown by date (newest first)
        game_breakdown.sort(key=lambda g: g.get("game_date") or "", reverse=True)

        # Compute offset explanation (only when debts flow both ways)
        you_owe_games = [g for g in game_breakdown if g["direction"] == "you_owe"]
        they_owe_games = [g for g in game_breakdown if g["direction"] == "owed_to_you"]

        offset_explanation = None
        if you_owe_games and they_owe_games:
            gross_you_owe = sum(g["amount"] for g in you_owe_games)
            gross_they_owe = sum(g["amount"] for g in they_owe_games)
            offset_amount = min(gross_you_owe, gross_they_owe)
            offset_explanation = {
                "offset_amount": round(offset_amount, 2),
                "gross_you_owe": round(gross_you_owe, 2),
                "gross_they_owe": round(gross_they_owe, 2)
            }

        # Collect all ledger_ids across games for this person
        all_ledger_ids = []
        for g in game_breakdown:
            all_ledger_ids.extend(g["ledger_ids"])

        consolidated.append({
            "user": other_user,
            "net_amount": round(total_net, 2),
            "direction": "owed_to_you" if total_net > 0 else "you_owe",
            "display_amount": round(abs(total_net), 2),
            "game_count": len(games),
            "game_breakdown": game_breakdown,
            "offset_explanation": offset_explanation,
            "all_ledger_ids": all_ledger_ids
        })

    consolidated.sort(key=lambda x: -x["display_amount"])

    total_you_owe = sum(-b["net_amount"] for b in consolidated if b["net_amount"] < 0)
    total_owed_to_you = sum(b["net_amount"] for b in consolidated if b["net_amount"] > 0)

    return {
        "consolidated": consolidated,
        "total_you_owe": round(total_you_owe, 2),
        "total_owed_to_you": round(total_owed_to_you, 2),
        "net_balance": round(total_owed_to_you - total_you_owe, 2),
        "people_count": len(consolidated)
    }


@router.post("/ledger/optimize")
async def optimize_ledger(user: User = Depends(get_current_user)):
    """
    Optimize ledger entries by consolidating cross-game debts between same players.

    This creates new consolidated entries and marks old ones as consolidated.
    Only processes entries where the current user is involved.
    """
    # Get all pending entries for this user
    all_entries = await queries.find_ledger_entries_by_user(user.user_id, status="pending")

    if len(all_entries) <= 1:
        return {"message": "No optimization needed", "optimized": 0}

    # Group by person and calculate net
    person_entries = {}  # other_user_id -> list of ledger_ids
    person_net = {}  # other_user_id -> net_amount

    for entry in all_entries:
        if entry["from_user_id"] == user.user_id:
            other_user = entry["to_user_id"]
            if other_user not in person_entries:
                person_entries[other_user] = []
                person_net[other_user] = 0
            person_entries[other_user].append(entry["ledger_id"])
            person_net[other_user] -= entry["amount"]
        else:
            other_user = entry["from_user_id"]
            if other_user not in person_entries:
                person_entries[other_user] = []
                person_net[other_user] = 0
            person_entries[other_user].append(entry["ledger_id"])
            person_net[other_user] += entry["amount"]

    optimized_count = 0

    for other_user_id, entry_ids in person_entries.items():
        if len(entry_ids) <= 1:
            continue  # Nothing to consolidate

        net = person_net[other_user_id]
        if abs(net) < 0.01:
            # They cancel out - mark all as paid
            await queries.update_ledger_entries_by_ids(entry_ids, {"status": "consolidated", "consolidated_at": datetime.now(timezone.utc)})
            optimized_count += len(entry_ids)
        else:
            # Create one consolidated entry
            from_user = user.user_id if net < 0 else other_user_id
            to_user = other_user_id if net < 0 else user.user_id

            # Mark old entries as consolidated
            await queries.update_ledger_entries_by_ids(entry_ids, {"status": "consolidated", "consolidated_at": datetime.now(timezone.utc)})

            # Create new consolidated entry
            new_entry = LedgerEntry(
                group_id="consolidated",
                game_id="consolidated",
                from_user_id=from_user,
                to_user_id=to_user,
                amount=round(abs(net), 2),
                notes=f"Consolidated from {len(entry_ids)} entries"
            )
            entry_dict = new_entry.model_dump()
            await queries.insert_ledger_entry(entry_dict)

            optimized_count += len(entry_ids)

    return {
        "message": "Ledger optimized",
        "optimized": optimized_count,
        "entries_consolidated": optimized_count
    }
