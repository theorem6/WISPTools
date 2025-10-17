# PowerShell script to upload files to server
# Run from: c:\Users\david\Downloads\PCI_mapper\

param(
    [string]$ServerIP = "136.112.111.167",
    [string]$Username = "root"
)

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "     Upload HSS Backend Files to Server" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$server = "${Username}@${ServerIP}"
$remotePath = "/opt/lte-pci-mapper/"

Write-Host "🎯 Target: $server" -ForegroundColor Yellow
Write-Host "📂 Remote: $remotePath" -ForegroundColor Yellow
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "hss-module")) {
    Write-Host "❌ hss-module directory not found!" -ForegroundColor Red
    Write-Host "   Make sure you're in c:\Users\david\Downloads\PCI_mapper\" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Found hss-module directory" -ForegroundColor Green
Write-Host ""

# Upload hss-module folder
Write-Host "📤 Uploading hss-module..." -ForegroundColor Yellow
scp -r hss-module "${server}:${remotePath}"
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ hss-module uploaded" -ForegroundColor Green
} else {
    Write-Host "   ❌ Upload failed!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Upload deployment script
Write-Host "📤 Uploading deployment script..." -ForegroundColor Yellow
scp deploy-hss-no-git.sh "${server}:${remotePath}hss-module/"
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Deployment script uploaded" -ForegroundColor Green
} else {
    Write-Host "   ❌ Upload failed!" -ForegroundColor Red
}
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "     ✅ Upload Complete!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. SSH to server:" -ForegroundColor White
Write-Host "   ssh $server" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Run deployment:" -ForegroundColor White
Write-Host "   cd /opt/lte-pci-mapper/hss-module" -ForegroundColor Gray
Write-Host "   chmod +x deploy-hss-no-git.sh" -ForegroundColor Gray
Write-Host "   sudo ./deploy-hss-no-git.sh" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test in browser:" -ForegroundColor White
Write-Host "   - Clear cache (Ctrl+Shift+R)" -ForegroundColor Gray
Write-Host "   - Register EPC" -ForegroundColor Gray
Write-Host "   - Download script ✅" -ForegroundColor Gray
Write-Host ""


