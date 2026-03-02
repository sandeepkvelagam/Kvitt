# Kvitt - Environment Setup Script (PowerShell)
# Copies .env.example to .env for backend, frontend, and mobile

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$pairs = @(
    @{ src = "backend\.env.example"; dst = "backend\.env" },
    @{ src = "frontend\.env.example"; dst = "frontend\.env" },
    @{ src = "mobile\.env.example"; dst = "mobile\.env" }
)

foreach ($p in $pairs) {
    $srcPath = Join-Path $root $p.src
    $dstPath = Join-Path $root $p.dst

    if (-not (Test-Path $srcPath)) {
        Write-Warning "Source not found: $srcPath"
        continue
    }

    if (Test-Path $dstPath) {
        Write-Host "Skipping $($p.dst) - already exists"
    } else {
        Copy-Item $srcPath $dstPath
        Write-Host "Created $($p.dst)"
    }
}

Write-Host ""
Write-Host "Next: Edit backend/.env, frontend/.env, mobile/.env with your API keys."
Write-Host "See docs/SETUP_KEYS.md for step-by-step instructions."
