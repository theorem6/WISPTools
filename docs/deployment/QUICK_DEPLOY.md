# Quick Deployment Commands

## 🔐 Step 1: Authenticate (Required)

```powershell
# Firebase authentication
cd C:\Users\david\Downloads\PCI_mapper\functions
firebase login --reauth

# Google Cloud authentication  
gcloud auth login
```

## 🚀 Step 2: Deploy Firebase Functions (Axios Implementation)

```powershell
cd C:\Users\david\Downloads\PCI_mapper\functions
firebase deploy --only functions:apiProxy,functions:isoProxy
```

**What this deploys:**
- ✅ apiProxy: Now uses Axios with automatic retry (3 attempts)
- ✅ isoProxy: Now uses Axios with automatic retry (3 attempts)
- ✅ Better error handling and connection pooling
- ✅ Improved reliability vs native fetch

## 🔧 Step 3: Deploy Backend (Syntax Fix)

```powershell
cd C:\Users\david\Downloads\PCI_mapper
.\scripts\deployment\Deploy-GCE-Backend.ps1
```

**What this deploys:**
- ✅ Fixed syntax error in `hss-epcs-legacy.js`
- ✅ Backend server should start successfully
- ✅ Fixes the 500 error on `/api/user-tenants/:userId`

## ✅ Verification

After deployment completes:
1. Backend should be running: `pm2 status` shows `main-api` as "online"
2. Frontend should be able to access tenant endpoints
3. The 500 error should be resolved

---

**All code is committed and ready:**
- Commit `6c15a39`: Backend syntax error fix
- Commit `f68ed75`: Axios implementation in Firebase Functions

