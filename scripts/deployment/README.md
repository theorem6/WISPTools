# WISPTools.io Deployment Scripts

Automated deployment scripts for the complete WISPTools.io system.

## 🎯 Quick Commands

### 🖥️ Complete GCE Setup (One Command)
```bash
ssh root@136.112.111.167
curl -fsSL https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/scripts/deployment/deploy-all-automated.sh | sudo bash
```

### 🌐 Deploy Frontend (One Command)
```bash
bash scripts/deployment/deploy-frontend-updates.sh production
```

### 🪟 Windows Deployment (One Command)
```powershell
.\scripts\deployment\Deploy-All.ps1 -Target All
```

---

## 📁 Available Scripts

| Script | Purpose | Platform | Time |
|--------|---------|----------|------|
| `deploy-all-automated.sh` | Complete GCE system setup | Linux | 10-15 min |
| `deploy-frontend-updates.sh` | Frontend to Firebase | Linux/Mac | 5-10 min |
| `Deploy-All.ps1` | Complete deployment | Windows | Varies |
| `update-gce-ip.sh` | Update IP address | Linux/Mac | <1 min |
| `deploy-gce-iso-builder.sh` | ISO builder only | Linux | 5 min |
| `build-minimal-iso.sh` | Build single ISO | Linux | 2 min |
| `wisptools-register.sh` | EPC auto-registration | Linux | <1 min |
| `cloud-init-autoinstall.yaml` | Unattended Ubuntu install | Linux | N/A |

---

## 🚀 Usage Examples

### Complete System Deployment

**On Windows (Cursor IDE):**
```powershell
# Deploy everything (frontend + backend)
.\scripts\deployment\Deploy-All.ps1 -Target All

# Local development only
.\scripts\deployment\Deploy-All.ps1 -Target Local

# Frontend only
.\scripts\deployment\Deploy-All.ps1 -Target Frontend

# GCE backend only
.\scripts\deployment\Deploy-All.ps1 -Target GCE
```

**On Linux/Mac:**
```bash
# Deploy frontend
bash scripts/deployment/deploy-frontend-updates.sh production

# SSH to GCE and deploy backend
ssh root@136.112.111.167
cd /root/lte-pci-mapper
git pull
sudo bash scripts/deployment/deploy-all-automated.sh
```

### Update Configuration

**Change GCE IP Address:**
```bash
# View current IP (136.112.111.167)
bash scripts/deployment/update-gce-ip.sh

# Change to new IP
bash scripts/deployment/update-gce-ip.sh 192.168.1.100
```

### Build Custom ISO

**On GCE Server:**
```bash
# Build ISO for specific tenant and EPC
sudo bash scripts/deployment/build-minimal-iso.sh \
  tenant_12345 \
  epc_67890 \
  /tmp/epc_creds.env \
  /var/www/html/downloads/isos/custom-epc.iso \
  /opt/base-images/ubuntu-24.04-live-server-amd64.iso
```

---

## 🔧 What Each Script Does

### 1. `deploy-all-automated.sh`
**Complete GCE System Setup**

Installs and configures:
- ✅ System packages (Node.js, MongoDB, Nginx)
- ✅ Backend services (Express API, EPC management)
- ✅ ISO builder with base Ubuntu image
- ✅ Systemd services (auto-start on boot)
- ✅ Firewall rules (UFW)
- ✅ Management commands (`wisptools-status`, `wisptools-restart`, `wisptools-logs`)
- ✅ Web interface at http://136.112.111.167/

**Prerequisites:**
- Ubuntu 24.04 LTS
- Root access
- Internet connection

**Output:**
- Backend running on port 3001
- Web server on port 80
- ISOs served from /var/www/html/downloads/isos/

---

### 2. `deploy-frontend-updates.sh`
**Frontend Deployment to Firebase**

Performs:
- ✅ Dependency installation
- ✅ Production build
- ✅ Firebase Hosting deployment
- ✅ Firebase Functions deployment
- ✅ Firestore rules deployment

**Prerequisites:**
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase login (`firebase login`)

**Environments:**
- `production` - https://wisptools.io
- `staging` - https://staging.wisptools.io
- `development` - https://dev.wisptools.io

---

### 3. `Deploy-All.ps1`
**Windows PowerShell Automation**

Supports:
- ✅ Local development setup
- ✅ Frontend build and deploy
- ✅ GCE backend deployment via SSH
- ✅ Automatic Git commit and push

**Prerequisites:**
- PowerShell 5.1+
- Node.js
- Git
- Firebase CLI (for frontend)
- SSH client (for GCE)

**Parameters:**
- `-Target` - Local, Frontend, GCE, or All
- `-GceIp` - GCE server IP (default: 136.112.111.167)
- `-SshUser` - SSH user (default: root)

---

### 4. `update-gce-ip.sh`
**Update IP Address Configuration**

Updates IP in:
- ✅ `gce-backend/routes/epc-deployment.js`
- ✅ `Module_Manager/src/routes/modules/hss-management/components/DeployEPC.svelte`
- ✅ `distributed-epc/utils/script-generator.js`
- ✅ `scripts/deployment/deploy-gce-iso-builder.sh`
- ✅ `scripts/deployment/deploy-all-automated.sh`
- ✅ Environment files (`.env`)
- ✅ Systemd services

**Usage:**
```bash
# No change (just verify)
bash scripts/deployment/update-gce-ip.sh

# Update to new IP
bash scripts/deployment/update-gce-ip.sh 192.168.1.100
```

---

### 5. `deploy-gce-iso-builder.sh`
**ISO Builder Setup Only**

Specialized setup for ISO generation:
- ✅ Installs `xorriso`, `p7zip-full`, `isolinux`
- ✅ Downloads base Ubuntu 24.04 ISO
- ✅ Creates ISO build directories
- ✅ Configures Nginx for ISO serving
- ✅ Sets up Node.js backend for ISO generation

**Use case:** Standalone ISO builder without full backend

---

### 6. `build-minimal-iso.sh`
**Build Single Custom ISO**

Creates a bootable Ubuntu ISO with:
- ✅ Embedded tenant ID
- ✅ EPC credentials
- ✅ Cloud-init autoinstall
- ✅ Auto-registration script
- ✅ DHCP network config

**Called by:** Backend API endpoint `/api/epc/:id/generate-iso`

---

### 7. `wisptools-register.sh`
**EPC Auto-Registration**

Runs on first boot of deployed EPC:
- ✅ Collects hardware info (CPU, RAM, disk)
- ✅ Collects network info (MAC, IP, interfaces)
- ✅ Collects OS info (version, kernel)
- ✅ POSTs to `/api/epc/auto-register`
- ✅ Receives deployment script
- ✅ Executes full Open5GS deployment

**Executed by:** `wisptools-register.service` (systemd)

---

## 🌍 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer (Windows)                       │
│                  Cursor IDE + PowerShell                     │
│                                                              │
│  .\Deploy-All.ps1 -Target All                               │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│   GitHub      │       │   Firebase    │
│   Repository  │       │   Hosting     │
│               │       │               │
│   Main Branch │       │   wisptools.io│
└───────┬───────┘       └───────────────┘
        │                       │
        │ git pull              │ HTTPS
        │                       │
        ▼                       ▼
┌───────────────────────────────────────┐
│       GCE Server (136.112.111.167)    │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ Backend API (Port 3001)         │ │
│  │  - EPC Management               │ │
│  │  - ISO Generation               │ │
│  │  - Auto-Registration            │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ Nginx Web Server (Port 80)      │ │
│  │  - ISO Downloads                │ │
│  │  - Static Files                 │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ MongoDB                         │ │
│  │  - EPC Database                 │ │
│  │  - Metrics Storage              │ │
│  └─────────────────────────────────┘ │
└───────────────┬───────────────────────┘
                │
                │ Download ISO
                │
                ▼
┌───────────────────────────────────────┐
│       Remote EPC Site                 │
│                                       │
│  1. Boot from ISO                     │
│  2. Auto-install Ubuntu               │
│  3. Run wisptools-register.sh         │
│  4. Download deployment script        │
│  5. Install Open5GS                   │
│  6. Connect to Cloud HSS              │
│  7. Start metrics reporting           │
└───────────────────────────────────────┘
```

---

## 📊 Deployment Flow

### Full Deployment Sequence

1. **Developer makes changes** (Windows/Cursor)
   ```
   Edit code → Test locally → Ready to deploy
   ```

2. **Run automated deployment**
   ```powershell
   .\Deploy-All.ps1 -Target All
   ```

3. **Script performs:**
   ```
   a. Git commit and push to GitHub
   b. Build frontend (npm run build)
   c. Deploy to Firebase Hosting
   d. SSH to GCE server
   e. Pull latest code from GitHub
   f. Install/update dependencies
   g. Restart backend services
   h. Verify deployment
   ```

4. **System is live:**
   ```
   Frontend: https://wisptools.io
   Backend:  http://136.112.111.167:3001
   ```

---

## 🔍 Verification

### After Deployment, Check:

**Frontend:**
```bash
# Open browser
https://wisptools.io

# Check console (F12) for errors
# Verify HSS Management → Deploy EPC tab exists
```

**Backend:**
```bash
# Health check
curl http://136.112.111.167:3001/health

# Check services
ssh root@136.112.111.167
wisptools-status
```

**ISOs:**
```bash
# List generated ISOs
curl http://136.112.111.167/downloads/isos/

# Or SSH
ssh root@136.112.111.167
ls -lh /var/www/html/downloads/isos/
```

---

## 🐛 Troubleshooting

### Common Issues

**"Permission denied" on GCE:**
```bash
# Fix script permissions
sudo chmod +x scripts/deployment/*.sh
```

**"Firebase login required":**
```bash
firebase login
# Follow browser prompts
```

**"Port 3001 already in use":**
```bash
# On GCE
sudo systemctl stop wisptools-backend
sudo lsof -ti:3001 | xargs kill -9
sudo systemctl start wisptools-backend
```

**"ISO generation fails":**
```bash
# Check base ISO exists
ls -lh /opt/base-images/ubuntu-24.04-live-server-amd64.iso

# If missing, download
sudo mkdir -p /opt/base-images
cd /opt/base-images
sudo wget https://releases.ubuntu.com/24.04/ubuntu-24.04-live-server-amd64.iso
```

**"Can't connect to GCE from Windows:"**
```powershell
# Test SSH connection
ssh root@136.112.111.167 "echo 'Connection OK'"

# If fails, check SSH key
ssh-keygen -t rsa -b 4096
# Add public key to GCE: ~/.ssh/authorized_keys
```

---

## 📚 Documentation

- **Main Guide:** [DEPLOYMENT_AUTOMATION_GUIDE.md](./DEPLOYMENT_AUTOMATION_GUIDE.md)
- **ISO System:** `/GCE_ISO_GENERATION_SYSTEM.md`
- **Architecture:** `/SYSTEM_ARCHITECTURE_DOCUMENTATION.md`
- **Backend Docs:** `/BACKEND_API_DOCUMENTATION.md`

---

## 🔐 Security

### Credentials Management

**Never commit:**
- `.env` files
- SSH private keys
- API keys
- Database passwords

**Required secrets:**
- GCE: `/opt/gce-backend/.env`
- Local: `Module_Manager/.env.local`
- Firebase: Environment variables in Cloud Functions

### Firewall Ports

**Must be open on GCE:**
- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS)
- 3000 (GenieACS)
- 3001 (HSS API)
- 3868 (Diameter)

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] Test locally (`npm run dev`)
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] No linter warnings
- [ ] Git status clean
- [ ] All tests pass
- [ ] Backend health check passes
- [ ] ISOs generate successfully
- [ ] Documentation updated
- [ ] Changelog updated

---

## 📞 Support

**Issues:** https://github.com/theorem6/lte-pci-mapper/issues  
**Email:** support@wisptools.io  
**Docs:** https://wisptools.io/docs

---

## 📝 Change Log

### Version 2.0 (2025-10-26)
- ✅ Complete automation scripts
- ✅ One-command GCE setup
- ✅ Windows PowerShell support
- ✅ Automated IP configuration
- ✅ Frontend deployment automation
- ✅ ISO generation system
- ✅ Auto-registration for EPCs

### Version 1.0 (2025-10-01)
- Initial manual deployment
- Basic scripts

---

**GCE IP:** 136.112.111.167  
**Last Updated:** 2025-10-26  
**Maintained By:** WISPTools.io Team

