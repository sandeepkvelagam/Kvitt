# GitHub Actions Auto-Deploy Setup

This guide explains how to set up automatic deployment to AWS Lightsail when you push to the `main` branch.

## How It Works

```
Push to main → GitHub Actions → SSH to Lightsail → Run deploy script
```

When you push code to the `main` branch:
1. GitHub Actions workflow triggers automatically
2. Connects to your Lightsail server via SSH
3. Pulls the latest code
4. Updates dependencies and rebuilds
5. Restarts services

## Setup Instructions

### Step 1: Get Your Lightsail Server IP

```bash
aws lightsail get-instance --instance-name kvitt-server --query "instance.publicIpAddress" --output text
```

Or find it in the [Lightsail Console](https://lightsail.aws.amazon.com).

### Step 2: Get Your SSH Private Key

If you already have the key file:
```bash
cat lightsail-key.pem
```

Or download it via AWS CLI:
```bash
aws lightsail download-default-key-pair --output text --query privateKeyBase64 | base64 -d
```

### Step 3: Add GitHub Secrets

1. Go to your repository: https://github.com/sandeepkvelagam/Kvitt
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these three secrets:

| Secret Name | Value |
|-------------|-------|
| `LIGHTSAIL_HOST` | Your server IP address (e.g., `44.123.45.67`) |
| `LIGHTSAIL_USER` | `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | Entire contents of your private key file |

**Important for SSH Key:**
- Copy the ENTIRE key including the header and footer lines
- It should look like:
  ```
  -----BEGIN RSA PRIVATE KEY-----
  MIIEowIBAAKCAQEA...
  ...many lines...
  -----END RSA PRIVATE KEY-----
  ```

### Step 4: Test the Deployment

Push a commit to main:
```bash
git add .
git commit -m "Test auto-deploy"
git push origin main
```

Then check the **Actions** tab in your GitHub repository to see the deployment progress.

## Manual Trigger

You can also trigger a deployment manually:
1. Go to **Actions** tab in GitHub
2. Select **Deploy to Lightsail** workflow
3. Click **Run workflow** → **Run workflow**

## Troubleshooting

### Deployment Failed - SSH Connection

- Verify `LIGHTSAIL_HOST` is the correct IP
- Ensure `LIGHTSAIL_SSH_KEY` contains the full private key
- Check that port 22 is open in Lightsail firewall:
  ```bash
  aws lightsail open-instance-public-ports \
    --instance-name kvitt-server \
    --port-info fromPort=22,toPort=22,protocol=tcp
  ```

### Deployment Failed - Script Error

SSH into your server and check logs:
```bash
ssh -i lightsail-key.pem ubuntu@<YOUR_IP>
sudo journalctl -u kvitt -n 50
```

### View Deployment Logs

1. Go to **Actions** tab in GitHub
2. Click on the failed/successful workflow run
3. Expand the **Deploy to Lightsail via SSH** step

## Files

- **Workflow**: `.github/workflows/deploy.yml`
- **Deploy Script**: `scripts/deploy/deploy.sh`

## Security Notes

- SSH keys are stored as encrypted GitHub Secrets
- Keys are never exposed in logs
- Only repository admins can view/edit secrets
