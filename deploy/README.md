# ACS Platform Deployment Scripts

This directory contains automated deployment scripts for the complete ACS (Auto Configuration Server) platform with GenieACS and Firebase integration.

## 🚀 Quick Start

### Complete Deployment (Recommended)
```bash
npm run deploy:complete
```
This will guide you through deploying GenieACS services, Firebase Functions, and web hosting.

### Individual Deployments
```bash
# Deploy GenieACS services only
npm run deploy:genieacs

# Deploy Firebase Functions only
npm run deploy:functions

# Deploy web hosting only
npm run deploy:hosting
```

## 📋 Prerequisites

### For GenieACS Deployment:
- **Ubuntu/Debian server** with root access
- **SSH access** to the target server
- **4GB+ RAM** and **50GB+ storage**
- **Public IP** with ports 7547, 7557, 7567, 8080 open

### For Firebase Deployment:
- **Firebase CLI** installed (`npm install -g firebase-tools`)
- **Firebase project** configured (`.firebaserc` file)
- **Logged in** to Firebase (`firebase login`)

## 🔧 Available Scripts

### `deploy/genieacs-install.js`
Automated GenieACS installation script that:
- Installs Node.js 18 and MongoDB
- Clones and builds GenieACS
- Creates systemd services for all GenieACS components
- Configures firewall rules
- Tests all services

**Usage:**
```bash
npm run deploy:genieacs
# OR
sudo node deploy/genieacs-install.js
```

### `deploy/firebase-deploy.js`
Firebase Functions deployment script that:
- Checks Firebase CLI and authentication
- Installs function dependencies
- Builds TypeScript functions
- Sets environment variables
- Deploys functions
- Tests deployed functions

**Usage:**
```bash
npm run deploy:functions
# OR
node deploy/firebase-deploy.js
```

### `deploy/complete-deploy.js`
Complete deployment orchestrator that:
- Deploys GenieACS to a remote server
- Deploys Firebase Functions
- Deploys web hosting
- Configures integration between services
- Tests the complete deployment

**Usage:**
```bash
npm run deploy:complete
# OR
node deploy/complete-deploy.js
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CPE Devices   │───▶│   GenieACS       │───▶│    MongoDB      │
│   (TR-069)      │    │   Services       │    │   Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Firebase        │───▶│    Firestore    │
                       │  Functions       │    │   Database      │
                       └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   ACS Module     │
                       │   Web Interface  │
                       └──────────────────┘
```

## 📡 GenieACS Services

| Service | Port | Description | Endpoint |
|---------|------|-------------|----------|
| **CWMP** | 7547 | TR-069 Protocol Server | `/cwmp` |
| **NBI** | 7557 | Northbound Interface API | `/nbi` |
| **FS** | 7567 | File Server | `/fs` |
| **UI** | 8080 | Web Interface | `/` |

## 🔥 Firebase Functions

| Function | Description | Method | Endpoint |
|----------|-------------|--------|----------|
| `initializeSamplePresets` | Initialize sample presets | POST | `/initializeSamplePresets` |
| `getPresets` | Get all presets | GET | `/getPresets` |
| `createPreset` | Create new preset | POST | `/createPreset` |
| `deletePreset` | Delete preset | DELETE | `/deletePreset/{id}` |
| `syncGenieACSDevices` | Sync devices from GenieACS | POST | `/syncGenieACSDevices` |
| `getDeviceParameters` | Get device parameters | GET | `/getDeviceParameters/{id}` |
| `executeDeviceTask` | Execute task on device | POST | `/executeDeviceTask/{id}` |

## 🧪 Testing

### Test Firebase Functions
```bash
# Test presets initialization
npm run test:functions

# Test GenieACS sync
npm run test:sync
```

### Test GenieACS Services
```bash
# Test CWMP service
curl http://your-server-ip:7547

# Test NBI service
curl http://your-server-ip:7557

# Test FS service
curl http://your-server-ip:7567

# Test UI service
curl http://your-server-ip:8080
```

## 🔧 Configuration

### Environment Variables
The deployment scripts automatically set these Firebase Functions environment variables:

```bash
genieacs.nbi_url="http://your-server-ip:7557"
genieacs.ui_url="http://your-server-ip:8080"
genieacs.cwmp_url="http://your-server-ip:7547"
genieacs.fs_url="http://your-server-ip:7567"
```

### Firewall Configuration
The scripts automatically configure UFW to allow these ports:
- **7547/tcp** - GenieACS CWMP
- **7557/tcp** - GenieACS NBI
- **7567/tcp** - GenieACS FS
- **8080/tcp** - GenieACS UI
- **27017/tcp** - MongoDB (optional)

## 📊 Monitoring

### Service Status
```bash
# Check all GenieACS services
sudo systemctl status genieacs-*

# View service logs
sudo journalctl -u genieacs-cwmp -f
sudo journalctl -u genieacs-nbi -f
sudo journalctl -u genieacs-fs -f
sudo journalctl -u genieacs-ui -f
```

### Firebase Functions Logs
```bash
# View function logs
firebase functions:log

# View specific function logs
firebase functions:log --only initializeSamplePresets
```

## 🚨 Troubleshooting

### Common Issues

#### GenieACS Services Won't Start
```bash
# Check service status
sudo systemctl status genieacs-cwmp

# Check logs
sudo journalctl -u genieacs-cwmp -n 50

# Restart service
sudo systemctl restart genieacs-cwmp
```

#### Firebase Functions Deployment Fails
```bash
# Check Firebase CLI
firebase --version

# Check authentication
firebase projects:list

# Check function build
cd functions && npm run build
```

#### CPE Devices Can't Connect
1. Verify firewall rules: `sudo ufw status`
2. Check GenieACS CWMP service: `curl http://server-ip:7547`
3. Verify CPE configuration points to correct server IP
4. Check GenieACS logs: `sudo journalctl -u genieacs-cwmp -f`

### Support Commands

#### Reset Everything
```bash
# Stop all GenieACS services
sudo systemctl stop genieacs-*

# Remove GenieACS
sudo rm -rf /opt/genieacs
sudo rm -f /etc/systemd/system/genieacs-*.service
sudo systemctl daemon-reload

# Reinstall
npm run deploy:genieacs
```

#### Update GenieACS
```bash
# Update GenieACS
cd /opt/genieacs
sudo -u genieacs git pull
sudo -u genieacs npm install
sudo -u genieacs npm run build

# Restart services
sudo systemctl restart genieacs-*
```

## 📚 Documentation

- **Complete Setup Guide**: `../COMPLETE_GENIEACS_SETUP.md`
- **Firebase Bridge**: `../functions/src/genieacsBridge.ts`
- **Configuration**: `./config.json`
- **Shell Script**: `../setup-genieacs-services.sh`

## 🎯 Next Steps After Deployment

1. **Configure CPE Devices** to connect to your GenieACS server
2. **Test Device Connectivity** through the ACS module
3. **Set up Monitoring** and alerts
4. **Configure Backup** schedules
5. **Set up SSL/TLS** certificates for production

---

**Need help?** Check the troubleshooting section above or review the complete setup guide.
