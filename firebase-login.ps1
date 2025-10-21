# Firebase Login Script
# Double-click this file or right-click → Run with PowerShell

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  Firebase CLI Login" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Change to project directory
Set-Location "C:\Users\david\Downloads\PCI_mapper"

Write-Host "Logging into Firebase..." -ForegroundColor Yellow
Write-Host "A browser window will open for authentication." -ForegroundColor Yellow
Write-Host ""

# Run Firebase login
firebase login

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "  Login Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

