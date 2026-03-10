"""Premium/Stripe endpoints: plans, checkout, status, webhooks.
Extracted from server.py — pure mechanical move, zero behavior changes."""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries

router = APIRouter(prefix="/api", tags=["premium"])


# ── Pydantic models ──────────────────────────────────────────────

class StripeCheckoutRequest(BaseModel):
    plan_id: str
    origin_url: str


# ── Routes ────────────────────────────────────────────────────────

@router.get("/premium/plans")
async def get_premium_plans():
    """Get available premium plans"""
    from stripe_service import PREMIUM_PLANS
    return {"plans": list(PREMIUM_PLANS.values())}

@router.post("/premium/checkout")
async def create_premium_checkout(data: StripeCheckoutRequest, user: User = Depends(get_current_user)):
    """Create Stripe checkout session for premium upgrade"""
    from stripe_service import create_stripe_checkout

    # Get user email
    user_doc = await queries.get_user(user.user_id)
    user_email = user_doc.get("email", "") if user_doc else ""

    result = await create_stripe_checkout(
        plan_id=data.plan_id,
        origin_url=data.origin_url,
        user_id=user.user_id,
        user_email=user_email,
    )

    return result

@router.get("/premium/status/{session_id}")
async def get_premium_payment_status(session_id: str):
    """Check payment status for a checkout session"""
    from stripe_service import check_payment_status
    return await check_payment_status(session_id)

@router.get("/premium/me")
async def get_my_premium_status(user: User = Depends(get_current_user)):
    """Get current user's premium status"""
    user_doc = await queries.get_user(user.user_id)

    if not user_doc:
        return {"is_premium": False}

    return {
        "is_premium": user_doc.get("is_premium", False),
        "plan": user_doc.get("premium_plan"),
        "until": user_doc.get("premium_until")
    }

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    from stripe_service import handle_stripe_webhook

    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    result = await handle_stripe_webhook(body, signature)
    return result
