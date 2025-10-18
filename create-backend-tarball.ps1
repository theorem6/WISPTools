# PowerShell script to create a tar.gz file for Linux deployment
# This creates a Linux-friendly archive

Write-Host "📦 Creating Linux-compatible backend deployment package..." -ForegroundColor Cyan

# Check if tar is available
$tarPath = Get-Command tar -ErrorAction SilentlyContinue

if ($tarPath) {
    # Create tar.gz using Windows tar (available in Windows 10+)
    tar -czf backend-update.tar.gz `
        distributed-epc-api.js `
        distributed-epc-schema.js `
        distributed-epc `
        backend-services `
        deployment-files
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Created backend-update.tar.gz" -ForegroundColor Green
        Write-Host ""
        Write-Host "Upload with:" -ForegroundColor Yellow
        Write-Host "  scp backend-update.tar.gz david@136.112.111.167:/home/david/" -ForegroundColor White
        Write-Host ""
        Write-Host "Then update the install script to use:" -ForegroundColor Yellow
        Write-Host "  tar -xzf /home/david/backend-update.tar.gz" -ForegroundColor White
    } else {
        Write-Host "❌ Failed to create tar.gz" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ tar command not found" -ForegroundColor Red
    Write-Host "The ZIP file will still work, just ignore the backslash warning" -ForegroundColor Yellow
}

