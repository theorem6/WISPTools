# Backend Deployment Commands for Dependency Updates

**Date:** December 2024  
**Purpose:** Commands to deploy backend dependency updates to GCE server

---

## 🚀 Quick Deploy Commands

### Option 1: SSH and Manual Deploy (Recommended)

**From your local machine, run:**

```bash
# SSH to GCE server
gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap
```

**Then on the GCE server, run:**

```bash
# Navigate to repo (check which directory exists)
cd /opt/lte-pci-mapper 2>/dev/null || cd /root/lte-pci-mapper

# Pull latest code with dependency updates
git pull origin main

# Install updated dependencies
cd backend-services
npm install --production

# Restart all PM2 services
pm2 restart all

# Verify services are running
pm2 status

# Check logs for any errors
pm2 logs main-api --lines 50
```

---

### Option 2: Use Deployment Script (On Server)

**On the GCE server:**

```bash
cd /opt/lte-pci-mapper  # or /root/lte-pci-mapper
sudo bash scripts/deployment/update-backend-from-git.sh
```

This script will:
- ✅ Pull latest code from GitHub
- ✅ Install npm dependencies
- ✅ Restart all PM2 services
- ✅ Show service status

---

### Option 3: PowerShell Deployment (From Windows)

**From your Windows machine:**

```powershell
# Navigate to project directory
cd C:\Users\david\Downloads\PCI_mapper

# Run PowerShell deployment script
.\scripts\deployment\Deploy-GCE-Backend.ps1
```

---

## 📋 What Gets Updated

### Backend Services Packages:
- `firebase-admin`: 13.5.0 → 13.6.0
- `mongoose`: 7.5.0 → 7.8.8 (latest v7.x - MongoDB Atlas compatible)
- `nodemon`: 3.0.1 → 3.1.11
- `net-snmp`: Added 3.26.0 (was missing)

### Services to Restart:
- `main-api` (port 3000 or 3003)
- `epc-api` (port 3002)
- `hss-api` (port 3001)

---

## ✅ Verification After Deployment

**On GCE server:**

```bash
# Check PM2 status
pm2 status

# Check MongoDB Atlas connection
pm2 logs main-api | grep -i mongodb

# Check API health
curl http://localhost:3003/api/health

# Check latest commit
cd /opt/lte-pci-mapper  # or /root/lte-pci-mapper
git log -1 --oneline
```

**From local machine:**

```bash
# Check backend health
curl https://hss.wisptools.io/api/health

# Should return: {"status":"healthy",...}
```

---

## ⚠️ Important Notes

1. **MongoDB Atlas Compatibility:**
   - Mongoose v7.8.8 is fully compatible with MongoDB Atlas
   - Connection strings already use `mongodb+srv://` format
   - No code changes needed

2. **Service Restart:**
   - Services will restart with new dependencies
   - Brief downtime expected (1-2 seconds per service)
   - All services restart in sequence

3. **Backup:**
   - Deployment script automatically backs up files
   - Previous versions saved in backup directory

---

## 🔄 Rollback (If Needed)

If issues occur after deployment:

```bash
# On GCE server
cd /opt/lte-pci-mapper/backend-services  # or /root/lte-pci-mapper/backend-services

# Revert package.json
git checkout HEAD~1 -- package.json package-lock.json

# Reinstall previous versions
npm install --production

# Restart services
pm2 restart all
```

---

**Ready to deploy!** Run the commands above to deploy backend dependency updates.

