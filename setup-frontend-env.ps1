# PowerShell script to configure frontend for backend server
# Run this on your local Windows machine

$backendIP = "136.112.111.167"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🔧 Configuring Frontend for Backend Server" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend IP: $backendIP" -ForegroundColor Green
Write-Host ""

# Create .env file
$envContent = @"
# Backend Server: $backendIP
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# GenieACS Services (Running on backend)
PUBLIC_GENIEACS_NBI_URL=http://${backendIP}:7557
PUBLIC_GENIEACS_CWMP_URL=http://${backendIP}:7547
PUBLIC_GENIEACS_FS_URL=http://${backendIP}:7567
PUBLIC_GENIEACS_UI_URL=http://${backendIP}:3333

# HSS Management API
VITE_HSS_API_URL=http://${backendIP}:3000

# Backend API
PUBLIC_BACKEND_API_URL=http://${backendIP}:3000/api

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0
VITE_FIREBASE_AUTH_DOMAIN=lte-pci-mapper-65450042-bbf71.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lte-pci-mapper-65450042-bbf71
VITE_FIREBASE_STORAGE_BUCKET=lte-pci-mapper-65450042-bbf71.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1044782186913
VITE_FIREBASE_APP_ID=1:1044782186913:web:e1d47cdb7b1d89bb0b6f9c
VITE_FIREBASE_MEASUREMENT_ID=
"@

# Navigate to Module_Manager
$moduleManagerPath = Join-Path $PSScriptRoot "Module_Manager"
if (-not (Test-Path $moduleManagerPath)) {
    Write-Host "❌ Error: Module_Manager directory not found" -ForegroundColor Red
    exit 1
}

$envPath = Join-Path $moduleManagerPath ".env"

# Write .env file
$envContent | Out-File -FilePath $envPath -Encoding UTF8 -NoNewline

Write-Host "✅ Created .env file at: $envPath" -ForegroundColor Green
Write-Host ""

# Show contents
Write-Host "📄 .env file contents:" -ForegroundColor Yellow
Get-Content $envPath | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ Configuration Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test backend services:" -ForegroundColor White
Write-Host "     curl http://${backendIP}:7557/devices" -ForegroundColor Gray
Write-Host "     curl http://${backendIP}:3333" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Build and deploy frontend:" -ForegroundColor White
Write-Host "     cd Module_Manager" -ForegroundColor Gray
Write-Host "     npm run build" -ForegroundColor Gray
Write-Host "     firebase deploy --only hosting" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Deploy HSS Management API on server (see FRONTEND_BACKEND_CONNECTION.md)" -ForegroundColor White
Write-Host ""

