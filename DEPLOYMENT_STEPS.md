# Deployment Steps

## Current Status
- ✅ Backend syntax error fixed (removed broken PUT route in hss-epcs-legacy.js)
- ✅ Axios implementation ready in Firebase Functions
- ✅ All code committed to git
- ⏳ Authentication required for deployment

## Deployment Commands

### Step 1: Authenticate with Firebase
```powershell
cd functions
firebase login --reauth
```

### Step 2: Authenticate with Google Cloud
```powershell
gcloud auth login
```

### Step 3: Deploy Firebase Functions (with Axios)
```powershell
cd C:\Users\david\Downloads\PCI_mapper\functions
firebase deploy --only functions:apiProxy,functions:isoProxy
```

### Step 4: Deploy Backend to GCE
```powershell
cd C:\Users\david\Downloads\PCI_mapper
.\scripts\deployment\Deploy-GCE-Backend.ps1
```

## What's Being Deployed

### Firebase Functions
- **apiProxy**: Now uses Axios with retry logic (3 retries, exponential backoff)
- **isoProxy**: Now uses Axios with retry logic (3 retries, exponential backoff)
- Better error handling and connection pooling
- Improved reliability vs native fetch

### Backend Services
- Fixed syntax error in `hss-epcs-legacy.js` (removed broken PUT route)
- Server should start successfully now

## Verification

After deployment, verify:
1. Backend server is running: `pm2 status` should show `main-api` as "online"
2. Backend health check: `curl http://localhost:3001/health`
3. Frontend can access `/api/user-tenants/:userId` endpoint

