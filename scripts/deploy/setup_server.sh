#!/bin/bash
# Kvitt Server Setup Script for AWS Lightsail
# Run this on a fresh Ubuntu 22.04 instance

set -e

echo "=========================================="
echo "Kvitt Server Setup"
echo "=========================================="

# Update system
echo "[1/10] Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+
echo "[2/10] Installing Python..."
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install Nginx
echo "[3/10] Installing Nginx..."
sudo apt install -y nginx

# Install Git
echo "[4/10] Installing Git..."
sudo apt install -y git

# Install Node.js 20.x
echo "[5/10] Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Create app directory
echo "[6/10] Setting up app directory..."
sudo mkdir -p /var/www/kvitt
sudo chown ubuntu:ubuntu /var/www/kvitt

# Clone repository
echo "[7/10] Cloning repository..."
cd /var/www/kvitt
if [ -d ".git" ]; then
    git pull
else
    git clone https://github.com/sandeepkvelagam/Kvitt.git .
fi

# Setup Python virtual environment
echo "[8/10] Setting up Python environment..."
python3.11 -m venv venv
source venv/bin/activate
cd backend
pip install --upgrade pip
pip install -r requirements.txt

# Create systemd service
echo "[9/10] Creating systemd service..."
sudo tee /etc/systemd/system/kvitt.service > /dev/null << 'EOF'
[Unit]
Description=Kvitt Backend API
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/var/www/kvitt/backend
Environment="PATH=/var/www/kvitt/venv/bin"
ExecStart=/var/www/kvitt/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable kvitt

# Setup Nginx
echo "[10/10] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/kvitt > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (React build)
    location / {
        root /var/www/kvitt/frontend/build;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_buffering off;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
        proxy_buffering off;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/kvitt /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "=========================================="
echo "Server setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Copy your .env file to /var/www/kvitt/backend/.env"
echo "2. Build frontend: cd /var/www/kvitt/frontend && npm install && npm run build"
echo "3. Start backend: sudo systemctl start kvitt"
echo "4. (Optional) Setup SSL with: sudo certbot --nginx"
echo ""
