# PowerShell Script to Deploy Backend Dependency Updates to GCE
# This script uses the existing deployment infrastructure

$ErrorActionPreference = "Stop"

Write-Host "Backend Dependency Updates Deployment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if existing deployment script exists
$existingScript = Join-Path $PSScriptRoot "scripts\deployment\Deploy-GCE-Backend.ps1"

if (Test-Path $existingScript) {
    Write-Host "Using existing deployment script..." -ForegroundColor Green
    Write-Host ""
    & $existingScript
    exit $LASTEXITCODE
}

# Fallback: Direct deployment
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Instance: acs-hss-server"
Write-Host "  Zone: us-central1-a"
Write-Host ""

# Check if gcloud is installed
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "Error: gcloud CLI not found" -ForegroundColor Red
    Write-Host "   Please install Google Cloud SDK first" -ForegroundColor Yellow
    exit 1
}

Write-Host "gcloud CLI found" -ForegroundColor Green
Write-Host ""

Write-Host "Connecting to GCE server..." -ForegroundColor Yellow
Write-Host ""

# Simple deployment command
$deployCmd = @'
cd /opt/lte-pci-mapper 2>/dev/null || cd /root/lte-pci-mapper
git pull origin main
cd backend-services
npm install --production
pm2 restart all
pm2 save
pm2 status
'@

try {
    gcloud compute ssh acs-hss-server --zone=us-central1-a --command=$deployCmd --tunnel-through-iap
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Backend deployment completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Verify deployment:" -ForegroundColor Cyan
        Write-Host "  1. Check API health: https://hss.wisptools.io/api/health"
        Write-Host "  2. Check PM2 status on server"
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "Deployment had issues. Exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "Deployment failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual deployment:" -ForegroundColor Yellow
    Write-Host "  gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap"
    exit 1
}

Write-Host ""
Write-Host "All done!" -ForegroundColor Green