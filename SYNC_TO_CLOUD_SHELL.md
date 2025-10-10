# 🔄 Sync Code to Web IDE (Cloud Shell)

## Quick Answer

You need to **commit and push** your local changes to Git, then **pull** in Cloud Shell.

---

## 📋 Step-by-Step Guide

### **Step 1: Commit Changes Locally** (On Your Windows Machine)

Open PowerShell in your project directory:

```powershell
# Navigate to your project
cd C:\Users\david\Downloads\PCI_mapper

# Check what files changed
git status

# Add all new files
git add .

# Commit with a message
git commit -m "Complete refactoring: GCE backend + comprehensive documentation"
```

### **Step 2: Push to GitHub**

```powershell
# Push to main branch
git push origin main

# If you get an error about upstream, use:
git push -u origin main
```

### **Step 3: Pull in Cloud Shell**

1. **Open Cloud Shell**: https://console.cloud.google.com/?cloudshell=true

2. **Navigate to your project** (or clone if needed):
   ```bash
   # If already cloned, navigate and pull
   cd PCI_mapper
   git pull origin main
   
   # OR if not cloned yet
   git clone https://github.com/YOUR_USERNAME/PCI_mapper.git
   cd PCI_mapper
   ```

3. **Verify files are updated**:
   ```bash
   # List new documentation files
   ls -la *.md
   
   # Check gce-backend scripts
   ls -la gce-backend/
   
   # Verify they're executable
   chmod +x gce-backend/*.sh
   ```

---

## 🚀 Alternative: Direct Script (Windows)

I can create a script that does all this for you!

### **Option A: PowerShell Script**

```powershell
# Save as: sync-to-cloud.ps1

# Commit and push
git add .
git commit -m "Complete refactoring: GCE backend + comprehensive documentation"
git push origin main

Write-Host "✅ Changes pushed to GitHub!" -ForegroundColor Green
Write-Host ""
Write-Host "Now in Cloud Shell, run:" -ForegroundColor Cyan
Write-Host "  cd PCI_mapper" -ForegroundColor White
Write-Host "  git pull origin main" -ForegroundColor White
Write-Host "  chmod +x gce-backend/*.sh" -ForegroundColor White
```

Run it:
```powershell
.\sync-to-cloud.ps1
```

---

## 📝 Detailed Steps with Verification

### **On Windows (Local Machine):**

```powershell
# 1. Check current status
git status

# 2. See what files are new
git status --short

# 3. Add all files
git add .

# 4. Verify what will be committed
git status

# 5. Commit with descriptive message
git commit -m "Refactoring complete: 
- Added GCE backend deployment scripts
- Created 10+ comprehensive documentation guides
- Refactored frontend API clients
- Added cost analysis and monitoring guides"

# 6. Push to GitHub
git push origin main

# 7. Verify push succeeded
git log --oneline -5
```

### **In Cloud Shell (Web IDE):**

```bash
# 1. Navigate to project
cd ~/PCI_mapper

# 2. Check current branch
git branch

# 3. Pull latest changes
git pull origin main

# 4. Verify new files
ls -la *.md | head -20

# 5. Check scripts
ls -la gce-backend/

# 6. Make scripts executable
chmod +x gce-backend/*.sh

# 7. Verify everything
ls -lh gce-backend/*.sh
cat START_HERE.md | head -50
```

---

## ⚠️ Common Issues & Solutions

### **Issue 1: "Nothing to commit"**

**Cause:** Git doesn't see any changes.

**Solution:**
```powershell
# Check if files were actually created
Get-ChildItem *.md | Select-Object Name, Length

# Force add specific files
git add -f START_HERE.md
git add -f COST_BREAKDOWN.md
git add -f gce-backend/*.sh
```

### **Issue 2: "Failed to push"**

**Cause:** You might not have push permissions or remote is ahead.

**Solution:**
```powershell
# Pull first, then push
git pull origin main --rebase
git push origin main

# If that fails, check remote
git remote -v
```

### **Issue 3: "Permission denied (publickey)"**

**Cause:** GitHub authentication issue.

**Solution:**
```powershell
# Re-authenticate with GitHub
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# Use HTTPS instead of SSH
git remote set-url origin https://github.com/YOUR_USERNAME/PCI_mapper.git
```

### **Issue 4: "Merge conflict"**

**Cause:** Cloud Shell has changes that conflict with local.

**Solution:**
```bash
# In Cloud Shell
git stash  # Save Cloud Shell changes
git pull origin main  # Get latest
git stash pop  # Reapply if needed
```

---

## 🎯 Quick Commands Summary

### **Windows (Local):**
```powershell
cd C:\Users\david\Downloads\PCI_mapper
git add .
git commit -m "Complete refactoring with GCE backend"
git push origin main
```

### **Cloud Shell (Web IDE):**
```bash
cd ~/PCI_mapper
git pull origin main
chmod +x gce-backend/*.sh
ls -la *.md
```

---

## 📦 What Files Will Be Synced

All the new files we created:

### **Documentation (10+ files):**
```
✅ START_HERE.md
✅ PROJECT_COMPLETE.md
✅ README_REFACTORING.md
✅ DEPLOYMENT_SUMMARY.md
✅ CLOUD_SHELL_DEPLOYMENT.md
✅ DEPLOYMENT_GUIDE_GCE_BACKEND.md
✅ QUICK_DEPLOY_CHECKLIST.md
✅ COMMAND_REFERENCE.md
✅ ARCHITECTURE_REFACTOR_PLAN.md
✅ REFACTOR_SUMMARY.md
✅ COST_BREAKDOWN.md
✅ FINAL_SUMMARY.md
```

### **Backend Scripts:**
```
✅ gce-backend/create-gce-instance.sh
✅ gce-backend/setup-gce-instance.sh
✅ gce-backend/README.md
```

### **Frontend Code:**
```
✅ Module_Manager/src/lib/config/backendConfig.ts
✅ Module_Manager/src/lib/api/backendClient.ts
✅ Module_Manager/src/lib/api/genieacsClient.ts
✅ Module_Manager/apphosting.yaml.gce-backend
```

### **Deleted Files:**
```
❌ Module_Manager/src/routes/cwmp/[...path]/+server.ts
❌ Module_Manager/src/routes/fs/[...path]/+server.ts
❌ Module_Manager/src/routes/nbi/[...path]/+server.ts
```

---

## 🔍 Verification Checklist

After pulling in Cloud Shell, verify:

- [ ] Documentation files exist: `ls *.md`
- [ ] Scripts are there: `ls gce-backend/*.sh`
- [ ] Scripts are executable: `ls -la gce-backend/*.sh`
- [ ] Frontend code updated: `ls Module_Manager/src/lib/api/`
- [ ] Proxy routes deleted: `! test -d Module_Manager/src/routes/cwmp`

---

## 🚀 Ready to Deploy After Sync

Once synced to Cloud Shell, you can immediately deploy:

```bash
# Verify everything is there
cd ~/PCI_mapper
ls -la *.md
ls -la gce-backend/

# Make scripts executable
chmod +x gce-backend/*.sh

# Start deployment!
./gce-backend/create-gce-instance.sh
```

---

## 💡 Pro Tips

### **Tip 1: Create .gitignore**

Make sure you're not committing sensitive data:

```bash
# Check if .gitignore exists
cat .gitignore

# Add if needed
echo "node_modules/" >> .gitignore
echo ".env" >> .gitignore
echo "*.log" >> .gitignore
echo "deployment-info.txt" >> .gitignore
```

### **Tip 2: Use Git Tags**

Tag this major version:

```bash
git tag -a v2.0-refactored -m "Complete GCE backend refactoring"
git push origin v2.0-refactored
```

### **Tip 3: Check File Sizes**

Make sure nothing too large is being committed:

```bash
# Find large files
git ls-files | xargs ls -lh | sort -k5 -hr | head -20
```

### **Tip 4: View Commit History**

```bash
# See what was committed
git log --oneline --graph --all --decorate
```

---

## 📱 Mobile/Web Git Clients

If you prefer a GUI:

- **GitHub Desktop**: https://desktop.github.com/
- **GitKraken**: https://www.gitkraken.com/
- **VS Code**: Built-in Git support
- **GitHub Web Interface**: Can commit directly on github.com

---

## ⚡ Quick Sync Script

Create this file: `sync-to-github.ps1`

```powershell
#!/usr/bin/env pwsh

Write-Host "🔄 Syncing to GitHub..." -ForegroundColor Cyan
Write-Host ""

# Check for changes
$status = git status --short
if (-not $status) {
    Write-Host "✅ No changes to commit" -ForegroundColor Green
    exit 0
}

Write-Host "📝 Changes to commit:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Commit
Write-Host "💾 Committing changes..." -ForegroundColor Cyan
git add .
git commit -m "Refactoring: GCE backend + documentation ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"

# Push
Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully synced to GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps in Cloud Shell:" -ForegroundColor Yellow
    Write-Host "  1. Open: https://console.cloud.google.com/?cloudshell=true" -ForegroundColor White
    Write-Host "  2. Run: cd ~/PCI_mapper && git pull origin main" -ForegroundColor White
    Write-Host "  3. Run: chmod +x gce-backend/*.sh" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Push failed! Check the error above." -ForegroundColor Red
    Write-Host ""
}
```

Run it:
```powershell
.\sync-to-github.ps1
```

---

## 🎯 Summary

**To sync your new code to Cloud Shell:**

1. **Local (Windows):**
   ```powershell
   git add .
   git commit -m "Complete refactoring"
   git push origin main
   ```

2. **Cloud Shell (Web IDE):**
   ```bash
   cd ~/PCI_mapper
   git pull origin main
   chmod +x gce-backend/*.sh
   ```

3. **Verify:**
   ```bash
   ls *.md
   ls gce-backend/
   ```

4. **Deploy!**
   ```bash
   ./gce-backend/create-gce-instance.sh
   ```

---

**That's it!** Your Cloud Shell will now have all the latest code and documentation.

