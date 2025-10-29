# 🚀 Firebase Functions Deployment Guide

Firebase Cloud Functions **do not auto-deploy** from Git pushes. You must manually deploy them after code changes.

## Quick Deploy Options

### Option 1: PowerShell Script (Windows - Local Firebase CLI)

If you have Firebase CLI installed locally:

```powershell
# Deploy hssProxy only
.\scripts\deployment\Deploy-Firebase-Functions.ps1

# Deploy all functions
.\scripts\deployment\Deploy-Firebase-Functions.ps1 -AllFunctions

# Build only (no deploy)
.\scripts\deployment\Deploy-Firebase-Functions.ps1 -BuildOnly
```

**Prerequisites:**
- Node.js and npm installed
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase authenticated: `firebase login`

### Option 2: Cloud Shell Script (Recommended)

Use Google Cloud Shell - no local setup needed:

1. Open Cloud Shell: https://console.cloud.google.com/ (click `>_` icon)
2. Run:

```bash
# Clone/update repo
cd ~
git clone https://github.com/theorem6/lte-pci-mapper.git 2>/dev/null || \
  (cd lte-pci-mapper && git pull origin main)

# Deploy
cd lte-pci-mapper
bash scripts/deployment/deploy-firebase-functions.sh

# Or deploy all functions
bash scripts/deployment/deploy-firebase-functions.sh hssProxy all
```

### Option 3: Manual Commands

From the `functions` directory:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions:hssProxy
```

## What Gets Deployed

### Main Functions:
- **`hssProxy`** - HTTPS proxy to GCE backend (port 3001)
- **`billingApi`** - Billing API functions
- **`analyzePCI`** - PCI conflict analysis

### After Deployment

The function will be available at:
- **hssProxy**: `https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy`

### Test Deployment

```bash
# Health check
curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/health

# Should return:
# {"status":"healthy","service":"user-management-system","port":"3001",...}
```

## Common Issues

### ❌ "Firebase CLI not found"
```bash
npm install -g firebase-tools
```

### ❌ "Authentication Error"
```bash
firebase login
firebase login --reauth
```

### ❌ "Permission denied"
Check that you're logged in to the correct project:
```bash
firebase projects:list
firebase use lte-pci-mapper-65450042-bbf71
```

### ❌ "Build failed"
Check TypeScript errors:
```bash
cd functions
npm run build
```

## When to Deploy

Deploy Firebase Functions after changes to:
- ✅ `functions/src/index.ts` (hssProxy changes)
- ✅ `functions/src/*.ts` (any function changes)
- ✅ `firebase.json` (rewrite rules)
- ❌ Frontend code (auto-deploys via App Hosting)
- ❌ Backend code (deploy separately to GCE)

## Deployment Checklist

- [ ] Code changes pushed to GitHub
- [ ] Functions built successfully (`npm run build`)
- [ ] Firebase CLI authenticated
- [ ] Correct project selected
- [ ] Function deployed successfully
- [ ] Test endpoint responds correctly

---

**Note:** Frontend changes auto-deploy via Firebase App Hosting. Backend changes deploy separately to the GCE server.

