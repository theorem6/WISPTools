# Frontend Deployment Script for Windows PowerShell
# Robust & Safe deployment to Firebase Hosting

param(
    [string]$FirebaseProject = "wisptools-production",
    [switch]$SkipBuild = $false,
    [switch]$SkipVerification = $false
)

$ErrorActionPreference = "Stop"

# Configuration
$BuildDir = "Module_Manager\build\client"
$SourceDir = "Module_Manager"
$BackupDir = "firebase-hosting-backup-$(Get-Date -Format 'yyyyMMddHHmmss')"
$FirebaseJson = "firebase.json"

# Helper Functions
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        default { "White" }
    }
    Write-Host "[$timestamp] $Message" -ForegroundColor $color
}

function Write-Success {
    param([string]$Message)
    Write-Log "✓ $Message" "SUCCESS"
}

function Write-Error {
    param([string]$Message)
    Write-Log "✗ $Message" "ERROR"
}

function Write-Warning {
    param([string]$Message)
    Write-Log "⚠ $Message" "WARNING"
}

# Pre-deployment Checks
function Test-Prerequisites {
    Write-Log "Running pre-deployment checks..."
    
    # Check Firebase CLI
    try {
        $null = firebase --version 2>&1
        Write-Success "Firebase CLI found"
    } catch {
        Write-Error "Firebase CLI not found. Install with: npm install -g firebase-tools"
        exit 1
    }
    
    # Check Firebase authentication
    try {
        $null = firebase projects:list 2>&1
        Write-Success "Firebase authentication verified"
    } catch {
        Write-Error "Not authenticated. Run: firebase login"
        exit 1
    }
    
    # Check firebase.json exists
    if (-not (Test-Path $FirebaseJson)) {
        Write-Error "$FirebaseJson not found"
        exit 1
    }
    
    # Validate firebase.json structure
    try {
        $config = Get-Content $FirebaseJson | ConvertFrom-Json
        if (-not $config.hosting -or -not $config.hosting.public -or -not $config.hosting.rewrites) {
            Write-Error "$FirebaseJson missing required hosting configuration"
            exit 1
        }
        Write-Success "firebase.json validated"
    } catch {
        Write-Error "$FirebaseJson is invalid JSON"
        exit 1
    }
    
    Write-Success "Pre-deployment checks passed"
}

# Build Frontend
function Build-Frontend {
    if ($SkipBuild) {
        Write-Warning "Skipping build (`--SkipBuild flag)"
        return
    }
    
    Write-Log "Building frontend..."
    Push-Location $SourceDir
    
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed"
        }
        Write-Success "Frontend build completed"
    } catch {
        Write-Error "Frontend build failed"
        Pop-Location
        exit 1
    }
    
    Pop-Location
    
    # Verify build output
    if (-not (Test-Path "$BuildDir\index.html")) {
        Write-Error "Build completed but index.html not found"
        exit 1
    }
    
    # Ensure 404.html exists
    if (-not (Test-Path "$BuildDir\404.html")) {
        Write-Warning "404.html not found. Creating from index.html..."
        Copy-Item "$BuildDir\index.html" "$BuildDir\404.html"
    }
}

# Backup Current Deployment
function Backup-Configuration {
    Write-Log "Creating backup..."
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Copy-Item $FirebaseJson "$BackupDir\firebase.json"
    Write-Success "Backup created in $BackupDir"
}

# Deploy to Firebase
function Deploy-ToFirebase {
    Write-Log "Deploying to Firebase Hosting..."
    
    try {
        firebase deploy --only hosting --project $FirebaseProject
        if ($LASTEXITCODE -ne 0) {
            throw "Deployment failed"
        }
        Write-Success "Deployment completed"
        return $true
    } catch {
        Write-Error "Firebase deployment failed"
        return $false
    }
}

# Verify Deployment
function Test-Deployment {
    if ($SkipVerification) {
        Write-Warning "Skipping verification (`--SkipVerification flag)"
        return $true
    }
    
    Write-Log "Verifying deployment..."
    $siteUrl = "https://$FirebaseProject.web.app"
    $maxAttempts = 5
    $attempt = 1
    
    while ($attempt -le $maxAttempts) {
        Write-Log "Verification attempt $attempt/$maxAttempts..."
        
        try {
            $response = Invoke-WebRequest -Uri $siteUrl -Method Head -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Success "Site is accessible (HTTP 200)"
                
                # Check content
                $content = Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -ErrorAction Stop
                if ($content.Content -match '<title>.*</title>') {
                    Write-Success "Site content verified"
                    return $true
                }
            }
        } catch {
            Write-Warning "Site check failed: $($_.Exception.Message)"
        }
        
        $attempt++
        Start-Sleep -Seconds 5
    }
    
    Write-Error "Deployment verification failed after $maxAttempts attempts"
    return $false
}

# Rollback
function Invoke-Rollback {
    Write-Error "Deployment failed. Attempting rollback..."
    
    if (Test-Path "$BackupDir\firebase.json") {
        Write-Log "Restoring firebase.json from backup..."
        Copy-Item "$BackupDir\firebase.json" $FirebaseJson -Force
        
        Write-Log "Redeploying previous version..."
        try {
            firebase deploy --only hosting --project $FirebaseProject
            Write-Success "Rollback completed"
        } catch {
            Write-Error "Rollback failed. Manual intervention required."
            Write-Error "Restore manually: Copy-Item '$BackupDir\firebase.json' '$FirebaseJson'"
            exit 1
        }
    } else {
        Write-Error "No backup found. Cannot rollback automatically."
        exit 1
    }
}

# Main Execution
function Main {
    Write-Log "=== Starting Frontend Deployment ==="
    
    # Pre-deployment checks
    Test-Prerequisites
    
    # Build frontend
    if (-not (Test-Path $BuildDir) -or -not (Test-Path "$BuildDir\index.html")) {
        Build-Frontend
    } else {
        Write-Success "Build directory exists, skipping build"
    }
    
    # Backup
    Backup-Configuration
    
    # Deploy
    if (-not (Deploy-ToFirebase)) {
        Invoke-Rollback
        exit 1
    }
    
    # Verify
    if (-not (Test-Deployment)) {
        Write-Error "Deployment verification failed"
        Invoke-Rollback
        exit 1
    }
    
    Write-Success "=== Frontend Deployment Completed Successfully ==="
    Write-Log "Site URL: https://$FirebaseProject.web.app"
    Write-Log "Backup location: $BackupDir"
}

# Run main
Main


