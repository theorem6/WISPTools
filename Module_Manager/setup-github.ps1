# Complete GitHub Setup for Module_Manager
# This script will initialize git, commit, and help you push to GitHub

Write-Host ""
Write-Host "🚀 LTE WISP Management Platform - GitHub Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in Module_Manager
$currentDir = (Get-Location).Path
if ($currentDir -notlike "*Module_Manager*") {
    Write-Host "❌ Error: Not in Module_Manager directory" -ForegroundColor Red
    Write-Host "   Please run: cd c:\Users\david\Downloads\Module_Manager" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ In Module_Manager directory" -ForegroundColor Green
Write-Host ""

# Step 1: Initialize git
if (!(Test-Path .git)) {
    Write-Host "📦 Step 1: Initializing git..." -ForegroundColor Cyan
    git init
    git branch -M main
    Write-Host "   ✅ Git initialized with 'main' branch" -ForegroundColor Green
} else {
    Write-Host "✅ Step 1: Git already initialized" -ForegroundColor Green
}
Write-Host ""

# Step 2: Show files to be added
Write-Host "📋 Step 2: Files to commit:" -ForegroundColor Cyan
git status --short | Select-Object -First 20
$fileCount = (git status --short | Measure-Object).Count
Write-Host "   Total: $fileCount files" -ForegroundColor White
Write-Host ""

# Step 3: Commit
$continue = Read-Host "Continue with commit? (Y/N)"
if ($continue -ne "Y" -and $continue -ne "y") {
    Write-Host "❌ Setup cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "💾 Step 3: Committing files..." -ForegroundColor Cyan
git add .
git commit -m "Initial commit: LTE WISP Management Platform - Module Manager"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Files committed successfully" -ForegroundColor Green
} else {
    Write-Host "   ❌ Commit failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Add remote
Write-Host "🔗 Step 4: Connect to GitHub" -ForegroundColor Cyan
Write-Host ""

$hasRemote = git remote | Select-String "origin"
if ($hasRemote) {
    $existingRemote = git remote get-url origin
    Write-Host "   ℹ️  Remote already configured: $existingRemote" -ForegroundColor Yellow
    $change = Read-Host "   Change remote? (Y/N)"
    
    if ($change -eq "Y" -or $change -eq "y") {
        git remote remove origin
        $hasRemote = $false
    }
}

if (!$hasRemote) {
    Write-Host ""
    Write-Host "   🌐 Create GitHub repository first:" -ForegroundColor Yellow
    Write-Host "   1. Go to: https://github.com/new" -ForegroundColor White
    Write-Host "   2. Name: lte-wisp-platform" -ForegroundColor White
    Write-Host "   3. DO NOT initialize with README" -ForegroundColor White
    Write-Host "   4. Click 'Create repository'" -ForegroundColor White
    Write-Host "   5. Copy the repository URL" -ForegroundColor White
    Write-Host ""
    
    $repoUrl = Read-Host "   Enter GitHub repository URL"
    
    if ([string]::IsNullOrWhiteSpace($repoUrl)) {
        Write-Host "   ❌ No URL provided. Cannot continue." -ForegroundColor Red
        Write-Host ""
        Write-Host "   💡 You can add it later with:" -ForegroundColor Yellow
        Write-Host "      git remote add origin YOUR_REPO_URL" -ForegroundColor White
        Write-Host "      git push -u origin main" -ForegroundColor White
        exit 1
    }
    
    # Clean up URL if needed
    $repoUrl = $repoUrl.Trim()
    
    git remote add origin $repoUrl
    Write-Host "   ✅ Remote added: $repoUrl" -ForegroundColor Green
}
Write-Host ""

# Step 5: Push to GitHub
Write-Host "⬆️  Step 5: Push to GitHub" -ForegroundColor Cyan
Write-Host ""

$push = Read-Host "Ready to push to GitHub? (Y/N)"
if ($push -ne "Y" -and $push -ne "y") {
    Write-Host ""
    Write-Host "   ℹ️  Setup complete but not pushed yet" -ForegroundColor Yellow
    Write-Host "   💡 Run this when ready to push:" -ForegroundColor Yellow
    Write-Host "      git push -u origin main" -ForegroundColor White
    exit 0
}

Write-Host ""
Write-Host "   Pushing to GitHub..." -ForegroundColor White

try {
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "   ✅ Successfully pushed to GitHub!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 GitHub setup complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Next Steps:" -ForegroundColor Cyan
        Write-Host "   1. Verify on GitHub: Check your repository online" -ForegroundColor White
        Write-Host "   2. Go to Firebase Console: https://console.firebase.google.com/" -ForegroundColor White
        Write-Host "   3. Navigate to: App Hosting" -ForegroundColor White
        Write-Host "   4. Click: 'Add Backend' or 'Connect Repository'" -ForegroundColor White
        Write-Host "   5. Select: Your lte-wisp-platform repository" -ForegroundColor White
        Write-Host "   6. Configure build:" -ForegroundColor White
        Write-Host "      - Build command: npm run build" -ForegroundColor Gray
        Write-Host "      - Output directory: build" -ForegroundColor Gray
        Write-Host "   7. Click: Deploy" -ForegroundColor White
        Write-Host "   8. Wait 2-3 minutes" -ForegroundColor White
        Write-Host "   9. Test your live platform! 🚀" -ForegroundColor White
        Write-Host ""
        Write-Host "📚 Documentation:" -ForegroundColor Cyan
        Write-Host "   - README.md (in this directory)" -ForegroundColor White
        Write-Host "   - QUICK_START.md (in this directory)" -ForegroundColor White
        Write-Host ""
    } else {
        throw "Push failed"
    }
} catch {
    Write-Host ""
    Write-Host "   ❌ Push failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Common issues:" -ForegroundColor Yellow
    Write-Host "   1. Authentication required" -ForegroundColor White
    Write-Host "      - GitHub may prompt you to login" -ForegroundColor Gray
    Write-Host "      - Or use: gh auth login" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Permission denied" -ForegroundColor White
    Write-Host "      - Check repository access" -ForegroundColor Gray
    Write-Host "      - Verify repository URL" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   3. Repository doesn't exist" -ForegroundColor White
    Write-Host "      - Create it first at: https://github.com/new" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   💡 Try again with:" -ForegroundColor Yellow
    Write-Host "      git push -u origin main" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

