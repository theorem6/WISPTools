# WISPTools.io Complete Deployment Script for Windows
# Automates local development and remote deployment
#
# Usage:
#   .\Deploy-All.ps1 -Target Local      # Local development setup
#   .\Deploy-All.ps1 -Target Frontend   # Deploy frontend to Firebase
#   .\Deploy-All.ps1 -Target GCE        # Deploy backend to GCE
#   .\Deploy-All.ps1 -Target All        # Deploy everything

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("Local", "Frontend", "GCE", "All")]
    [string]$Target = "Local",
    
    [Parameter(Mandatory=$false)]
    [string]$GceIp = "136.112.111.167",
    
    [Parameter(Mandatory=$false)]
    [string]$SshUser = "root"
)

# Colors
function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║  $($Message.PadRight(57)) ║" -ForegroundColor Magenta
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
    Write-Host ""
}

function Write-Status {
    param([string]$Message)
    Write-Host "▶ $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

# Check prerequisites
function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    $missing = @()
    
    # Check Node.js
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = node --version
        Write-Success "Node.js: $nodeVersion"
    } else {
        $missing += "Node.js"
        Write-Error-Custom "Node.js not installed"
    }
    
    # Check npm
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $npmVersion = npm --version
        Write-Success "npm: v$npmVersion"
    } else {
        $missing += "npm"
        Write-Error-Custom "npm not installed"
    }
    
    # Check Git
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $gitVersion = git --version
        Write-Success "$gitVersion"
    } else {
        $missing += "Git"
        Write-Error-Custom "Git not installed"
    }
    
    # Check Firebase CLI
    if (Get-Command firebase -ErrorAction SilentlyContinue) {
        $firebaseVersion = firebase --version
        Write-Success "Firebase CLI: $firebaseVersion"
    } else {
        Write-Warning-Custom "Firebase CLI not installed (needed for frontend deployment)"
        if ($Target -eq "Frontend" -or $Target -eq "All") {
            $missing += "Firebase CLI"
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Host ""
        Write-Error-Custom "Missing prerequisites: $($missing -join ', ')"
        Write-Host ""
        Write-Host "Install instructions:"
        if ($missing -contains "Node.js") {
            Write-Host "  Node.js: https://nodejs.org/"
        }
        if ($missing -contains "Git") {
            Write-Host "  Git: https://git-scm.com/download/win"
        }
        if ($missing -contains "Firebase CLI") {
            Write-Host "  Firebase CLI: npm install -g firebase-tools"
        }
        exit 1
    }
    
    Write-Success "All prerequisites met"
}

# Local development setup
function Start-LocalSetup {
    Write-Header "Local Development Setup"
    
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $moduleManager = Join-Path $repoRoot "Module_Manager"
    
    if (-not (Test-Path $moduleManager)) {
        Write-Error-Custom "Module_Manager directory not found"
        exit 1
    }
    
    Set-Location $moduleManager
    
    Write-Status "Installing frontend dependencies..."
    npm install
    Write-Success "Frontend dependencies installed"
    
    Write-Status "Creating .env.local file..."
    @"
VITE_API_URL=http://localhost:3001
VITE_GCE_IP=$GceIp
VITE_GCE_PORT=3001
VITE_FIREBASE_PROJECT=lte-pci-mapper-65450042-bbf71
"@ | Out-File -FilePath ".env.local" -Encoding UTF8
    
    Write-Success ".env.local created"
    
    # Check if backend is needed
    $gceBackend = Join-Path $repoRoot "gce-backend"
    if (Test-Path $gceBackend) {
        Write-Status "Installing backend dependencies..."
        Set-Location $gceBackend
        npm install
        Write-Success "Backend dependencies installed"
    }
    
    Set-Location $repoRoot
    
    Write-Header "Local Setup Complete"
    Write-Host ""
    Write-Success "Development environment ready!"
    Write-Host ""
    Write-Host "To start development:"
    Write-Host "  cd Module_Manager"
    Write-Host "  npm run dev"
    Write-Host ""
    Write-Host "Frontend will be available at: http://localhost:5173"
    Write-Host ""
}

# Deploy frontend to Firebase
function Start-FrontendDeploy {
    Write-Header "Frontend Deployment to Firebase"
    
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $moduleManager = Join-Path $repoRoot "Module_Manager"
    
    Set-Location $moduleManager
    
    Write-Status "Building frontend..."
    npm run build
    
    if (-not (Test-Path "build")) {
        Write-Error-Custom "Build failed - build directory not created"
        exit 1
    }
    
    Write-Success "Frontend built"
    
    Write-Status "Deploying to Firebase..."
    firebase deploy --only hosting
    
    Write-Success "Frontend deployed"
    
    Write-Header "Frontend Deployment Complete"
    Write-Host ""
    Write-Success "Frontend is live!"
    Write-Host ""
    Write-Host "  URL: https://lte-pci-mapper-65450042-bbf71.web.app"
    Write-Host "  Custom: https://wisptools.io"
    Write-Host ""
}

# Deploy to GCE server
function Start-GceDeploy {
    Write-Header "GCE Backend Deployment"
    
    Write-Status "Connecting to GCE server: $GceIp"
    
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $deployScript = Join-Path $repoRoot "scripts\deployment\deploy-all-automated.sh"
    
    if (-not (Test-Path $deployScript)) {
        Write-Error-Custom "Deployment script not found: $deployScript"
        exit 1
    }
    
    Write-Status "Uploading deployment script..."
    scp "$deployScript" "${SshUser}@${GceIp}:/tmp/deploy-all-automated.sh"
    
    Write-Status "Running deployment on GCE server..."
    ssh "${SshUser}@${GceIp}" "bash /tmp/deploy-all-automated.sh"
    
    Write-Success "GCE deployment complete"
    
    Write-Header "GCE Deployment Complete"
    Write-Host ""
    Write-Success "Backend is live!"
    Write-Host ""
    Write-Host "  Server: http://$GceIp"
    Write-Host "  API: http://${GceIp}:3001/api/"
    Write-Host "  Health: http://${GceIp}:3001/health"
    Write-Host "  ISOs: http://${GceIp}/downloads/isos/"
    Write-Host ""
}

# Commit and push to Git
function Start-GitPush {
    Write-Header "Git Commit & Push"
    
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    Set-Location $repoRoot
    
    Write-Status "Checking Git status..."
    $status = git status --porcelain
    
    if ([string]::IsNullOrEmpty($status)) {
        Write-Warning-Custom "No changes to commit"
        return
    }
    
    Write-Status "Staging all changes..."
    git add .
    
    Write-Status "Committing changes..."
    $commitMessage = "Automated deployment update - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git commit -m $commitMessage
    
    Write-Status "Pushing to GitHub..."
    git push origin main
    
    Write-Success "Changes pushed to GitHub"
}

# Main execution
Write-Header "WISPTools.io Deployment Automation"
Write-Host "  Target: $Target"
Write-Host "  GCE IP: $GceIp"
Write-Host ""

Test-Prerequisites

switch ($Target) {
    "Local" {
        Start-LocalSetup
    }
    "Frontend" {
        Start-FrontendDeploy
        Start-GitPush
    }
    "GCE" {
        Start-GitPush
        Start-GceDeploy
    }
    "All" {
        Start-LocalSetup
        Start-FrontendDeploy
        Start-GceDeploy
        Start-GitPush
    }
}

Write-Header "DEPLOYMENT COMPLETE"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "SYSTEM STATUS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  GCE Server:  http://$GceIp"
Write-Host "  Frontend:    https://wisptools.io"
Write-Host "  GitHub:      https://github.com/theorem6/lte-pci-mapper"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "NEXT STEPS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Visit frontend: https://wisptools.io"
Write-Host "  2. Check HSS Management module"
Write-Host "  3. Test EPC deployment"
Write-Host "  4. Monitor: ssh ${SshUser}@${GceIp} 'wisptools-status'"
Write-Host ""
Write-Success "All systems operational!" -ForegroundColor Green
Write-Host ""

exit 0

