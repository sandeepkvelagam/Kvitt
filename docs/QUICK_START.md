# Quick Start - Mobile App Testing

**Copy/paste these commands to get testing in 5 minutes.**

---

## 1. Database Setup (One-time)

Database indexes are defined in `supabase/migrations/` and applied automatically.
No manual index creation needed — PostgreSQL/Supabase handles this.

---

## 2. Start Backend

```bash
cd /app/backend
python server.py
```

**Keep this terminal running.** Backend must stay up for mobile app to work.

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## 3. Setup Mobile Environment

**Check `.env` file exists:**
```bash
cat /app/mobile/.env
```

**Should contain:**
```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://hbqngvptbuvocjrozcgw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicW5ndnB0YnV2b2Nqcm96Y2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MjEwNjAsImV4cCI6MjA1MDA5NzA2MH0.FIBa7f-mwTHD3g8gkYWUa6S3Vsy7i6H88GJQMdDNvVo
```

**If testing on physical device,** change localhost to your computer's IP:
```bash
# Find your local IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Then update .env
EXPO_PUBLIC_API_URL=http://192.168.1.XXX:8000
```

---

## 4. Start Mobile App

```bash
cd /app/mobile
npm install  # First time only
npx expo start
```

**Then:**
- Press **`i`** for iOS Simulator (macOS only)
- Press **`a`** for Android Emulator
- Scan QR code with Expo Go app on physical device

---

## 5. Basic Smoke Test (2 minutes)

1. **Login:** Use any test account (or create one)
2. **Groups:** Should see list of groups
3. **GroupHub:** Tap a group → see members + games
4. **GameNight:** Tap a game → see players + socket status "✅ Connected"

**If this works:** Basic functionality ✅

---

## 6. Run Critical Tests

Open `/app/TEST_CHECKLIST.md` and complete each test:

- **Test A:** Cold start (2 min)
- **Test B:** Token refresh (60 min - can skip for quick validation)
- **Test C:** Background/foreground (3 min)
- **Test D:** Network drop (3 min)
- **Test E:** Authorization (5 min)

**Total time:** ~15 minutes (excluding Test B)

---

## 7. Check Results

Fill out checklist in `/app/TEST_CHECKLIST.md`

✅ **All pass:** Ready for buy-in/cash-out actions
❌ **Any fail:** Debug with logs (see below)

---

## Debugging Commands

### View Mobile Logs
```bash
# Already visible in terminal where you ran `npx expo start`
# Or use:
npx expo start --clear
```

### View Backend Logs
```bash
# Visible in terminal where you ran `python server.py`
# Look for:
# - "User X authenticated via JWT"
# - "join_game: User authorized"
```

### Check Database Connection
```bash
cd /app/backend
python -c "
import asyncio, os
from dotenv import load_dotenv
import asyncpg

load_dotenv()

async def check():
    pool = await asyncpg.create_pool(os.getenv('SUPABASE_DB_URL'))
    row = await pool.fetchval('SELECT COUNT(*) FROM users')
    print(f'Database connected. Users: {row}')
    await pool.close()

asyncio.run(check())
"
```

### Test Backend API Directly
```bash
# Get JWT token (after login via mobile app, check console logs)
TOKEN="your-jwt-token-here"

# Test groups endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/groups

# Expected: JSON array of groups
```

---

## Common Issues

### "Unable to connect to backend"
**Fix:**
```bash
# 1. Check backend is running
curl http://localhost:8000/health
# Should return: {"status":"ok"}

# 2. Check firewall (macOS)
# System Preferences → Security → Firewall → Allow python

# 3. If on physical device, update .env to use local IP
```

### "Session expired" on login
**Fix:**
```bash
# Check Supabase credentials in backend .env
cat /app/backend/.env | grep SUPABASE
```

### Socket won't connect
**Fix:**
```bash
# Check backend logs for JWT errors
# Common issue: Wrong SUPABASE_JWT_SECRET in backend .env
```

### iOS Simulator won't open
**Fix:**
```bash
# Open manually
open -a Simulator

# Or install iOS simulator
xcode-select --install
```

### Android Emulator won't open
**Fix:**
```bash
# List available emulators
~/Library/Android/sdk/emulator/emulator -list-avds

# Start manually
~/Library/Android/sdk/emulator/emulator -avd Pixel_5_API_31
```

---

## Files to Check

If something doesn't work, verify these files exist:

```bash
ls -la /app/mobile/src/screens/GroupsScreen.tsx
ls -la /app/mobile/src/screens/GroupHubScreen.tsx
ls -la /app/mobile/src/screens/GameNightScreen.tsx
ls -la /app/mobile/src/utils/errors.ts
ls -la /app/backend/create_indexes.py
```

---

## Documentation

- **Full test instructions:** `/app/TESTING_GUIDE.md`
- **Test checklist:** `/app/TEST_CHECKLIST.md`
- **Summary:** `/app/TEST_SUMMARY.md`
- **Hardening details:** `/app/HARDENING_COMPLETE.md`

---

## Need Help?

**Provide:**
1. Which test failed (A, B, C, D, or E)
2. Error logs from mobile app (console)
3. Error logs from backend (terminal)
4. Device/OS info (iOS 17, Android 13, etc.)
5. Screenshot of error alert

---

## Success Criteria

✅ **Basic functionality works** (login, groups, games)
✅ **Socket connects** (shows "✅ Connected")
✅ **Tests A, C, D pass** (cold start, background, network drop)
✅ **Test E passes** (authorization works)
✅ **(Optional) Test B passes** (token refresh after 60 min)

**Then:** Architecture validated, ready for next phase! 🎉
