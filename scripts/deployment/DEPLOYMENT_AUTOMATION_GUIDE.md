# WISPTools.io Deployment Automation Guide

Complete automation scripts for deploying the entire WISPTools.io system.

## 🚀 Quick Start

### One-Command Complete Setup (GCE Server)
```bash
# SSH to GCE server
ssh root@136.112.111.167

# Run master deployment script
curl -fsSL https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/scripts/deployment/deploy-all-automated.sh | sudo bash
```

This single command sets up:
- ✅ HSS Backend (Port 3001)
- ✅ ISO Builder
- ✅ Deployment APIs
- ✅ Web Server (Nginx)
- ✅ MongoDB Atlas connection
- ✅ All system services

---

## 📋 Available Scripts

### 1. **Complete System Setup** (GCE Server)
**Script:** `deploy-all-automated.sh`

**What it does:**
- Updates system packages
- Installs Node.js, MongoDB, Nginx
- Sets up ISO builder
- Configures backend services
- Creates systemd services
- Configures firewall
- Creates management commands

**Usage:**
```bash
# On GCE server
sudo bash scripts/deployment/deploy-all-automated.sh
```

**Time:** ~10-15 minutes

---

### 2. **Update GCE IP Address**
**Script:** `update-gce-ip.sh`

**What it does:**
- Updates IP in backend config
- Updates IP in frontend UI
- Updates IP in deployment scripts
- Updates environment files
- Updates systemd services

**Usage:**
```bash
# Keep current IP (136.112.111.167)
bash scripts/deployment/update-gce-ip.sh

# Change to new IP
bash scripts/deployment/update-gce-ip.sh 192.168.1.100
```

**Automated:** Yes (updates all files automatically)

---

### 3. **Frontend Deployment** (Local → Firebase)
**Script:** `deploy-frontend-updates.sh`

**What it does:**
- Installs dependencies
- Builds frontend
- Deploys to Firebase Hosting
- Deploys Firebase Functions
- Deploys Firestore rules

**Usage:**
```bash
# Production deployment
bash scripts/deployment/deploy-frontend-updates.sh production

# Staging deployment
bash scripts/deployment/deploy-frontend-updates.sh staging

# Development deployment
bash scripts/deployment/deploy-frontend-updates.sh development
```

**Time:** ~5-10 minutes

---

### 4. **Update MongoDB Atlas Connection**
**Script:** `update-mongodb-atlas.sh`

**What it does:**
- Updates MongoDB Atlas connection string
- Backs up existing configuration
- Restarts backend service
- Verifies connection

**Usage:**
```bash
# On GCE server
sudo bash scripts/deployment/update-mongodb-atlas.sh "mongodb+srv://user:pass@cluster.mongodb.net/wisptools"
```

**Get your Atlas connection string:**
1. Login to MongoDB Atlas (https://cloud.mongodb.com)
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your actual password

**Time:** <1 minute

---

### 5. **Windows PowerShell Deployment**
**Script:** `Deploy-All.ps1`

**What it does:**
- Local development setup
- Frontend deployment
- GCE deployment via SSH
- Automatic Git push

**Usage:**
```powershell
# Local development setup
.\scripts\deployment\Deploy-All.ps1 -Target Local

# Deploy frontend only
.\scripts\deployment\Deploy-All.ps1 -Target Frontend

# Deploy GCE backend only
.\scripts\deployment\Deploy-All.ps1 -Target GCE

# Deploy everything
.\scripts\deployment\Deploy-All.ps1 -Target All

# Custom GCE IP
.\scripts\deployment\Deploy-All.ps1 -Target GCE -GceIp "192.168.1.100"
```

**Platform:** Windows (PowerShell)

---

## 🔧 System Configuration

### GCE Server Information
- **IP Address:** 136.112.111.167
- **Backend Port:** 3001
- **Web Port:** 80
- **HSS Port:** 3001

### Directory Structure
```
/opt/gce-backend/          # Backend application
/var/www/html/downloads/   # ISO and file downloads
/opt/base-images/          # Base Ubuntu ISO
/root/lte-pci-mapper/      # Git repository
```

### Management Commands (on GCE)
After running `deploy-all-automated.sh`, these commands are available:

```bash
# Check system status
wisptools-status

# Restart services
wisptools-restart

# View logs
wisptools-logs backend
wisptools-logs nginx

# Follow live logs
journalctl -u wisptools-backend -f
```

---

## 🌐 Access Points

### After Deployment

| Service | URL | Description |
|---------|-----|-------------|
| **Homepage** | http://136.112.111.167/ | System landing page |
| **API Base** | http://136.112.111.167:3001/api/ | Backend API |
| **Health Check** | http://136.112.111.167:3001/health | Service status |
| **ISO Downloads** | http://136.112.111.167/downloads/isos/ | Generated ISOs |
| **Frontend** | https://wisptools.io | Management portal |
| **Firebase** | https://lte-pci-mapper-65450042-bbf71.web.app | Direct Firebase URL |

---

## 📦 What Gets Deployed

### Backend (GCE Server)
- ✅ Node.js backend server (Express)
- ✅ EPC deployment API
- ✅ ISO generation service
- ✅ Distributed EPC management
- ✅ MongoDB database
- ✅ Nginx web server
- ✅ Systemd services

### Frontend (Firebase)
- ✅ Svelte web application
- ✅ HSS Management UI
- ✅ Deploy EPC interface
- ✅ All modules and components
- ✅ Firebase Functions
- ✅ Firestore rules

---

## 🔄 Deployment Workflow

### Standard Workflow (Windows)

1. **Make code changes in Cursor IDE**
   ```powershell
   # Edit files in C:\Users\david\Downloads\PCI_mapper
   ```

2. **Test locally**
   ```powershell
   cd Module_Manager
   npm run dev
   ```

3. **Deploy everything**
   ```powershell
   .\scripts\deployment\Deploy-All.ps1 -Target All
   ```

This automatically:
- ✅ Commits changes to Git
- ✅ Pushes to GitHub
- ✅ Builds frontend
- ✅ Deploys to Firebase
- ✅ Updates GCE server

### Manual Workflow (Linux/Mac)

1. **Deploy frontend**
   ```bash
   bash scripts/deployment/deploy-frontend-updates.sh production
   ```

2. **Deploy backend**
   ```bash
   # SSH to GCE
   ssh root@136.112.111.167
   
   # Pull latest code
   cd /root/lte-pci-mapper
   git pull origin main
   
   # Run deployment
   sudo bash scripts/deployment/deploy-all-automated.sh
   ```

3. **Commit and push**
   ```bash
   git add .
   git commit -m "Deployment update"
   git push origin main
   ```

---

## 🛠️ Troubleshooting

### Backend Not Starting
```bash
# Check logs
wisptools-logs backend

# Or
journalctl -u wisptools-backend -n 50

# Restart service
wisptools-restart
```

### Frontend Build Fails
```bash
# Clear cache
cd Module_Manager
rm -rf node_modules package-lock.json
npm install
npm run build
```

### ISO Generation Fails
```bash
# Check ISO builder
ls -lh /opt/base-images/ubuntu-24.04-live-server-amd64.iso

# Check output directory
ls -lh /var/www/html/downloads/isos/

# Check permissions
sudo chmod -R 755 /var/www/html/downloads/
```

### Can't Access Services
```bash
# Check firewall
sudo ufw status

# Open required ports
sudo ufw allow 80/tcp
sudo ufw allow 3001/tcp

# Check services
systemctl status wisptools-backend
systemctl status nginx
```

---

## 🔐 Security Notes

### Environment Variables
All sensitive data is stored in `.env` files:
- `/opt/gce-backend/.env` (on GCE server)
- `Module_Manager/.env.local` (local development)

Never commit these files to Git!

### Firewall Rules
Ensure these ports are open on GCE:
- **22** - SSH
- **80** - HTTP
- **443** - HTTPS
- **3000** - GenieACS UI
- **3001** - HSS API
- **3868** - Diameter
- **7547** - TR-069

---

## 📊 Monitoring

### Check System Health
```bash
# On GCE server
wisptools-status

# Or via API
curl http://136.112.111.167:3001/health
```

### Monitor Logs
```bash
# Backend logs
tail -f /opt/gce-backend/logs/backend.log

# Nginx access logs
tail -f /var/log/nginx/wisptools-access.log

# System logs
journalctl -u wisptools-backend -f
```

---

## 🎯 Common Tasks

### Add New API Endpoint
1. Add route in `gce-backend/routes/`
2. Update `gce-backend/server.js` to load route
3. Run: `bash scripts/deployment/deploy-all-automated.sh`

### Update Frontend Component
1. Edit component in `Module_Manager/src/routes/modules/`
2. Run: `bash scripts/deployment/deploy-frontend-updates.sh production`

### Change GCE IP Address
1. Run: `bash scripts/deployment/update-gce-ip.sh [NEW_IP]`
2. Commit changes: `git add . && git commit -m "Update IP" && git push`
3. Redeploy: `bash scripts/deployment/deploy-all-automated.sh`

---

## 🚨 Emergency Procedures

### Rollback Frontend
```bash
firebase hosting:rollback
```

### Restore Backend
```bash
# SSH to GCE
ssh root@136.112.111.167

# Pull previous version from Git
cd /root/lte-pci-mapper
git log --oneline
git checkout [PREVIOUS_COMMIT_HASH]

# Redeploy
sudo bash scripts/deployment/deploy-all-automated.sh
```

### Complete System Reset
```bash
# WARNING: This will delete all data!
ssh root@136.112.111.167

# Stop all services
systemctl stop wisptools-backend
systemctl stop nginx
systemctl stop mongodb

# Remove all data
rm -rf /opt/gce-backend
rm -rf /var/www/html/downloads
rm -rf /opt/base-images

# Reinstall
bash scripts/deployment/deploy-all-automated.sh
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] GCE homepage loads: http://136.112.111.167/
- [ ] Health check passes: http://136.112.111.167:3001/health
- [ ] Frontend loads: https://wisptools.io
- [ ] HSS Management module accessible
- [ ] Deploy EPC tab visible
- [ ] ISO generation works
- [ ] No console errors in browser
- [ ] Backend logs show no errors
- [ ] MongoDB connected
- [ ] Nginx serving files

---

## 📞 Support

### Documentation
- Main README: `/README.md`
- Architecture: `/SYSTEM_ARCHITECTURE_DOCUMENTATION.md`
- GCE Setup: `/GCE_ISO_GENERATION_SYSTEM.md`

### Logs Location
- Backend: `/opt/gce-backend/logs/`
- Nginx: `/var/log/nginx/`
- System: `journalctl -u wisptools-backend`

---

**Last Updated:** 2025-10-26  
**System Version:** 2.0  
**GCE IP:** 136.112.111.167

