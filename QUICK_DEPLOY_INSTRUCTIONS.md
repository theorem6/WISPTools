# Quick Deploy Instructions - Dependency Updates

**Date:** December 2024  
**Status:** Frontend ✅ | Functions ✅ | Backend ⏳ | Agents ✅

---

## 🚀 One-Command Backend Deployment

### Option 1: PowerShell (Windows) ⭐ EASIEST

**Run from project root:**

```powershell
.\DEPLOY_BACKEND_NOW.ps1
```

This will:
- ✅ SSH to GCE server
- ✅ Pull latest code from GitHub
- ✅ Install updated npm packages
- ✅ Restart all PM2 services
- ✅ Show service status

---

### Option 2: Bash Script (Linux/Mac/Git Bash)

**Run from project root:**

```bash
bash DEPLOY_BACKEND_NOW.sh
```

---

### Option 3: Manual SSH Commands

**Step 1: SSH to Server**
```bash
gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap
```

**Step 2: On Server, Run These Commands**
```bash
# Navigate to repo (check which exists)
cd /opt/lte-pci-mapper 2>/dev/null || cd /root/lte-pci-mapper

# Pull latest code
git pull origin main

# Install updated dependencies
cd backend-services
npm install --production

# Restart services
pm2 restart all

# Verify
pm2 status
```

---

## ✅ What's Already Deployed

### Frontend ✅
- **Status:** Deployed to Firebase Hosting
- **URL:** https://wisptools-production.web.app
- **Packages:** All updated and MongoDB Atlas compatible

### Firebase Functions ✅
- **Status:** Deployed and live
- **Functions:** All 17 functions deployed
- **Packages:** firebase-admin 13.6.0, mongodb 6.21.0

### Remote EPC Agents ✅
- **Status:** Auto-updates enabled
- **Action:** Will auto-update after backend deployment
- **Timing:** Next check-in (within 60 seconds)

---

## ⏳ What Needs Deployment

### Backend (GCE Server) ⏳

**Packages to Deploy:**
- firebase-admin: 13.6.0
- mongoose: 7.8.8 (MongoDB Atlas compatible)
- nodemon: 3.1.11
- net-snmp: 3.26.0 (newly added)

**Quick Deploy:**
```powershell
# Windows PowerShell
.\DEPLOY_BACKEND_NOW.ps1
```

Or manually:
```bash
gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap
cd /opt/lte-pci-mapper  # or /root/lte-pci-mapper
git pull origin main
cd backend-services
npm install --production
pm2 restart all
pm2 status
```

---

## 📋 Complete Deployment Checklist

- [x] Frontend deployed to Firebase Hosting
- [x] Firebase Functions deployed
- [ ] **Backend deployed to GCE server** ← RUN DEPLOY_BACKEND_NOW.ps1
- [x] Agent scripts ready for auto-update

---

## 🔍 Verification After Backend Deployment

1. **Check API Health:**
   ```bash
   curl https://hss.wisptools.io/api/health
   ```
   Should return: `{"status":"healthy",...}`

2. **Check Services on Server:**
   ```bash
   pm2 status
   ```
   All services should be "online"

3. **Check MongoDB Connection:**
   ```bash
   pm2 logs main-api | grep -i "mongodb\|connected"
   ```
   Should show "MongoDB connected" or "MongoDB Atlas connected"

4. **Monitor Logs:**
   ```bash
   pm2 logs main-api --lines 50
   ```
   Check for any errors

---

## 🎯 Next Steps

1. **Run backend deployment:**
   ```powershell
   .\DEPLOY_BACKEND_NOW.ps1
   ```

2. **Verify deployment:**
   - Check API health endpoint
   - Verify PM2 services running
   - Check logs for errors

3. **Wait for agent updates:**
   - Agents will auto-update on next check-in (within 60 seconds)
   - No manual action needed

---

**Ready to deploy! Run `.\DEPLOY_BACKEND_NOW.ps1` to complete the deployment.**

