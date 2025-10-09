# GitHub Actions Setup for Automatic Functions Deployment

## What This Does

Automatically deploys Firebase Functions to the cloud whenever you push code to Git. **No CLI access needed!**

## How It Works

```
You push to GitHub
    ↓
GitHub Actions automatically runs
    ↓
Builds TypeScript Functions
    ↓
Deploys to Firebase Cloud
    ↓
Done! ✅
```

## Setup Steps (One Time)

### Step 1: Create Firebase Token

**You need to do this once from any computer with Firebase CLI:**

```bash
firebase login:ci
```

**Copy the token it gives you** (looks like: `1//0abcdefg...`)

### Step 2: Add Token to GitHub Secrets

1. **Go to your GitHub repository:**
   ```
   https://github.com/theorem6/lte-pci-mapper
   ```

2. **Click:** Settings → Secrets and variables → Actions

3. **Click:** "New repository secret"

4. **Add secret:**
   - Name: `FIREBASE_TOKEN`
   - Value: Paste the token from Step 1
   - Click: "Add secret"

### Step 3: Push to GitHub

The workflow file is already committed. Just push:

```bash
git push
```

**That's it!** GitHub Actions will automatically deploy Functions! 🎉

## What Happens Automatically

### When You Push Code:

```
1. GitHub detects push to main branch
2. Checks if functions/ directory changed
3. Triggers GitHub Action
4. Action runs in GitHub cloud:
   - Installs dependencies
   - Builds TypeScript
   - Deploys Functions to Firebase
5. Functions are live!
6. Takes ~3-5 minutes
```

### Monitor Deployment:

1. **GitHub repository** → **Actions** tab
2. See: Latest workflow run
3. Watch: Real-time logs
4. Status: ✅ Success or ❌ Failed

## After Setup

### Every time you push:

```bash
git add .
git commit -m "Update functions"
git push
```

**GitHub automatically:**
- ✅ Detects changes
- ✅ Builds Functions
- ✅ Deploys to Firebase
- ✅ No CLI needed!

### Both Systems Deploy Automatically:

| Component | Deployed By | When |
|-----------|-------------|------|
| Module Manager (UI) | Firebase App Hosting | On Git push |
| Firebase Functions | GitHub Actions | On Git push |
| Both deploy automatically! | 🎉 | Always! |

## Workflow Triggers

The action runs when you change:
- ✅ `functions/**` - Any function code
- ✅ `apphosting.yaml` - Environment variables
- ✅ `Module_Manager/apphosting.yaml` - Configuration
- ✅ `.github/workflows/deploy-functions.yml` - Workflow itself

## Verify It's Working

### Check GitHub Actions:

1. Go to: `https://github.com/YOUR-REPO/actions`
2. Should see: "Deploy Firebase Functions" workflow
3. Status: ✅ Completed successfully

### Check Firebase Console:

1. Go to: Firebase Console → Functions
2. Should see: 30+ functions listed
3. Status: All active

### Test Functions:

Visit:
```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/checkMongoHealth
```

Expected:
```json
{"success":true,"connected":true,"database":"genieacs"}
```

## Without GitHub Actions (Alternative)

If you can't use GitHub Actions, you need someone with CLI access to run once:

```bash
firebase deploy --only functions
```

**After that:** Functions stay deployed until you change them.

## Benefits of This Approach

✅ **Fully Automatic** - No CLI needed  
✅ **Push to Deploy** - Just `git push`  
✅ **Works from Anywhere** - GitHub cloud handles it  
✅ **No Local Setup** - All in cloud  
✅ **Audit Trail** - See deployment history  
✅ **Rollback Easy** - Redeploy previous commit  

## Summary

### What You Need:

1. ✅ Firebase token (get with `firebase login:ci`)
2. ✅ Add token to GitHub Secrets
3. ✅ Push code to GitHub

### What Happens:

1. ✅ GitHub Actions deploys Functions automatically
2. ✅ Firebase App Hosting deploys UI automatically
3. ✅ Everything updates on `git push`
4. ✅ No CLI needed!

---

**After you add the Firebase token to GitHub Secrets and push, Functions will deploy automatically!** 🚀

