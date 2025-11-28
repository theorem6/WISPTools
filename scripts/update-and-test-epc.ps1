# PowerShell Script to Update EPC and Force Check-in Test
# Queues update command and triggers immediate check-in

$ErrorActionPreference = "Continue"

$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"
$REPO_DIR = "/opt/lte-pci-mapper"
$EPC_ID = "EPC-CB4C5042"
$DEVICE_CODE = "YALNTFQC"
$TENANT_ID = "690abdc14a6f067977986db3"
$EPC_IP = "192.168.2.234"  # Optional: Set to EPC IP if you want to trigger check-in via SSH
$EPC_SSH_USER = "wisp"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Update EPC and Force Check-in Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EPC ID: $EPC_ID" -ForegroundColor Yellow
Write-Host "Device Code: $DEVICE_CODE" -ForegroundColor Yellow
Write-Host "EPC IP: $EPC_IP" -ForegroundColor Yellow
Write-Host ""

# Function to run command on GCE server
function Invoke-GCECmd {
    param([string]$Command, [string]$Description)
    Write-Host "$Description" -ForegroundColor Yellow
    gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command=$Command
    Write-Host ""
}

# Step 1: Queue Update Command
Write-Host "Step 1: Queueing Update Command..." -ForegroundColor Cyan
Invoke-GCECmd -Command "cd $REPO_DIR; node backend-services/scripts/update-and-test-epc.js $EPC_ID $TENANT_ID" -Description "Queueing Update and Checking Status"

# Step 2: Trigger Immediate Check-in (if EPC IP is provided)
if ($EPC_IP) {
    Write-Host "Step 2: Triggering Immediate Check-in via SSH..." -ForegroundColor Cyan
    Write-Host "Attempting SSH to $EPC_SSH_USER@$EPC_IP..." -ForegroundColor Yellow
    
    $sshCommand = "sudo /opt/wisptools/epc-checkin-agent.sh once"
    
    # Try to run via GCE server (which might have SSH access to EPC)
    Write-Host "Note: If direct SSH fails, use manual instructions below" -ForegroundColor Yellow
    Write-Host ""
    
    # Alternative: Use GCE server as jump host if needed
    Invoke-GCECmd -Command "ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 $EPC_SSH_USER@$EPC_IP '$sshCommand' 2>&1 || echo 'SSH failed - use manual check-in'" -Description "Triggering Check-in"
} else {
    Write-Host "Step 2: Manual Check-in Required" -ForegroundColor Cyan
    Write-Host "EPC IP not provided - please trigger check-in manually:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  ssh wisp@EPC_IP" -ForegroundColor White
    Write-Host "  sudo /opt/wisptools/epc-checkin-agent.sh once" -ForegroundColor White
    Write-Host ""
}

# Step 3: Wait and Check Status
Write-Host "Step 3: Waiting 10 seconds, then checking status..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

Write-Host "Checking command status..." -ForegroundColor Yellow
Invoke-GCECmd -Command "cd $REPO_DIR; node backend-services/scripts/check-epc-status.js $EPC_ID $TENANT_ID" -Description "Checking Final Status"

# Step 4: Check Server Logs
Write-Host "Step 4: Checking Recent Server Logs..." -ForegroundColor Cyan
Invoke-GCECmd -Command "pm2 logs main-api --lines 30 --nostream | grep -E 'EPC Check-in|Commands:|YALNTFQC|EPC-CB4C5042' | tail -15" -Description "Checking Server Logs"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check EPC logs: tail -f /var/log/wisptools-checkin.log" -ForegroundColor White
Write-Host "2. Verify update was executed" -ForegroundColor White
Write-Host "3. Check monitoring page for metrics" -ForegroundColor White
Write-Host ""

