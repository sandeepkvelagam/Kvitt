# Kvitt AWS Lightsail Instance Creation Script
# Run this on your local Windows machine after configuring AWS CLI

param(
    [string]$InstanceName = "kvitt-server",
    [string]$Region = "us-west-2",
    [string]$AvailabilityZone = "us-west-2a"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Creating Kvitt Lightsail Instance" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check AWS CLI
Write-Host "[1/6] Checking AWS CLI..." -ForegroundColor Yellow
try {
    $awsVersion = aws --version 2>&1
    Write-Host "AWS CLI: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: AWS CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "Download from: https://awscli.amazonaws.com/AWSCLIV2.msi" -ForegroundColor Yellow
    exit 1
}

# Check AWS credentials
Write-Host "[2/6] Checking AWS credentials..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "Logged in as: $($identity.Arn)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: AWS credentials not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

# Create instance
Write-Host "[3/6] Creating Lightsail instance..." -ForegroundColor Yellow
Write-Host "  Name: $InstanceName" -ForegroundColor Gray
Write-Host "  Region: $Region" -ForegroundColor Gray
Write-Host "  Blueprint: Ubuntu 22.04 LTS" -ForegroundColor Gray
Write-Host "  Bundle: medium_3_0 (2GB RAM, 1 vCPU, $10/month)" -ForegroundColor Gray

try {
    aws lightsail create-instances `
        --instance-names $InstanceName `
        --availability-zone $AvailabilityZone `
        --blueprint-id ubuntu_22_04 `
        --bundle-id medium_3_0 `
        --tags "key=app,value=kvitt" `
        --region $Region
    Write-Host "Instance creation initiated!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create instance. It may already exist." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Wait for instance to be running
Write-Host "[4/6] Waiting for instance to be running..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
do {
    Start-Sleep -Seconds 10
    $attempt++
    $state = aws lightsail get-instance --instance-name $InstanceName --region $Region --query "instance.state.name" --output text 2>$null
    Write-Host "  Status: $state (attempt $attempt/$maxAttempts)" -ForegroundColor Gray
} while ($state -ne "running" -and $attempt -lt $maxAttempts)

if ($state -ne "running") {
    Write-Host "WARNING: Instance not yet running. Check AWS console." -ForegroundColor Yellow
}

# Open firewall ports
Write-Host "[5/6] Configuring firewall..." -ForegroundColor Yellow
$ports = @(
    @{from=80; to=80; desc="HTTP"},
    @{from=443; to=443; desc="HTTPS"},
    @{from=22; to=22; desc="SSH"}
)

foreach ($port in $ports) {
    try {
        aws lightsail open-instance-public-ports `
            --instance-name $InstanceName `
            --port-info "fromPort=$($port.from),toPort=$($port.to),protocol=tcp" `
            --region $Region 2>$null
        Write-Host "  Opened port $($port.from) ($($port.desc))" -ForegroundColor Green
    } catch {
        Write-Host "  Port $($port.from) already open or error" -ForegroundColor Gray
    }
}

# Get instance IP
Write-Host "[6/6] Getting instance details..." -ForegroundColor Yellow
$instanceInfo = aws lightsail get-instance --instance-name $InstanceName --region $Region --output json | ConvertFrom-Json
$publicIp = $instanceInfo.instance.publicIpAddress

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Instance Created Successfully!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Instance Name: $InstanceName" -ForegroundColor White
Write-Host "Public IP: $publicIp" -ForegroundColor White
Write-Host "State: $($instanceInfo.instance.state.name)" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Download SSH key from Lightsail console" -ForegroundColor Gray
Write-Host "2. SSH into instance: ssh -i <key.pem> ubuntu@$publicIp" -ForegroundColor Gray
Write-Host "3. Run setup script: bash /var/www/kvitt/scripts/deploy/setup_server.sh" -ForegroundColor Gray
Write-Host ""
Write-Host "Or use this command to download the default key:" -ForegroundColor Yellow
Write-Host "aws lightsail download-default-key-pair --output text --query privateKeyBase64 | Out-File -Encoding ascii lightsail-key.pem" -ForegroundColor Gray
