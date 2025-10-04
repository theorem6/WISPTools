# Firebase Deployment Guide - How to See Your Changes

## Problem

You're making changes to the code, but they're not appearing in your Firebase Web IDE test environment because the changes need to be **deployed** to Firebase App Hosting.

## Solution

Deploy your changes to Firebase App Hosting so they're visible in the web IDE.

## Quick Deploy (PowerShell)

```powershell
# Run the deployment script
.\deploy-to-firebase.ps1
```

## Manual Deployment Steps

### 1. Install Firebase CLI (One-time)

If you don't have Firebase CLI installed:

```powershell
npm install -g firebase-tools
```

Then login:

```powershell
firebase login
```

### 2. Build Your Application

```powershell
npm run build
```

This compiles your Svelte app into static files.

### 3. Deploy to Firebase App Hosting

```powershell
firebase apphosting:backends:deploy pci-mapper
```

Wait for deployment to complete (usually 2-5 minutes).

### 4. View Changes

Your changes are now live at your Firebase App Hosting URL!

## Why Changes Aren't Showing

### The Issue

Firebase App Hosting serves a **built version** of your app, not the source code. When you edit files:

1. ✅ Files are changed in Git
2. ✅ Files are pushed to GitHub
3. ❌ **But Firebase still serves the OLD version**
4. ✅ You must **deploy** to update Firebase

### The Fix

**Every time you want to see changes**, you must:
1. Build: `npm run build`
2. Deploy: `firebase apphosting:backends:deploy pci-mapper`

## Automatic Deployment (Recommended)

### Option 1: GitHub Actions (CI/CD)

Set up automatic deployment when you push to GitHub:

1. Create `.github/workflows/firebase-deploy.yml`
2. Every push to `main` automatically deploys
3. No manual deployment needed

### Option 2: Firebase GitHub Integration

Connect your GitHub repo to Firebase:
1. Firebase Console → App Hosting
2. Connect to GitHub repository
3. Auto-deploys on push to main

## Current vs Development Server

| Server Type | Command | URL | Updates |
|-------------|---------|-----|---------|
| **Development** | `npm run dev` | localhost:5173 | Instant (hot reload) |
| **Firebase Hosting** | Deploy script | Firebase URL | After deployment |

## Why Your Changes Aren't Visible

You're likely viewing the **Firebase-hosted version** which requires deployment:

❌ **Not enough**:
- Editing files ✓
- Pushing to Git ✓

✅ **Required**:
- Editing files ✓
- Pushing to Git ✓  
- **Building** ✓
- **Deploying to Firebase** ✓

## Quick Checklist

Before viewing changes in Firebase Web IDE:

- [ ] Changes made to files
- [ ] Changes committed to Git
- [ ] Changes pushed to GitHub
- [ ] **Build completed** (`npm run build`)
- [ ] **Deployed to Firebase** (`firebase deploy`)
- [ ] Browser cache cleared (Ctrl+Shift+R)

## Viewing Changes Locally (Instant Updates)

If you want to see changes **immediately** without deployment:

### Install Node.js (if not installed)

1. Download: https://nodejs.org/
2. Install LTS version
3. Restart terminal

### Run Development Server

```powershell
# Install dependencies (one-time)
npm install

# Start dev server
npm run dev
```

Then open: `http://localhost:5173`

**Changes appear instantly** with hot reload!

## Firebase App Hosting Status

Check your current deployment:

```powershell
# List backends
firebase apphosting:backends:list

# Get deployment status
firebase apphosting:backends:describe pci-mapper
```

## Deploy Script Features

The `deploy-to-firebase.ps1` script:
- ✓ Checks Firebase CLI is installed
- ✓ Shows current project
- ✓ Builds the application
- ✓ Deploys to App Hosting
- ✓ Reports success/failure
- ✓ Shows app URL

## Common Issues

### Issue: "npm is not recognized"

**Solution**: Install Node.js from https://nodejs.org/

### Issue: "firebase is not recognized"

**Solution**: Install Firebase CLI:
```powershell
npm install -g firebase-tools
firebase login
```

### Issue: "Build failed"

**Solution**: Install dependencies first:
```powershell
npm install
```

### Issue: "Changes still not showing"

**Solutions**:
1. Hard refresh browser: `Ctrl + Shift + R`
2. Clear browser cache
3. Check deployment completed successfully
4. Verify correct Firebase project: `firebase use`

## Environment URLs

Your app is hosted at different locations:

- **Firebase App Hosting**: Production URL (requires deployment)
- **Local Dev Server**: http://localhost:5173 (instant updates)
- **GitHub Repository**: https://github.com/theorem6/lte-pci-mapper

## Recommended Workflow

### For Active Development

Use local dev server for instant feedback:
```powershell
npm run dev
```

### For Testing/Sharing

Deploy to Firebase:
```powershell
.\deploy-to-firebase.ps1
```

## Summary

**To see your Nokia Export button and all recent changes in Firebase Web IDE:**

```powershell
# 1. Build
npm run build

# 2. Deploy
firebase apphosting:backends:deploy pci-mapper

# 3. Wait for deployment to complete

# 4. Hard refresh your browser (Ctrl+Shift+R)
```

**Or use the script:**

```powershell
.\deploy-to-firebase.ps1
```

Your changes are already in Git, but **Firebase needs to be updated** to serve the new version!

