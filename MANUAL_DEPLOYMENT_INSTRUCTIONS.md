# Manual Deployment Instructions

## ⚠️ Authentication Required First

Before deploying, you need to authenticate with Firebase CLI:

### Step 1: Authenticate with Firebase

Open a PowerShell terminal and run:

```powershell
cd C:\Users\david\Downloads\WISPTools
firebase login --reauth
```

This will open a browser window for you to authenticate. Once complete, you can proceed with deployment.

---

## 🚀 Deployment Steps

### Step 2: Deploy Frontend (Firebase Hosting)

The frontend has already been built. Now deploy it:

```powershell
cd C:\Users\david\Downloads\WISPTools
firebase deploy --only hosting --project wisptools-production
```

This will deploy to:
- **wisptools-production** site (primary)
- **wisptools-docs** site (if docs are built)

### Step 3: Build and Deploy Firebase Functions

```powershell
cd C:\Users\david\Downloads\WISPTools\functions
npm install
npm run build
cd ..
firebase deploy --only functions --project wisptools-production
```

This will deploy all Firebase Functions including:
- `apiProxy` - Main API proxy
- `isoProxy` - ISO generation proxy
- Other functions as configured

### Step 4: Deploy Backend Services (GCE) - Optional

If backend services need updates, use:

```powershell
cd C:\Users\david\Downloads\WISPTools
.\scripts\deployment\deploy-backend.ps1
```

Or manually via gcloud:

```powershell
# Copy files to GCE instance
gcloud compute scp backend-services/server.js acs-hss-server:/opt/hss-api/ --zone=us-central1-a

# Restart service
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="sudo systemctl restart hss-api"
```

---

## ✅ Verification

After deployment:

1. **Frontend**: Visit https://wisptools-production.web.app
   - Check for help buttons in modules
   - Verify help modals open correctly
   - Test hardware modal (should not loop)

2. **Functions**: Check Firebase Console
   - https://console.firebase.google.com/project/wisptools-production/functions
   - Verify functions are deployed and running

3. **Backend**: Check GCE instance
   - SSH to server and check service status
   - Verify API endpoints respond

---

## 📝 What's Being Deployed

### Frontend Changes (Help System Fixes):
- ✅ Help buttons with proper SVG icons (fixed position)
- ✅ Help modals working correctly
- ✅ Hardware modal loop fixed
- ✅ Event handler syntax standardized (onclick instead of on:click)

### Backend:
- Firebase Functions (if any changes)
- GCE backend services (if needed)

---

## 🎯 Quick Command Summary

```powershell
# 1. Authenticate (one-time, if needed)
firebase login --reauth

# 2. Deploy frontend
cd C:\Users\david\Downloads\WISPTools
firebase deploy --only hosting --project wisptools-production

# 3. Deploy functions
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions --project wisptools-production

# 4. Deploy backend (if needed)
.\scripts\deployment\deploy-backend.ps1
```


# Manual Deployment Instructions

## ⚠️ Authentication Required First

Before deploying, you need to authenticate with Firebase CLI:

### Step 1: Authenticate with Firebase

Open a PowerShell terminal and run:

```powershell
cd C:\Users\david\Downloads\WISPTools
firebase login --reauth
```

This will open a browser window for you to authenticate. Once complete, you can proceed with deployment.

---

## 🚀 Deployment Steps

### Step 2: Deploy Frontend (Firebase Hosting)

The frontend has already been built. Now deploy it:

```powershell
cd C:\Users\david\Downloads\WISPTools
firebase deploy --only hosting --project wisptools-production
```

This will deploy to:
- **wisptools-production** site (primary)
- **wisptools-docs** site (if docs are built)

### Step 3: Build and Deploy Firebase Functions

```powershell
cd C:\Users\david\Downloads\WISPTools\functions
npm install
npm run build
cd ..
firebase deploy --only functions --project wisptools-production
```

This will deploy all Firebase Functions including:
- `apiProxy` - Main API proxy
- `isoProxy` - ISO generation proxy
- Other functions as configured

### Step 4: Deploy Backend Services (GCE) - Optional

If backend services need updates, use:

```powershell
cd C:\Users\david\Downloads\WISPTools
.\scripts\deployment\deploy-backend.ps1
```

Or manually via gcloud:

```powershell
# Copy files to GCE instance
gcloud compute scp backend-services/server.js acs-hss-server:/opt/hss-api/ --zone=us-central1-a

# Restart service
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="sudo systemctl restart hss-api"
```

---

## ✅ Verification

After deployment:

1. **Frontend**: Visit https://wisptools-production.web.app
   - Check for help buttons in modules
   - Verify help modals open correctly
   - Test hardware modal (should not loop)

2. **Functions**: Check Firebase Console
   - https://console.firebase.google.com/project/wisptools-production/functions
   - Verify functions are deployed and running

3. **Backend**: Check GCE instance
   - SSH to server and check service status
   - Verify API endpoints respond

---

## 📝 What's Being Deployed

### Frontend Changes (Help System Fixes):
- ✅ Help buttons with proper SVG icons (fixed position)
- ✅ Help modals working correctly
- ✅ Hardware modal loop fixed
- ✅ Event handler syntax standardized (onclick instead of on:click)

### Backend:
- Firebase Functions (if any changes)
- GCE backend services (if needed)

---

## 🎯 Quick Command Summary

```powershell
# 1. Authenticate (one-time, if needed)
firebase login --reauth

# 2. Deploy frontend
cd C:\Users\david\Downloads\WISPTools
firebase deploy --only hosting --project wisptools-production

# 3. Deploy functions
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions --project wisptools-production

# 4. Deploy backend (if needed)
.\scripts\deployment\deploy-backend.ps1
```


# Manual Deployment Instructions

## ⚠️ Authentication Required First

Before deploying, you need to authenticate with Firebase CLI:

### Step 1: Authenticate with Firebase

Open a PowerShell terminal and run:

```powershell
cd C:\Users\david\Downloads\WISPTools
firebase login --reauth
```

This will open a browser window for you to authenticate. Once complete, you can proceed with deployment.

---

## 🚀 Deployment Steps

### Step 2: Deploy Frontend (Firebase Hosting)

The frontend has already been built. Now deploy it:

```powershell
cd C:\Users\david\Downloads\WISPTools
firebase deploy --only hosting --project wisptools-production
```

This will deploy to:
- **wisptools-production** site (primary)
- **wisptools-docs** site (if docs are built)

### Step 3: Build and Deploy Firebase Functions

```powershell
cd C:\Users\david\Downloads\WISPTools\functions
npm install
npm run build
cd ..
firebase deploy --only functions --project wisptools-production
```

This will deploy all Firebase Functions including:
- `apiProxy` - Main API proxy
- `isoProxy` - ISO generation proxy
- Other functions as configured

### Step 4: Deploy Backend Services (GCE) - Optional

If backend services need updates, use:

```powershell
cd C:\Users\david\Downloads\WISPTools
.\scripts\deployment\deploy-backend.ps1
```

Or manually via gcloud:

```powershell
# Copy files to GCE instance
gcloud compute scp backend-services/server.js acs-hss-server:/opt/hss-api/ --zone=us-central1-a

# Restart service
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="sudo systemctl restart hss-api"
```

---

## ✅ Verification

After deployment:

1. **Frontend**: Visit https://wisptools-production.web.app
   - Check for help buttons in modules
   - Verify help modals open correctly
   - Test hardware modal (should not loop)

2. **Functions**: Check Firebase Console
   - https://console.firebase.google.com/project/wisptools-production/functions
   - Verify functions are deployed and running

3. **Backend**: Check GCE instance
   - SSH to server and check service status
   - Verify API endpoints respond

---

## 📝 What's Being Deployed

### Frontend Changes (Help System Fixes):
- ✅ Help buttons with proper SVG icons (fixed position)
- ✅ Help modals working correctly
- ✅ Hardware modal loop fixed
- ✅ Event handler syntax standardized (onclick instead of on:click)

### Backend:
- Firebase Functions (if any changes)
- GCE backend services (if needed)

---

## 🎯 Quick Command Summary

```powershell
# 1. Authenticate (one-time, if needed)
firebase login --reauth

# 2. Deploy frontend
cd C:\Users\david\Downloads\WISPTools
firebase deploy --only hosting --project wisptools-production

# 3. Deploy functions
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions --project wisptools-production

# 4. Deploy backend (if needed)
.\scripts\deployment\deploy-backend.ps1
```








