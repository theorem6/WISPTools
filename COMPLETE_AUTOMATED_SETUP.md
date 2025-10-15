# ✅ Complete Automated HSS Setup - Firebase Studio Only

## 🎯 Deploy Everything Through Web Browser (Zero CLI Commands!)

**What You Get**: Fully automated HSS + GenieACS deployment that updates on every git push

---

## 📋 One-Time Setup (15 minutes, all in browser)

### 1️⃣ Store MongoDB Secret (2 minutes)

**URL**: https://console.cloud.google.com/security/secret-manager?project=lte-pci-mapper-65450042-bbf71

1. Click **"+ CREATE SECRET"**
2. Name: `mongodb-uri`
3. Secret value:
   ```
   mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
4. Click **"CREATE SECRET"**

### 2️⃣ Generate & Store Encryption Key (2 minutes)

1. **Generate key** at: https://www.random.org/cgi-bin/randbyte?nbytes=32&format=h
   - Copy the 64-character hex output (example: `a1b2c3d4e5f6...`)

2. Back in Secret Manager: Click **"+ CREATE SECRET"**
3. Name: `hss-encryption-key`
4. Secret value: Paste the 64-char hex
5. Click **"CREATE SECRET"**

### 3️⃣ Grant Permissions (3 minutes)

**URL**: https://console.cloud.google.com/iam-admin/iam?project=lte-pci-mapper-65450042-bbf71

1. Find service account: `[NUMBER]@cloudbuild.gserviceaccount.com`
2. Click ✏️ pencil icon
3. Click **"+ ADD ANOTHER ROLE"** and add these 3 roles:
   - ✅ **Secret Manager Secret Accessor**
   - ✅ **Compute Admin**
   - ✅ **Service Account User**
4. Click **"SAVE"**

### 4️⃣ Enable APIs (2 minutes)

**URL**: https://console.cloud.google.com/apis/dashboard?project=lte-pci-mapper-65450042-bbf71

Click **"+ ENABLE APIS AND SERVICES"** and enable:
- ✅ Cloud Build API
- ✅ Compute Engine API
- ✅ Secret Manager API

(Most should already be enabled)

### 5️⃣ Create Cloud Build Trigger (3 minutes)

**URL**: https://console.cloud.google.com/cloud-build/triggers?project=lte-pci-mapper-65450042-bbf71

1. Click **"CREATE TRIGGER"**
2. Name: `deploy-hss-to-gce`
3. Event: **Push to a branch**
4. Source:
   - Repository: **theorem6/lte-pci-mapper** (1st gen)
   - Branch: `^main$`
5. Configuration:
   - Type: **Cloud Build configuration file (yaml or json)**
   - Location: `firebase-automation/deploy-hss-to-gce.yaml`
6. Click **"CREATE"**

### 6️⃣ Verify Firebase App Hosting Connected (1 minute)

**URL**: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

- Should show your app already connected to GitHub
- If not, click **"Get started"** and connect `theorem6/lte-pci-mapper`

---

## 🚀 Trigger First Deployment (Automatic!)

Since you already pushed the HSS code to GitHub, now just trigger a new deployment:

### Option A: Push Any Small Change

```bash
# Make a small change (like adding a comment)
echo "# HSS deployment ready" >> README.md
git add README.md
git commit -m "trigger: Deploy HSS module"
git push
```

### Option B: Manual Trigger (Web Console)

1. **Go to Cloud Build Triggers**:
   - https://console.cloud.google.com/cloud-build/triggers?project=lte-pci-mapper-65450042-bbf71

2. Click **"RUN"** next to `deploy-hss-to-gce` trigger

3. **Monitor deployment**:
   - Click on the triggered build
   - Watch live logs in browser

---

## 📊 Monitor Deployment (15-20 minutes)

### Watch Backend Deployment

**URL**: https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71

You'll see the build progress through:
- ✅ Creating GCE instance
- ✅ Installing dependencies
- ✅ Deploying HSS module
- ✅ Deploying GenieACS
- ✅ Configuring Nginx

### Watch Frontend Deployment

**URL**: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

You'll see:
- ✅ Building SvelteKit app
- ✅ Deploying to Cloud Run
- ✅ Rolling out new version

---

## 🌐 Get Your Service URLs

### After Deployment Completes:

1. **Get External IP**:
   - Go to: https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71
   - Find `genieacs-backend` instance
   - Copy **External IP** (example: `35.222.123.45`)

2. **Your Services**:
   ```
   Frontend:      https://lte-pci-mapper-65450042-bbf71.web.app
   
   HSS API:       http://EXTERNAL_IP/api/hss/
   HSS S6a:       EXTERNAL_IP:3868
   GenieACS NBI:  http://EXTERNAL_IP/nbi/
   GenieACS CWMP: http://EXTERNAL_IP:7547
   GenieACS UI:   http://EXTERNAL_IP/admin/
   ```

---

## ✅ Verify Installation

### Test in Browser:

Open these URLs (replace `XX.XX.XX.XX` with your external IP):

1. **Health Check**: `http://XX.XX.XX.XX/health`
   - Should show: `healthy`

2. **HSS API Health**: `http://XX.XX.XX.XX/api/hss/health`
   - Should show HSS service info

3. **GenieACS Devices**: `http://XX.XX.XX.XX/nbi/devices`
   - Should show device list (may be empty initially)

### Initialize Sample Data:

1. **SSH via Browser**:
   - Go to: https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71
   - Click **SSH** button next to `genieacs-backend`

2. **Run initialization script**:
   ```bash
   # In the browser SSH terminal:
   curl -s https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/init-hss-sample-data.sh | bash -s -- localhost
   ```

3. **This creates**:
   - ✅ 3 Bandwidth Plans (Gold, Silver, Bronze)
   - ✅ 3 Subscriber Groups (Residential, Business, VIP)
   - ✅ 2 Test Subscribers

---

## 🎨 Access HSS Module in Web UI

1. **Open**: https://lte-pci-mapper-65450042-bbf71.web.app
2. **Login** with your account
3. **Click**: "Modules"
4. **Find**: "HSS & Subscriber Management" 🔐 [Active]
5. **Click** to open the HSS dashboard

You'll see:
- 📊 Dashboard with statistics
- 👥 Subscriber list (with test subscribers)
- 📦 Groups (Residential, Business, VIP)
- 🚀 Bandwidth Plans (Gold, Silver, Bronze)
- 🌐 MME Connections (for remote MMEs)
- 📥 Bulk Import tool

---

## 🔄 From Now On: 100% Automated!

### Every Time You Push to GitHub:

```bash
git add .
git commit -m "Update HSS"
git push
```

**Automatic actions triggered**:
1. ✅ Cloud Build deploys backend to GCE
2. ✅ Firebase App Hosting deploys frontend
3. ✅ Services restart automatically
4. ✅ Changes go live in ~10 minutes

**Monitor deployments**:
- Cloud Build: https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71
- Firebase: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

---

## 📊 Quick Reference

### Consoles:

| Console | URL |
|---------|-----|
| Firebase | https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71 |
| Compute Engine | https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71 |
| Cloud Build | https://console.cloud.google.com/cloud-build?project=lte-pci-mapper-65450042-bbf71 |
| Secret Manager | https://console.cloud.google.com/security/secret-manager?project=lte-pci-mapper-65450042-bbf71 |
| IAM | https://console.cloud.google.com/iam-admin?project=lte-pci-mapper-65450042-bbf71 |

### Configuration:

```
Project ID:    lte-pci-mapper-65450042-bbf71
Instance:      genieacs-backend
Zone:          us-central1-a
Machine Type:  e2-standard-2 (2 vCPU, 8 GB RAM)

Ports:
  3000 - HSS REST API
  3868 - HSS S6a/Diameter (MME connections)
  7547 - TR-069 CWMP (CPE connections)
  7557 - GenieACS NBI API
  3333 - GenieACS UI
```

---

## 🆘 Troubleshooting (All Web Console)

### Check Deployment Logs

1. **Cloud Build**: https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71
   - Click latest build → View logs

2. **Firebase**: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
   - Click latest rollout → View build logs

### Check Service Status (Browser SSH)

1. **Open SSH**: https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71
2. Click **SSH** next to `genieacs-backend`
3. Run:
   ```bash
   sudo systemctl status hss
   docker ps
   curl localhost:3000/health
   ```

### Restart Services (Browser SSH)

```bash
# Restart HSS
sudo systemctl restart hss

# Restart GenieACS
cd /opt/genieacs && sudo docker-compose restart

# Restart Nginx
sudo systemctl restart nginx
```

---

## ✅ Installation Checklist

Complete these in order:

- [ ] **Step 1**: Create `mongodb-uri` secret
- [ ] **Step 2**: Create `hss-encryption-key` secret  
- [ ] **Step 3**: Grant Cloud Build permissions
- [ ] **Step 4**: Enable required APIs
- [ ] **Step 5**: Create Cloud Build trigger
- [ ] **Step 6**: Verify Firebase App Hosting connected
- [ ] **Step 7**: Trigger deployment (git push or manual)
- [ ] **Step 8**: Monitor deployment (~15 minutes)
- [ ] **Step 9**: Get external IP from Compute Engine
- [ ] **Step 10**: Test endpoints in browser
- [ ] **Step 11**: Initialize sample data via browser SSH
- [ ] **Step 12**: Open web UI and verify HSS module works

---

## 🎉 Summary

**Total Time**: ~30 minutes (one-time setup)  
**CLI Commands**: 0 (everything in browser!)  
**Future Updates**: Automatic on git push  
**Cost**: ~$60-85/month  

**Status**: ✅ Ready to install  
**Method**: 100% automated via Firebase Studio  

---

**Start with Step 1 above!** 🚀

All setup links are clickable - just follow the checklist in your browser.


