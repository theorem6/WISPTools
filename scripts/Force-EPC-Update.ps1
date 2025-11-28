# Force EPC Update via Backend API
# Creates an update command on the backend for the remote EPC to execute
# Usage: .\Force-EPC-Update.ps1 <EPC_ID_OR_DEVICE_CODE> [TENANT_ID]

param(
    [Parameter(Mandatory=$true)]
    [string]$EPCIdentifier,
    
    [string]$TenantId = "690abdc14a6f067977986db3"
)

Write-Host "🔧 Force EPC Update via Backend API" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "backend-services")) {
    Write-Host "❌ backend-services directory not found. Please run from project root." -ForegroundColor Red
    exit 1
}

Write-Host "EPC Identifier: $EPCIdentifier" -ForegroundColor Yellow
Write-Host "Tenant ID: $TenantId" -ForegroundColor Yellow
Write-Host ""

Write-Host "📡 Connecting to GCE server to create update command..." -ForegroundColor Yellow
Write-Host ""

# Run the update command creation script on the GCE server
$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"
$REPO_DIR = "/opt/lte-pci-mapper"

$command = "cd $REPO_DIR; node backend-services/scripts/create-epc-update-command.js $EPCIdentifier $TenantId"

try {
    gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command=$command
    
    Write-Host ""
    Write-Host "✅ Update command created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The EPC will:" -ForegroundColor Cyan
    Write-Host "  • Download the update command on next check-in (within 60 seconds)" -ForegroundColor White
    Write-Host "  • Download new scripts from the server" -ForegroundColor White
    Write-Host "  • Install npm packages (ping-scanner, net-snmp)" -ForegroundColor White
    Write-Host "  • Restart the check-in service" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Failed to create update command: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: SSH to the EPC device and run:" -ForegroundColor Yellow
    Write-Host "  curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh | sudo bash -s install" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

