# 🚀 Deploy to Firebase Web IDE - Step by Step

## Quick Reference for Your Workflow

This guide is specifically for deploying the **LTE WISP Management Platform** to Firebase for testing.

---

## 📋 Prerequisites

- [x] Module_Manager created ✅
- [x] Landing page complete ✅
- [x] Theme system ready ✅
- [ ] Git configured
- [ ] GitHub repository
- [ ] Firebase project

---

## 🎯 Method 1: Push Current Project (Recommended)

### Step 1: Commit Changes

```powershell
# You're currently in: C:\Users\david\Downloads\PCI_mapper

# Stage all changes
git add .

# Commit with message
git commit -m "Add Module Manager - LTE WISP Management Platform"
```

### Step 2: Push to GitHub

```powershell
# Push to your existing repository
git push origin main
```

**Your GitHub Repo** (from previous docs):
- URL: `https://github.com/theorem6/lte-pci-mapper`

### Step 3: Sync in Firebase

1. **Go to Firebase Console**
   - https://console.firebase.google.com/project/mapping-772cf/apphosting
   - OR: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

2. **Click Your Connected Backend**
   - Should show: `theorem6/lte-pci-mapper`

3. **Deploy Latest**
   - Click "Actions" → "Rollout" or "Deploy"
   - OR: Click "Redeploy" button
   - Firebase will pull latest code from GitHub

4. **Wait for Build**
   - Build time: ~2-5 minutes
   - Watch logs for any errors

5. **Access Your App**
   - URL will be provided after deployment
   - Example: `https://mapping-772cf.web.app`

---

## 🎯 Method 2: Use the PowerShell Script

I've created a script to automate this:

```powershell
# Run from PCI_mapper directory
.\push-to-github.ps1
```

This script will:
1. Show git status
2. Ask for confirmation
3. Request commit message
4. Add, commit, and push all changes
5. Show next steps

---

## 🎯 Method 3: Deploy Module_Manager Separately

If you want to deploy ONLY the Module_Manager as a standalone app:

### Step 1: Create New GitHub Repository

1. Go to: https://github.com/new
2. Repository name: `lte-wisp-platform`
3. Description: "LTE WISP Management Platform - Module Manager"
4. Public or Private: Your choice
5. Click "Create repository"

### Step 2: Push Module_Manager

```powershell
# Navigate to Module_Manager
cd c:\Users\david\Downloads\Module_Manager

# Initialize git
git init

# Add files
git add .

# Commit
git commit -m "Initial commit: Module Manager"

# Add remote (replace with YOUR username)
git remote add origin https://github.com/YOUR_USERNAME/lte-wisp-platform.git

# Push
git push -u origin main
```

### Step 3: Connect to Firebase

1. **Firebase Console** → **App Hosting**
2. Click "Add Backend" or "Get Started"
3. Connect to GitHub
4. Select repository: `YOUR_USERNAME/lte-wisp-platform`
5. Branch: `main`
6. Root directory: `/` (or leave empty)

### Step 4: Configure Build

**Build settings**:
```
Root directory: (empty or /)
Install command: npm install
Build command: npm run build
Output directory: build
```

### Step 5: Deploy

Click "Deploy" and wait for completion.

---

## 🔄 Update Workflow (After Initial Deploy)

### Every Time You Make Changes

```powershell
# 1. Test locally first
cd Module_Manager
npm run dev
# Verify everything works at http://localhost:5173

# 2. Commit changes
git add .
git commit -m "Describe your changes"

# 3. Push to GitHub
git push origin main

# 4. Firebase auto-deploys (if configured)
# OR manually: Firebase Console → Deploy Latest
```

---

## 🔧 Firebase Project Details

Based on your previous configuration:

### Option A: Existing Project 1
- **Project ID**: `mapping-772cf`
- **Console**: https://console.firebase.google.com/project/mapping-772cf
- **Hosting**: https://console.firebase.google.com/project/mapping-772cf/hosting
- **App Hosting**: https://console.firebase.google.com/project/mapping-772cf/apphosting

### Option B: Existing Project 2
- **Project ID**: `lte-pci-mapper-65450042-bbf71`
- **Console**: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71
- **App Hosting**: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

**Your GitHub Repo**:
- `theorem6/lte-pci-mapper`

---

## 🎯 Simplest Method RIGHT NOW

Since you already have GitHub connected to Firebase:

```powershell
# 1. From PCI_mapper directory (where you are now)
git add .
git commit -m "Add Module Manager and platform transformation"
git push origin main

# 2. Go to Firebase Console
# https://console.firebase.google.com/project/mapping-772cf/apphosting

# 3. Click "Deploy Latest" or "Redeploy"

# 4. Done! ✅
```

---

## 📱 What You'll See After Deploy

1. **Firebase Build Logs**
   - `npm install` running
   - `npm run build` executing
   - Build artifacts being created

2. **Deployment Complete**
   - URL provided (e.g., `https://mapping-772cf.web.app`)
   - Click URL to test

3. **Your Landing Page**
   - LTE WISP Management Platform header
   - Module cards (PCI Resolution active)
   - Dark mode toggle
   - Professional UI

---

## ❓ Troubleshooting

### "Cannot find package.json"

**Cause**: Firebase is looking in wrong directory

**Fix**: In Firebase App Hosting settings:
- Set "Root directory" to `Module_Manager`
- OR deploy Module_Manager as separate repo

### "Build failed"

**Check**:
1. `package.json` exists in root
2. `npm install` works locally
3. `npm run build` works locally

**Fix**:
```bash
cd Module_Manager
npm install
npm run build
# If this works locally, it should work on Firebase
```

### "Blank page after deploy"

**Check**:
1. Browser console for errors
2. Firebase hosting public directory = `build`
3. Rewrites configured for SPA

**Fix**:
- Update `firebase.json` (already created for you)
- Redeploy

---

## 🎯 Test Checklist

After deploying, test these:

- [ ] Landing page loads
- [ ] Header shows "LTE WISP Management Platform"
- [ ] 4 module cards visible
- [ ] PCI Resolution card shows "Active" badge
- [ ] Other cards show "Coming Soon"
- [ ] Dark mode toggle works
- [ ] Dark mode persists after refresh
- [ ] Clicking PCI Resolution opens module page
- [ ] Back button returns to landing page
- [ ] Mobile responsive (resize browser)
- [ ] No console errors

---

## 🚀 Do It Now!

**Fastest way to test in Firebase**:

```powershell
# 1. Push to GitHub
git add .
git commit -m "Add Module Manager platform"
git push origin main

# 2. Open Firebase
# https://console.firebase.google.com/project/mapping-772cf/apphosting

# 3. Click "Deploy Latest"

# 4. Wait 2-3 minutes

# 5. Test your live platform! 🎉
```

---

## 📚 Files Created for Firebase

I've already created these for you:

- ✅ `Module_Manager/firebase.json` - Firebase hosting config
- ✅ `Module_Manager/.gitignore` - Git ignore file
- ✅ `push-to-github.ps1` - Automated push script
- ✅ This deployment guide

**Everything is ready to deploy!** 🚀

---

## 🆘 Need Help?

If something doesn't work:

1. **Check Firebase Logs**: Console → App Hosting → Logs
2. **Check Build Output**: See what command failed
3. **Test Locally**: `cd Module_Manager && npm run dev`
4. **Verify Git**: `git remote -v` shows correct repo

---

**Ready to deploy your new platform!** 🎉

