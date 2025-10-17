# 🚀 Set Up Auto-Deploy for Cloud Functions via Git

**Goal**: Make Firebase Functions auto-deploy when you push to Git (just like App Hosting does)

---

## ⚡ Quick Setup (5 minutes)

### Step 1: Go to Cloud Build Triggers

https://console.cloud.google.com/cloud-build/triggers?project=lte-pci-mapper-65450042-bbf71

### Step 2: Click "CREATE TRIGGER"

### Step 3: Configure the Trigger

**Name**: `auto-deploy-functions`

**Description**: `Auto-deploy Firebase Functions on push to main`

**Event**: ✅ **Push to a branch**

**Source**:
- **Repository**: Connect your GitHub repo if not already connected
  - Click "CONNECT REPOSITORY"
  - Select "GitHub"
  - Authorize and select: `theorem6/lte-pci-mapper`
- **Branch**: `^main$` (regex to match main branch)

**Configuration**:
- **Type**: ✅ **Cloud Build configuration file (yaml or json)**
- **Location**: `/cloudbuild.yaml`

**Service account**: Use default

### Step 4: Click "CREATE"

---

## ✅ What Happens Next

After creating the trigger:

1. **Every git push to main** will trigger Cloud Build
2. Cloud Build will:
   - Install dependencies
   - Build TypeScript in `functions/`
   - Deploy to Firebase Functions
   - Update `hssProxy` automatically
3. **Total time**: ~5-10 minutes per push

---

## 🧪 Test the Trigger

After creating it:

```powershell
# Make a small change
cd C:\Users\david\Downloads\PCI_mapper
echo "# test" >> test.txt
git add test.txt
git commit -m "Test: Trigger Cloud Build"
git push origin main
```

Then watch: https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71

You should see a build start automatically!

---

## 🎯 For Right Now (Immediate Fix)

Since the trigger isn't set up yet, **manually trigger a build**:

### Option A: Cloud Console Manual Build

1. Go to: https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71

2. Click **"RUN"** or **"Submit Build"**

3. Configure:
   - **Source**: GitHub repository
   - **Branch**: main  
   - **Build configuration**: cloudbuild.yaml
   
4. Click **"RUN"**

5. Wait ~5-10 minutes

6. Functions will be deployed! ✅

### Option B: Enable Cloud Build API

The trigger might not work if Cloud Build API isn't enabled:

1. Go to: https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=lte-pci-mapper-65450042-bbf71

2. Click **"ENABLE"**

3. Then create the trigger (Step 1-4 above)

---

## 📝 Summary

**Current State:**
- ✅ App Hosting: Auto-deploys from Git
- ❌ Cloud Functions: Need manual deployment or Cloud Build trigger

**After Setup:**
- ✅ App Hosting: Auto-deploys from Git
- ✅ Cloud Functions: Auto-deploys from Git via Cloud Build
- 🎉 One `git push` updates everything!

---

**Do this now:** Set up the Cloud Build trigger (5 min), then future pushes will auto-deploy functions!

