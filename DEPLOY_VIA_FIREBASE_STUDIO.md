# 🚀 Automated Deployment via Firebase App Hosting Studio

## ✅ Deploy Everything Through Web Console (No CLI Needed!)

**Project**: `lte-pci-mapper-65450042-bbf71`  
**Method**: Firebase App Hosting Studio + GitHub Integration  
**Result**: Fully automated deployment on every git push

---

## 🎯 Step-by-Step Setup (One-Time, 10 minutes)

### Step 1: Add MongoDB Secret in Google Cloud Console

1. **Open Secret Manager**:
   - Go to: https://console.cloud.google.com/security/secret-manager?project=lte-pci-mapper-65450042-bbf71
   
2. **Create mongodb-uri secret**:
   - Click **"+ CREATE SECRET"**
   - Name: `mongodb-uri`
   - Secret value: 
     ```
     mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
     ```
   - Click **"CREATE SECRET"**

3. **Create hss-encryption-key secret**:
   - Click **"+ CREATE SECRET"**
   - Name: `hss-encryption-key`
   - Secret value: (Generate one below or use existing)
   - Click **"CREATE SECRET"**

**Generate encryption key online**: https://www.random.org/cgi-bin/randbyte?nbytes=32&format=h
- Copy the 64-character hex string

---

### Step 2: Grant Permissions to Cloud Build

1. **Open IAM Console**:
   - Go to: https://console.cloud.google.com/iam-admin/iam?project=lte-pci-mapper-65450042-bbf71

2. **Find Cloud Build Service Account**:
   - Look for: `[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`
   - Click the pencil icon to edit

3. **Add Roles**:
   - Click **"ADD ANOTHER ROLE"**
   - Add these roles:
     - ✅ **Secret Manager Secret Accessor**
     - ✅ **Compute Admin**
     - ✅ **Service Account User**
   - Click **"SAVE"**

---

### Step 3: Enable Required APIs

1. **Open APIs & Services**:
   - Go to: https://console.cloud.google.com/apis/library?project=lte-pci-mapper-65450042-bbf71

2. **Enable these APIs** (search and click "ENABLE"):
   - ✅ Cloud Build API
   - ✅ Compute Engine API
   - ✅ Secret Manager API
   - ✅ Firebase App Hosting API

---

### Step 4: Set Up Firebase App Hosting Studio

1. **Open Firebase Console**:
   - Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

2. **Connect GitHub Repository**:
   - Click **"Get started"** or **"Add another backend"**
   - Select **"GitHub"**
   - Authorize Firebase to access your GitHub account
   - Select repository: `theorem6/lte-pci-mapper`
   - Select branch: `main`
   - Click **"Next"**

3. **Configure Build**:
   - Root directory: `Module_Manager` (should auto-detect from apphosting.yaml)
   - Build configuration: **Detected from apphosting.yaml** ✅
   - Click **"Next"**

4. **Review and Deploy**:
   - Review configuration
   - Click **"Deploy"**

---

### Step 5: Add Cloud Build Configuration for GCE Backend

1. **Create cloudbuild.yaml in repository root**:
   - This should already exist: `firebase-automation/deploy-hss-to-gce.yaml`

2. **Set up Cloud Build Trigger**:
   - Go to: https://console.cloud.google.com/cloud-build/triggers?project=lte-pci-mapper-65450042-bbf71
   - Click **"CREATE TRIGGER"**
   
3. **Configure Trigger**:
   - Name: `deploy-hss-to-gce`
   - Event: **Push to branch**
   - Source: **Repository: theorem6/lte-pci-mapper**
   - Branch: `^main$`
   - Configuration: **Cloud Build configuration file**
   - Location: `firebase-automation/deploy-hss-to-gce.yaml`
   - Click **"CREATE"**

---

## 🎉 That's It! Now It's Fully Automated

### What Happens Now:

1. **You push code to GitHub**:
   ```bash
   git add .
   git commit -m "Update HSS module"
   git push
   ```

2. **Firebase App Hosting automatically**:
   - ✅ Detects the push to `main` branch
   - ✅ Triggers build using `apphosting.yaml`
   - ✅ Builds frontend (SvelteKit)
   - ✅ Deploys to Cloud Run
   - ✅ Updates live site

3. **Cloud Build Trigger automatically**:
   - ✅ Detects the push to `main` branch
   - ✅ Runs `firebase-automation/deploy-hss-to-gce.yaml`
   - ✅ Creates/updates GCE instance
   - ✅ Deploys HSS server
   - ✅ Deploys GenieACS
   - ✅ Configures Nginx

**Total automation: 100%** 🚀

---

## 📊 Monitor Deployments

### Frontend Deployment (Firebase App Hosting)

1. **Go to Firebase Console**:
   - https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

2. **View Rollouts**:
   - See all deployments
   - View build logs
   - Monitor status

### Backend Deployment (Cloud Build)

1. **Go to Cloud Build Console**:
   - https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71

2. **View Build History**:
   - See all triggered builds
   - View detailed logs
   - Check success/failure

### GCE Instance

1. **Go to Compute Engine Console**:
   - https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71

2. **View Instance**:
   - Instance: `genieacs-backend`
   - Status, IP address, logs
   - SSH access (browser-based)

---

## ✅ Verify Deployment

### Check Frontend

1. Open: https://lte-pci-mapper-65450042-bbf71.web.app
2. Login to your account
3. Navigate to **Modules**
4. You should see **"HSS & Subscriber Management"** [Active]

### Check Backend (Get IP First)

1. **Get External IP**:
   - Go to: https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71
   - Find `genieacs-backend` instance
   - Copy the **External IP**

2. **Test Endpoints**:
   - Open in browser: `http://EXTERNAL_IP/health`
   - Should show: `{"status": "healthy", ...}`

### Test HSS API

Open in browser or use curl:
```
http://EXTERNAL_IP/api/hss/health
```

---

## 🔄 Update Workflow

Every time you make changes:

1. **Edit code locally**
2. **Commit to git**:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
3. **Automatic deployment triggers** ✅
4. **Monitor in Firebase/Cloud Build console**
5. **Changes go live in ~5-10 minutes**

**No CLI commands needed!**

---

## 🌐 Service URLs (After First Deployment)

Once deployed, get the external IP from:
https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71

Then access:

| Service | URL |
|---------|-----|
| **Frontend** | https://lte-pci-mapper-65450042-bbf71.web.app |
| **HSS API** | http://EXTERNAL_IP/api/hss/ |
| **HSS S6a (MME)** | EXTERNAL_IP:3868 |
| **GenieACS NBI** | http://EXTERNAL_IP/nbi/ |
| **GenieACS CWMP** | http://EXTERNAL_IP:7547 |
| **GenieACS UI** | http://EXTERNAL_IP/admin/ |

---

## 🆘 Troubleshooting (All via Web Console)

### Check Build Logs

**Firebase App Hosting**:
1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
2. Click on latest rollout
3. View build logs

**Cloud Build**:
1. Go to: https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71
2. Click on latest build
3. View execution details

### SSH to Instance (Browser-Based)

1. Go to: https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71
2. Click **SSH** button next to `genieacs-backend`
3. Opens browser-based terminal

### Check Service Status

In browser SSH terminal:
```bash
# Check HSS
sudo systemctl status hss

# Check GenieACS
docker ps

# View HSS logs
sudo journalctl -u hss -n 50
```

---

## 💡 Pro Tips

### Automatic Rollback

If a deployment fails:
1. Go to App Hosting console
2. Click on a previous successful rollout
3. Click **"Rollback to this version"**

### Preview Deployments

Create a pull request on GitHub:
- Firebase automatically creates a preview deployment
- Test before merging to main
- Preview URL appears in PR comments

### Manual Trigger

Need to redeploy without code changes?

1. **Cloud Build**:
   - Go to: https://console.cloud.google.com/cloud-build/triggers?project=lte-pci-mapper-65450042-bbf71
   - Click **RUN** on `deploy-hss-to-gce` trigger

2. **Firebase App Hosting**:
   - Go to App Hosting console
   - Click **"Deploy"** → **"Deploy from branch"**

---

## 📋 First Deployment Checklist

- [x] Code committed and pushed to GitHub ✅
- [ ] MongoDB secret created in Secret Manager
- [ ] HSS encryption key secret created in Secret Manager
- [ ] Cloud Build permissions granted
- [ ] Required APIs enabled
- [ ] Firebase App Hosting connected to GitHub
- [ ] Cloud Build trigger created
- [ ] First deployment initiated

**Next**: Complete the secret setup above, then your first deployment will trigger automatically!

---

## 🎯 Quick Start

### Right Now (Web Console Only):

1. **Create Secrets** (5 minutes):
   - Open: https://console.cloud.google.com/security/secret-manager?project=lte-pci-mapper-65450042-bbf71
   - Create `mongodb-uri` with your connection string ✅
   - Create `hss-encryption-key` with random 64-char hex

2. **Grant Permissions** (2 minutes):
   - Open: https://console.cloud.google.com/iam-admin/iam?project=lte-pci-mapper-65450042-bbf71
   - Add roles to Cloud Build service account

3. **Connect GitHub** (2 minutes):
   - Open: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
   - Connect your repository
   - Deploy!

4. **Monitor Deployment** (15 minutes):
   - Watch in Firebase console as it builds and deploys
   - Get external IP from Compute Engine
   - Test endpoints

**Total Time**: ~25 minutes  
**CLI Commands Needed**: 0 ✅  
**Everything via Browser**: Yes! 🎉

---

**Ready? Start with Step 1 above!** 🚀


