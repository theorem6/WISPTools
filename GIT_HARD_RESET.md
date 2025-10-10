# 🔄 Git Hard Reset & Clean - Force Pull Commands

## ⚠️ WARNING

These commands will **PERMANENTLY DELETE** any local changes!

Use these when you want to make your local code **exactly match** what's on GitHub.

---

## 🎯 Quick Answer

### **On Windows (or anywhere):**

```bash
# Fetch latest from GitHub
git fetch origin

# Reset to match GitHub exactly (DELETES local changes!)
git reset --hard origin/main

# Remove untracked files and directories
git clean -fd

# Remove ignored files too (optional)
git clean -fdx
```

### **One-Liner:**

```bash
git fetch origin && git reset --hard origin/main && git clean -fd
```

---

## 📋 Step-by-Step Explanation

### **Step 1: Fetch Latest from Remote**

```bash
git fetch origin
```

**What it does:**
- Downloads latest changes from GitHub
- Doesn't modify your local files yet
- Safe to run anytime

### **Step 2: Hard Reset to Remote**

```bash
git reset --hard origin/main
```

**What it does:**
- ⚠️ **DELETES all uncommitted changes**
- Makes your local files match GitHub exactly
- Can't be undone!

### **Step 3: Clean Untracked Files**

```bash
git clean -fd
```

**What it does:**
- Removes untracked files (`-f` = force)
- Removes untracked directories (`-d`)
- Doesn't remove ignored files (.gitignore)

### **Step 4: Clean Everything (Optional)**

```bash
git clean -fdx
```

**What it does:**
- Removes **everything** not in Git
- Including ignored files like node_modules
- Use for a completely fresh start

---

## 🎨 Different Scenarios

### **Scenario 1: Just Want Fresh Code from GitHub**

```bash
# Fetch and reset
git fetch origin
git reset --hard origin/main

# Clean untracked files
git clean -fd
```

### **Scenario 2: Complete Fresh Start (Cleanest)**

```bash
# Fetch latest
git fetch origin

# Reset to match remote exactly
git reset --hard origin/main

# Remove ALL untracked and ignored files
git clean -fdx

# Verify
git status
```

### **Scenario 3: Keep Some Local Files**

```bash
# Stash changes you want to keep
git stash save "backup-before-reset"

# Hard reset
git fetch origin
git reset --hard origin/main

# Apply stashed changes back (if needed)
git stash pop
```

---

## 💡 Command Flags Explained

### **git clean flags:**

| Flag | What It Does |
|------|--------------|
| `-f` | Force (required for safety) |
| `-d` | Remove untracked directories |
| `-x` | Remove ignored files too (.gitignore) |
| `-n` | Dry run (shows what would be deleted) |
| `-i` | Interactive mode |

### **Examples:**

```bash
# Dry run - see what would be deleted
git clean -fdn

# Interactive - choose what to delete
git clean -fdi

# Nuclear option - delete everything
git clean -fdx
```

---

## 🔍 Before You Reset - Check What Will Change

### **See what will be deleted:**

```bash
# Dry run for clean
git clean -fdn

# See uncommitted changes
git status

# See difference from remote
git diff origin/main
```

### **List untracked files:**

```bash
git ls-files --others --exclude-standard
```

---

## 🚨 Safety Checks

### **Check 1: Are you on the right branch?**

```bash
git branch
```

Should show `* main`

### **Check 2: What's the remote URL?**

```bash
git remote -v
```

Should show your GitHub repository

### **Check 3: Preview what will be deleted**

```bash
# Dry run
git clean -fdn
```

---

## 📝 Complete PowerShell Script

Save as `hard-reset.ps1`:

```powershell
#!/usr/bin/env pwsh

Write-Host ""
Write-Host "⚠️  GIT HARD RESET - WARNING!" -ForegroundColor Red
Write-Host "================================" -ForegroundColor Red
Write-Host ""
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  • DELETE all local changes" -ForegroundColor White
Write-Host "  • DELETE all untracked files" -ForegroundColor White
Write-Host "  • Reset to match GitHub exactly" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Are you SURE? Type 'YES' to continue"

if ($confirm -ne "YES") {
    Write-Host "❌ Cancelled" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "📋 Current status:" -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "🗑️  Files that will be deleted:" -ForegroundColor Yellow
git clean -fdn

Write-Host ""
$finalConfirm = Read-Host "Continue? (y/n)"

if ($finalConfirm -ne "y") {
    Write-Host "❌ Cancelled" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "⬇️  Fetching from GitHub..." -ForegroundColor Cyan
git fetch origin

Write-Host "🔄 Hard resetting to origin/main..." -ForegroundColor Cyan
git reset --hard origin/main

Write-Host "🧹 Cleaning untracked files..." -ForegroundColor Cyan
git clean -fd

Write-Host ""
Write-Host "✅ Done! Your code now matches GitHub exactly." -ForegroundColor Green
Write-Host ""
Write-Host "📊 Final status:" -ForegroundColor Cyan
git status
```

Run it:
```powershell
.\hard-reset.ps1
```

---

## 🎯 Common Use Cases

### **Use Case 1: Cloud Shell Has Old Code**

**In Cloud Shell:**

```bash
cd ~/PCI_mapper

# Hard pull to get latest
git fetch origin
git reset --hard origin/main
git clean -fd

# Verify
git status
ls -la *.md
```

### **Use Case 2: Messed Up Local Changes**

**On Windows:**

```powershell
cd C:\Users\david\Downloads\PCI_mapper

# Reset everything
git fetch origin
git reset --hard origin/main
git clean -fd

# Verify
git status
```

### **Use Case 3: Want Absolutely Fresh Clone**

```bash
# Delete and re-clone (ultimate reset!)
cd ..
rm -rf PCI_mapper
git clone https://github.com/YOUR_USERNAME/PCI_mapper.git
cd PCI_mapper
```

---

## 🔧 Alternative: Stash Instead of Delete

If you might want your changes later:

```bash
# Save changes
git stash save "backup-$(date +%Y%m%d-%H%M%S)"

# Pull latest
git fetch origin
git reset --hard origin/main

# List stashes
git stash list

# Restore if needed
git stash pop
```

---

## 📊 Verify After Reset

```bash
# Should show "nothing to commit, working tree clean"
git status

# Should show you're up to date with origin/main
git log --oneline -5

# Should show no differences
git diff origin/main

# Check files exist
ls -la *.md
ls -la gce-backend/
```

---

## ⚡ Quick Commands Summary

### **Safe Hard Pull (Recommended):**

```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

### **Nuclear Option (Everything):**

```bash
git fetch origin
git reset --hard origin/main
git clean -fdx  # Removes node_modules, etc.
```

### **One-Line Version:**

```bash
git fetch origin && git reset --hard origin/main && git clean -fd
```

---

## 🆘 If Something Goes Wrong

### **Undo Last Reset (if just did it):**

```bash
# Git keeps a reflog
git reflog

# Find the commit before reset (something like HEAD@{1})
git reset --hard HEAD@{1}
```

### **Recover Deleted Files:**

Unfortunately, if you didn't commit or stash:
- ❌ Uncommitted changes are **GONE**
- ❌ Untracked files are **GONE**
- ✅ Committed changes can be recovered from reflog

**This is why it warns you!**

---

## 💡 Pro Tips

### **Tip 1: Always Check First**

```bash
# Dry run before clean
git clean -fdn
```

### **Tip 2: Stash Important Work**

```bash
git stash save "important-changes"
```

### **Tip 3: Use Branches**

```bash
# Create backup branch
git branch backup-$(date +%Y%m%d)

# Then reset main
git reset --hard origin/main
```

### **Tip 4: Check Remote**

```bash
git remote -v
git log origin/main --oneline -5
```

---

## 🎯 For Your Situation

**To sync Cloud Shell with your latest GitHub code:**

### **In Cloud Shell:**

```bash
# Navigate to project
cd ~/PCI_mapper

# Check current state
git status

# Hard pull from GitHub
git fetch origin
git reset --hard origin/main
git clean -fd

# Verify new files
ls -la *.md
ls -la gce-backend/

# Make scripts executable
chmod +x gce-backend/*.sh

# Ready to deploy!
./gce-backend/create-gce-instance.sh
```

---

## ✅ Summary

| What You Want | Command |
|---------------|---------|
| **Match GitHub exactly** | `git fetch origin && git reset --hard origin/main` |
| **Clean untracked files** | `git clean -fd` |
| **Clean everything** | `git clean -fdx` |
| **See what will change** | `git clean -fdn` (dry run) |
| **One command to do it all** | `git fetch origin && git reset --hard origin/main && git clean -fd` |

---

**⚠️ Remember:** These commands DELETE local changes permanently!

**🎯 For Cloud Shell:** Use the commands above to get fresh code from GitHub!

