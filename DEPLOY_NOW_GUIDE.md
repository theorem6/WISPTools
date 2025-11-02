# 🚀 Deploy Now - Quick Guide

## ✅ Tools Installed

- ✅ Node.js v22.21.1
- ✅ npm 10.9.4
- ✅ Firebase CLI 14.23.0
- ✅ Google Cloud SDK 545.0.0

---

## Part 1: Backend Deployment to GCE

Since we need SSH access to deploy to GCE, you have two options:

### Option A: Use gcloud compute ssh (if authenticated)

```bash
# Authenticate with Google Cloud
gcloud auth login

# Set project
gcloud config set project lte-pci-mapper-65450042-bbf71

# SSH and deploy
gcloud compute ssh root@acs-hss-server --zone=us-central1-a --command="cd /root/lte-pci-mapper && git pull origin main && chmod +x scripts/deployment/deploy-monetization-updates.sh && sudo bash scripts/deployment/deploy-monetization-updates.sh"
```

### Option B: Manual SSH (recommended)

```bash
# SSH into GCE server
ssh root@136.112.111.167

# Once on the server, run:
cd /root/lte-pci-mapper
git pull origin main
chmod +x scripts/deployment/deploy-monetization-updates.sh
sudo bash scripts/deployment/deploy-monetization-updates.sh
```

The script will automatically:
- ✅ Pull latest code
- ✅ Backup existing files
- ✅ Copy all new/updated files
- ✅ Verify syntax
- ✅ Restart the service

---

## Part 2: Configure PayPal Credentials

After backend deployment, add PayPal credentials:

```bash
# On GCE server
nano /opt/hss-api/.env
```

Add:
```bash
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENVIRONMENT=sandbox
```

Restart:
```bash
systemctl restart hss-api
```

---

## Part 3: Frontend Deployment

Frontend auto-deploys via Firebase App Hosting when you push to Git!

### Step 1: Commit the deployment files

```bash
cd /workspace
git add DEPLOY_MONETIZATION_UPDATES.md scripts/deployment/deploy-monetization-updates.sh DEPLOY_NOW_GUIDE.md
git commit -m "docs: Add monetization deployment guide and scripts"
```

### Step 2: Switch to main branch and merge

```bash
git checkout main
git merge cursor/open-last-chat-history-ccb4  # or your feature branch
git push origin main
```

### Step 3: Monitor Firebase App Hosting

Firebase App Hosting will automatically:
1. Detect the push (~30 seconds)
2. Start building (~1 minute)
3. Build completes (~5-10 minutes)
4. Deploy (~2-3 minutes)

**Monitor here:**
https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

---

## 🎯 Quick Commands Summary

### Backend:
```bash
ssh root@136.112.111.167
cd /root/lte-pci-mapper && git pull && sudo bash scripts/deployment/deploy-monetization-updates.sh
```

### Frontend:
```bash
git checkout main
git merge cursor/open-last-chat-history-ccb4
git push origin main
```

---

## ✅ Verification

### Backend:
```bash
# On GCE server
systemctl status hss-api
curl http://localhost:3001/health
```

### Frontend:
Visit: https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app

---

**Ready to deploy!** 🚀
