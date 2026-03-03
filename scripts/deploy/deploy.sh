#!/bin/bash
# Kvitt Deployment Script
# Run this to deploy updates to the server
# Can be run manually or via GitHub Actions CI/CD

set -e

# Configuration
APP_DIR="${KVITT_APP_DIR:-/var/www/kvitt}"
BRANCH="${KVITT_BRANCH:-main}"

# Colors for output (disabled in non-interactive mode)
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    GREEN=''
    YELLOW=''
    NC=''
fi

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo "=========================================="
echo "Kvitt Deployment"
echo "=========================================="
echo "App directory: $APP_DIR"
echo "Branch: $BRANCH"
echo "=========================================="

# Ensure we're in the app directory
if [ ! -d "$APP_DIR" ]; then
    echo "Error: App directory $APP_DIR does not exist"
    exit 1
fi

cd "$APP_DIR"

# Pull latest code
log "[1/5] Pulling latest code..."
git fetch origin
git reset --hard "origin/$BRANCH"

# Update backend dependencies
log "[2/5] Updating backend dependencies..."
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
else
    warn "Virtual environment not found, creating..."
    python3 -m venv venv
    source venv/bin/activate
fi

cd backend
pip install -r requirements.txt --quiet

# Restart backend
log "[3/5] Restarting backend service..."
sudo systemctl restart kvitt

# Wait for backend to be healthy
sleep 3
if sudo systemctl is-active --quiet kvitt; then
    log "Backend service started successfully"
else
    warn "Backend service may have issues, check logs"
fi

# Build frontend
log "[4/5] Building frontend..."
cd ../frontend
npm install --silent --no-audit --no-fund
npm run build

# Reload Nginx (in case of config changes)
log "[5/5] Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "Check status: sudo systemctl status kvitt"
echo "View logs: sudo journalctl -u kvitt -f"
