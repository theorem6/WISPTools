# Fix EPC Device Registration
# Runs the diagnostic script on the GCE server to check/fix device registration
# Usage: .\Fix-EPC-Registration.ps1 <device_code> [epc_id]

param(
    [Parameter(Mandatory=$true)]
    [string]$DeviceCode,
    
    [Parameter(Mandatory=$false)]
    [string]$EPCID
)

$ErrorActionPreference = "Stop"

$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"

Write-Host "🔍 Fixing EPC Device Registration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Device Code: $DeviceCode" -ForegroundColor Yellow
if ($EPCID) {
    Write-Host "EPC ID: $EPCID" -ForegroundColor Yellow
}
Write-Host ""

# Check if gcloud is available
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: gcloud CLI not found" -ForegroundColor Red
    Write-Host "   Please install Google Cloud SDK first" -ForegroundColor Yellow
    exit 1
}

# Build the command
$scriptPath = "/opt/lte-pci-mapper/backend-services/scripts/fix-epc-registration.js"
$command = "cd /opt/lte-pci-mapper && node $scriptPath $DeviceCode"

if ($EPCID) {
    $command += " $EPCID"
}

Write-Host "📡 Connecting to GCE server..." -ForegroundColor Yellow
Write-Host ""

# Run the script on GCE server
Write-Host "Running diagnostic script..." -ForegroundColor Yellow
gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command=$command

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Script execution failed" -ForegroundColor Red
    Write-Host "   Exit code: $LASTEXITCODE" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Script execution complete!" -ForegroundColor Green
Write-Host ""

