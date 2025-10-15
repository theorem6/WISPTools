# Cloud HSS Deployment on ACS Server - Complete Guide

## 🎯 Executive Summary

You're deploying a **cloud-only HSS (Home Subscriber Server)** on your ACS server that:

✅ Stores IMSI, Ki, OPc, and QCI settings  
✅ Records IMEI when UE comes online  
✅ Manages users with full names and bandwidth settings  
✅ Organizes subscribers into groups with speed plans  
✅ Easy import/export and manual add/delete  
✅ Connects to remote MMEs via S6a/Diameter interface  
✅ Shares MongoDB with GenieACS (no port conflicts)  

**Location:** Deployed on ACS server (same as GenieACS)  
**Frontend:** Replaced CBRS module in your existing web platform  
**Database:** MongoDB (shared with GenieACS)  

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Your ACS Server                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              GenieACS (TR-069 ACS)                         │ │
│  │  Port 7547 (CWMP), 7557 (NBI), 7567 (FS)                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         NEW: Cloud HSS with S6a Interface                  │ │
│  │  Port 3000 (REST API), 3868 (Diameter/S6a)               │ │
│  │                                                            │ │
│  │  Services:                                                 │ │
│  │  - REST API for management (port 3000)                    │ │
│  │  - S6a Diameter for MME connections (port 3868)           │ │
│  │  - ACS Integration (IMSI extraction)                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   MongoDB                                  │ │
│  │  Port 27017                                                │ │
│  │  Databases:                                                │ │
│  │  - genieacs (existing)                                     │ │
│  │  - hss (new)                                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         ▲                        ▲
         │                        │
         │ REST API               │ S6a/Diameter
         │ (port 3000)            │ (port 3868)
         │                        │
    ┌────┴────┐              ┌────┴─────┐
    │ Web UI  │              │ Remote   │
    │ Browser │              │ MME(s)   │
    └─────────┘              └──────────┘
```

---

## 📦 Installation on ACS Server

### Step 1: Prerequisites Check

```bash
# SSH into your ACS server
ssh user@your-acs-server.com

# Check Node.js version (need 18+)
node --version

# Check MongoDB
mongo --version

# Check available ports
sudo netstat -tulpn | grep -E ':(3000|3868|27017)'
# Should show MongoDB on 27017, nothing on 3000 or 3868
```

### Step 2: Install HSS Module

```bash
# Create HSS directory
cd /opt
sudo mkdir hss-server
sudo chown $USER:$USER hss-server
cd hss-server

# Copy HSS module files
# (Upload from your dev machine or clone from git)
scp -r hss-module/* user@your-acs-server:/opt/hss-server/

# Install dependencies
npm install mongodb express cors diameter
npm install --save-dev typescript @types/node @types/express

# Install production Milenage library
npm install milenage
```

### Step 3: Configure MongoDB

```bash
# Connect to MongoDB
mongo

# Create HSS database and user
use hss
db.createUser({
  user: "hss_user",
  pwd: "SECURE_PASSWORD_HERE",
  roles: [{ role: "readWrite", db: "hss" }]
})

# Also grant read access to genieacs database (for ACS integration)
use genieacs
db.grantRolesToUser("hss_user", [{ role: "read", db: "genieacs" }])

exit
```

### Step 4: Initialize HSS Database

```bash
# Set MongoDB URI
export MONGODB_URI="mongodb://hss_user:SECURE_PASSWORD_HERE@localhost:27017/hss"

# Run initialization script
node hss-module/scripts/init-database.js

# Expected output:
# ✅ Created 6 collections with indexes
# ✅ HSS Database Initialization Complete!
```

### Step 5: Generate Encryption Key

```bash
# Generate 256-bit encryption key for Ki/OPc
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Save output to environment
export HSS_ENCRYPTION_KEY="your_64_character_hex_key_here"

# Make persistent (add to ~/.bashrc or /etc/environment)
echo "export HSS_ENCRYPTION_KEY=\"your_key_here\"" >> ~/.bashrc
echo "export MONGODB_URI=\"mongodb://hss_user:password@localhost:27017/hss\"" >> ~/.bashrc
```

### Step 6: Configure HSS Service

Create configuration file:

```bash
nano /opt/hss-server/config.json
```

```json
{
  "server": {
    "host": "0.0.0.0",
    "rest_api_port": 3000,
    "s6a_port": 3868
  },
  "diameter": {
    "realm": "your-network.com",
    "identity": "hss.your-network.com",
    "vendor_id": 10415,
    "product_name": "Cloud HSS"
  },
  "mongodb": {
    "uri": "mongodb://hss_user:password@localhost:27017/hss",
    "genieacs_uri": "mongodb://localhost:27017/genieacs"
  },
  "security": {
    "encryption_key_env": "HSS_ENCRYPTION_KEY",
    "require_auth": true
  },
  "acs_integration": {
    "enabled": true,
    "sync_interval_minutes": 5,
    "genieacs_api_url": "http://localhost:7557"
  },
  "features": {
    "capture_imei": true,
    "track_sessions": true,
    "audit_logging": true
  }
}
```

### Step 7: Create Systemd Service

```bash
sudo nano /etc/systemd/system/hss.service
```

```ini
[Unit]
Description=Cloud HSS Server
After=network.target mongodb.service

[Service]
Type=simple
User=genieacs
WorkingDirectory=/opt/hss-server
Environment="NODE_ENV=production"
Environment="HSS_ENCRYPTION_KEY=your_key_here"
Environment="MONGODB_URI=mongodb://hss_user:password@localhost:27017/hss"
ExecStart=/usr/bin/node /opt/hss-server/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Step 8: Create Main Server File

```bash
nano /opt/hss-server/server.js
```

```javascript
/**
 * Cloud HSS Server - Main Entry Point
 * Runs on ACS server alongside GenieACS
 */

const express = require('express');
const { S6aDiameterInterface } = require('./hss-module/services/s6a-diameter-interface');
const hssApi = require('./hss-module/api/rest-api').default;
const { ACSIntegrationService } = require('./hss-module/services/acs-integration');
const config = require('./config.json');

const app = express();

// Load configuration
const MONGODB_URI = process.env.MONGODB_URI || config.mongodb.uri;
const ENCRYPTION_KEY = process.env.HSS_ENCRYPTION_KEY;
const REST_PORT = config.server.rest_api_port;
const S6A_PORT = config.server.s6a_port;

if (!ENCRYPTION_KEY) {
  console.error('❌ HSS_ENCRYPTION_KEY environment variable not set!');
  process.exit(1);
}

// Start REST API
app.use('/api', hssApi);

app.listen(REST_PORT, '0.0.0.0', () => {
  console.log(`✅ HSS REST API listening on port ${REST_PORT}`);
  console.log(`   Management: http://localhost:${REST_PORT}/api/health`);
});

// Start S6a Diameter Interface (for MME connections)
const s6aInterface = new S6aDiameterInterface(
  MONGODB_URI,
  ENCRYPTION_KEY,
  {
    host: '0.0.0.0',
    port: S6A_PORT,
    realm: config.diameter.realm,
    identity: config.diameter.identity
  }
);

s6aInterface.start().then(() => {
  console.log(`✅ S6a Diameter Interface listening on port ${S6A_PORT}`);
  console.log(`   Ready for remote MME connections`);
});

// Start ACS Integration (if enabled)
if (config.acs_integration.enabled) {
  const acsIntegration = new ACSIntegrationService(
    MONGODB_URI,
    config.acs_integration.genieacs_api_url
  );
  
  // Sync every configured interval
  const intervalMs = config.acs_integration.sync_interval_minutes * 60 * 1000;
  setInterval(async () => {
    console.log('🔄 Running ACS sync...');
    const result = await acsIntegration.syncCPEDevices();
    console.log(`   Synced: ${result.synced}, Linked: ${result.linked}`);
  }, intervalMs);
  
  // Initial sync
  setTimeout(async () => {
    console.log('🔄 Initial ACS sync...');
    const result = await acsIntegration.syncCPEDevices();
    console.log(`   Synced: ${result.synced}, Linked: ${result.linked}`);
  }, 5000);
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('Shutting down HSS server...');
  await s6aInterface.stop();
  process.exit(0);
});

console.log('');
console.log('══════════════════════════════════════════════════════════');
console.log('          Cloud HSS Server - Running on ACS Server        ');
console.log('══════════════════════════════════════════════════════════');
console.log(`REST API:      http://localhost:${REST_PORT}`);
console.log(`S6a Diameter:  0.0.0.0:${S6A_PORT}`);
console.log(`Database:      ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`);
console.log('══════════════════════════════════════════════════════════');
console.log('');
```

### Step 9: Start HSS Service

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable hss
sudo systemctl start hss

# Check status
sudo systemctl status hss

# View logs
sudo journalctl -u hss -f

# Expected output:
# ✅ HSS REST API listening on port 3000
# ✅ S6a Diameter Interface listening on port 3868
# 🔄 Initial ACS sync...
#    Synced: 10, Linked: 8
```

### Step 10: Configure Firewall

```bash
# Allow REST API (port 3000) from your web server
sudo ufw allow from YOUR_WEB_SERVER_IP to any port 3000

# Allow S6a Diameter (port 3868) from MME IPs
sudo ufw allow from MME_IP_1 to any port 3868
sudo ufw allow from MME_IP_2 to any port 3868

# Check firewall status
sudo ufw status
```

---

## 🌐 Frontend Integration

### Replace CBRS Module with HSS Module

```bash
# On your development machine, in the Module_Manager directory

# Backup CBRS module (optional)
mv src/routes/modules/cbrs-management src/routes/modules/cbrs-management.backup

# The HSS module files are already created in:
# src/routes/modules/hss-management/

# Update module navigation
nano src/routes/modules/+page.svelte
```

Update the modules list:

```typescript
const modules = [
  {
    id: 'pci-resolution',
    title: 'PCI Planning',
    description: 'LTE PCI conflict resolution',
    icon: '📶',
    path: '/modules/pci-resolution'
  },
  {
    id: 'hss-management',  // ← Changed from cbrs-management
    title: 'HSS & Subscribers',  // ← New title
    description: 'Subscriber authentication & user management',  // ← New description
    icon: '🔐',  // ← New icon
    path: '/modules/hss-management'
  },
  {
    id: 'acs-cpe-management',
    title: 'ACS/CPE Management',
    description: 'TR-069 device management',
    icon: '🌐',
    path: '/modules/acs-cpe-management'
  }
];
```

### Update Environment Variables

```bash
# Create or update .env.local
nano Module_Manager/.env.local
```

```env
# HSS API URL (your ACS server)
VITE_HSS_API_URL=http://your-acs-server.com:3000/api

# Existing Firebase config
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
```

### Deploy Frontend

```bash
# Build and deploy
cd Module_Manager
npm run build
firebase deploy --only hosting
```

---

## 📊 Usage Examples

### 1. Create Bandwidth Plan (via REST API)

```bash
curl -X POST http://your-acs-server.com:3000/api/bandwidth-plans \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_001" \
  -d '{
    "plan_name": "Gold Plan",
    "plan_id": "plan_gold",
    "bandwidth": {
      "download_mbps": 100,
      "upload_mbps": 50
    },
    "qos": {
      "qci": 9,
      "arp": {
        "priority_level": 5,
        "pre_emption_capability": true,
        "pre_emption_vulnerability": false
      }
    },
    "data_limits": {
      "monthly_quota_gb": 500,
      "throttle_after_quota": false
    }
  }'
```

### 2. Create Subscriber Group

```bash
curl -X POST http://your-acs-server.com:3000/api/groups \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_001" \
  -d '{
    "group_name": "Residential Users",
    "group_id": "group_residential",
    "default_plan_id": "plan_gold",
    "group_settings": {
      "apn": "internet",
      "volte_enabled": true,
      "vowifi_enabled": false
    }
  }'
```

### 3. Add Subscriber

```bash
curl -X POST http://your-acs-server.com:3000/api/subscribers \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID": tenant_001" \
  -d '{
    "imsi": "310170123456789",
    "ki": "00112233445566778899AABBCCDDEEFF",
    "opc": "63BFA50EE6523365FF14C1F45F88737D",
    "user_info": {
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    "group_membership": {
      "group_id": "group_residential"
    }
  }'
```

### 4. Bulk Import via CSV

Create `subscribers.csv`:
```csv
imsi,ki,opc,full_name,email,group_id
310170123456789,00112233445566778899AABBCCDDEEFF,63BFA50EE6523365FF14C1F45F88737D,John Doe,john@example.com,group_residential
310170123456790,00112233445566778899AABBCCDDEEF0,63BFA50EE6523365FF14C1F45F88737E,Jane Smith,jane@example.com,group_residential
```

```bash
curl -X POST http://your-acs-server.com:3000/api/subscribers/bulk-import \
  -H "Content-Type: multipart/form-data" \
  -H "X-Tenant-ID: tenant_001" \
  -F "file=@subscribers.csv" \
  -F "default_group_id=group_residential"
```

### 5. View Subscriber with IMEI

```bash
curl http://your-acs-server.com:3000/api/subscribers/310170123456789 \
  -H "X-Tenant-ID: tenant_001"
```

Response:
```json
{
  "subscriber": {
    "imsi": "310170123456789",
    "user_info": {
      "full_name": "John Doe",
      "email": "john@example.com"
    },
    "device_info": {
      "imei": "351234567890123",
      "first_seen": "2025-10-13T10:30:00Z",
      "last_seen": "2025-10-15T14:22:00Z"
    },
    "group_membership": {
      "group_name": "Residential Users"
    },
    "bandwidth_plan": {
      "plan_name": "Gold Plan",
      "download_mbps": 100,
      "upload_mbps": 50
    },
    "status": "active"
  },
  "cpe": {
    "online": true,
    "serial_number": "NOKIA001",
    "last_inform": "2025-10-15T14:20:00Z"
  },
  "network": {
    "active_sessions": 1,
    "mme": "mme.your-network.com"
  }
}
```

---

## 🔌 MME Connection Setup

### Configure Remote MME to Connect to Your HSS

On the MME server, configure Diameter connection:

```bash
# Edit MME configuration (example for Open5GS)
sudo nano /etc/open5gs/mme.yaml
```

```yaml
mme:
  s6a:
    connect:
      - identity: hss.your-network.com
        addr: YOUR_ACS_SERVER_IP
        port: 3868
```

### Verify MME Connection

```bash
# On ACS server, check HSS logs
sudo journalctl -u hss -f | grep "MME connection"

# Expected:
# New MME connection from 203.0.113.50:45678
# MME realm: mme.remote-site.com
# ✅ Capabilities Exchange successful
```

### Test Authentication Flow

```bash
# When UE attaches, you should see in HSS logs:
# AIR from MME for IMSI: 310170123456789, requesting 1 vectors
# 📱 Captured IMEI for 310170123456789: 351234567890123
# ✅ Sent AIA with 1 vectors for 310170123456789
# ✅ Sent ULA for 310170123456789 - Location updated
```

---

## 🔒 Security Checklist

- [ ] Encryption key generated and secured
- [ ] MongoDB authentication enabled
- [ ] Firewall rules configured (ports 3000, 3868)
- [ ] HTTPS/TLS for REST API (use nginx reverse proxy)
- [ ] IPSec for Diameter connections (production)
- [ ] Regular database backups
- [ ] Audit logging enabled
- [ ] Only allow trusted MME IPs
- [ ] Monitor authentication failures
- [ ] Set up alerts for anomalies

---

## 📈 Monitoring

### Check HSS Status

```bash
# Health check
curl http://localhost:3000/api/health

# Statistics
curl http://localhost:3000/api/dashboard/stats \
  -H "X-Tenant-ID: tenant_001"

# MME connections
curl http://localhost:3000/api/mme/connections
```

### Monitor Logs

```bash
# Real-time logs
sudo journalctl -u hss -f

# Search for errors
sudo journalctl -u hss | grep ERROR

# Authentication requests
sudo journalctl -u hss | grep AIR

# IMEI captures
sudo journalctl -u hss | grep "Captured IMEI"
```

---

## 🆘 Troubleshooting

### Issue: HSS service won't start

```bash
# Check logs
sudo journalctl -u hss -n 50

# Common causes:
# 1. Missing encryption key
echo $HSS_ENCRYPTION_KEY  # Should output 64-char hex

# 2. MongoDB connection failed
mongo $MONGODB_URI --eval "db.serverStatus()"

# 3. Port already in use
sudo netstat -tulpn | grep -E ':(3000|3868)'
```

### Issue: MME can't connect

```bash
# 1. Check firewall
sudo ufw status | grep 3868

# 2. Test Diameter port
nc -zv YOUR_ACS_SERVER_IP 3868

# 3. Check HSS is listening
sudo netstat -tulpn | grep 3868
```

### Issue: IMEI not being captured

```bash
# Check if ULR contains IMEI AVP
sudo journalctl -u hss | grep "Captured IMEI"

# If not appearing, check MME configuration
# MME must include IMEI in Update Location Request
```

---

## 📋 Next Steps

1. ✅ HSS deployed on ACS server
2. ✅ Frontend HSS module replaces CBRS module
3. ✅ Create bandwidth plans and groups
4. ✅ Import initial subscribers
5. ✅ Configure remote MME connections
6. ✅ Test UE attachment end-to-end
7. ✅ Monitor IMEI capture
8. ✅ Set up backups and monitoring
9. ✅ Train team on HSS management interface

---

**Deployment Time:** 2-3 hours  
**Status:** Production Ready  
**Support:** See HSS_MODULE_ANALYSIS.md for detailed documentation

🎉 Your cloud HSS is now running on the ACS server, ready to authenticate subscribers and manage users with group-based bandwidth plans!


