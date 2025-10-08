# Deploy from Git to Firebase App Hosting
# This script deploys the entire application from a fresh git clone

param(
    [switch]$SkipFunctions = $false,
    [switch]$SkipAppHosting = $false,
    [switch]$InitializeDB = $false
)

Write-Host "🚀 Deploying from Git to Firebase App Hosting..." -ForegroundColor Green
Write-Host ""

# Check if Firebase CLI is installed
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI installed: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if logged in to Firebase
Write-Host ""
Write-Host "Checking Firebase authentication..." -ForegroundColor Yellow
try {
    $firebaseProjects = firebase projects:list 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Not logged in to Firebase. Please run:" -ForegroundColor Red
        Write-Host "firebase login" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Authenticated with Firebase" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase authentication check failed" -ForegroundColor Red
    exit 1
}

# Verify we're in the correct project
Write-Host ""
Write-Host "Verifying Firebase project..." -ForegroundColor Yellow
try {
    $currentProject = firebase use
    Write-Host "✅ Using Firebase project: $currentProject" -ForegroundColor Green
} catch {
    Write-Host "❌ No Firebase project selected. Please run:" -ForegroundColor Red
    Write-Host "firebase use <project-id>" -ForegroundColor Yellow
    exit 1
}

# Deploy Firebase Functions
if (-not $SkipFunctions) {
    Write-Host ""
    Write-Host "📦 Deploying Firebase Functions..." -ForegroundColor Cyan
    Write-Host "This includes all MongoDB CRUD operations and initialization functions" -ForegroundColor Gray
    
    # Check if functions directory exists
    if (-not (Test-Path "functions")) {
        Write-Host "❌ functions directory not found!" -ForegroundColor Red
        exit 1
    }
    
    # Install dependencies if needed
    if (-not (Test-Path "functions/node_modules")) {
        Write-Host "Installing Functions dependencies..." -ForegroundColor Yellow
        Push-Location functions
        npm install
        Pop-Location
    }
    
    # Build TypeScript
    Write-Host "Building TypeScript..." -ForegroundColor Yellow
    Push-Location functions
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ TypeScript build failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "✅ TypeScript build successful" -ForegroundColor Green
    
    # Deploy functions
    Write-Host "Deploying functions to Firebase..." -ForegroundColor Yellow
    firebase deploy --only functions
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Firebase Functions deployed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Firebase Functions deployment failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⏭️  Skipping Firebase Functions deployment" -ForegroundColor Yellow
}

# Deploy Module Manager to Firebase App Hosting
if (-not $SkipAppHosting) {
    Write-Host ""
    Write-Host "🌐 Deploying Module Manager to Firebase App Hosting..." -ForegroundColor Cyan
    Write-Host "This includes the GenieACS UI and database initialization pages" -ForegroundColor Gray
    
    # Check if Module_Manager directory exists
    if (-not (Test-Path "Module_Manager")) {
        Write-Host "❌ Module_Manager directory not found!" -ForegroundColor Red
        exit 1
    }
    
    Push-Location Module_Manager
    
    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing Module Manager dependencies..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ npm install failed!" -ForegroundColor Red
            Pop-Location
            exit 1
        }
    }
    
    # Deploy to Firebase App Hosting
    Write-Host "Deploying to Firebase App Hosting..." -ForegroundColor Yellow
    firebase apphosting:backends:deploy
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Firebase App Hosting deployment successful!" -ForegroundColor Green
    } else {
        Write-Host "❌ Firebase App Hosting deployment failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Pop-Location
} else {
    Write-Host "⏭️  Skipping Firebase App Hosting deployment" -ForegroundColor Yellow
}

# Initialize MongoDB Database
if ($InitializeDB) {
    Write-Host ""
    Write-Host "🗄️  Initializing MongoDB Database..." -ForegroundColor Cyan
    
    # Get the project ID
    $projectId = firebase use | Out-String
    $projectId = $projectId.Trim()
    
    $functionsUrl = "https://us-central1-$projectId.cloudfunctions.net"
    
    Write-Host "Checking MongoDB health..." -ForegroundColor Yellow
    try {
        $healthResponse = Invoke-WebRequest -Uri "$functionsUrl/checkMongoHealth" -Method Get -ErrorAction Stop
        $healthData = $healthResponse.Content | ConvertFrom-Json
        
        if ($healthData.success) {
            Write-Host "✅ MongoDB connected: $($healthData.database)" -ForegroundColor Green
            Write-Host "   Server: $($healthData.serverVersion)" -ForegroundColor Gray
            Write-Host "   Presets: $($healthData.collections.presets)" -ForegroundColor Gray
            Write-Host "   Faults: $($healthData.collections.faults)" -ForegroundColor Gray
            
            # Ask if user wants to initialize
            $response = Read-Host "Initialize database with sample data? (y/n)"
            if ($response -eq 'y') {
                Write-Host "Initializing database..." -ForegroundColor Yellow
                $initResponse = Invoke-WebRequest -Uri "$functionsUrl/initializeMongoDatabase" -Method Post -ErrorAction Stop
                $initData = $initResponse.Content | ConvertFrom-Json
                
                if ($initData.success) {
                    Write-Host "✅ Database initialized!" -ForegroundColor Green
                    Write-Host "   Presets: $($initData.presets.created) created, $($initData.presets.skipped) existed" -ForegroundColor Gray
                    Write-Host "   Faults: $($initData.faults.created) created, $($initData.faults.skipped) existed" -ForegroundColor Gray
                } else {
                    Write-Host "❌ Database initialization failed: $($initData.error)" -ForegroundColor Red
                }
            }
        } else {
            Write-Host "❌ MongoDB not connected: $($healthData.error)" -ForegroundColor Red
            Write-Host "Please configure MONGODB_URI in apphosting.yaml" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Failed to connect to MongoDB: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=" -ForegroundColor Green -NoNewline
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "=" -ForegroundColor Green -NoNewline
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host ""

# Show next steps
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Visit your Firebase App Hosting URL" -ForegroundColor White
Write-Host "2. Go to: ACS CPE Management → Administration → Database" -ForegroundColor White
Write-Host "3. Click 'Initialize Database' to create sample data" -ForegroundColor White
Write-Host "4. Test presets editing and faults management" -ForegroundColor White
Write-Host ""
Write-Host "To initialize database from command line, run:" -ForegroundColor Yellow
Write-Host "./deploy-from-git.ps1 -InitializeDB" -ForegroundColor Cyan
Write-Host ""
Write-Host "To deploy only functions:" -ForegroundColor Yellow
Write-Host "./deploy-from-git.ps1 -SkipAppHosting" -ForegroundColor Cyan
Write-Host ""
Write-Host "To deploy only app hosting:" -ForegroundColor Yellow
Write-Host "./deploy-from-git.ps1 -SkipFunctions" -ForegroundColor Cyan
Write-Host ""

