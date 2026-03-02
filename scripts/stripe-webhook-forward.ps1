# Stripe Webhook Forward - Local Development
# Forwards Stripe webhooks to your local backend.
# Run this in a separate terminal and keep it running while developing.
#
# Prerequisites: Stripe CLI installed (scoop install stripe, or manual)
# Usage: .\scripts\stripe-webhook-forward.ps1

$backendUrl = "http://localhost:8000"
$webhookPath = "/api/webhook/stripe"

Write-Host "Stripe Webhook Forward" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure your backend is running on $backendUrl" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Check if stripe is installed
try {
    $null = stripe --version 2>&1
} catch {
    Write-Host "Stripe CLI not found. Install with:" -ForegroundColor Red
    Write-Host "  scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git" -ForegroundColor White
    Write-Host "  scoop install stripe" -ForegroundColor White
    Write-Host ""
    Write-Host "Or download from: https://github.com/stripe/stripe-cli/releases" -ForegroundColor White
    exit 1
}

$forwardUrl = "$backendUrl$webhookPath"
Write-Host "Forwarding to: $forwardUrl" -ForegroundColor Green
Write-Host "Copy the webhook signing secret (whsec_...) to backend/.env as STRIPE_WEBHOOK_SECRET" -ForegroundColor Green
Write-Host ""

stripe listen --forward-to $forwardUrl
