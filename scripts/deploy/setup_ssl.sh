#!/bin/bash
# SSL Setup Script for Kvitt
# Run this after setting up DNS

set -e

if [ -z "$1" ]; then
    echo "Usage: ./setup_ssl.sh <domain>"
    echo "Example: ./setup_ssl.sh kvitt.example.com"
    exit 1
fi

DOMAIN=$1

echo "=========================================="
echo "Setting up SSL for $DOMAIN"
echo "=========================================="

# Install Certbot
echo "[1/3] Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# Update Nginx config with domain
echo "[2/3] Updating Nginx config..."
sudo sed -i "s/server_name _;/server_name $DOMAIN www.$DOMAIN;/" /etc/nginx/sites-available/kvitt
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
echo "[3/3] Obtaining SSL certificate..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

echo ""
echo "=========================================="
echo "SSL setup complete!"
echo "=========================================="
echo ""
echo "Your site is now available at: https://$DOMAIN"
echo "Certificate auto-renewal is configured."
