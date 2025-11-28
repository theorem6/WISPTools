# PowerShell Script to Run EPC Diagnostics and Force Update
# Runs all diagnostics and forces an update for the EPC

$ErrorActionPreference = "Continue"

$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"
$REPO_DIR = "/opt/lte-pci-mapper"
$EPC_ID = "EPC-CB4C5042"
$TENANT_ID = "690abdc14a6f067977986db3"

Write-Host "EPC Diagnostic and Update Script" -ForegroundColor Cyan
Write-Host "EPC ID: $EPC_ID" -ForegroundColor Yellow
Write-Host ""

# Function to run command on GCE server
function Invoke-GCECmd {
    param([string]$Command, [string]$Description)
    Write-Host "$Description" -ForegroundColor Yellow
    gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command=$Command
    Write-Host ""
}

# Step 1: Check EPC Status
Write-Host "Step 1: Checking EPC Status..." -ForegroundColor Cyan
Invoke-GCECmd -Command "cd $REPO_DIR; node backend-services/scripts/check-epc-status.js $EPC_ID $TENANT_ID" -Description "Checking EPC Status"

# Step 2: Check Recent Server Logs
Write-Host "Step 2: Checking Recent Server Logs..." -ForegroundColor Cyan
Invoke-GCECmd -Command "pm2 logs main-api --lines 30 --nostream | grep -E 'EPC Check-in|Auto-Update|YALNTFQC|EPC-CB4C5042' | tail -20" -Description "Checking Server Logs"

# Step 3: Force Update
Write-Host "Step 3: Forcing Update..." -ForegroundColor Cyan
Invoke-GCECmd -Command "cd $REPO_DIR; node backend-services/scripts/create-epc-update-command.js $EPC_ID $TENANT_ID" -Description "Creating Update Command"

# Step 4: Verify Update Command
Write-Host "Step 4: Verifying Update Command..." -ForegroundColor Cyan
Invoke-GCECmd -Command "cd $REPO_DIR; node backend-services/scripts/check-epc-status.js $EPC_ID $TENANT_ID" -Description "Verifying Update Command Created"

# Step 5: Wait and Check Again
Write-Host "Step 5: Waiting 75 seconds for next check-in..." -ForegroundColor Cyan
Start-Sleep -Seconds 75

# Step 6: Check logs for update execution
Write-Host "Step 6: Checking for Update Execution..." -ForegroundColor Cyan
Invoke-GCECmd -Command "pm2 logs main-api --lines 50 --nostream | grep -E 'EPC Check-in|Commands:' | tail -10" -Description "Checking Update Execution"

Write-Host "Diagnostic Complete!" -ForegroundColor Green
