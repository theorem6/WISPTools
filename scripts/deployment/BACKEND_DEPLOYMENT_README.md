# Backend Deployment Guide

## Overview

**GitHub is the master source of truth for all code.** All deployments should pull from GitHub, not copy files manually.

## Deployment Process

### Standard Deployment (Recommended)

**From your local machine (Windows):**

```powershell
# 1. Commit and push changes to GitHub
git add .
git commit -m "Your commit message"
git push origin main

# 2. Deploy to GCE server via SSH
gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap
```

**On the GCE server:**

```bash
# Navigate to repo directory
cd /opt/lte-pci-mapper

# Pull latest code from GitHub
sudo bash scripts/deployment/update-backend-from-git.sh
```

This script will:
- ✅ Pull latest code from GitHub (`origin/main`)
- ✅ Install/update npm dependencies
- ✅ Restart all backend services (epc-api, hss-api, main-api)
- ✅ Show service status and latest commit

### Manual Deployment (If Git Auth Issues)

If GitHub authentication is not configured:

```bash
# On GCE server
cd /opt/lte-pci-mapper

# Manually copy files from GitHub (using your local machine)
# From Windows machine:
gcloud compute scp backend-services/routes/epc-deployment.js \
  acs-hss-server:/opt/lte-pci-mapper/backend-services/routes/epc-deployment.js \
  --zone=us-central1-a --tunnel-through-iap

# Then restart services
sudo pm2 restart epc-api
```

### Setting Up GitHub Authentication (One-Time Setup)

To enable automatic pulls from GitHub, configure authentication:

**Option 1: SSH Keys (Recommended)**
```bash
# On GCE server
ssh-keygen -t ed25519 -C "gce-server@wisptools.io"
cat ~/.ssh/id_ed25519.pub
# Add this public key to GitHub: Settings > SSH and GPG keys

# Update remote to use SSH
cd /opt/lte-pci-mapper
git remote set-url origin git@github.com:theorem6/lte-pci-mapper.git
```

**Option 2: Personal Access Token**
```bash
# On GCE server
cd /opt/lte-pci-mapper
git remote set-url origin https://<token>@github.com/theorem6/lte-pci-mapper.git
```

## Service Management

### Check Service Status
```bash
pm2 status
pm2 logs epc-api --lines 50
```

### Restart Services
```bash
pm2 restart epc-api    # EPC ISO generation (port 3002)
pm2 restart hss-api   # HSS management (port 3001)
pm2 restart main-api  # Main API (port 3000)
```

### View Logs
```bash
pm2 logs epc-api --lines 100
pm2 logs hss-api --lines 100
```

## File Locations

- **Backend Code:** `/opt/lte-pci-mapper/backend-services/`
- **EPC Deployment Route:** `/opt/lte-pci-mapper/backend-services/routes/epc-deployment.js`
- **Deployment Script:** `/opt/lte-pci-mapper/scripts/deployment/update-backend-from-git.sh`
- **ISO Output:** `/var/www/html/downloads/isos/`
- **Preseed Files:** `/var/www/html/downloads/netboot/`

## Verification

After deployment, verify:

1. **Code is synced:**
   ```bash
   cd /opt/lte-pci-mapper
   git log -1 --oneline
   # Should match latest commit from GitHub
   ```

2. **Services are running:**
   ```bash
   pm2 status
   curl http://localhost:3002/health
   ```

3. **ISO generation works:**
   - Test from frontend wizard
   - Check logs: `pm2 logs epc-api --lines 50`

## Important Notes

- ⚠️ **Never edit code directly on the server** - always make changes locally, commit to GitHub, then pull on server
- ⚠️ **GitHub is the source of truth** - any local changes on server will be overwritten on next `git pull`
- ✅ **Always use the deployment script** - it handles dependencies and service restarts automatically

