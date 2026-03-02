# Kvitt

Poker group management and settlement app. Track games, buy-ins, cash-outs, and settle debts.

## Quick Setup

1. **Environment variables:** Run `scripts/setup-env.ps1` (Windows) or `scripts/setup-env.sh` (Mac/Linux) to create `.env` files from templates.

2. **API keys:** See [docs/SETUP_KEYS.md](docs/SETUP_KEYS.md) for step-by-step instructions to create and configure:
   - OpenAI (AI assistant, Whisper)
   - Supabase (Auth)
   - Stripe (Payments)
   - MongoDB (Database)

3. **Start backend:** `cd backend && uvicorn server:app --reload --port 8000`

4. **Start frontend:** `cd frontend && npm install && npm start`

5. **Start mobile:** `cd mobile && npm install && npx expo start`

**Testing:** See [docs/TESTING_SETUP.md](docs/TESTING_SETUP.md) for Stripe webhooks, DuckDNS, AWS Lightsail, and mobile testing.
