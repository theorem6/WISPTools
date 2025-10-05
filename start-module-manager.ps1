# LTE WISP Management Platform - Module Manager Launcher
# This script starts the Module Manager development server

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  LTE WISP Management Platform - Module Manager" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to Module_Manager directory
Set-Location -Path "Module_Manager"

Write-Host "Checking dependencies..." -ForegroundColor Yellow

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies (first time setup)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies!" -ForegroundColor Red
        Write-Host "Please ensure Node.js and npm are installed correctly." -ForegroundColor Red
        pause
        exit 1
    }
}

Write-Host ""
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host ""
Write-Host "Once started, open your browser to:" -ForegroundColor Yellow
Write-Host "  http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Start the dev server
npm run dev

