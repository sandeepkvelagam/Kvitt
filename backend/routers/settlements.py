"""Debt settlement/payment endpoints: pay debt, pay-net flow, stripe-debt webhook.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends, Request

from dependencies import User, get_current_user
from db import queries

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["settlements"])


# ── Routes ────────────────────────────────────────────────────────

@router.post("/settlements/{ledger_id}/pay")
async def create_debt_payment(ledger_id: str, data: dict, user: User = Depends(get_current_user)):
    """Create a Stripe payment link for settling a debt"""
    from stripe_service import create_debt_payment_link

    # Get ledger entry
    entry = await queries.get_ledger_entry(ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    # Verify the current user is the one who owes money
    if entry["from_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the debtor can initiate payment")

    # Check if already paid
    if entry.get("status") == "paid":
        raise HTTPException(status_code=400, detail="This debt has already been paid")

    # Get recipient info
    to_user = await queries.get_user(entry["to_user_id"])

    origin_url = data.get("origin_url", "")
    if not origin_url:
        raise HTTPException(status_code=400, detail="origin_url required")

    result = await create_debt_payment_link(
        ledger_id=ledger_id,
        from_user_id=user.user_id,
        from_user_email=user.email,
        to_user_id=entry["to_user_id"],
        to_user_name=to_user.get("name", "Unknown"),
        amount=entry["amount"],
        game_id=entry["game_id"],
        origin_url=origin_url,
    )

    return result


# ============== PAY NET FLOW (2-PHASE COMMIT) ==============

@router.post("/ledger/pay-net/prepare")
async def prepare_pay_net(data: dict, user: User = Depends(get_current_user)):
    """
    Prepare a net payment across multiple ledger entries. Creates a plan
    and Stripe session but does NOT mutate any ledger entries.
    Mutations only happen after Stripe webhook confirms success.
    """
    from stripe_service import create_debt_payment_link

    other_user_id = data.get("other_user_id")
    ledger_ids = data.get("ledger_ids", [])
    origin_url = data.get("origin_url", "")

    if not other_user_id or not ledger_ids or not origin_url:
        raise HTTPException(status_code=400, detail="other_user_id, ledger_ids, and origin_url required")

    # Validate all ledger entries
    entries = await queries.find_ledger_entries({"status": "pending"}, limit=100)
    entries = [e for e in entries if e.get("ledger_id") in ledger_ids]

    if len(entries) != len(ledger_ids):
        raise HTTPException(status_code=400, detail="Some ledger entries not found or already paid")

    # Compute net: only entries where current user owes other_user
    net_cents = 0
    valid_ids = []
    for e in entries:
        if e["from_user_id"] == user.user_id and e["to_user_id"] == other_user_id:
            net_cents += round(e["amount"] * 100)
            valid_ids.append(e["ledger_id"])
        elif e["to_user_id"] == user.user_id and e["from_user_id"] == other_user_id:
            net_cents -= round(e["amount"] * 100)
            valid_ids.append(e["ledger_id"])

    if net_cents <= 0:
        raise HTTPException(status_code=400, detail="Net amount must be positive (you must owe)")

    # Get payee info
    payee = await queries.get_user(other_user_id)
    payee_name = payee.get("name", "Unknown") if payee else "Unknown"

    amount_dollars = round(net_cents / 100, 2)

    # Build breakdown for display
    breakdown = []
    for e in entries:
        game_info = await queries.get_game_night(e.get("game_id", ""))
        direction = "you_owe" if e["from_user_id"] == user.user_id else "owed_to_you"
        breakdown.append({
            "game_title": game_info.get("title", "Game") if game_info else "Game",
            "amount": e["amount"],
            "direction": direction
        })

    # Create plan record (no mutation yet)
    plan_id = f"pnp_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    plan = {
        "plan_id": plan_id,
        "payer_id": user.user_id,
        "payee_id": other_user_id,
        "amount_cents": net_cents,
        "ledger_ids": valid_ids,
        "breakdown": breakdown,
        "status": "pending",
        "stripe_session_id": None,
        "created_at": now,
        "expires_at": now + timedelta(minutes=30),
        "completed_at": None
    }

    # Create Stripe checkout session
    import stripe
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment service not configured")

    stripe.api_key = api_key

    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': 'usd',
                'product_data': {
                    'name': f'Net payment to {payee_name}',
                    'description': f'Consolidated settlement across {len(entries)} game(s)',
                },
                'unit_amount': net_cents,
            },
            'quantity': 1,
        }],
        mode='payment',
        success_url=f"{origin_url}/profile?payment=success&plan_id={plan_id}",
        cancel_url=f"{origin_url}/profile?payment=cancelled",
        customer_email=user.email,
        metadata={
            "type": "pay_net",
            "plan_id": plan_id,
            "payer_id": user.user_id,
            "payee_id": other_user_id,
            "amount_cents": str(net_cents)
        }
    )

    plan["stripe_session_id"] = session.id
    await queries.generic_insert("pay_net_plans", plan)

    logger.info(f"Pay-net plan {plan_id} created: {user.user_id} → {other_user_id}, ${amount_dollars}")

    return {
        "plan_id": plan_id,
        "checkout_url": session.url,
        "amount_cents": net_cents,
        "amount": amount_dollars,
        "payee_name": payee_name,
        "breakdown": breakdown
    }


@router.get("/ledger/pay-net/status")
async def get_pay_net_status(plan_id: str, user: User = Depends(get_current_user)):
    """Check status of a pay-net plan."""
    plan = await queries.generic_find_one("pay_net_plans", {"plan_id": plan_id, "payer_id": user.user_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Check expiry
    if plan["status"] == "pending":
        expires_at = datetime.fromisoformat(plan["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            await queries.generic_update("pay_net_plans", {"plan_id": plan_id}, {"status": "expired"})
            return {"status": "expired"}

    return {"status": plan["status"]}


@router.post("/webhook/stripe-debt")
async def stripe_debt_webhook(request: Request):
    """Handle Stripe webhook events for debt payments"""
    from stripe_service import handle_debt_payment_webhook

    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    result = await handle_debt_payment_webhook(body, signature)
    return result
