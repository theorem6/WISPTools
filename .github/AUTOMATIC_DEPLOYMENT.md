# Automatic Deployment Setup

This project is configured for **automatic deployment** to Firebase when you push code to GitHub.

## 🚀 How It Works

### **Firebase App Hosting** (Automatic)
✅ **Already configured** - Deploys automatically when you push to `main` branch

**What it deploys:**
- Frontend application (Module_Manager)
- SvelteKit build
- All UI changes

**Trigger:** Any push to `main` branch  
**Build time:** ~3-5 minutes  
**Status:** Check Firebase Console → App Hosting

### **Firestore Rules** (GitHub Actions)
✅ **Configured** - Deploys when `firestore.rules` changes

**What it deploys:**
- Database security rules
- Database indexes

**Trigger:** Changes to `firestore.rules` or `firestore.indexes.json`  
**Deploy time:** ~10-30 seconds  
**Status:** Check GitHub Actions tab

### **Cloud Functions** (GitHub Actions)
✅ **Configured** - Deploys when functions code changes

**What it deploys:**
- Backend Cloud Functions
- API endpoints

**Trigger:** Changes to `functions/**`  
**Deploy time:** ~2-3 minutes  
**Status:** Check GitHub Actions tab

---

## ⚙️ One-Time Setup Required

### Required GitHub Secrets (Actions → Settings → Secrets and variables → Actions)

| Secret | Used by | How to get |
|--------|---------|------------|
| **FIREBASE_SERVICE_ACCOUNT** | Deploy to Firebase Hosting | Service account JSON key with Firebase Hosting Admin (see Step 1 below) |
| **GCP_SA_KEY** | Deploy Backend to GCE | JSON key for a GCP service account with Compute Engine + IAP access |

If a workflow run fails immediately with "X is not set", add the missing secret above.

### Step 1: Firebase Hosting – Service account (replaces deprecated `firebase login:ci` token)

The `--token` from `firebase login:ci` is deprecated and can cause 401 errors. Use a **service account JSON key** instead.

1. **Create a service account** (Firebase project **wisptools-production**):
   - [Google Cloud Console](https://console.cloud.google.com/) → select project **wisptools-production**
   - IAM & Admin → Service Accounts → Create Service Account
   - Name it e.g. `firebase-hosting-deploy`
   - Create and Continue

2. **Grant Firebase Hosting Admin**:
   - Add role: **Firebase Hosting Admin** (or **Firebase Admin** if you prefer)
   - Done

3. **Create a JSON key**:
   - Open the new service account → Keys → Add Key → Create new key → JSON → Create
   - Save the downloaded `.json` file

4. **Add to GitHub**:
   - Repo → **Settings** → **Secrets and variables** → **Actions**
   - **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: paste the **entire contents** of the JSON file (including `{` and `}`)
   - Add secret

### Step 2: Add other secrets (GCP_SA_KEY, etc.)

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Add **GCP_SA_KEY** for backend GCE deploy (JSON key for the GCE service account)

### Step 3: Test the Setup

Push a change to test:
```bash
# Make a small change to firestore.rules (add a comment)
echo "# Auto-deploy test" >> firestore.rules
git add firestore.rules
git commit -m "Test automatic deployment"
git push origin main
```

Check if it worked:
1. Go to GitHub → Actions tab
2. You should see "Deploy Firestore Rules" workflow running
3. Wait ~30 seconds
4. Check Firebase Console → Firestore → Rules
5. Your rules should be updated! ✅

---

## 📊 Deployment Workflows

### **Workflow 1: Firestore Rules**
**File:** `.github/workflows/deploy-firestore-rules.yml`

**Triggers when:**
- `firestore.rules` changes
- `firestore.indexes.json` changes

**What it does:**
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### **Workflow 2: Cloud Functions**
**File:** `.github/workflows/deploy-functions.yml`

**Triggers when:**
- Any file in `functions/` changes

**What it does:**
```bash
cd functions
npm ci
npm run build
firebase deploy --only functions
```

### **Workflow 3: App Hosting (Built-in)**
**File:** `apphosting.yaml`

**Triggers when:**
- Any code pushed to `main` branch

**What Firebase does:**
```bash
cd Module_Manager
npm install
npm run build
# Deploy to App Hosting
```

---

## 🔍 Monitoring Deployments

### **Check App Hosting Deployments:**
1. Go to Firebase Console
2. Click **App Hosting** in left menu
3. See deployment status and history
4. View build logs

### **Check GitHub Actions:**
1. Go to your GitHub repo
2. Click **Actions** tab
3. See all workflow runs
4. Click on any run to see logs

---

## 🎯 Current Status

After pushing all your refactoring changes:

| Component | Auto-Deploy | Status |
|-----------|-------------|--------|
| **App Code** | ✅ Firebase App Hosting | Automatic |
| **Firestore Rules** | ✅ GitHub Actions | Needs `FIREBASE_TOKEN` |
| **Cloud Functions** | ✅ GitHub Actions | Needs `FIREBASE_TOKEN` |

---

## 🛠️ Manual Deployment (Fallback)

If you need to deploy manually:

```bash
# Deploy everything
firebase deploy

# Deploy only rules
firebase deploy --only firestore:rules

# Deploy only functions
firebase deploy --only functions

# Deploy only app hosting
firebase deploy --only apphosting
```

---

## 📝 Workflow Files Created

1. `.github/workflows/deploy-firestore-rules.yml` - Auto-deploy Firestore rules
2. `.github/workflows/deploy-functions.yml` - Auto-deploy Cloud Functions

---

## ✅ Next Steps

1. **Generate Firebase CI token:** `firebase login:ci`
2. **Add `FIREBASE_TOKEN` to GitHub Secrets**
3. **Push your code** - Everything deploys automatically!
4. **Monitor in GitHub Actions** tab

---

## 🎊 Benefits

✅ **No manual deployment** - Just push to GitHub  
✅ **Faster iteration** - Deploy in seconds  
✅ **Consistent builds** - Same process every time  
✅ **Audit trail** - See all deployments in GitHub  
✅ **Rollback easy** - Revert git commit = revert deployment  

**Push to deploy!** 🚀

