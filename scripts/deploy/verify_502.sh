#!/bin/bash
# 502 Diagnostic Script - Run on Lightsail to diagnose backend issues
# Usage: bash scripts/deploy/verify_502.sh

echo "=========================================="
echo "502 Diagnostic - Kvitt Backend"
echo "=========================================="
echo ""

echo "1. Nginx error log (last 50 lines):"
echo "-----------------------------------"
sudo tail -50 /var/log/nginx/error.log
echo ""

echo "2. Backend service status:"
echo "-----------------------------------"
sudo systemctl status kvitt --no-pager
echo ""

echo "3. Backend logs (last 50 lines):"
echo "-----------------------------------"
sudo journalctl -u kvitt -n 50 --no-pager
echo ""

echo "4. Port 8000 listening:"
echo "-----------------------------------"
ss -tlnp | grep ':8000' || echo "Port 8000 NOT listening"
echo ""

echo "5. Backend health check (bypass Nginx):"
echo "-----------------------------------"
curl -i -s --connect-timeout 5 http://127.0.0.1:8000/api/health || echo "Backend not responding"
echo ""

echo "6. Nginx proxy config:"
echo "-----------------------------------"
sudo nginx -T 2>/dev/null | grep -E "proxy_pass|proxy_read_timeout|proxy_connect_timeout" | head -20
echo ""
echo "=========================================="
echo "Done. Share nginx error.log and journalctl output if 502 persists."
echo "=========================================="
