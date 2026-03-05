# Stripe Webhooks - Production Setup (kvitt.duckdns.org)

Create three webhook endpoints in Stripe for your production backend.

## Step 1: Open Stripe Dashboard

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Ensure you're in **Test mode** or **Live mode** (match your `STRIPE_API_KEY`)
3. Click **Developers** → **Webhooks** → **Add endpoint**

---

## Step 2: Create Webhook Endpoints

Create **three** endpoints, one for each backend path:

### Endpoint 1: Subscriptions (Premium)

| Field | Value |
|-------|-------|
| **Endpoint URL** | `https://kvitt.duckdns.org/api/webhook/stripe` |
| **Events** | Select these events: |
| | `checkout.session.completed` |
| | `invoice.payment_succeeded` |
| | `invoice.payment_failed` |
| | `customer.subscription.deleted` |

After creating, click **Reveal** under "Signing secret" → copy the `whsec_...` value → add to `backend/.env` as `STRIPE_WEBHOOK_SECRET`.

---

### Endpoint 2: Wallet Deposits

| Field | Value |
|-------|-------|
| **Endpoint URL** | `https://kvitt.duckdns.org/api/webhook/stripe-wallet` |
| **Events** | `checkout.session.completed` |

Copy the signing secret → add to `backend/.env` as `STRIPE_WEBHOOK_SECRET_WALLET`.

---

### Endpoint 3: Debt Payments

| Field | Value |
|-------|-------|
| **Endpoint URL** | `https://kvitt.duckdns.org/api/webhook/stripe-debt` |
| **Events** | `checkout.session.completed` |

Copy the signing secret → add to `backend/.env` as `STRIPE_WEBHOOK_SECRET_DEBT`.

---

## Step 3: Update backend/.env

Add the three secrets (each endpoint gets its own from Stripe):

```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET_WALLET=whsec_xxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET_DEBT=whsec_xxxxxxxxxxxxxxxx
```

**Fallback:** If `STRIPE_WEBHOOK_SECRET_WALLET` or `STRIPE_WEBHOOK_SECRET_DEBT` is empty, the backend uses `STRIPE_WEBHOOK_SECRET`. But Stripe gives a **different** signing secret per endpoint, so you need all 3 secrets from the 3 endpoints you create.

---

## Step 4: Deploy to Lightsail

1. Copy your updated `backend/.env` to the server:
   ```bash
   scp -i lightsail-key.pem backend/.env ubuntu@<YOUR_LIGHTSAIL_IP>:/var/www/kvitt/backend/.env
   ```

2. Restart the backend:
   ```bash
   ssh -i lightsail-key.pem ubuntu@<YOUR_LIGHTSAIL_IP> "sudo systemctl restart kvitt"
   ```

---

## Step 5: Verify

1. In Stripe Dashboard → Webhooks → click each endpoint
2. Send a test event (e.g. `checkout.session.completed`)
3. Check that the event shows "Succeeded" (200 response)
4. If failed, check backend logs: `sudo journalctl -u kvitt -n 50`

---

## Quick Reference: All Three Endpoints

| Purpose | URL | Events |
|---------|-----|--------|
| Subscriptions | `https://kvitt.duckdns.org/api/webhook/stripe` | checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.deleted |
| Wallet | `https://kvitt.duckdns.org/api/webhook/stripe-wallet` | checkout.session.completed |
| Debt | `https://kvitt.duckdns.org/api/webhook/stripe-debt` | checkout.session.completed |
