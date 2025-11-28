# Deploy EPC Scripts to GCE Server and Update Remote EPC
# Updates repository, copies scripts to downloads directory, and triggers EPC update

$ErrorActionPreference = "Stop"

$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"
$REPO_DIR = "/opt/lte-pci-mapper"
$SCRIPTS_DIR = "/var/www/html/downloads/scripts"

Write-Host "🚀 Deploying EPC Scripts to GCE Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is available
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: gcloud CLI not found" -ForegroundColor Red
    Write-Host "   Please install Google Cloud SDK first" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ gcloud CLI found" -ForegroundColor Green
Write-Host ""

# Function to run command on GCE server
function Invoke-GCECmd {
    param([string]$Command)
    Write-Host "  Running: $Command" -ForegroundColor Gray
    gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command=$Command
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️  Command returned exit code: $LASTEXITCODE" -ForegroundColor Yellow
    }
}

Write-Host "📡 Connecting to GCE server..." -ForegroundColor Yellow
Write-Host ""

# Step 1: Update repository from GitHub
Write-Host "📥 Step 1: Updating repository from GitHub..." -ForegroundColor Yellow
Invoke-GCECmd "cd $REPO_DIR; sudo git fetch origin; sudo git reset --hard origin/main; sudo git clean -fd"

Write-Host ""
Write-Host "✅ Repository updated from GitHub" -ForegroundColor Green
Write-Host ""

# Step 2: Ensure scripts directory exists
Write-Host "📁 Step 2: Ensuring scripts directory exists..." -ForegroundColor Yellow
Invoke-GCECmd "sudo mkdir -p $SCRIPTS_DIR; sudo chown -R www-data:www-data /var/www/html/downloads; sudo chmod -R 755 /var/www/html/downloads"

Write-Host ""
Write-Host "✅ Scripts directory ready" -ForegroundColor Green
Write-Host ""

# Step 3: Copy EPC scripts to download directory
Write-Host "📋 Step 3: Copying EPC scripts to download directory..." -ForegroundColor Yellow

# Copy check-in agent
Write-Host "  → Copying epc-checkin-agent.sh..." -ForegroundColor Gray
Invoke-GCECmd "sudo cp $REPO_DIR/backend-services/scripts/epc-checkin-agent.sh $SCRIPTS_DIR/; sudo chmod 755 $SCRIPTS_DIR/epc-checkin-agent.sh"

# Copy Node.js SNMP discovery script
Write-Host "  → Copying epc-snmp-discovery.js..." -ForegroundColor Gray
Invoke-GCECmd "sudo cp $REPO_DIR/backend-services/scripts/epc-snmp-discovery.js $SCRIPTS_DIR/; sudo chmod 755 $SCRIPTS_DIR/epc-snmp-discovery.js"

# Copy Bash SNMP discovery script (fallback)
Write-Host "  → Copying epc-snmp-discovery.sh (fallback)..." -ForegroundColor Gray
Invoke-GCECmd "sudo cp $REPO_DIR/backend-services/scripts/epc-snmp-discovery.sh $SCRIPTS_DIR/; sudo chmod 755 $SCRIPTS_DIR/epc-snmp-discovery.sh"

# Copy npm package installer
        Write-Host "  → Copying install-epc-npm-packages.sh..." -ForegroundColor Gray
        Invoke-GCECmd "sudo cp $REPO_DIR/backend-services/scripts/install-epc-npm-packages.sh $SCRIPTS_DIR/; sudo chmod 755 $SCRIPTS_DIR/install-epc-npm-packages.sh"

        # Copy device setup script
        Write-Host "  → Copying setup-epc-device.sh..." -ForegroundColor Gray
        Invoke-GCECmd "sudo cp $REPO_DIR/backend-services/scripts/setup-epc-device.sh $SCRIPTS_DIR/; sudo chmod 755 $SCRIPTS_DIR/setup-epc-device.sh"

        Write-Host ""
        Write-Host "✅ Scripts copied successfully" -ForegroundColor Green
Write-Host ""

# Step 4: Verify scripts are accessible
Write-Host "🔍 Step 4: Verifying scripts are accessible..." -ForegroundColor Yellow
Invoke-GCECmd "ls -lh $SCRIPTS_DIR/epc-*.sh $SCRIPTS_DIR/epc-*.js"

Write-Host ""
Write-Host "✅ Scripts verified" -ForegroundColor Green
Write-Host ""

# Step 5: Restart backend services to pick up any changes
Write-Host "🔄 Step 5: Restarting backend services..." -ForegroundColor Yellow
Invoke-GCECmd "pm2 restart all"

Write-Host ""
Write-Host "✅ Backend services restarted" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host ""
        Write-Host "Scripts are now available at:" -ForegroundColor Cyan
        Write-Host "  • https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh" -ForegroundColor White
        Write-Host "  • https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.js" -ForegroundColor White
        Write-Host "  • https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh" -ForegroundColor White
        Write-Host "  • https://hss.wisptools.io/downloads/scripts/install-epc-npm-packages.sh" -ForegroundColor White
        Write-Host "  • https://hss.wisptools.io/downloads/scripts/setup-epc-device.sh" -ForegroundColor White
Write-Host ""
Write-Host "The remote EPC will automatically download the new scripts on next check-in." -ForegroundColor Yellow
Write-Host ""
Write-Host "To force an immediate update on the EPC, run this command on the EPC:" -ForegroundColor Yellow
$updateCommand = 'curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh | sudo bash -s install'
Write-Host $updateCommand -ForegroundColor Gray
Write-Host ""
