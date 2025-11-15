# 🚀 Deploy Frontend Now - Manual Trigger Guide

## Problem
GitHub Actions auto-deployment isn't working for the frontend.

## Solution: Manual Trigger

### Option 1: Trigger via GitHub Actions UI (Recommended)

1. **Go to GitHub Actions:**
   ```
   https://github.com/theorem6/lte-pci-mapper/actions
   ```

2. **Select Workflow:**
   - Click on **"Deploy to Firebase Hosting"** workflow
   - OR click on **"Auto Deploy WISPTools.io Platform"** workflow

3. **Click "Run workflow" button** (top right)
   - Select branch: `main`
   - Click **"Run workflow"**

4. **Monitor Deployment:**
   - The workflow will start running
   - Watch the "Deploy Frontend" job
   - Should complete in ~5-10 minutes

### Option 2: Force Deployment via Empty Commit

If the UI method doesn't work, create a trivial change:

```bash
# Make a trivial change to trigger deployment
echo "# Build trigger $(date)" >> Module_Manager/.deploy-trigger
git add Module_Manager/.deploy-trigger
git commit -m "chore: Trigger frontend deployment"
git push origin main
```

### Option 3: Check GitHub Actions Status

Check if workflows are running at all:

1. **Go to Actions tab:** https://github.com/theorem6/lte-pci-mapper/actions
2. **Check for:**
   - ✅ Green checkmarks = Success
   - 🟡 Yellow circles = In progress
   - ❌ Red X = Failed
   - ⚪ Gray = Not run

3. **If workflows aren't running:**
   - Check if GitHub Actions is enabled for the repo
   - Verify `FIREBASE_TOKEN` secret exists in Settings → Secrets → Actions

## What Should Happen

After triggering:
1. ✅ GitHub Actions starts the workflow
2. ✅ Builds the frontend (`npm run build`)
3. ✅ Deploys to Firebase Hosting
4. ✅ You should see "Microsoft Building Footprints" in the wizard

## Verify Deployment

1. **Check Firebase Hosting:**
   ```
   https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/hosting
   ```

2. **Check Live Site:**
   - Visit your site URL
   - Hard refresh (Ctrl+Shift+R)
   - Open the marketing discovery wizard
   - Should see "Microsoft Building Footprints" as first option

## Current Status

- ✅ Frontend code fixed (build error resolved)
- ✅ Backend deployed and running
- ⏳ Frontend deployment needs manual trigger

