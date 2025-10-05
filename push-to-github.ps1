# Push LTE WISP Management Platform to GitHub

Write-Host "🚀 Push to GitHub - LTE WISP Management Platform" -ForegroundColor Cyan
Write-Host ""

# Check if git is initialized
if (!(Test-Path .git)) {
    Write-Host "⚠️  Git not initialized. Initializing..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git initialized" -ForegroundColor Green
}

# Show status
Write-Host ""
Write-Host "📊 Current Git Status:" -ForegroundColor Cyan
git status --short

# Ask user to confirm
Write-Host ""
$confirm = Read-Host "Do you want to commit and push all changes? (Y/N)"

if ($confirm -eq "Y" -or $confirm -eq "y") {
    # Get commit message
    Write-Host ""
    $commitMessage = Read-Host "Enter commit message (or press Enter for default)"
    
    if ([string]::IsNullOrWhiteSpace($commitMessage)) {
        $commitMessage = "Update: LTE WISP Management Platform with Module Manager"
    }
    
    # Add all files
    Write-Host ""
    Write-Host "📦 Adding files..." -ForegroundColor Cyan
    git add .
    
    # Commit
    Write-Host "💾 Committing..." -ForegroundColor Cyan
    git commit -m "$commitMessage"
    
    # Check if remote exists
    $remotes = git remote
    if ($remotes -notcontains "origin") {
        Write-Host ""
        Write-Host "⚠️  No remote 'origin' configured" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please add your GitHub repository URL:" -ForegroundColor Cyan
        Write-Host "Example: https://github.com/yourusername/lte-wisp-platform.git"
        Write-Host ""
        $repoUrl = Read-Host "Enter GitHub repository URL"
        
        if (![string]::IsNullOrWhiteSpace($repoUrl)) {
            git remote add origin $repoUrl
            Write-Host "✅ Remote added" -ForegroundColor Green
        } else {
            Write-Host "❌ No URL provided. Exiting." -ForegroundColor Red
            exit 1
        }
    }
    
    # Get current branch
    $currentBranch = git rev-parse --abbrev-ref HEAD
    
    # Push
    Write-Host ""
    Write-Host "⬆️  Pushing to GitHub (branch: $currentBranch)..." -ForegroundColor Cyan
    
    try {
        git push -u origin $currentBranch
        Write-Host ""
        Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 Next Steps:" -ForegroundColor Cyan
        Write-Host "1. Go to Firebase Console: https://console.firebase.google.com/" -ForegroundColor White
        Write-Host "2. Navigate to App Hosting" -ForegroundColor White
        Write-Host "3. Click 'Deploy Latest' or configure auto-deploy" -ForegroundColor White
        Write-Host "4. Your platform will be live! 🚀" -ForegroundColor White
    } catch {
        Write-Host ""
        Write-Host "❌ Push failed. You may need to:" -ForegroundColor Red
        Write-Host "1. Check if the remote URL is correct: git remote -v" -ForegroundColor Yellow
        Write-Host "2. Ensure you have push access to the repository" -ForegroundColor Yellow
        Write-Host "3. Try: git push -u origin main --force (if you're sure)" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "❌ Push cancelled" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

