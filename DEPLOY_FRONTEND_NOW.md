# 🚀 Deploy Frontend Now - Quick Guide

## ✅ The Missing File Issue is FIXED!

The `src/app.html` missing file error has been resolved. All `apphosting.yaml` files now have the correct `rootDirectory` configuration.

---

## 📋 Prerequisites

Before deploying, make sure you have:

- [ ] Firebase CLI installed: `npm install -g firebase-tools`
- [ ] Logged into Firebase: `firebase login`
- [ ] Project set: `firebase use lte-pci-mapper-65450042-bbf71`

---

## 🎯 Quick Deploy (2 Options)

### Option 1: Deploy with Default Configuration (Firebase Functions Backend)

**Best for:** Testing the frontend without setting up GCE backend

```bash
# From the project root
cd PCI_mapper

# Deploy everything (frontend + functions)
firebase deploy

# Or deploy just the frontend
firebase deploy --only apphosting
```

**What you get:**
- ✅ Frontend deployed to Firebase App Hosting
- ✅ Uses Firebase Functions for backend APIs
- ✅ All services fully functional
- ✅ URL: `https://lte-pci-mapper-65450042-bbf71.web.app`

---

### Option 2: Deploy with GCE Backend

**Best for:** Production use with GenieACS TR-069 support

#### Step 1: Get Your GCE External IP

If you haven't deployed the GCE backend yet:
```bash
cd gce-backend
./create-gce-instance.sh
# Note the External IP address shown at the end
```

If you already have it running:
```bash
gcloud compute instances list
# Look for "genieacs-backend" and note the EXTERNAL_IP
```

#### Step 2: Update Configuration

Edit the root `apphosting.yaml` file and replace `<GCE-IP>` with your actual IP:

```yaml
# Find these lines (around line 265-299):
- variable: PUBLIC_BACKEND_API_URL
  value: "http://<GCE-IP>/api"  # Replace <GCE-IP> with your IP

- variable: PUBLIC_GENIEACS_NBI_URL
  value: "http://<GCE-IP>/nbi"  # Replace <GCE-IP> with your IP

# ... and so on for all GCE-related variables
```

**Quick find & replace:**
```bash
# On Windows PowerShell:
(Get-Content apphosting.yaml) -replace '<GCE-IP>', 'YOUR.ACTUAL.IP.HERE' | Set-Content apphosting.yaml

# On Linux/Mac:
sed -i 's/<GCE-IP>/YOUR.ACTUAL.IP.HERE/g' apphosting.yaml
```

#### Step 3: Deploy

```bash
firebase deploy --only apphosting
```

---

## 🔍 Verify Deployment

### Check Deployment Status

```bash
# List your backends
firebase apphosting:backends:list

# Check logs
firebase apphosting:logs --backend lte-pci-mapper
```

### Test the Application

1. **Open the URL** from the deployment output
2. **Try logging in** with Firebase Auth
3. **Check the console** for any errors (F12 → Console)
4. **Test backend connection**: Visit the dashboard

### Expected Results

✅ **Build succeeds** (no more "src/app.html not found")  
✅ **Container starts** on port 8080  
✅ **Health check passes**  
✅ **Application loads** in browser  
✅ **Firebase Auth works**  
✅ **Backend APIs respond**

---

## 🛠️ Troubleshooting

### Error: "src/app.html not found"
**Status**: ✅ FIXED! This was caused by missing `rootDirectory` in `apphosting.yaml`. Now resolved.

### Error: "Cannot find module '/workspace/index.js'"
**Fix**: Make sure `Module_Manager/package.json` has:
```json
{
  "scripts": {
    "start": "node build/index.js"
  }
}
```

### Error: "Build failed - out of memory"
**Fix**: Already configured with 6GB heap:
```yaml
buildCommand: npm install && NODE_OPTIONS="--max-old-space-size=6144" npm run build
```

### Error: "Firebase API key invalid"
**Check**: Make sure environment variables are set in `apphosting.yaml` with both BUILD and RUNTIME availability:
```yaml
- variable: PUBLIC_FIREBASE_API_KEY
  value: "your-api-key"
  availability:
    - BUILD
    - RUNTIME
```

### Build succeeds but site shows errors
**Check**:
1. Open browser console (F12)
2. Look for CORS errors
3. Verify backend URLs are correct
4. Test backend endpoints directly:
   ```bash
   curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/analyzePCI
   ```

---

## 📊 Deployment Architecture

### What Gets Deployed

```
Firebase App Hosting (Cloud Run)
├── SvelteKit Frontend (Module_Manager)
│   ├── src/app.html ✅ Now found correctly!
│   ├── Authentication (Firebase Auth)
│   ├── Map Interface (ArcGIS)
│   └── UI Components
│
└── Backend Connection
    ├── Option A: Firebase Functions ✅
    │   ├── analyzePCI
    │   ├── syncCPEDevices
    │   ├── getCPEDevices
    │   └── More...
    │
    └── Option B: GCE Backend ✅
        ├── GenieACS (TR-069 CWMP)
        ├── Backend API
        └── STUN Server
```

---

## 🎯 Quick Commands Reference

```bash
# Check Firebase login
firebase login:list

# Set project
firebase use lte-pci-mapper-65450042-bbf71

# Deploy everything
firebase deploy

# Deploy only frontend
firebase deploy --only apphosting

# Deploy only functions
firebase deploy --only functions

# View logs
firebase apphosting:logs

# List backends
firebase apphosting:backends:list

# Stream logs in real-time
firebase apphosting:logs --follow
```

---

## 📈 After Successful Deployment

### 1. Route Traffic to Latest Version

```bash
gcloud run services update-traffic lte-pci-mapper \
  --region=us-central1 \
  --project=lte-pci-mapper-65450042-bbf71 \
  --to-latest
```

### 2. Test All Features

- [ ] Login/Authentication
- [ ] Dashboard loads
- [ ] PCI Resolution module
- [ ] ACS/CPE Management module
- [ ] Map renders (ArcGIS)
- [ ] Backend API connection
- [ ] Device list loads

### 3. Monitor Performance

**Firebase Console:**
- Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71
- Click: App Hosting → lte-pci-mapper
- Monitor: Requests, errors, latency

**Cloud Run Console:**
- Go to: https://console.cloud.google.com/run
- Click: lte-pci-mapper
- Check: CPU, Memory, Request count

---

## 💰 Cost Monitoring

After deployment, keep an eye on costs:

```bash
# View current costs
gcloud billing accounts list

# Set up budget alerts in Firebase Console:
# Settings → Usage and Billing → Set Budget Alert
```

**Expected Monthly Costs:**
- Firebase App Hosting: ~$50 (with always-on instance)
- Firebase Functions: ~$10-20 (based on usage)
- GCE Backend (if used): ~$50
- **Total**: ~$60-120/month

**Cost Optimization:**
- Set `minInstances: 0` in `apphosting.yaml` to scale to zero when idle
- Use Cloud Scheduler to stop GCE instance at night (if applicable)
- Enable committed use discounts for long-term savings

---

## 🎉 Success!

Your frontend is now deployed! The `src/app.html` missing file issue is resolved thanks to the `rootDirectory` configuration.

**Next Steps:**
1. ✅ Test your application thoroughly
2. ✅ Configure custom domain (optional)
3. ✅ Set up monitoring and alerts
4. ✅ Configure backups (Firestore, Storage)

---

## 🆘 Need Help?

- **Deployment logs**: `firebase apphosting:logs`
- **Cloud Run logs**: https://console.cloud.google.com/run
- **Firebase Console**: https://console.firebase.google.com/
- **Check**: `MISSING_FILE_FIX.md` for detailed explanation of the fix

---

**Ready to Deploy?** Just run:
```bash
firebase deploy --only apphosting
```

🎊 **Your frontend will be live in ~5-10 minutes!**

