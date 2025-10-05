# 🔧 Setup Git and Deploy - Complete Guide

## ❌ Problem Identified

**None of your folders are git repositories yet!**

That's why Firebase can't pull changes - there's nothing to pull from GitHub.

---

## ✅ Solution: Complete Setup from Scratch

Follow these steps to get your Module_Manager on GitHub and deployed to Firebase.

---

## 📋 Step 1: Initialize Git in Module_Manager

```powershell
# Navigate to Module_Manager
cd c:\Users\david\Downloads\Module_Manager

# Initialize git
git init

# Check status
git status
```

**Expected output**: Should show all your files as "untracked"

---

## 📋 Step 2: Create GitHub Repository

### Option A: Via GitHub Website (Easier)

1. **Go to**: https://github.com/new
2. **Repository name**: `lte-wisp-platform`
3. **Description**: "LTE WISP Management Platform - Module Manager"
4. **Public/Private**: Your choice
5. **DO NOT** initialize with README, .gitignore, or license
6. **Click**: "Create repository"
7. **Copy** the repository URL (e.g., `https://github.com/YOUR_USERNAME/lte-wisp-platform.git`)

### Option B: Via GitHub CLI (if installed)

```powershell
gh repo create lte-wisp-platform --public --source=. --remote=origin
```

---

## 📋 Step 3: Add Files and Commit

```powershell
# Still in Module_Manager directory

# Add all files
git add .

# Commit
git commit -m "Initial commit: LTE WISP Management Platform"

# Verify commit
git log --oneline
```

---

## 📋 Step 4: Connect to GitHub

```powershell
# Add your GitHub repository as remote
# Replace YOUR_USERNAME with your actual GitHub username
git remote add origin https://github.com/YOUR_USERNAME/lte-wisp-platform.git

# Verify remote
git remote -v
```

---

## 📋 Step 5: Push to GitHub

```powershell
# Push to GitHub
git push -u origin main

# If you get an error about branch name, try:
git branch -M main
git push -u origin main
```

**If this is your first time pushing**:
- You may be prompted to login to GitHub
- Follow the authentication prompts

---

## 📋 Step 6: Verify on GitHub

1. Go to: `https://github.com/YOUR_USERNAME/lte-wisp-platform`
2. You should see all your Module_Manager files
3. Verify these files are visible:
   - `package.json`
   - `src/routes/+page.svelte`
   - `src/styles/theme.css`
   - `README.md`

---

## 📋 Step 7: Connect to Firebase

### Method A: Firebase App Hosting (Recommended)

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com/
   - Select your project (e.g., `mapping-772cf`)

2. **Navigate to App Hosting**
   - Click "App Hosting" in the left sidebar
   - OR go directly: https://console.firebase.google.com/project/mapping-772cf/apphosting

3. **Add Backend** (if first time)
   - Click "Get Started" or "Add Backend"
   - Give it a name: `module-manager` or `lte-wisp-platform`

4. **Connect Repository**
   - Click "Connect to GitHub"
   - Authorize Firebase to access GitHub (if needed)
   - Select repository: `YOUR_USERNAME/lte-wisp-platform`
   - Select branch: `main`
   - Root directory: Leave empty (or `/`)

5. **Configure Build**
   ```
   Install command: npm install
   Build command: npm run build
   Output directory: build
   ```

6. **Set Environment Variables** (if needed for Firebase features)
   ```
   PUBLIC_FIREBASE_API_KEY=your_key
   PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
   PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   ```

7. **Deploy**
   - Click "Deploy" or "Rollout"
   - Wait for build (2-5 minutes)
   - Get your live URL!

### Method B: Firebase Hosting (Traditional)

```powershell
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login
firebase login

# Navigate to Module_Manager
cd c:\Users\david\Downloads\Module_Manager

# Initialize Firebase
firebase init hosting

# Select:
# - Use existing project: mapping-772cf (or your project)
# - Public directory: build
# - Single-page app: Yes
# - Set up automatic builds: No (we'll do manual for now)

# Build the project
npm run build

# Deploy
firebase deploy --only hosting
```

---

## 📋 Step 8: Test Your Deployment

After deployment completes:

1. **Get your URL**: 
   - From Firebase Console
   - Or shown in terminal after deploy
   - Usually: `https://YOUR_PROJECT_ID.web.app`

2. **Open in browser**

3. **Test features**:
   - [ ] Landing page loads
   - [ ] "LTE WISP Management Platform" header visible
   - [ ] 4 module cards display
   - [ ] Dark mode toggle works
   - [ ] Can click PCI Resolution card
   - [ ] Back button works
   - [ ] Mobile responsive

---

## 🔄 Future Updates Workflow

After initial setup, whenever you make changes:

```powershell
# 1. Navigate to Module_Manager
cd c:\Users\david\Downloads\Module_Manager

# 2. Make your changes, then:
git add .
git commit -m "Describe your changes"
git push origin main

# 3. Firebase (if auto-deploy enabled):
# Automatically deploys!

# 3. Firebase (if manual):
# Go to Firebase Console → App Hosting → Deploy Latest
# OR run: firebase deploy --only hosting
```

---

## 🛠️ Automated PowerShell Script

Save this as `setup-and-deploy.ps1` in Module_Manager:

```powershell
# Complete setup and deploy script
Write-Host "🚀 LTE WISP Management Platform - Setup & Deploy" -ForegroundColor Cyan

# Check if git initialized
if (!(Test-Path .git)) {
    Write-Host "Initializing git..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git initialized" -ForegroundColor Green
}

# Add files
Write-Host "Adding files..." -ForegroundColor Cyan
git add .

# Get commit message
$message = Read-Host "Enter commit message (or press Enter for default)"
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = "Update: LTE WISP Management Platform"
}

# Commit
Write-Host "Committing..." -ForegroundColor Cyan
git commit -m "$message"

# Check for remote
$hasRemote = git remote | Select-String "origin"
if (!$hasRemote) {
    Write-Host ""
    Write-Host "⚠️  No remote configured" -ForegroundColor Yellow
    $repoUrl = Read-Host "Enter GitHub repository URL (e.g., https://github.com/user/repo.git)"
    
    if (![string]::IsNullOrWhiteSpace($repoUrl)) {
        git remote add origin $repoUrl
        Write-Host "✅ Remote added" -ForegroundColor Green
    }
}

# Push
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "✅ Pushed to GitHub!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Go to Firebase Console" -ForegroundColor White
Write-Host "2. Connect your GitHub repository" -ForegroundColor White
Write-Host "3. Deploy!" -ForegroundColor White
```

---

## ❓ Troubleshooting

### "fatal: not a git repository"
**Fix**: Run `git init` in the Module_Manager directory

### "Permission denied (publickey)"
**Fix**: Set up GitHub authentication
```powershell
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub: https://github.com/settings/keys
```

Or use HTTPS with personal access token:
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate token
3. Use token as password when pushing

### "Branch main does not exist"
**Fix**:
```powershell
git branch -M main
git push -u origin main
```

### "Firebase: Cannot find module"
**Fix**: Ensure you're in Module_Manager directory
```powershell
cd c:\Users\david\Downloads\Module_Manager
npm install
npm run build
```

---

## 📊 Current Status

Based on our investigation:

- ❌ Module_Manager is NOT a git repository yet
- ❌ Nothing pushed to GitHub yet
- ❌ Firebase has nothing to pull from

**Need to do**:
1. Initialize git ✋
2. Create GitHub repo ✋
3. Push code to GitHub ✋
4. Connect Firebase to GitHub ✋
5. Deploy ✋

---

## 🚀 Quick Start Commands (Copy-Paste)

```powershell
# 1. Setup git
cd c:\Users\david\Downloads\Module_Manager
git init
git add .
git commit -m "Initial commit: LTE WISP Management Platform"

# 2. Create GitHub repo (do this on github.com/new first!)
# Then run (replace YOUR_USERNAME):
git remote add origin https://github.com/YOUR_USERNAME/lte-wisp-platform.git
git branch -M main
git push -u origin main

# 3. Go to Firebase Console and connect the repo
# https://console.firebase.google.com/project/mapping-772cf/apphosting

# 4. Click "Deploy" and wait!
```

---

## 📧 Summary

**Why no changes were pulled**: There's no git repository yet, so nothing to pull!

**What you need to do**:
1. ✅ Initialize git in Module_Manager
2. ✅ Create GitHub repository
3. ✅ Push code to GitHub
4. ✅ Connect Firebase to GitHub
5. ✅ Deploy and test

**After that**: Every `git push` → Firebase can pull changes!

---

Ready to set this up? Start with Step 1! 🚀

