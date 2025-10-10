#!/usr/bin/env pwsh
# Quick sync script to push changes to GitHub

Write-Host ""
Write-Host "🔄 Syncing Local Changes to GitHub" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path .git)) {
    Write-Host "❌ Error: Not in a git repository!" -ForegroundColor Red
    Write-Host "   Please run this from the PCI_mapper directory" -ForegroundColor Yellow
    exit 1
}

# Check for changes
Write-Host "📊 Checking for changes..." -ForegroundColor Cyan
$status = git status --short

if (-not $status) {
    Write-Host "✅ No changes to commit - repository is up to date!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your Cloud Shell should already have the latest code." -ForegroundColor White
    exit 0
}

# Show changes
Write-Host ""
Write-Host "📝 Changes to be committed:" -ForegroundColor Yellow
Write-Host ""
git status --short
Write-Host ""

# Confirm
$confirm = Read-Host "Commit and push these changes? (y/n)"
if ($confirm -ne "y") {
    Write-Host "❌ Sync cancelled" -ForegroundColor Red
    exit 0
}

# Get commit message
Write-Host ""
$message = Read-Host "Commit message (or press Enter for default)"
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = "Refactoring: GCE backend + comprehensive documentation ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
}

# Stage all changes
Write-Host ""
Write-Host "📦 Staging changes..." -ForegroundColor Cyan
git add .

# Commit
Write-Host "💾 Committing changes..." -ForegroundColor Cyan
git commit -m $message

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    exit 1
}

# Push
Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor Cyan
Write-Host ""
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "✅ Successfully synced to GitHub!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps in Cloud Shell:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Open Cloud Shell:" -ForegroundColor White
    Write-Host "     https://console.cloud.google.com/?cloudshell=true" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  2. Navigate to project:" -ForegroundColor White
    Write-Host "     cd ~/PCI_mapper" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  3. Pull latest changes:" -ForegroundColor White
    Write-Host "     git pull origin main" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  4. Make scripts executable:" -ForegroundColor White
    Write-Host "     chmod +x gce-backend/*.sh" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  5. Verify files:" -ForegroundColor White
    Write-Host "     ls -la *.md" -ForegroundColor Cyan
    Write-Host "     ls -la gce-backend/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  6. Start deployment:" -ForegroundColor White
    Write-Host "     ./gce-backend/create-gce-instance.sh" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  • Pull first: git pull origin main" -ForegroundColor White
    Write-Host "  • Check authentication: git config --list" -ForegroundColor White
    Write-Host "  • Try HTTPS: git remote set-url origin https://github.com/USER/REPO.git" -ForegroundColor White
    Write-Host ""
    exit 1
}

