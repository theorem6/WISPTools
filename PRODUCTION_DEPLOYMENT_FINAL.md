# 🚀 Production Deployment - GenieACS + rapid5gs HSS

## ✅ Clean Production Solution

**Creates**: New Ubuntu 24.04 VM with GenieACS + rapid5gs HSS  
**MongoDB**: Cloud Atlas (no local MongoDB)  
**Deployment**: One command from Firebase Studio

---

## 🎯 **One Command Deployment**

```bash
chmod +x deploy-production-now.sh && ./deploy-production-now.sh
```

This will:
1. ✅ Create new GCE VM: `acs-hss-server` (Ubuntu 24.04)
2. ✅ Install GenieACS (ports 7547, 7557, 3333)
3. ✅ Install rapid5gs Open5GS HSS (port 3868)
4. ✅ Configure cloud MongoDB Atlas connection
5. ✅ Start all services

**Time**: ~10 minutes  
**Result**: Production ACS + HSS server ready for MME connections

---

## 📊 **What You Get**

### **New VM Specs:**
- Name: `acs-hss-server`
- Zone: `us-central1-a`
- OS: Ubuntu 24.04 LTS (rapid5gs requirement)
- Machine: e2-standard-4 (4 vCPU, 16GB RAM)
- Disk: 50GB

### **Services Installed:**

**GenieACS (ACS/TR-069)**:
- Port 7547: CWMP (CPE connections)
- Port 7557: NBI API
- Port 3333: Web UI
- Database: Cloud MongoDB Atlas

**rapid5gs HSS (Authentication)**:
- Port 3868: S6a/Diameter (MME connections)
- Database: Cloud MongoDB Atlas
- Production C daemon (open5gs-hssd)

---

## 🌐 **Access Your Services**

After deployment, get IP from:  
https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71

**Your services:**
```
HSS S6a (MME):        YOUR_IP:3868
GenieACS CWMP:        http://YOUR_IP:7547
GenieACS API:         http://YOUR_IP:7557
GenieACS UI:          http://YOUR_IP:3333
```

---

## 📝 **Prerequisites** (Should already be done)

- ✅ MongoDB URI secret in Secret Manager
- ✅ Cloud Build permissions granted
- ✅ Compute Engine API enabled

---

## 🔧 **After Deployment**

### **Configure Remote MME:**
```
HSS Address: YOUR_EXTERNAL_IP
HSS Port: 3868
HSS Realm: lte-pci-mapper.com
HSS Identity: hss.lte-pci-mapper.com
```

### **Add Subscribers:**

SSH to server:
```bash
gcloud compute ssh acs-hss-server --zone=us-central1-a
```

Use Open5GS tools:
```bash
# Add subscriber
open5gs-dbctl add 001010123456789 00112233445566778899AABBCCDDEEFF 63BFA50EE6523365FF14C1F45F88737D

# Or use web UI at http://YOUR_IP:3333
```

---

## 📊 **Monitor Deployment**

https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71

Watch for:
- Creating VM
- Installing software  
- Configuring services
- Starting daemons

---

## ✅ **Files Created**

- `deploy-acs-hss-production.yaml` - Cloud Build configuration
- `deploy-production-now.sh` - One-command runner
- **Removed**: All failed attempt scripts (8 files cleaned up)

---

**Ready to deploy?** Run: `./deploy-production-now.sh` 🚀


