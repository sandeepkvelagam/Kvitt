#!/bin/bash
# Expo Server Restart & QR Code Generator
# Usage: bash expo-restart.sh
# For Windows: Run in Git Bash or WSL

set +e  # Don't exit on errors

echo "========================================="
echo "  Kvitt Mobile - Expo Dev Server"
echo "========================================="
echo ""
echo "  Backend: https://kvitt.duckdns.org"
echo "  Supabase: https://hbqngvptbuvocjrozcgw.supabase.co"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$SCRIPT_DIR/mobile"

# Check if mobile directory exists
if [ ! -d "$MOBILE_DIR" ]; then
    echo "ERROR: Mobile directory not found at $MOBILE_DIR"
    exit 1
fi

cd "$MOBILE_DIR"

# 1. Kill any existing Expo processes
echo "1. Stopping any existing Expo processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true
# For Windows, also try taskkill
taskkill //F //IM "node.exe" //FI "WINDOWTITLE eq *expo*" 2>/dev/null || true
sleep 2

# 2. Clear Expo cache (optional but recommended)
echo ""
echo "2. Clearing Expo cache..."
rm -rf .expo 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true

# 3. Check .env file
echo ""
echo "3. Checking environment configuration..."
if [ -f ".env" ]; then
    echo "   .env file found:"
    grep -E "^EXPO_PUBLIC_" .env | while read line; do
        KEY=$(echo "$line" | cut -d'=' -f1)
        VALUE=$(echo "$line" | cut -d'=' -f2-)
        # Mask sensitive values
        if [[ "$KEY" == *"KEY"* ]]; then
            echo "   $KEY=***masked***"
        else
            echo "   $line"
        fi
    done
else
    echo "   WARNING: .env file not found!"
    echo "   Creating .env with default values..."
    cat > .env << 'EOF'
# Kvitt Mobile Environment

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://hbqngvptbuvocjrozcgw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Backend API Configuration
EXPO_PUBLIC_API_URL=https://kvitt.duckdns.org/api
EXPO_PUBLIC_SOCKET_URL=https://kvitt.duckdns.org
EOF
    echo "   Created .env - please update EXPO_PUBLIC_SUPABASE_ANON_KEY"
fi

# 4. Install dependencies if needed
echo ""
echo "4. Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies (this may take a minute)..."
    npm install
else
    echo "   Dependencies already installed"
fi

# 5. Start Expo
echo ""
echo "5. Starting Expo development server..."
echo ""
echo "========================================="
echo "  STARTING EXPO"
echo "========================================="
echo ""
echo "  Options:"
echo "    - Press 'a' to open Android emulator"
echo "    - Press 'i' to open iOS simulator (Mac only)"
echo "    - Press 'w' to open web browser"
echo "    - Scan QR code with Expo Go app"
echo ""
echo "  To stop: Press Ctrl+C"
echo ""
echo "========================================="
echo ""

# Start Expo with tunnel for external device access
# --tunnel creates a public URL accessible from any device
npx expo start --tunnel

# If tunnel fails, fall back to LAN
# npx expo start --lan
