# Fix Firebase App Hosting Auto-Deploy for Backend-Only Changes

## Problem
Firebase App Hosting has its own Git integration that auto-deploys on **every push** to the main branch, regardless of which files changed. This causes unnecessary frontend deployments when only backend files are modified.

## Solution Options

### Option 1: Disable Auto-Deploy in Firebase Console (Recommended)

Firebase App Hosting Git integration needs to be reconfigured in the Firebase Console:

1. **Go to Firebase Console:**
   ```
   https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
   ```

2. **Find Git Integration Settings:**
   - Look for "Git integration" or "Source" settings
   - Find the connected repository configuration
   - Look for "Auto-deploy" toggle or settings

3. **Disable Auto-Deploy:**
   - Turn off automatic deployment
   - This will require manual deployments via GitHub Actions instead

4. **Alternative: Use GitHub Actions Only:**
   - Keep Firebase App Hosting Git integration disabled
   - Use the `.github/workflows/firebase-app-hosting.yml` workflow instead
   - This workflow has proper path filtering configured

### Option 2: Use Cloud Build Trigger with Path Filters (If Available)

If Firebase App Hosting uses Cloud Build triggers, you can configure path filters:

1. **Go to Cloud Build Triggers:**
   ```
   https://console.cloud.google.com/cloud-build/triggers?project=lte-pci-mapper-65450042-bbf71
   ```

2. **Find App Hosting Trigger:**
   - Look for triggers related to App Hosting or Firebase
   - Edit the trigger configuration

3. **Add Path Filters:**
   - Add include paths: `Module_Manager/**`
   - Add exclude paths: `backend-services/**`, `gce-backend/**`, etc.

### Option 3: Keep Both (Current State + Documentation)

Since GitHub Actions workflow (`.github/workflows/firebase-app-hosting.yml`) is already configured with path filtering, Firebase App Hosting's auto-deploy might be redundant. However, if both run:
- GitHub Actions will skip if no frontend changes (correct behavior)
- Firebase App Hosting will deploy anyway (unwanted behavior)

**Best Solution:** Disable Firebase App Hosting's built-in Git auto-deploy and rely on GitHub Actions only.

## Current Configuration Status

✅ **GitHub Actions** (`.github/workflows/firebase-app-hosting.yml`):
- ✅ Path filtering configured
- ✅ Only deploys on `Module_Manager/**` changes
- ✅ Excludes backend directories

⚠️ **Firebase App Hosting Git Integration**:
- ❌ No path filtering (deploys on every push)
- Needs to be disabled or reconfigured in Firebase Console

## Quick Fix Steps

1. **Go to Firebase Console → App Hosting**
2. **Find Git Integration/Source settings**
3. **Disable "Auto-deploy on push"** or configure path filters
4. **Save changes**

After this, only GitHub Actions will handle deployments, and it will respect path filters properly.

