# Kvitt - API Keys and Environment Setup Guide

This guide walks you through creating and configuring all API keys and environment variables needed for Kvitt after the Emergent migration.

## Stripe Webhooks (Local Dev)

Install [Stripe CLI](https://stripe.com/docs/stripe-cli), then run:
```powershell
stripe login
stripe listen --forward-to localhost:8000/api/webhook/stripe
```
Copy the `whsec_...` secret to `STRIPE_WEBHOOK_SECRET` in backend/.env. See [docs/TESTING_SETUP.md](docs/TESTING_SETUP.md) for full details.

---

# Migrating from Emergent .env

If you have an existing `backend/.env` with Emergent keys:

- **Remove:** `EMERGENT_LLM_KEY`, `AUTH_SERVICE_URL` (or set to your Supabase URL)
- **Add:** `OPENAI_API_KEY` (replaces EMERGENT_LLM_KEY), `STRIPE_WEBHOOK_SECRET`
- **Update:** `APP_URL`, `REACT_APP_BACKEND_URL` to your domain or `http://localhost:3000` for local dev

---

## Quick Setup (Copy env templates)

```bash
# From project root
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp mobile/.env.example mobile/.env
```

Then fill in the values below. On Windows PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
Copy-Item mobile\.env.example mobile\.env
```

---

## 1. OpenAI (Required for AI Assistant + Whisper)

**Used for:** AI chat assistant (GPT-4o), voice transcription (Whisper)

**Create key:**
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **Create new secret key**
4. Copy the key (starts with `sk-`)

**Add to `backend/.env`:**
```
OPENAI_API_KEY=<your-openai-api-key>
```

**Cost:** Pay-as-you-go. GPT-4o and Whisper have per-token pricing. Check [OpenAI pricing](https://openai.com/api/pricing/).

---

## 2. Supabase (Required for Auth)

**Used for:** User authentication (login/signup), JWT verification, WebSocket auth

**Create project:**
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Choose region, set database password
4. Create project

**Get credentials:**
1. Click the **gear icon** (Project Settings) in the left sidebar
2. Go to **API** in the settings menu
3. Copy **Project URL** (e.g. `https://xxxxx.supabase.co`)
4. Copy **anon public** key (under "Project API keys")

**JWT verification (two options):**
- **New projects (JWT Signing Keys):** Supabase uses asymmetric keys. Your backend verifies via JWKS at `{SUPABASE_URL}/auth/v1/jwks`. **Leave `SUPABASE_JWT_SECRET` empty** – only `SUPABASE_URL` is needed.
- **Legacy projects:** If your project still uses the old JWT secret, go to Project Settings → **API** → **JWT Settings** and copy the **JWT Secret**. Set `SUPABASE_JWT_SECRET` for fallback verification.

**Add to `backend/.env`:**
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_JWT_SECRET=
```
(Leave `SUPABASE_JWT_SECRET` empty for new projects using JWT Signing Keys.)

**Add to `frontend/.env`:**
```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Add to `mobile/.env`:**
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. Stripe (Required for Payments)

**Used for:** Premium subscriptions, wallet deposits, debt payments

**Stripe onboarding (when prompted):**
- **Business name:** Kvitt
- **Business website:** https://kvitt.app (or your domain; use https://localhost:3000 for dev)
- **Business type:** "We offer a software app that helps friends manage poker nights and game settlements. Users can subscribe to premium features and add funds to in-app wallets."

**Create keys:**
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Sign up or log in
3. For development: use **Test mode** (toggle in top right)

**API keys:**
1. Developers → **API keys**
2. Copy **Secret key** (starts with `sk_test_` for test mode)

**Add to `backend/.env`:**
```
STRIPE_API_KEY=<your-secret-key-from-stripe-dashboard>
STRIPE_WEBHOOK_SECRET=<your-webhook-secret-from-stripe-cli>
```

**Webhook secret (one secret for all endpoints):** Your backend has three webhook paths (`/stripe`, `/stripe-wallet`, `/stripe-debt`) but they all fall back to `STRIPE_WEBHOOK_SECRET`. One secret is enough.
1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Run: `stripe login`
3. Run: `stripe listen --forward-to localhost:8000/api/webhook/stripe`
4. Copy the `whsec_...` secret into `STRIPE_WEBHOOK_SECRET` in backend/.env

**Production:** Create webhook endpoints in Stripe Dashboard → Developers → Webhooks for each URL (`/api/webhook/stripe`, `/api/webhook/stripe-wallet`, `/api/webhook/stripe-debt`). You can use the same secret for all, or separate secrets if you prefer.

---

## 4. Supabase PostgreSQL (Required)

**Used for:** Primary database (PostgreSQL via Supabase)

**Get connection string:**
1. Supabase Dashboard → Project Settings → Database
2. Under "Connection string", select **URI**
3. Copy the connection string (replace `[YOUR-PASSWORD]` with your database password)

**Add to `backend/.env`:**
```
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

---

## 5. App URLs (Required)

**Add to `backend/.env`:**
```
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

**Add to `frontend/.env`:**
```
REACT_APP_BACKEND_URL=http://localhost:8000
```

**Add to `mobile/.env`:**
```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SOCKET_URL=http://localhost:8000
```

For physical device testing: replace `localhost` with your computer's IP (e.g. `http://192.168.1.100:8000`).

---

## 6. Optional Integrations

### Anthropic Claude (AI Orchestrator)

**Used for:** AI tool routing, intent classification (optional; falls back to keyword matching if not set)

**Create key:** [console.anthropic.com](https://console.anthropic.com) → API Keys

**Add to `backend/.env`:**
```
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

### Resend (Email)

**Used for:** Transactional emails (subscription renewals, payment failed, etc.)

**Create key:** [resend.com](https://resend.com) → API Keys

**Add to `backend/.env`:**
```
RESEND_API_KEY=re_xxxxxxxx
SENDER_EMAIL=noreply@yourdomain.com
```

### Spotify

**Used for:** Music during games

**Create app:** [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → Create App

**Add to `backend/.env`:**
```
SPOTIFY_CLIENT_ID=xxxxxxxx
SPOTIFY_CLIENT_SECRET=xxxxxxxx
SPOTIFY_REDIRECT_URI=http://localhost:3000/spotify/callback
```

---

## 7. Verify Setup

**Backend:**
```bash
cd backend
python -c "
import os
from dotenv import load_dotenv
load_dotenv()
required = ['SUPABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_JWT_SECRET', 'OPENAI_API_KEY', 'STRIPE_API_KEY']
missing = [k for k in required if not os.environ.get(k)]
print('OK' if not missing else f'Missing: {missing}')
"
```

**Start backend:**
```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

---

## Summary Checklist

| Service   | Required | Key/Config                          | Where to get |
|-----------|----------|-------------------------------------|--------------|
| OpenAI    | Yes      | `OPENAI_API_KEY`                    | platform.openai.com |
| Anthropic | Yes*     | `ANTHROPIC_API_KEY` (Claude)        | console.anthropic.com |
| Supabase  | Yes      | `SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_JWT_SECRET`, anon key | supabase.com |
| Stripe    | Yes      | `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com |
| Resend    | No       | `RESEND_API_KEY`                    | resend.com |
| Spotify   | No       | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | developer.spotify.com |

*Claude powers AI orchestrator; falls back to keyword matching if not set.
