#!/bin/bash
# Kvitt Deployment Script
# Run this to deploy updates to the server

set -e

echo "=========================================="
echo "Kvitt Deployment"
echo "=========================================="

cd /var/www/kvitt

# Pull latest code
echo "[1/5] Pulling latest code..."
git pull origin main

# Update backend dependencies
echo "[2/5] Updating backend dependencies..."
source venv/bin/activate
cd backend
pip install -r requirements.txt

# Restart backend
echo "[3/5] Restarting backend service..."
sudo systemctl restart kvitt

# Build frontend
echo "[4/5] Building frontend..."
cd ../frontend
npm install
npm run build

# Reload Nginx (in case of config changes)
echo "[5/5] Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "Check status: sudo systemctl status kvitt"
echo "View logs: sudo journalctl -u kvitt -f"
