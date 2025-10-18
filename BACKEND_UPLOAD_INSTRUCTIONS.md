# 📤 Backend Module Upload Instructions

## Overview

This guide helps you upload and install the modularized backend files to your Google Compute Engine VM.

---

## 📦 What's in the Zip Files

### `backend-update.zip` Contains:
```
├── distributed-epc-api.js          # Updated monolithic API (current version)
├── distributed-epc-schema.js       # MongoDB schemas
├── distributed-epc/                # NEW - Modular structure (11 files)
│   ├── index.js
│   ├── middleware/auth.js
│   ├── routes/ (4 files)
│   ├── services/metrics-service.js
│   ├── utils/ (2 files)
│   ├── models/index.js
│   └── README.md
├── backend-services/               # Backend services (5 files)
│   ├── email-service.js
│   ├── monitoring-api.js
│   ├── monitoring-schema.js
│   ├── monitoring-service.js
│   └── tenant-email-schema.js
└── deployment-files/               # Remote EPC deployment (2 files)
    ├── open5gs-metrics-agent.js
    └── open5gs-metrics-agent.service
```

---

## 🚀 Step-by-Step Installation

### **Step 1: Upload the Zip File**

From your **PowerShell** terminal:

```powershell
scp backend-update.zip david@136.112.111.167:/home/david/
```

Or use the **Google Cloud Console**:
1. Go to: https://console.cloud.google.com/compute/instances
2. Click **Upload file** in the SSH menu
3. Select `backend-update.zip`
4. Upload to `/home/david/`

---

### **Step 2: Upload the Installation Script**

```powershell
scp install-backend-modules.sh david@136.112.111.167:/home/david/
```

Or copy the script content and paste it in the SSH terminal.

---

### **Step 3: Run the Installation**

SSH into your server and run:

```bash
cd /home/david
chmod +x install-backend-modules.sh
./install-backend-modules.sh
```

---

## ✅ What the Script Does

1. **Checks Prerequisites**
   - Verifies zip file exists
   - Installs `unzip` if needed

2. **Creates Backup**
   - Backs up existing files to `/opt/hss-api/backups/TIMESTAMP/`
   - You can restore from backup if needed

3. **Installs New Files**
   - Extracts zip to temp directory
   - Copies all files to `/opt/hss-api/`
   - Sets proper permissions

4. **Verifies Installation**
   - Checks JavaScript syntax
   - Restores backup if errors detected

5. **Restarts Service**
   - Restarts PM2 service
   - Shows service status
   - Displays recent logs

6. **Cleanup**
   - Removes temp files
   - Removes zip file

---

## 📁 Result on Server

After installation, your server will have:

```
/opt/hss-api/
├── distributed-epc-api.js         # Current monolithic API (still works)
├── distributed-epc-schema.js
├── distributed-epc/               # NEW - Modular API
│   ├── index.js                   # Use this instead of distributed-epc-api.js
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── models/
├── backend-services/              # Additional services
├── deployment-files/              # EPC deployment resources
└── backups/                       # Automatic backups
    └── TIMESTAMP/
```

---

## 🔄 Migration Options

### Option 1: Keep Using Monolithic File (Safest)
The updated `distributed-epc-api.js` already includes:
- ✅ OAuth token for GitHub downloads
- ✅ Enhanced metrics agent
- ✅ Interactive deployment script

**No code changes needed** - just restart PM2.

### Option 2: Migrate to Modular Structure (Recommended for Future)
Update your main server file:

```javascript
// OLD:
const distributedEpcRouter = require('./distributed-epc-api');

// NEW:
const distributedEpcRouter = require('./distributed-epc');
```

**Benefits:**
- ✅ Better organization
- ✅ Easier to maintain
- ✅ Can test individual modules
- ✅ Deploy only changed modules

---

## 🧪 Testing After Installation

### 1. Check Service Status
```bash
pm2 status hss-api
pm2 logs hss-api --lines 50
```

### 2. Test API Endpoints
```bash
# Test health check
curl http://localhost:3000/api/health

# Test EPC list (requires auth)
curl -H "X-Tenant-ID: your-tenant-id" http://localhost:3000/api/epc/list
```

### 3. Test Frontend
1. Register a new EPC in web interface
2. Download deployment script
3. Verify script has:
   - OAuth token for GitHub downloads
   - Interactive IP configuration
   - Enhanced metrics agent

---

## 🔧 Troubleshooting

### If Installation Fails:

```bash
# Restore from backup
sudo cp /opt/hss-api/backups/TIMESTAMP/* /opt/hss-api/
sudo pm2 restart hss-api
```

### If Service Won't Start:

```bash
# Check syntax
node -c /opt/hss-api/distributed-epc-api.js

# Check detailed errors
pm2 logs hss-api --err --lines 100

# Restart PM2 completely
pm2 kill
cd /opt/hss-api
pm2 start distributed-epc-api.js --name hss-api
pm2 save
```

### If Modules Missing:

```bash
# Verify structure
ls -la /opt/hss-api/distributed-epc/
ls -la /opt/hss-api/backend-services/
ls -la /opt/hss-api/deployment-files/

# Re-run installation
cd /home/david
./install-backend-modules.sh
```

---

## 📊 Expected Output

When successful, you should see:

```
🎉 Backend Update Complete!
✅ Files installed to /opt/hss-api/
✅ Backup created in /opt/hss-api/backups/20251017_123456
✅ Service restarted successfully
✅ No errors detected in logs!

📁 New Structure:
   /opt/hss-api/
   ├── distributed-epc-api.js
   ├── distributed-epc/ (11 modules)
   ├── backend-services/ (5 files)
   └── deployment-files/ (2 files)
```

---

## 🎯 What's New

### Enhanced Features:
- ✅ **OAuth Token** - Can download from private GitHub repo
- ✅ **Enhanced Metrics** - CPU, memory, disk, network, subscribers
- ✅ **Interactive Deployment** - Rapid5GS-style script with prompts
- ✅ **Modular Structure** - Easy to maintain and test
- ✅ **Comprehensive Monitoring** - Full system & service metrics

### Deployment Script Features:
- Interactive IP configuration (MME, SGW, SMF, UPF)
- Colored output with progress indicators
- Complete Open5GS EPC stack installation
- Metrics agent with MongoDB integration
- Network monitoring tools (vnstat, sysstat)
- Auto-start systemd services
- Service verification and status checks

---

## 📞 Support

If you encounter issues:
1. Check logs: `pm2 logs hss-api --lines 100`
2. Restore backup: `sudo cp /opt/hss-api/backups/*/distributed-epc-api.js /opt/hss-api/`
3. Review documentation: `/opt/hss-api/distributed-epc/README.md`

---

## ✨ Next Steps

After successful installation:
1. ✅ Register a test EPC
2. ✅ Download and test deployment script
3. ✅ Verify metrics appear in dashboard
4. ✅ (Optional) Migrate to modular structure

---

*Installation script version: 1.0*  
*Created: October 17, 2025*

