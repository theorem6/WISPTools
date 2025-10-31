# PowerShell Script to Deploy GCE Backend
# Updates backend services on GCE server from GitHub

$ErrorActionPreference = "Stop"

Write-Host "🚀 GCE Backend Deployment Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"
$GCE_IP = "136.112.111.167"

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "  Instance: $GCE_INSTANCE"
Write-Host "  Zone: $GCE_ZONE"
Write-Host "  IP: $GCE_IP"
Write-Host ""

# Check if gcloud is installed
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ gcloud CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "   Download from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ gcloud CLI found" -ForegroundColor Green
Write-Host ""

# Inline-transfer update script via base64 (avoids scp issues)
Write-Host "📤 Sending update script inline (base64) and executing on GCE..." -ForegroundColor Yellow
$localScriptPath = Join-Path $PSScriptRoot "update-backend-from-git.sh"
$localScriptPath = (Resolve-Path $localScriptPath).Path
$scriptContent = Get-Content -Raw -LiteralPath $localScriptPath
$bytes = [System.Text.Encoding]::UTF8.GetBytes($scriptContent)
$b64 = [Convert]::ToBase64String($bytes)

# Use single quotes around bash HERE to avoid interpolation; echo base64 and decode remotely
$remoteCmd = @(
  "echo '$b64' | base64 -d > update-backend-from-git.sh",
  "chmod +x update-backend-from-git.sh",
  "sudo bash update-backend-from-git.sh"
) -join " && "

gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command=$remoteCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed running remote script" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ GCE Backend Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 Verify deployment:" -ForegroundColor Cyan
Write-Host "  curl http://${GCE_IP}:3001/health"
Write-Host "  curl http://${GCE_IP}:3002/health"
Write-Host ""

