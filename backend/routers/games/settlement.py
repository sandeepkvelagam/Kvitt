"""Settlement algorithm: deterministic minimum-transaction optimization."""

import uuid
import logging
from datetime import datetime, timezone

from dependencies import LedgerEntry
from db import queries

logger = logging.getLogger(__name__)


def optimize_settlement(net_results: list) -> dict:
    """
    Deterministic minimum-transaction settlement algorithm.
    All math in integer cents — no float arithmetic.

    Input:  [{"user_id": str, "net_cents": int}]
            positive = should receive, negative = owes
    Output: {
        "transfers": [{"from_user_id", "to_user_id", "amount_cents": int}],
        "stats": {"possible_payments": int, "optimized_payments": int}
    }
    """
    # Build creditor/debtor lists
    creditors = []  # (user_id, amount_cents) — positive
    debtors = []    # (user_id, amount_cents) — positive (abs of what they owe)

    for p in net_results:
        cents = p["net_cents"]
        if cents > 0:
            creditors.append((p["user_id"], cents))
        elif cents < 0:
            debtors.append((p["user_id"], -cents))

    # Deterministic sort: descending by amount, tie-break by user_id
    creditors.sort(key=lambda x: (-x[1], x[0]))
    debtors.sort(key=lambda x: (-x[1], x[0]))

    # Verify balance: total debts must equal total credits
    total_credit = sum(c[1] for c in creditors)
    total_debt = sum(d[1] for d in debtors)

    # Handle tiny rounding remainder (1 cent max) — assign to largest creditor
    if total_debt != total_credit and abs(total_debt - total_credit) <= 1 and creditors:
        diff = total_debt - total_credit
        creditors[0] = (creditors[0][0], creditors[0][1] + diff)
        total_credit += diff

    # Count active players (non-zero net) for possible payments calc
    active_players = len(creditors) + len(debtors)
    possible_payments = (active_players * (active_players - 1)) // 2 if active_players > 1 else 0

    # Greedy matching
    transfers = []
    i, j = 0, 0

    while i < len(debtors) and j < len(creditors):
        debtor_id, debtor_amt = debtors[i]
        creditor_id, creditor_amt = creditors[j]

        pay = min(debtor_amt, creditor_amt)

        if pay > 0:
            transfers.append({
                "from_user_id": debtor_id,
                "to_user_id": creditor_id,
                "amount_cents": pay
            })

        debtors[i] = (debtor_id, debtor_amt - pay)
        creditors[j] = (creditor_id, creditor_amt - pay)

        if debtors[i][1] <= 0:
            i += 1
        if creditors[j][1] <= 0:
            j += 1

    return {
        "transfers": transfers,
        "stats": {
            "possible_payments": possible_payments,
            "optimized_payments": len(transfers)
        }
    }


async def auto_generate_settlement(game_id: str, game: dict, players: list, generated_by: str = "system") -> dict:
    """
    Smart Settlement — generates optimized settlement using integer cents.
    Returns: {"settlements": [...], "stats": {...}}
    """
    # Build net_results in cents (skip players without cash_out)
    net_results = []
    input_snapshot = []
    for p in players:
        buy_in = p.get("total_buy_in", 0)
        cash_out = p.get("cash_out")
        if cash_out is None:
            continue
        net_cents = round((cash_out - buy_in) * 100)
        net_results.append({"user_id": p["user_id"], "net_cents": net_cents})
        input_snapshot.append({
            "user_id": p["user_id"],
            "buy_in": buy_in,
            "cash_out": cash_out,
            "net_cents": net_cents
        })

    # Run deterministic optimization
    result = optimize_settlement(net_results)
    transfers = result["transfers"]
    stats = result["stats"]

    # Convert cents back to float for storage (backwards compat)
    settlements = []
    for t in transfers:
        settlements.append({
            "from_user_id": t["from_user_id"],
            "to_user_id": t["to_user_id"],
            "amount": round(t["amount_cents"] / 100, 2)
        })

    # Delete any existing settlements for this game
    await queries.delete_ledger_entries_by_game(game_id)

    # Create ledger entries
    created_ledger_ids = []
    for s in settlements:
        entry = LedgerEntry(
            group_id=game["group_id"],
            game_id=game_id,
            from_user_id=s["from_user_id"],
            to_user_id=s["to_user_id"],
            amount=s["amount"]
        )
        entry_dict = entry.model_dump()
        await queries.insert_ledger_entry(entry_dict)
        created_ledger_ids.append(entry.ledger_id)

    # Update game status to settled + locked (preserve ended_at from end_game; set if missing)
    game_row = await queries.get_game_night(game_id) or game
    settled_updates: dict = {
        "status": "settled",
        "is_finalized": True,
        "is_locked": True,
        "updated_at": datetime.now(timezone.utc),
    }
    if not game_row.get("ended_at"):
        settled_updates["ended_at"] = datetime.now(timezone.utc)
    await queries.update_game_night(game_id, settled_updates)

    # Settlement audit trail
    existing_runs = await queries.count_settlement_runs_by_game(game_id)
    settlement_version = existing_runs + 1

    audit_record = {
        "run_id": f"srun_{uuid.uuid4().hex[:12]}",
        "game_id": game_id,
        "settlement_version": settlement_version,
        "generated_at": datetime.now(timezone.utc),
        "generated_by": generated_by,
        "algorithm_version": "greedy_v2_cents",
        "input_snapshot": {"players": input_snapshot},
        "output_payments_count": len(settlements),
        "output_total_amount_cents": sum(t["amount_cents"] for t in transfers),
        "ledger_ids": created_ledger_ids,
        "stats": stats
    }
    await queries.insert_settlement_run(audit_record)

    logger.info(f"Settlement v{settlement_version} for game {game_id}: {stats['optimized_payments']} transactions (from {stats['possible_payments']} possible)")
    return {"settlements": settlements, "stats": stats, "audit": {"version": settlement_version, "algorithm": "greedy_v2_cents"}}
