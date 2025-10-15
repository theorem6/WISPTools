# 🚀 START HERE - Complete Automated HSS Deployment

## ✅ What You're Deploying

**Cloud HSS (Home Subscriber Server) + GenieACS on Google Cloud**

- **Project**: `lte-pci-mapper-65450042-bbf71`
- **Instance**: `genieacs-backend` (GCE)
- **Zone**: `us-central1-a`
- **Replaces**: Spectrum Management module (keeps CBRS active)

---

## 🎯 One-Command Deployment

### First Time Setup (5 minutes)

```bash
# Linux/Mac
chmod +x deploy-everything.sh
./deploy-everything.sh --first-time

# Windows PowerShell
.\deploy-everything.ps1 -FirstTime
```

This will:
1. Check prerequisites (gcloud, firebase CLI)
2. Configure Google Cloud project
3. Create/check secrets in Secret Manager
4. Grant Cloud Build permissions
5. Enable required APIs
6. Deploy everything automatically

### Subsequent Deployments (10-15 minutes)

```bash
# Linux/Mac
./deploy-everything.sh

# Windows PowerShell
.\deploy-everything.ps1
```

---

## 📋 What Gets Deployed Automatically

### Phase 1: Backend Infrastructure (GCE)
- ✅ Creates `genieacs-backend` instance (if doesn't exist)
- ✅ Installs Node.js, Docker, MongoDB client, Nginx
- ✅ Configures firewall rules (ports 80, 443, 3000, 3868, 7547, 3478)
- ✅ Reserves static external IP

### Phase 2: HSS Server
- ✅ Copies HSS module to `/opt/hss-server`
- ✅ Installs dependencies
- ✅ Retrieves secrets from Secret Manager
- ✅ Initializes MongoDB collections
- ✅ Creates systemd service
- ✅ Starts HSS on port 3000 (REST) and 3868 (S6a)

### Phase 3: GenieACS (ACS/TR-069)
- ✅ Deploys Docker containers
- ✅ Configures GenieACS services
- ✅ Sets up TR-069 CWMP on port 7547

### Phase 4: Nginx Reverse Proxy
- ✅ Configures routes:
  - `/api/hss/` → HSS REST API
  - `/nbi/` → GenieACS NBI
  - `/fs/` → GenieACS File Server
  - `/admin/` → GenieACS UI

### Phase 5: Frontend
- ✅ Builds SvelteKit application
- ✅ Deploys to Firebase App Hosting
- ✅ Updates HSS module (replaces Spectrum Management)
- ✅ Configures environment variables

**Total Time:** 15-20 minutes

---

## 🌐 Access Your Services

After deployment completes, you'll see:

```
═══════════════════════════════════════════════════════════
  ✅ DEPLOYMENT COMPLETE!
═══════════════════════════════════════════════════════════

🌐 Your Services:

Frontend:
  https://lte-pci-mapper-65450042-bbf71.web.app

Backend (GCE: XX.XX.XX.XX):
  HSS REST API:     http://XX.XX.XX.XX/api/hss/
  HSS S6a:          XX.XX.XX.XX:3868
  GenieACS NBI:     http://XX.XX.XX.XX/nbi/
  GenieACS CWMP:    http://XX.XX.XX.XX:7547
  GenieACS UI:      http://XX.XX.XX.XX/admin/
  Health Check:     http://XX.XX.XX.XX/health
```

---

## ✅ Verification Steps

### 1. Test Health Endpoints

```bash
# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe genieacs-backend --zone=us-central1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

# Test HSS API
curl http://$EXTERNAL_IP/health
curl http://$EXTERNAL_IP/api/hss/health

# Test GenieACS
curl http://$EXTERNAL_IP/nbi/devices
```

### 2. Open Web UI

1. Navigate to: `https://lte-pci-mapper-65450042-bbf71.web.app`
2. Login with your account
3. Click "Modules" from dashboard
4. You should see **HSS & Subscriber Management** [Active]
5. Click to open the HSS module

### 3. Create First Bandwidth Plan

```bash
curl -X POST http://$EXTERNAL_IP/api/hss/bandwidth-plans \
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
      "qci": 9
    }
  }'
```

### 4. Create Subscriber Group

```bash
curl -X POST http://$EXTERNAL_IP/api/hss/groups \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_001" \
  -d '{
    "group_name": "Residential Users",
    "group_id": "group_residential",
    "default_plan_id": "plan_gold"
  }'
```

### 5. Add Test Subscriber

```bash
curl -X POST http://$EXTERNAL_IP/api/hss/subscribers \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_001" \
  -d '{
    "imsi": "001010123456789",
    "ki": "00112233445566778899AABBCCDDEEFF",
    "opc": "63BFA50EE6523365FF14C1F45F88737D",
    "user_info": {
      "full_name": "Test User"
    },
    "group_membership": {
      "group_id": "group_residential"
    }
  }'
```

---

## 📚 Documentation Quick Links

| Document | Purpose |
|----------|---------|
| **CORRECTED_MODULE_REPLACEMENT.md** | ⭐ Clarifies HSS replaces Spectrum Mgmt (not CBRS) |
| **FIREBASE_AUTOMATED_DEPLOYMENT.md** | Complete automation guide |
| **CLOUD_HSS_FINAL_SUMMARY.md** | Full feature summary |
| **HSS_ACS_SERVER_DEPLOYMENT_GUIDE.md** | Manual deployment steps |
| **hss-module/README.md** | HSS module API documentation |

---

## 🆘 Troubleshooting

### Deployment Fails

```bash
# Check Cloud Build logs
gcloud builds list --limit=5
gcloud builds log LATEST_BUILD_ID
```

### Services Not Running

```bash
# SSH to instance
gcloud compute ssh genieacs-backend --zone=us-central1-a

# Check HSS
sudo systemctl status hss
sudo journalctl -u hss -n 50

# Check GenieACS
docker ps
docker logs genieacs-cwmp

# Check Nginx
sudo systemctl status nginx
```

### Can't Access from Internet

```bash
# Check firewall
gcloud compute firewall-rules list | grep acs-server

# Test connectivity
curl -I http://$EXTERNAL_IP/health
```

---

## 🔄 Update/Redeploy

```bash
# Make changes to code
git add .
git commit -m "Update HSS module"
git push

# Redeploy
./deploy-everything.sh

# Or deploy specific components:
firebase deploy --only apphosting              # Frontend only
gcloud builds submit --config=...              # Backend only
```

---

## 💰 Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| GCE e2-standard-2 | ~$50-65 |
| Static IP | ~$7 |
| Cloud Run (Frontend) | ~$0-10 (free tier) |
| Cloud Build | First 120 min/day free |
| **Total** | **~$60-85/month** |

---

## ✅ Module Status

After deployment:

```
Module Manager → Modules Page

✅ PCI Resolution              [Active]
✅ ACS CPE Management          [Active]
✅ CBRS Management             [Active]  ← Still here!
🚧 Coverage Planning           [Coming Soon]
✅ HSS & Subscriber Management [Active]  ← Replaces Spectrum Management
```

---

## 🎯 Next Steps

1. ✅ Run `./deploy-everything.sh --first-time`
2. ✅ Wait 15-20 minutes for deployment
3. ✅ Test health endpoints
4. ✅ Open web UI and find HSS module
5. ✅ Create bandwidth plans
6. ✅ Create subscriber groups
7. ✅ Add test subscribers
8. ✅ Configure remote MME (if applicable)
9. ✅ Train team on new interface
10. ✅ Go live!

---

**Ready to deploy?**

```bash
./deploy-everything.sh --first-time
```

🚀 **Let's go!**

<function_calls>
<invoke name="run_terminal_cmd">
<parameter name="command">chmod +x deploy-everything.sh
