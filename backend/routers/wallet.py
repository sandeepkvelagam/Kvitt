"""Wallet endpoints: setup, PIN management, transfers, deposits, withdrawals.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

import wallet_service
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel, Field, ConfigDict

from dependencies import User, get_current_user
from db import queries
from push_service import send_push_notification_to_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["wallet"])


# ============== WALLET MODELS (Payment Engineering: cents-based) ==============

class Wallet(BaseModel):
    """
    Wallet for storing funds and making transfers.
    All money fields are in CENTS (integer) to avoid float precision issues.
    """
    model_config = ConfigDict(extra="ignore")
    wallet_id: str  # Unique ID: "KVT-XXXXXX"
    user_id: str
    balance_cents: int = 0  # INTEGER CENTS - source of truth is wallet_transactions
    currency: str = "usd"
    status: str = "active"  # active, suspended, frozen

    # Security
    pin_hash: Optional[str] = None  # bcrypt hashed 4-6 digit PIN
    pin_attempts: int = 0
    pin_locked_until: Optional[datetime] = None

    # Limits (all in cents)
    daily_transfer_limit_cents: int = 50000  # $500
    per_transaction_limit_cents: int = 20000  # $200
    daily_transferred_cents: int = 0
    daily_transferred_reset_at: Optional[datetime] = None

    # Optimistic concurrency
    version: int = 1

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class WalletTransaction(BaseModel):
    """
    Immutable ledger entry for wallet transactions.
    This is the SOURCE OF TRUTH for balances.
    """
    model_config = ConfigDict(extra="ignore")
    transaction_id: str = Field(default_factory=lambda: f"wtxn_{uuid.uuid4().hex[:12]}")
    wallet_id: str
    user_id: str
    type: str  # deposit, transfer_in, transfer_out, settlement_credit
    amount_cents: int  # Always positive
    direction: str  # "credit" or "debit"
    balance_before_cents: int
    balance_after_cents: int

    # For transfers (shared by both sides of transfer)
    transfer_id: Optional[str] = None
    counterparty_wallet_id: Optional[str] = None
    counterparty_user_id: Optional[str] = None
    counterparty_name: Optional[str] = None

    # For deposits (prevents double-credit via unique index)
    stripe_payment_intent_id: Optional[str] = None

    # Idempotency (prevents duplicate processing)
    idempotency_key: Optional[str] = None

    description: str = ""
    status: str = "completed"  # completed, pending, failed
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WalletAuditLog(BaseModel):
    """Audit trail for wallet operations - compliance and fraud investigation."""
    model_config = ConfigDict(extra="ignore")
    audit_id: str = Field(default_factory=lambda: f"waud_{uuid.uuid4().hex[:12]}")
    wallet_id: str
    user_id: str
    action: str  # wallet_created, pin_set, pin_changed, pin_failed, transfer_completed
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    risk_score: Optional[int] = None
    risk_flags: List[str] = []
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============== WALLET REQUEST MODELS ==============

class SetPinRequest(BaseModel):
    """Set wallet PIN (4-6 digits)."""
    pin: str = Field(..., min_length=4, max_length=6, pattern=r'^\d+$')


class ChangePinRequest(BaseModel):
    """Change wallet PIN (requires current PIN)."""
    current_pin: str
    new_pin: str = Field(..., min_length=4, max_length=6, pattern=r'^\d+$')


class VerifyPinRequest(BaseModel):
    """Verify wallet PIN."""
    pin: str


class WalletTransferRequest(BaseModel):
    """Transfer money to another wallet."""
    to_wallet_id: str
    amount_cents: int = Field(..., gt=0, le=20000)  # Max $200 per transaction
    pin: str
    idempotency_key: str  # Client-generated UUID for duplicate prevention
    description: Optional[str] = None
    risk_acknowledged: bool = False  # User confirmed high-risk transfer


class WalletDepositRequest(BaseModel):
    """Create Stripe checkout session for wallet deposit."""
    amount_cents: int = Field(..., ge=500, le=100000)  # $5 - $1000
    origin_url: str


class WithdrawRequest(BaseModel):
    """Simple withdrawal request (processed manually by admin)."""
    amount_cents: int = Field(..., ge=500, le=50000)  # $5 - $500
    method: str = "bank_transfer"  # bank_transfer, venmo, paypal
    destination_details: str  # email, phone, account number
    pin: str


# ============== WALLET ENDPOINTS ==============
# Payment engineering: cents-based, ledger source of truth, idempotent


@router.get("/wallet")
async def get_wallet(user: User = Depends(get_current_user)):
    """Get user's wallet info including balance and wallet ID."""
    logger.info(f"Getting wallet for user_id: {user.user_id}")
    wallet = await queries.get_wallet_by_user(user.user_id)
    logger.info(f"Wallet found: {wallet}")

    if not wallet or not wallet.get("wallet_id"):
        # Return placeholder - user needs to set up wallet
        return {
            "user_id": user.user_id,
            "wallet_id": None,
            "balance_cents": 0,
            "balance": 0.00,  # For backward compatibility
            "currency": "usd",
            "status": "needs_setup",
            "has_pin": False
        }

    return {
        "wallet_id": wallet.get("wallet_id"),
        "user_id": wallet.get("user_id"),
        "balance_cents": wallet.get("balance_cents", 0),
        "balance": wallet.get("balance_cents", 0) / 100,  # For backward compatibility
        "currency": wallet.get("currency", "usd"),
        "status": wallet.get("status", "active"),
        "has_pin": bool(wallet.get("pin_hash")),
        "daily_transfer_limit_cents": wallet.get("daily_transfer_limit_cents", 50000),
        "per_transaction_limit_cents": wallet.get("per_transaction_limit_cents", 20000),
        "daily_transferred_cents": wallet.get("daily_transferred_cents", 0)
    }


@router.post("/wallet/setup")
async def setup_wallet(user: User = Depends(get_current_user)):
    """
    Create wallet with unique ID (KVT-XXXXXX).
    If wallet exists, returns existing wallet.
    """
    wallet = await wallet_service.create_wallet(user.user_id)

    await wallet_service.log_wallet_audit(
        wallet["wallet_id"], user.user_id, "wallet_created"
    )

    return {
        "success": True,
        "wallet_id": wallet["wallet_id"],
        "message": f"Wallet created! Your wallet ID is {wallet['wallet_id']}"
    }


@router.post("/wallet/pin/set")
async def set_wallet_pin(
    data: SetPinRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Set initial wallet PIN (required for transfers)."""
    wallet = await queries.get_wallet_by_user(user.user_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found. Set up wallet first.")

    if wallet.get("pin_hash"):
        raise HTTPException(status_code=400, detail="PIN already set. Use change PIN endpoint.")

    pin_hash = wallet_service.hash_pin(data.pin)

    await queries.update_wallet(wallet["wallet_id"], {"pin_hash": pin_hash, "updated_at": datetime.now(timezone.utc)})

    await wallet_service.log_wallet_audit(
        wallet["wallet_id"], user.user_id, "pin_set", request
    )

    return {"success": True, "message": "PIN set successfully"}


@router.post("/wallet/pin/change")
async def change_wallet_pin(
    data: ChangePinRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Change wallet PIN (requires current PIN)."""
    wallet = await queries.get_wallet_by_user(user.user_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    # Verify current PIN
    pin_valid, pin_error = await wallet_service.verify_pin_with_lockout(wallet, data.current_pin)
    if not pin_valid:
        await wallet_service.log_wallet_audit(
            wallet["wallet_id"], user.user_id, "pin_change_failed", request,
            new_value={"reason": pin_error}
        )
        raise HTTPException(status_code=401, detail=pin_error)

    # Set new PIN
    new_pin_hash = wallet_service.hash_pin(data.new_pin)
    await queries.update_wallet(wallet["wallet_id"], {"pin_hash": new_pin_hash, "updated_at": datetime.now(timezone.utc)})

    await wallet_service.log_wallet_audit(
        wallet["wallet_id"], user.user_id, "pin_changed", request
    )

    return {"success": True, "message": "PIN changed successfully"}


@router.post("/wallet/pin/verify")
async def verify_wallet_pin(
    data: VerifyPinRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Verify wallet PIN (for sensitive operations)."""
    wallet = await queries.get_wallet_by_user(user.user_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    pin_valid, pin_error = await wallet_service.verify_pin_with_lockout(wallet, data.pin)
    if not pin_valid:
        raise HTTPException(status_code=401, detail=pin_error)

    return {"success": True, "message": "PIN verified"}


@router.get("/wallet/lookup/{wallet_id}")
async def lookup_wallet(wallet_id: str, request: Request, user: User = Depends(get_current_user)):
    """Look up wallet by ID. Returns limited info for privacy."""
    # Rate limit: 30 lookups per minute per IP (prevent enumeration attacks)
    client_ip = request.client.host if request.client else "unknown"
    if not await wallet_service.check_rate_limit(f"ip:{client_ip}", "lookup", 30, 60):
        raise HTTPException(status_code=429, detail="Too many lookup attempts. Please wait.")

    result = await wallet_service.lookup_wallet_by_id(wallet_id, exclude_user_id=user.user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return result


@router.get("/wallet/search")
async def search_wallets(
    request: Request,
    q: str = Query(..., min_length=2),
    user: User = Depends(get_current_user)
):
    """Search wallets by user name or wallet ID."""
    # Rate limit: 20 searches per minute per IP (prevent brute-force)
    client_ip = request.client.host if request.client else "unknown"
    if not await wallet_service.check_rate_limit(f"ip:{client_ip}", "search", 20, 60):
        raise HTTPException(status_code=429, detail="Too many search attempts. Please wait.")

    results = await wallet_service.search_wallets(q, exclude_user_id=user.user_id, limit=10)
    return {"results": results}


@router.post("/wallet/transfer")
async def transfer_funds(
    data: WalletTransferRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """
    Transfer money to another wallet.
    Requires PIN verification and respects daily/per-transaction limits.
    Idempotent: same idempotency_key returns same result.
    High-risk transfers (risk_score > 50) require risk_acknowledged=true.
    """
    sender_wallet = await queries.get_wallet_by_user(user.user_id)
    if not sender_wallet or not sender_wallet.get("wallet_id"):
        raise HTTPException(status_code=404, detail="Wallet not found. Set up wallet first.")

    # Rate limit: 10 transfers per minute per wallet
    if not await wallet_service.check_rate_limit(
        f"wallet:{sender_wallet['wallet_id']}", "transfer", 10, 60
    ):
        raise HTTPException(status_code=429, detail="Too many transfer attempts. Please wait a minute.")

    # Rate limit: 20 transfers per minute per IP
    client_ip = request.client.host if request.client else "unknown"
    if not await wallet_service.check_rate_limit(f"ip:{client_ip}", "transfer", 20, 60):
        raise HTTPException(status_code=429, detail="Too many requests from this IP. Please wait.")

    # High-risk step-up: Check risk score before transfer
    risk_score, risk_flags = await wallet_service.calculate_risk_score(
        sender_wallet["wallet_id"], data.amount_cents, data.to_wallet_id
    )

    if risk_score > 50 and not data.risk_acknowledged:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "high_risk_transfer",
                "message": "This transfer has been flagged for additional verification.",
                "risk_score": risk_score,
                "risk_flags": risk_flags,
                "action": "Please confirm you want to proceed with this transfer."
            }
        )

    result = await wallet_service.process_transfer(
        from_wallet_id=sender_wallet["wallet_id"],
        to_wallet_id=data.to_wallet_id,
        amount_cents=data.amount_cents,
        pin=data.pin,
        idempotency_key=data.idempotency_key,
        request=request,
        description=data.description
    )

    return result


@router.get("/wallet/transactions")
async def get_wallet_transactions(
    user: User = Depends(get_current_user),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    type: Optional[str] = Query(None)
):
    """Get paginated wallet transaction history from ledger."""
    wallet = await queries.get_wallet_by_user(user.user_id)
    if not wallet or not wallet.get("wallet_id"):
        return {"transactions": [], "total": 0, "balance_cents": 0}

    wallet_id = wallet["wallet_id"]

    # Build query
    query = {"wallet_id": wallet_id, "status": "completed"}
    if type:
        query["type"] = type

    # Get total count
    total = await queries.count_wallet_transactions(query)

    # Get transactions
    transactions = await queries.find_wallet_transactions_paginated(query, limit=limit, offset=offset)

    return {
        "transactions": transactions,
        "total": total,
        "balance_cents": wallet.get("balance_cents", 0),
        "wallet_id": wallet_id
    }


@router.post("/wallet/deposit")
async def create_wallet_deposit(
    data: WalletDepositRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """
    Create Stripe checkout session to add funds to wallet.
    Returns checkout URL to redirect user.
    """
    wallet = await queries.get_wallet_by_user(user.user_id)
    if not wallet or not wallet.get("wallet_id"):
        raise HTTPException(status_code=404, detail="Wallet not found. Set up wallet first.")

    # Rate limit: 5 deposits per hour per wallet
    if not await wallet_service.check_rate_limit(
        f"wallet:{wallet['wallet_id']}", "deposit", 5, 3600
    ):
        raise HTTPException(status_code=429, detail="Too many deposit attempts. Please try again later.")

    # Validate amount
    if data.amount_cents < 500:
        raise HTTPException(status_code=400, detail="Minimum deposit is $5.00")
    if data.amount_cents > 100000:
        raise HTTPException(status_code=400, detail="Maximum deposit is $1000.00")

    try:
        import stripe
        stripe.api_key = os.environ.get('STRIPE_API_KEY')
        if not stripe.api_key:
            raise HTTPException(status_code=500, detail="Payment service not configured")

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': 'Kvitt Wallet Deposit',
                        'description': f'Deposit ${data.amount_cents / 100:.2f} to your Kvitt wallet',
                    },
                    'unit_amount': data.amount_cents,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{data.origin_url}/wallet?deposit=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{data.origin_url}/wallet?deposit=cancelled",
            metadata={
                "type": "wallet_deposit",
                "wallet_id": wallet["wallet_id"],
                "user_id": user.user_id,
                "amount_cents": str(data.amount_cents)
            }
        )

        # Store pending deposit for webhook processing (30 min expiration)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        await queries.generic_insert("wallet_deposits", {
            "deposit_id": f"dep_{uuid.uuid4().hex[:12]}",
            "wallet_id": wallet["wallet_id"],
            "user_id": user.user_id,
            "amount_cents": data.amount_cents,
            "stripe_session_id": session.id,
            "status": "pending",
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        })

        return {
            "checkout_url": session.url,
            "session_id": session.id
        }

    except Exception as e:
        logger.error(f"Failed to create deposit session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment session")


@router.get("/wallet/deposit/status/{session_id}")
async def check_deposit_status(session_id: str, user: User = Depends(get_current_user)):
    """
    Check status of pending deposit.
    NOTE: Stripe webhook is the authoritative source. This is for convenience only.
    """
    deposit = await queries.get_wallet_deposit(session_id)

    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")

    # Check if deposit session expired
    if deposit["status"] == "pending" and deposit.get("expires_at"):
        expires_at = deposit["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if expires_at < datetime.now(timezone.utc):
            # Mark as expired
            await queries.update_wallet_deposit(session_id, {"status": "expired"})
            return {
                "status": "expired",
                "message": "Payment session expired. Please try again."
            }

    if deposit["status"] == "expired":
        return {
            "status": "expired",
            "message": "Payment session expired. Please try again."
        }

    if deposit["status"] == "completed":
        return {
            "status": "completed",
            "amount_cents": deposit["amount_cents"],
            "message": "Deposit completed successfully"
        }

    # Check with Stripe (backup for webhook failure)
    try:
        import stripe
        stripe.api_key = os.environ.get('STRIPE_API_KEY')
        stripe_session = stripe.checkout.Session.retrieve(session_id)

        if stripe_session.payment_status == "paid" and deposit["status"] == "pending":
            # Credit wallet (idempotent via unique index on payment_intent_id)
            payment_intent_id = stripe_session.payment_intent
            if payment_intent_id:
                result = await wallet_service.credit_wallet_deposit(
                    deposit["wallet_id"],
                    deposit["amount_cents"],
                    payment_intent_id,
                )

                if result:
                    await queries.update_wallet_deposit(session_id, {"status": "completed", "completed_at": datetime.now(timezone.utc)})

                    return {
                        "status": "completed",
                        "amount_cents": deposit["amount_cents"],
                        "new_balance_cents": result.get("new_balance_cents"),
                        "message": "Deposit completed successfully"
                    }

        return {
            "status": deposit["status"],
            "stripe_status": stripe_session.payment_status if stripe_session else "unknown"
        }

    except Exception as e:
        logger.error(f"Failed to check deposit status: {e}")
        return {"status": deposit["status"]}


@router.get("/wallet/reconcile")
async def reconcile_wallet(user: User = Depends(get_current_user)):
    """
    Reconcile wallet balance against ledger (for debugging/admin).
    The ledger (wallet_transactions) is the source of truth.
    """
    wallet = await queries.get_wallet_by_user(user.user_id)
    if not wallet or not wallet.get("wallet_id"):
        raise HTTPException(status_code=404, detail="Wallet not found")

    result = await wallet_service.reconcile_wallet_balance(wallet["wallet_id"])
    return result


@router.post("/wallet/withdraw")
async def request_withdrawal(
    data: WithdrawRequest,
    user: User = Depends(get_current_user)
):
    """
    Request a withdrawal from wallet (simple flow, processed by admin).
    PIN is verified before creating the request.
    """
    wallet = await queries.get_wallet_by_user(user.user_id)
    if not wallet or not wallet.get("wallet_id"):
        raise HTTPException(status_code=404, detail="Wallet not found. Set up wallet first.")

    # Verify PIN
    pin_ok = await wallet_service.verify_pin(data.pin, wallet.get("pin_hash", ""))
    if not pin_ok:
        raise HTTPException(status_code=400, detail="Invalid PIN")

    # Check balance
    if wallet.get("balance_cents", 0) < data.amount_cents:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Rate limit: 3 withdrawals per day
    if not await wallet_service.check_rate_limit(
        f"wallet:{wallet['wallet_id']}", "withdraw", 3, 86400
    ):
        raise HTTPException(status_code=429, detail="Withdrawal limit reached. Try again tomorrow.")

    # Create withdrawal request record
    withdrawal_id = f"wdr_{uuid.uuid4().hex[:12]}"
    await queries.generic_insert("wallet_withdrawals", {
        "withdrawal_id": withdrawal_id,
        "wallet_id": wallet["wallet_id"],
        "user_id": user.user_id,
        "amount_cents": data.amount_cents,
        "method": data.method,
        "destination_details": data.destination_details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "processed_at": None,
        "note": None
    })

    # Log audit
    await wallet_service.log_wallet_audit(
        wallet["wallet_id"], user.user_id, "withdraw_requested",
        old_value={"amount_cents": data.amount_cents, "method": data.method}
    )

    # Send push notification to user
    await send_push_notification_to_user(
        user.user_id,
        "Withdrawal Requested",
        f"Your withdrawal of ${data.amount_cents / 100:.2f} has been submitted and will be processed within 1-2 business days.",
        {"type": "withdrawal_requested", "withdrawal_id": withdrawal_id}
    )

    return {
        "success": True,
        "withdrawal_id": withdrawal_id,
        "message": f"Withdrawal of ${data.amount_cents / 100:.2f} submitted. Will be processed within 1-2 business days."
    }


@router.get("/wallet/withdrawals")
async def get_withdrawals(user: User = Depends(get_current_user)):
    """Get user's withdrawal history."""
    withdrawals = await queries.generic_find("wallet_withdrawals", {"user_id": user.user_id}, limit=20)
    return {"withdrawals": withdrawals}


# ============== WALLET WEBHOOK ==============


@router.post("/webhook/stripe-wallet")
async def stripe_wallet_webhook(request: Request):
    """
    Handle Stripe webhook events for wallet deposits.
    This is the authoritative source for crediting wallets.
    Idempotent via unique index on stripe_payment_intent_id.
    """
    import stripe
    import json

    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET_WALLET", os.environ.get("STRIPE_WEBHOOK_SECRET", ""))

    try:
        # Verify signature
        if webhook_secret:
            event = stripe.Webhook.construct_event(body, signature, webhook_secret)
        else:
            # Development mode without signature verification
            event = json.loads(body)
            logger.warning("Webhook signature verification skipped (no secret configured)")

        event_type = event.get("type") if isinstance(event, dict) else event.type
        data = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object

        logger.info(f"Wallet webhook received: {event_type}")

        if event_type == "checkout.session.completed":
            metadata = data.get("metadata", {})

            # Only process wallet deposits
            if metadata.get("type") != "wallet_deposit":
                return {"status": "ignored", "reason": "not a wallet deposit"}

            wallet_id = metadata.get("wallet_id")
            amount_cents = int(metadata.get("amount_cents", 0))
            payment_intent_id = data.get("payment_intent")

            if not wallet_id or not amount_cents or not payment_intent_id:
                logger.error(f"Missing required metadata: wallet_id={wallet_id}, amount_cents={amount_cents}")
                return {"status": "error", "reason": "missing metadata"}

            # Credit wallet (idempotent)
            result = await wallet_service.credit_wallet_deposit(
                wallet_id=wallet_id,
                amount_cents=amount_cents,
                stripe_payment_intent_id=payment_intent_id
            )

            if result:
                logger.info(f"Wallet deposit credited: {wallet_id}, ${amount_cents/100:.2f}")

                # Update pending deposit record
                await queries.generic_update("wallet_deposits", {"wallet_id": wallet_id, "stripe_session_id": data.get("id")}, {
                        "status": "completed",
                        "stripe_payment_intent_id": payment_intent_id,
                        "completed_at": datetime.now(timezone.utc)
                    })

                return {"status": "success", "transaction_id": result.get("transaction_id")}
            else:
                return {"status": "already_processed"}

        return {"status": "ignored", "event_type": event_type}

    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Wallet webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
