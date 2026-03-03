# AWS Lightsail Setup Guide for Kvitt

This guide walks you through deploying Kvitt on AWS Lightsail.

## Prerequisites

1. AWS Account with Lightsail access
2. AWS CLI installed and configured
3. Domain name (optional, but recommended for SSL)

## Step 1: Install AWS CLI

### Windows
```powershell
# Download and run the installer from:
# https://awscli.amazonaws.com/AWSCLIV2.msi

# Or use winget:
winget install Amazon.AWSCLI
```

### Verify installation
```bash
aws --version
```

## Step 2: Configure AWS CLI

```bash
aws configure
```

Enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `us-west-2` (or your preferred region)
- Default output format: `json`

## Step 3: Create Lightsail Instance

### Option A: Using AWS CLI (Recommended)

```bash
# List available blueprints
aws lightsail get-blueprints --query "blueprints[?platform=='LINUX_UNIX'].{id:blueprintId,name:name}" --output table

# List available bundles (instance sizes)
aws lightsail get-bundles --query "bundles[?supportedPlatforms[0]=='LINUX_UNIX'].{id:bundleId,price:price,ram:ramSizeInGb,cpu:cpuCount}" --output table

# Create instance (2GB RAM recommended for Kvitt)
aws lightsail create-instances \
  --instance-names kvitt-server \
  --availability-zone us-west-2a \
  --blueprint-id ubuntu_22_04 \
  --bundle-id medium_3_0 \
  --tags key=app,value=kvitt
```

### Option B: Using AWS Console

1. Go to https://lightsail.aws.amazon.com
2. Click "Create instance"
3. Select:
   - Platform: Linux/Unix
   - Blueprint: Ubuntu 22.04 LTS
   - Instance plan: $10/month (2GB RAM, 1 vCPU)
   - Name: kvitt-server
4. Click "Create instance"

## Step 4: Configure Firewall

```bash
# Open required ports
aws lightsail open-instance-public-ports \
  --instance-name kvitt-server \
  --port-info fromPort=80,toPort=80,protocol=tcp

aws lightsail open-instance-public-ports \
  --instance-name kvitt-server \
  --port-info fromPort=443,toPort=443,protocol=tcp

aws lightsail open-instance-public-ports \
  --instance-name kvitt-server \
  --port-info fromPort=8000,toPort=8000,protocol=tcp
```

## Step 5: Get Instance IP

```bash
aws lightsail get-instance --instance-name kvitt-server --query "instance.publicIpAddress" --output text
```

## Step 6: SSH into Instance

```bash
# Download SSH key from Lightsail console or use:
aws lightsail download-default-key-pair --output text --query privateKeyBase64 | base64 -d > lightsail-key.pem
chmod 400 lightsail-key.pem

# SSH into instance
ssh -i lightsail-key.pem ubuntu@<INSTANCE_IP>
```

## Step 7: Server Setup Script

Run this on the Lightsail instance:

```bash
#!/bin/bash
# Kvitt Server Setup Script

# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git

# Install Node.js (for frontend build)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Create app directory
sudo mkdir -p /var/www/kvitt
sudo chown ubuntu:ubuntu /var/www/kvitt

# Clone repository
cd /var/www/kvitt
git clone https://github.com/sandeepkvelagam/Kvitt.git .

# Setup Python virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install Python dependencies
cd backend
pip install -r requirements.txt

# Create .env file (copy from local)
# You'll need to scp your .env file or create it manually

# Setup systemd service
sudo tee /etc/systemd/system/kvitt.service << 'EOF'
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

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable kvitt
sudo systemctl start kvitt

echo "Backend service started!"
```

## Step 8: Nginx Configuration

```bash
sudo tee /etc/nginx/sites-available/kvitt << 'EOF'
server {
    listen 80;
    server_name _;  # Replace with your domain

    # Frontend (React build)
    location / {
        root /var/www/kvitt/frontend/build;
        try_files $uri $uri/ /index.html;
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
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/kvitt /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Step 9: Build Frontend

```bash
cd /var/www/kvitt/frontend
npm install
npm run build
```

## Step 10: SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is configured automatically
```

## Step 11: Static IP (Recommended)

```bash
# Create static IP
aws lightsail allocate-static-ip --static-ip-name kvitt-ip

# Attach to instance
aws lightsail attach-static-ip --static-ip-name kvitt-ip --instance-name kvitt-server

# Get static IP address
aws lightsail get-static-ip --static-ip-name kvitt-ip --query "staticIp.ipAddress" --output text
```

## Step 12: DNS Setup

Point your domain to the static IP:
- A record: `@` → `<STATIC_IP>`
- A record: `www` → `<STATIC_IP>`

Or use DuckDNS for free:
1. Go to https://www.duckdns.org
2. Create a subdomain (e.g., kvitt.duckdns.org)
3. Point it to your static IP

## Monitoring & Maintenance

### Check service status
```bash
sudo systemctl status kvitt
```

### View logs
```bash
sudo journalctl -u kvitt -f
```

### Restart service
```bash
sudo systemctl restart kvitt
```

### Update code
```bash
cd /var/www/kvitt
git pull
source venv/bin/activate
cd backend && pip install -r requirements.txt
sudo systemctl restart kvitt
cd ../frontend && npm install && npm run build
```

## Cost Estimate

- Lightsail instance (2GB): $10/month
- Static IP: Free (when attached)
- Data transfer: 3TB included
- **Total: ~$10/month**

## Troubleshooting

### Service won't start
```bash
sudo journalctl -u kvitt -n 50
```

### Nginx errors
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Database connection issues
- Verify SUPABASE_DB_URL in .env
- Check Supabase dashboard for connection limits
- Ensure Session Pooler URL is used (IPv4 compatible)
