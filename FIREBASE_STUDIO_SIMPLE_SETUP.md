# 🚀 Firebase Studio Setup - Add HSS to Existing ACS Server

## ✅ Simple Setup (Uses Your Existing GCE Instance)

**Your existing instance**: `genieacs-backend` (already running ACS)  
**What we're adding**: HSS module on the same server  
**Method**: Automated via Firebase Studio (no CLI needed)

---

## 📋 Setup Steps (15 minutes, all in browser)

### **1. Create Secrets** (5 minutes)

**URL**: https://console.cloud.google.com/security/secret-manager?project=lte-pci-mapper-65450042-bbf71

**Secret #1: mongodb-uri**
1. Click **"+ CREATE SECRET"**
2. Name: `mongodb-uri`
3. Secret value:
   ```
   mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
4. Click **"CREATE SECRET"**

**Secret #2: hss-encryption-key**
1. Open new tab: https://www.random.org/cgi-bin/randbyte?nbytes=32&format=h
2. Copy the 64-character hex output
3. Back in Secret Manager, click **"+ CREATE SECRET"**
4. Name: `hss-encryption-key`
5. Paste the hex value
6. Click **"CREATE SECRET"**

### **2. Create Cloud Build Trigger** (5 minutes)

**URL**: https://console.cloud.google.com/cloud-build/triggers?project=lte-pci-mapper-65450042-bbf71

1. Click **"CREATE TRIGGER"**
2. **Name**: `add-hss-to-existing-server`
3. **Event**: Push to a branch
4. **Source**:
   - Repository: **theorem6/lte-pci-mapper** (1st gen)
   - Branch: `^main$`
5. **Configuration**:
   - Type: **Cloud Build configuration file (yaml or json)**
   - Location: `firebase-automation/add-hss-to-existing-gce.yaml` ⭐
6. Click **"CREATE"**

### **3. Deploy!** (1 click)

Still on triggers page, click **"RUN"** next to `add-hss-to-existing-server`

### **4. Monitor** (3-5 minutes)

Automatically redirects to build page, or go to:  
https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71

Watch the progress:
- ✅ Verify existing instance
- ✅ Add HSS firewall rules
- ✅ Package HSS module
- ✅ Upload to Cloud Storage
- ✅ Deploy to existing GCE instance
- ✅ Configure Nginx routes

### **5. Get Your IP** (1 minute)

**URL**: https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71

- Find `genieacs-backend`
- Copy **External IP** (example: `35.222.123.45`)

### **6. Test!** (1 minute)

Open in browser (replace XX.XX.XX.XX with your IP):

- **Health**: http://XX.XX.XX.XX/health
- **HSS API**: http://XX.XX.XX.XX/api/hss/health

Should see: `{"status": "healthy", ...}`

---

## ✅ What Just Happened

Your existing `genieacs-backend` instance now has:

```
Existing Services (unchanged):
  ✅ GenieACS CWMP (port 7547)
  ✅ GenieACS NBI (port 7557)
  ✅ GenieACS FS (port 7567)
  ✅ GenieACS UI (port 3333)
  ✅ Any existing backend API

NEW Services (just added):
  ✅ HSS REST API (port 3000)
  ✅ HSS S6a/Diameter (port 3868)
  ✅ Updated Nginx config with HSS routes
```

**No conflicts!** All services run on different ports.

---

## 🌐 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **HSS API** | http://EXTERNAL_IP/api/hss/ | Subscriber management |
| **HSS S6a** | EXTERNAL_IP:3868 | MME connections |
| **GenieACS NBI** | http://EXTERNAL_IP/nbi/ | Device API (existing) |
| **GenieACS CWMP** | http://EXTERNAL_IP:7547 | CPE TR-069 (existing) |
| **GenieACS UI** | http://EXTERNAL_IP/admin/ | Admin panel (existing) |
| **Health** | http://EXTERNAL_IP/health | Status check |

---

## 📊 Initialize Sample Data

After deployment, add bandwidth plans and groups:

### Option A: Via Web UI

1. Open: https://lte-pci-mapper-65450042-bbf71.web.app
2. Go to **Modules** → **HSS & Subscriber Management**
3. Click tabs to create:
   - **Bandwidth Plans**: Create Gold/Silver/Bronze
   - **Groups**: Create Residential/Business/VIP
   - **Subscribers**: Add users manually

### Option B: Via API (from anywhere)

Replace `XX.XX.XX.XX` with your external IP:

**Create Gold Plan:**
```bash
curl -X POST http://XX.XX.XX.XX/api/hss/bandwidth-plans \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_001" \
  -d '{
    "plan_name": "Gold Plan",
    "plan_id": "plan_gold",
    "tenantId": "tenant_001",
    "bandwidth": {
      "download_mbps": 100,
      "upload_mbps": 50
    },
    "qos": { "qci": 9 }
  }'
```

**Create Residential Group:**
```bash
curl -X POST http://XX.XX.XX.XX/api/hss/groups \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_001" \
  -d '{
    "group_name": "Residential Users",
    "group_id": "group_residential",
    "tenantId": "tenant_001",
    "default_plan_id": "plan_gold"
  }'
```

**Add Subscriber:**
```bash
curl -X POST http://XX.XX.XX.XX/api/hss/subscribers \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_001" \
  -d '{
    "tenantId": "tenant_001",
    "imsi": "001010123456789",
    "ki": "00112233445566778899AABBCCDDEEFF",
    "opc": "63BFA50EE6523365FF14C1F45F88737D",
    "user_info": { "full_name": "John Doe" },
    "group_membership": { "group_id": "group_residential" }
  }'
```

---

## 🔄 Future Updates

From now on, just push to GitHub:

```bash
git add .
git commit -m "Update HSS"
git push
```

**Automatic deployment triggers:**
- ✅ Cloud Build detects push
- ✅ Runs deployment script
- ✅ Updates HSS on your server
- ✅ No manual steps needed!

---

## 🆘 Troubleshooting

### Check Deployment Status

**Cloud Build**: https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71
- Click latest build
- View logs

### Check HSS Service (Browser SSH)

**Compute Engine**: https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71
- Click **SSH** next to `genieacs-backend`
- Run:
  ```bash
  sudo systemctl status hss
  sudo journalctl -u hss -n 50
  curl localhost:3000/health
  ```

### Service Not Running

In browser SSH terminal:
```bash
# Restart HSS
sudo systemctl restart hss

# Check logs
sudo journalctl -u hss -f
```

---

## ✅ Checklist

- [ ] Create `mongodb-uri` secret
- [ ] Create `hss-encryption-key` secret
- [ ] Create Cloud Build trigger
- [ ] Run trigger (or git push)
- [ ] Wait 3-5 minutes
- [ ] Get external IP
- [ ] Test health endpoint
- [ ] Test HSS API endpoint
- [ ] Open web UI
- [ ] Create bandwidth plans
- [ ] Create groups
- [ ] Add test subscribers

---

## 🎉 Summary

**What**: Add HSS to your existing ACS server  
**Where**: Your existing `genieacs-backend` GCE instance  
**How**: Automated via Firebase Studio (no CLI)  
**Time**: ~5 minutes setup + 3-5 minutes deployment  
**Cost**: $0 additional (uses existing server)  

**Ready?** Start with Step 1 above! 🚀


