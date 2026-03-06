"""
Stripe Payments Integration for Kvitt Premium
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Request, Depends

from db import queries

logger = logging.getLogger(__name__)

# Premium Plans
PREMIUM_PLANS = {
    "monthly": {
        "id": "monthly",
        "name": "Kvitt Pro Monthly",
        "price": 4.99,
        "interval": "month",
        "features": [
            "Unlimited games",
            "Group analytics",
            "Monthly summaries",
            "Priority support"
        ]
    },
    "yearly": {
        "id": "yearly",
        "name": "Kvitt Pro Yearly",
        "price": 39.99,
        "interval": "year",
        "features": [
            "Everything in Monthly",
            "2 months free",
            "Advanced insights",
            "Export data"
        ]
    },
    "lifetime": {
        "id": "lifetime",
        "name": "Kvitt Pro Lifetime",
        "price": 99.99,
        "interval": "once",
        "features": [
            "All Pro features forever",
            "No recurring charges",
            "Early access to new features",
            "Founding member badge"
        ]
    }
}


class CheckoutRequest(BaseModel):
    plan_id: str
    origin_url: str


class PaymentStatusResponse(BaseModel):
    status: str
    payment_status: str
    plan_id: Optional[str] = None
    user_id: Optional[str] = None


async def create_stripe_checkout(
    plan_id: str,
    origin_url: str,
    user_id: str,
    user_email: str,
) -> Dict[str, Any]:
    """Create Stripe checkout session for premium subscription"""
    import stripe

    # Validate plan
    if plan_id not in PREMIUM_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan selected")

    plan = PREMIUM_PLANS[plan_id]
    api_key = os.environ.get('STRIPE_API_KEY')

    if not api_key:
        raise HTTPException(status_code=500, detail="Payment service not configured")

    stripe.api_key = api_key

    # Build URLs
    success_url = f"{origin_url}/premium/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/premium"

    # Create Stripe checkout session (native SDK)
    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': 'usd',
                'product_data': {'name': plan["name"]},
                'unit_amount': int(plan["price"] * 100),
            },
            'quantity': 1,
        }],
        mode='payment',
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "plan_id": plan_id,
            "user_id": user_id,
            "user_email": user_email,
            "plan_name": plan["name"]
        }
    )

    # Create payment transaction record
    transaction = {
        "transaction_id": f"txn_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{user_id[:8]}",
        "session_id": session.id,
        "user_id": user_id,
        "user_email": user_email,
        "plan_id": plan_id,
        "plan_name": plan["name"],
        "amount": plan["price"],
        "currency": "usd",
        "status": "pending",
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    await queries.generic_insert("payment_transactions", transaction)

    logger.info(f"Created checkout session for user {user_id}, plan {plan_id}")

    return {
        "checkout_url": session.url,
        "session_id": session.id,
        "plan": plan
    }


async def check_payment_status(
    session_id: str,
) -> PaymentStatusResponse:
    """Check payment status and update if completed"""
    import stripe

    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment service not configured")

    stripe.api_key = api_key
    stripe_session = stripe.checkout.Session.retrieve(session_id)
    status_response = type('StatusResponse', (), {
        'status': stripe_session.status,
        'payment_status': stripe_session.payment_status
    })()

    # Get transaction from DB
    transaction = await queries.generic_find_one("payment_transactions", {"session_id": session_id})

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Update transaction if status changed
    if transaction["payment_status"] != status_response.payment_status:
        update_data = {
            "status": status_response.status,
            "payment_status": status_response.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        # If payment successful, upgrade user to premium
        if status_response.payment_status == "paid" and transaction["payment_status"] != "paid":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

            # Update user's premium status
            user_id = transaction["user_id"]
            plan_id = transaction["plan_id"]

            premium_until = None
            if plan_id == "monthly":
                from datetime import timedelta
                premium_until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            elif plan_id == "yearly":
                from datetime import timedelta
                premium_until = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
            elif plan_id == "lifetime":
                premium_until = "lifetime"

            await queries.update_user(user_id, {
                "is_premium": True,
                "premium_plan": plan_id,
                "premium_until": premium_until,
                "premium_started_at": datetime.now(timezone.utc).isoformat()
            })

            logger.info(f"User {user_id} upgraded to {plan_id} premium")

        await queries.generic_update("payment_transactions", {"session_id": session_id}, update_data)

    return PaymentStatusResponse(
        status=status_response.status,
        payment_status=status_response.payment_status,
        plan_id=transaction.get("plan_id"),
        user_id=transaction.get("user_id")
    )


async def handle_subscription_renewal(user_id: str, plan_id: str):
    """Handle subscription renewal - extend premium access"""
    from datetime import timedelta

    # Calculate new expiry date based on plan
    if plan_id == "monthly":
        new_expiry = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    elif plan_id == "yearly":
        new_expiry = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    else:
        new_expiry = None

    if new_expiry:
        await queries.update_user(user_id, {
            "premium_until": new_expiry,
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Subscription renewed for user {user_id}, plan {plan_id} until {new_expiry}")


async def handle_subscription_cancelled(user_id: str, cancellation_date: str):
    """Handle subscription cancellation - allow access until period end"""
    await queries.update_user(user_id, {
        "premium_cancelled_at": cancellation_date,
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    logger.info(f"Subscription cancelled for user {user_id}, access until premium_until date")


async def handle_payment_failed(user_id: str):
    """Handle failed payment - set grace period"""
    from datetime import timedelta
    grace_period = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()

    await queries.update_user(user_id, {
        "payment_failed": True,
        "grace_period_until": grace_period,
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    logger.warning(f"Payment failed for user {user_id}, grace period until {grace_period}")


async def handle_subscription_expired(user_id: str):
    """Handle subscription expiry - revoke premium access"""
    await queries.update_user(user_id, {
        "is_premium": False,
        "premium_plan": None,
        "premium_expired_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    logger.info(f"Subscription expired for user {user_id}, premium access revoked")


def _parse_stripe_webhook_event(request_body: bytes, signature: str, webhook_secret: str):
    """Parse Stripe webhook event. Returns (event, session_id, payment_status, event_id) or raises."""
    import stripe
    stripe.api_key = os.environ.get('STRIPE_API_KEY')
    event = stripe.Webhook.construct_event(request_body, signature, webhook_secret)
    session_id = None
    payment_status = None
    if event.type in ("checkout.session.completed", "invoice.payment_succeeded", "invoice.payment_failed", "customer.subscription.deleted"):
        obj = event.data.object
        session_id = getattr(obj, 'id', None) or (obj.get('id') if isinstance(obj, dict) else None)
        payment_status = getattr(obj, 'payment_status', None) or (obj.get('payment_status') if isinstance(obj, dict) else None)
        if not session_id and hasattr(obj, 'session'):
            session_id = obj.session
    return event, session_id, payment_status, event.id


async def handle_stripe_webhook(
    request_body: bytes,
    signature: str,
) -> Dict[str, Any]:
    """Handle Stripe webhook events for subscription lifecycle"""
    import stripe

    api_key = os.environ.get('STRIPE_API_KEY')
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
    if not api_key:
        return {"status": "error", "message": "Not configured"}
    event_id = ""
    if not webhook_secret:
        import json
        event = json.loads(request_body)
        event_type = event.get("type", "")
        session_id = None
        payment_status = None
        if "data" in event and "object" in event["data"]:
            obj = event["data"]["object"]
            session_id = obj.get("id") or obj.get("session")
            payment_status = obj.get("payment_status")
        event_id = event.get("id", "")
    else:
        try:
            event, session_id, payment_status, event_id = _parse_stripe_webhook_event(
                request_body, signature, webhook_secret
            )
            event_type = event.type
        except Exception as e:
            logger.error(f"Webhook signature verification failed: {e}")
            return {"status": "error", "message": str(e)}

    try:
        # Update transaction based on webhook
        if session_id:
            transaction = await queries.generic_find_one("payment_transactions", {"session_id": session_id})

            if transaction:
                await queries.generic_update("payment_transactions", {"session_id": session_id}, {
                    "status": event_type,
                    "payment_status": payment_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })

                user_id = transaction.get("user_id")
                plan_id = transaction.get("plan_id")

                # Handle specific subscription events
                if event_type == "checkout.session.completed" and payment_status == "paid":
                    # Initial subscription payment successful
                    logger.info(f"Initial subscription completed for user {user_id}")

                elif event_type == "invoice.payment_succeeded":
                    # Subscription renewal successful
                    await handle_subscription_renewal(user_id, plan_id)

                    # Send notification email (if email service is available)
                    try:
                        from email_service import send_email
                        user = await queries.get_user(user_id)
                        if user and user.get("email"):
                            await send_email(
                                to=user["email"],
                                subject="Subscription Renewed - Kvitt Pro",
                                html=f"""
                                <h2>Your subscription has been renewed!</h2>
                                <p>Your {plan_id} subscription has been successfully renewed.</p>
                                <p>You'll continue to enjoy all Pro features.</p>
                                """
                            )
                    except Exception as e:
                        logger.warning(f"Could not send renewal email: {e}")

                elif event_type == "invoice.payment_failed":
                    # Payment failed - set grace period
                    await handle_payment_failed(user_id)

                    # Send notification email
                    try:
                        from email_service import send_email
                        user = await queries.get_user(user_id)
                        if user and user.get("email"):
                            await send_email(
                                to=user["email"],
                                subject="Payment Failed - Kvitt Pro",
                                html=f"""
                                <h2>Payment Failed</h2>
                                <p>We were unable to process your subscription payment.</p>
                                <p>You have 3 days to update your payment method to avoid service interruption.</p>
                                <p><a href="{os.environ.get('FRONTEND_URL', '')}/premium">Update Payment Method</a></p>
                                """
                            )
                    except Exception as e:
                        logger.warning(f"Could not send payment failed email: {e}")

                elif event_type == "customer.subscription.deleted":
                    # Subscription cancelled/expired
                    await handle_subscription_expired(user_id)

                    # Send notification email
                    try:
                        from email_service import send_email
                        user = await queries.get_user(user_id)
                        if user and user.get("email"):
                            await send_email(
                                to=user["email"],
                                subject="Subscription Ended - Kvitt Pro",
                                html=f"""
                                <h2>Subscription Ended</h2>
                                <p>Your Kvitt Pro subscription has ended.</p>
                                <p>You can resubscribe anytime to regain access to Pro features.</p>
                                <p><a href="{os.environ.get('FRONTEND_URL', '')}/premium">Resubscribe</a></p>
                                """
                            )
                    except Exception as e:
                        logger.warning(f"Could not send expiry email: {e}")

        return {"status": "success", "event_id": event_id, "event_type": event_type}

    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}



# ============================================
# DEBT SETTLEMENT PAYMENTS
# ============================================

class DebtPaymentRequest(BaseModel):
    ledger_id: str
    origin_url: str


async def create_debt_payment_link(
    ledger_id: str,
    from_user_id: str,
    from_user_email: str,
    to_user_id: str,
    to_user_name: str,
    amount: float,
    game_id: str,
    origin_url: str,
) -> Dict[str, Any]:
    """Create a Stripe payment link for settling a debt between players"""
    import stripe

    api_key = os.environ.get('STRIPE_API_KEY')

    if not api_key:
        raise HTTPException(status_code=500, detail="Payment service not configured")

    stripe.api_key = api_key

    # Get game details for description
    game = await queries.get_game_night(game_id)
    game_title = game.get("title", "Poker Game") if game else "Poker Game"
    game_date = ""
    if game and game.get("ended_at"):
        try:
            game_date = datetime.fromisoformat(game["ended_at"].replace("Z", "+00:00")).strftime("%b %d, %Y")
        except:
            game_date = ""

    description = f"{game_title} • {game_date}" if game_date else game_title

    # Build URLs
    success_url = f"{origin_url}/games/{game_id}/settlement?payment=success&ledger_id={ledger_id}"
    cancel_url = f"{origin_url}/games/{game_id}/settlement?payment=cancelled"

    # Create Stripe checkout session with line items for better UX
    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': 'usd',
                'product_data': {
                    'name': f'Payment to {to_user_name}',
                    'description': description,
                },
                'unit_amount': int(amount * 100),  # Stripe uses cents
            },
            'quantity': 1,
        }],
        mode='payment',
        success_url=success_url,
        cancel_url=cancel_url,
        customer_email=from_user_email,
        metadata={
            "type": "debt_settlement",
            "ledger_id": ledger_id,
            "from_user_id": from_user_id,
            "to_user_id": to_user_id,
            "to_user_name": to_user_name,
            "game_id": game_id,
            "amount": str(amount)
        }
    )

    # Create debt payment record
    debt_payment = {
        "payment_id": f"debt_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{ledger_id[:8]}",
        "session_id": session.id,  # Stripe SDK uses .id
        "ledger_id": ledger_id,
        "from_user_id": from_user_id,
        "from_user_email": from_user_email,
        "to_user_id": to_user_id,
        "to_user_name": to_user_name,
        "game_id": game_id,
        "amount": amount,
        "currency": "usd",
        "status": "pending",
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    await queries.generic_insert("debt_payments", debt_payment)

    logger.info(f"Created debt payment session for ledger {ledger_id}, amount ${amount}")

    return {
        "checkout_url": session.url,
        "session_id": session.id,  # Stripe SDK uses .id
        "amount": amount,
        "to_user_name": to_user_name
    }


async def _credit_wallet_and_notify(
    to_user_id: str,
    from_user_id: str,
    from_user_name: str,
    amount: float,
    reference_id: str,
    reference_type: str,
    game_id: Optional[str] = None,
    plan_id: Optional[str] = None,
):
    """Helper: credit a user's wallet and send notification."""
    now = datetime.now(timezone.utc)

    # Get or create wallet
    wallet = await queries.get_wallet_by_user(to_user_id)
    if not wallet:
        await queries.insert_wallet({
            "wallet_id": f"wal_{now.strftime('%Y%m%d%H%M%S')}_{to_user_id[:8]}",
            "user_id": to_user_id,
            "balance_cents": 0,
            "currency": "usd",
            "created_at": now.isoformat()
        })
        wallet = await queries.get_wallet_by_user(to_user_id)

    amount_cents = int(amount * 100)
    new_balance_cents = (wallet.get("balance_cents", 0) if wallet else 0) + amount_cents

    # Update wallet balance
    await queries.update_wallet(wallet["wallet_id"], {"balance_cents": new_balance_cents})

    # Insert wallet transaction
    txn_id = f"txn_{now.strftime('%Y%m%d%H%M%S')}_{reference_id[:8]}"
    await queries.insert_wallet_transaction({
        "transaction_id": txn_id,
        "wallet_id": wallet["wallet_id"],
        "user_id": to_user_id,
        "type": "credit",
        "amount_cents": amount_cents,
        "description": f"Payment from {from_user_name}",
        "reference_id": reference_id,
        "reference_type": reference_type,
        "status": "completed",
        "created_at": now.isoformat()
    })

    new_balance = new_balance_cents / 100

    # Send notification
    notif_data = {
        "amount": amount,
        "new_balance": new_balance
    }
    if game_id:
        notif_data["game_id"] = game_id
    if plan_id:
        notif_data["plan_id"] = plan_id

    description = f"net settlement" if plan_id else "Stripe"
    await queries.insert_notification({
        "notification_id": f"notif_{now.strftime('%Y%m%d%H%M%S')}_{reference_id[:6]}",
        "user_id": to_user_id,
        "type": "payment_received",
        "title": "Payment Received!",
        "message": f"{from_user_name} paid you ${amount:.2f} via {description}. Your Kvitt balance: ${new_balance:.2f}",
        "data": notif_data,
        "read": False,
        "created_at": now.isoformat()
    })

    return new_balance


async def handle_debt_payment_webhook(
    request_body: bytes,
    signature: str,
) -> Dict[str, Any]:
    """Handle Stripe webhook events for debt payments"""
    import stripe

    api_key = os.environ.get('STRIPE_API_KEY')
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET_DEBT', os.environ.get('STRIPE_WEBHOOK_SECRET', ''))
    if not api_key:
        return {"status": "error", "message": "Not configured"}

    stripe.api_key = api_key

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(request_body, signature, webhook_secret)
            event_type = event.type
            obj = event.data.object
            session_id = getattr(obj, 'id', None)
            payment_status = getattr(obj, 'payment_status', None)
            event_id = event.id
        else:
            import json
            payload = json.loads(request_body)
            event_type = payload.get('type', '')
            obj = payload.get('data', {}).get('object', {})
            session_id = obj.get('id')
            payment_status = obj.get('payment_status')
            event_id = payload.get('id', '')

        # Update debt payment based on webhook
        if session_id:
            debt_payment = await queries.generic_find_one("debt_payments", {"session_id": session_id})

            if debt_payment:
                await queries.generic_update("debt_payments", {"session_id": session_id}, {
                    "status": event_type,
                    "payment_status": payment_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })

                # If payment successful, mark ledger entry as paid
                if event_type == "checkout.session.completed" and payment_status == "paid":
                    ledger_id = debt_payment.get("ledger_id")

                    # Update ledger entry
                    await queries.update_ledger_entry(ledger_id, {
                        "status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                        "paid_via": "stripe",
                        "stripe_session_id": session_id,
                        "is_locked": True
                    })

                    # Update debt payment record
                    await queries.generic_update("debt_payments", {"session_id": session_id}, {
                        "completed_at": datetime.now(timezone.utc).isoformat()
                    })

                    logger.info(f"Debt payment completed for ledger {ledger_id}")

                    # Credit creditor's Kvitt wallet
                    to_user_id = debt_payment["to_user_id"]
                    payment_amount = debt_payment["amount"]
                    from_user_id = debt_payment["from_user_id"]

                    # Get payer's name
                    from_user = await queries.get_user(from_user_id)
                    from_user_name = from_user.get('name', 'Someone') if from_user else 'Someone'

                    await _credit_wallet_and_notify(
                        to_user_id=to_user_id,
                        from_user_id=from_user_id,
                        from_user_name=from_user_name,
                        amount=payment_amount,
                        reference_id=ledger_id,
                        reference_type="debt_payment",
                        game_id=debt_payment.get("game_id"),
                    )

            # Handle Pay-Net plans (consolidated cross-game payments)
            if not debt_payment and session_id:
                # Check if this is a pay_net session by looking up the plan
                plan = await queries.generic_find_one("pay_net_plans", {"stripe_session_id": session_id})

                if plan and event_type == "checkout.session.completed" and payment_status == "paid":
                    plan_id = plan["plan_id"]

                    # Idempotency: skip if already completed
                    if plan["status"] == "completed":
                        logger.info(f"Pay-net plan {plan_id} already completed — skipping")
                    else:
                        # Check expiry
                        expires_at = datetime.fromisoformat(plan["expires_at"].replace("Z", "+00:00"))
                        now = datetime.now(timezone.utc)

                        if now > expires_at:
                            await queries.generic_update("pay_net_plans", {"plan_id": plan_id}, {"status": "expired"})
                            logger.warning(f"Pay-net plan {plan_id} expired before webhook")
                        else:
                            # Verify all ledger entries are still pending
                            ledger_ids = plan["ledger_ids"]
                            pending_entries = await queries.find_ledger_entries({"ledger_id": ledger_ids, "status": "pending"}, limit=100)

                            if len(pending_entries) != len(ledger_ids):
                                logger.warning(f"Pay-net plan {plan_id}: ledger entries changed since plan creation")
                                await queries.generic_update("pay_net_plans", {"plan_id": plan_id}, {
                                    "status": "canceled",
                                    "cancel_reason": "ledger_entries_changed"
                                })
                            else:
                                # Mark all ledger entries as paid
                                for lid in ledger_ids:
                                    await queries.update_ledger_entry(lid, {
                                        "status": "paid",
                                        "paid_at": now.isoformat(),
                                        "paid_via": "stripe_net",
                                        "pay_net_plan_id": plan_id,
                                        "is_locked": True
                                    })

                                # Mark plan completed
                                await queries.generic_update("pay_net_plans", {"plan_id": plan_id}, {
                                    "status": "completed",
                                    "completed_at": now.isoformat()
                                })

                                # Credit recipient wallet
                                payee_id = plan["payee_id"]
                                payer_id = plan["payer_id"]
                                amount_dollars = round(plan["amount_cents"] / 100, 2)

                                payer_user = await queries.get_user(payer_id)
                                payer_name = payer_user.get('name', 'Someone') if payer_user else 'Someone'

                                await _credit_wallet_and_notify(
                                    to_user_id=payee_id,
                                    from_user_id=payer_id,
                                    from_user_name=payer_name,
                                    amount=amount_dollars,
                                    reference_id=plan_id,
                                    reference_type="pay_net",
                                    plan_id=plan_id,
                                )

                                logger.info(f"Pay-net plan {plan_id} completed: ${amount_dollars} from {payer_id} to {payee_id}")

                elif plan and event_type == "checkout.session.expired":
                    await queries.generic_update("pay_net_plans", {"plan_id": plan["plan_id"]}, {"status": "canceled"})
                    logger.info(f"Pay-net plan {plan['plan_id']} canceled: {event_type}")

        return {"status": "success", "event_id": event_id, "event_type": event_type}

    except Exception as e:
        logger.error(f"Debt webhook error: {e}")
        return {"status": "error", "message": str(e)}
