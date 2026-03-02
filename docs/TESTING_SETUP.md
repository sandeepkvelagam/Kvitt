# Kvitt - Testing Setup Guide

Covers Stripe webhooks, env vars (AUTH_SERVICE_URL, CORS_ORIGINS), DuckDNS for testing, and mobile testing.

---

## 1. Stripe Webhooks (Local Development)

### Install Stripe CLI (Windows)

**Option A: Scoop**
```powershell
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Option B: Manual**
1. Download from [GitHub releases](https://github.com/stripe/stripe-cli/releases/latest) (`stripe_X.X.X_windows_x86_64.zip`)
2. Unzip and add `stripe.exe` folder to your PATH

**Verify:**
```powershell
stripe --version
```

### Login and Forward Webhooks

```powershell
# Login to Stripe (opens browser)
stripe login

# Forward webhooks to your local backend
stripe listen --forward-to localhost:8000/api/webhook/stripe
```

This will output a webhook signing secret like:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxx
```

**Add to `backend/.env`:**
```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
```

**Note:** One `stripe listen` command forwards all events to the same URL. The backend uses `STRIPE_WEBHOOK_SECRET` for `/api/webhook/stripe`, `/api/webhook/stripe-wallet`, and `/api/webhook/stripe-debt`. For local dev, one secret is enough.

### Keep Stripe CLI Running

Leave `stripe listen` running in a separate terminal while you develop. Restart the backend after adding the secret.

---

## 2. AUTH_SERVICE_URL

**What it is:** Used by the `/api/auth/session` endpoint to exchange an OAuth `session_id` for user data. It calls `{AUTH_SERVICE_URL}/auth/v1/env/oauth/session-data`.

**For Supabase:** Supabase does not expose this exact path. The app uses Supabase Auth directly on the frontend/mobile; users sign in via Supabase client and get a JWT. The backend verifies that JWT via JWKS.

**What to set:**
- **Leave empty** if you only use Supabase Auth (JWT in `Authorization: Bearer` header).
- **Set to `SUPABASE_URL`** if you have a custom OAuth flow that needs this endpoint (it may 404 until you implement it).

**Default:**
```
AUTH_SERVICE_URL=
```
If empty, the code falls back to `SUPABASE_URL`. For Supabase-only auth, you can leave it blank.

---

## 3. CORS_ORIGINS

**What it is:** Controls which origins (domains) can make HTTP requests to your backend. Without CORS, browsers block cross-origin requests from your frontend to the API.

**Format:** Comma-separated list of origins. No trailing slashes.

**Examples:**
```
# Allow all (development only)
CORS_ORIGINS=*

# Local dev
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# DuckDNS + local
CORS_ORIGINS=http://localhost:3000,https://kvitt.duckdns.org

# Production
CORS_ORIGINS=https://kvitt.app,https://www.kvitt.app
```

**For testing:** Use `CORS_ORIGINS=*` to allow all origins. For production, list your exact domains.

---

## 4. DuckDNS for Testing (Public URL)

**What it is:** Free dynamic DNS. Gives you a public URL like `kvitt.duckdns.org` that points to your machine (or later, your Lightsail).

### Setup DuckDNS

1. Go to [duckdns.org](https://www.duckdns.org)
2. Sign in with Google/GitHub
3. Create a subdomain (e.g. `kvitt`)
4. You get: `https://kvitt.duckdns.org`

### Point DuckDNS to Your Machine

**If backend runs on your PC:**
- Your PC needs a public IP or you need a tunnel (e.g. ngrok, Cloudflare Tunnel).
- DuckDNS alone can update your IP, but your router must forward ports 80/443 to your PC.

**Easier for testing: ngrok**

```powershell
# Install ngrok: https://ngrok.com/download
# Then:
ngrok http 8000
```

ngrok gives you a URL like `https://abc123.ngrok.io` that forwards to `localhost:8000`. Use that as your backend URL for mobile testing.

### Use DuckDNS with AWS Lightsail

1. Create a Lightsail instance (see below).
2. Attach a static IP.
3. In DuckDNS, set the subdomain to point to that static IP.
4. Your backend URL becomes `https://kvitt.duckdns.org` (or `http://` if no SSL yet).

---

## 5. AWS Lightsail Quick Setup

### Create Instance

1. [AWS Lightsail](https://lightsail.aws.amazon.com) → Create instance
2. **Platform:** Linux/Unix
3. **Blueprint:** Ubuntu 22.04
4. **Plan:** $10/mo (2GB RAM, 1 vCPU)
5. Create instance

### Attach Static IP

1. Instance → Networking → Create static IP
2. Attach to your instance

### Connect and Deploy

```bash
# SSH (use the key from Lightsail)
ssh -i "your-key.pem" ubuntu@<static-ip>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt install python3.11 python3.11-venv python3.11-dev -y

# Install Node.js 20 (for frontend build)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# Install Nginx
sudo apt install nginx -y

# SSL with Let's Encrypt (after you point DuckDNS to this IP)
sudo snap install certbot --classic
sudo certbot --nginx -d kvitt.duckdns.org
```

### Point DuckDNS to Lightsail

1. DuckDNS → Your subdomain → Enter the Lightsail static IP
2. Save

### App URLs (DuckDNS)

```bash
# backend/.env on Lightsail
APP_URL=https://kvitt.duckdns.org
FRONTEND_URL=https://kvitt.duckdns.org

# CORS
CORS_ORIGINS=https://kvitt.duckdns.org
```

---

## 6. Mobile Testing

### Local Backend (Same Network)

1. **Backend:** Run `uvicorn server:app --host 0.0.0.0 --port 8000` (must bind to 0.0.0.0)
2. **Find your PC IP:** `ipconfig` (Windows) or `ifconfig` (Mac/Linux). Look for something like `192.168.1.100`
3. **mobile/.env:**
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api
   EXPO_PUBLIC_SOCKET_URL=http://192.168.1.100:8000
   ```
4. **Start mobile:** `cd mobile && npx expo start`
5. **Connect:** Scan QR with Expo Go on your phone (same Wi‑Fi as PC)

### With ngrok (Public URL)

1. Run `ngrok http 8000`
2. Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`)
3. **mobile/.env:**
   ```
   EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app/api
   EXPO_PUBLIC_SOCKET_URL=https://abc123.ngrok-free.app
   ```
4. Restart Expo: `npx expo start --clear`

### With DuckDNS + Lightsail

1. Deploy backend to Lightsail (see above)
2. Point DuckDNS to Lightsail IP
3. **mobile/.env:**
   ```
   EXPO_PUBLIC_API_URL=https://kvitt.duckdns.org/api
   EXPO_PUBLIC_SOCKET_URL=https://kvitt.duckdns.org
   ```

### Supabase (Mobile)

Ensure mobile has Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 7. Checklist

| Step | Action |
|------|--------|
| [ ] Install Stripe CLI | `scoop install stripe` or manual |
| [ ] Run `stripe login` | Authenticate |
| [ ] Run `stripe listen --forward-to localhost:8000/api/webhook/stripe` | Get webhook secret |
| [ ] Add `STRIPE_WEBHOOK_SECRET` to backend/.env | Paste from `stripe listen` |
| [ ] Set `AUTH_SERVICE_URL` | Leave empty for Supabase |
| [ ] Set `CORS_ORIGINS` | `*` for dev, or your domains |
| [ ] For mobile: Use PC IP or ngrok URL | Update mobile/.env |
| [ ] For Lightsail: Create instance, static IP, DuckDNS | Point to Lightsail IP |
