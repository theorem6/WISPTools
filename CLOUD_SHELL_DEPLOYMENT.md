# 🌐 Cloud Shell Deployment Guide

## Deploy Everything from Google Cloud Console

This guide shows you how to deploy the entire infrastructure using **Google Cloud Shell** - no local installation required!

---

## ✅ What is Google Cloud Shell?

Google Cloud Shell is a free, browser-based terminal that includes:
- ✅ Pre-installed `gcloud` CLI
- ✅ Pre-installed `git`, `docker`, `node`, etc.
- ✅ 5 GB persistent storage
- ✅ Already authenticated to your GCP project
- ✅ Full Linux environment (Debian-based)

**Access it at**: https://console.cloud.google.com/?cloudshell=true

---

## 🚀 Complete Deployment from Cloud Shell (20 minutes)

### Step 1: Open Cloud Shell

1. Go to: https://console.cloud.google.com/
2. Click the **Activate Cloud Shell** button (top-right, terminal icon)
3. Wait for Cloud Shell to initialize (~30 seconds)

### Step 2: Clone Your Repository

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/PCI_mapper.git
cd PCI_mapper

# Or if already cloned, pull latest
cd PCI_mapper
git pull
```

### Step 3: Set Your Project

```bash
# Set the GCP project
gcloud config set project lte-pci-mapper-65450042-bbf71

# Verify it's set
gcloud config get-value project
```

### Step 4: Make Scripts Executable

```bash
# Make scripts executable
chmod +x gce-backend/create-gce-instance.sh
chmod +x gce-backend/setup-gce-instance.sh

# Verify
ls -lh gce-backend/*.sh
```

### Step 5: Create GCE Instance

```bash
# Run the creation script
./gce-backend/create-gce-instance.sh
```

**What it does**:
- ✅ Reserves static external IP
- ✅ Creates firewall rules (HTTP/HTTPS, TR-069, STUN)
- ✅ Creates GCE instance (e2-standard-2)
- ✅ Displays the external IP

**Expected time**: 2-3 minutes

**Save the external IP** displayed at the end!

### Step 6: Copy Setup Script to GCE

```bash
# Copy the setup script to the new instance
gcloud compute scp gce-backend/setup-gce-instance.sh genieacs-backend:~ --zone=us-central1-a
```

### Step 7: SSH to GCE Instance

```bash
# SSH into the instance
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

You're now on the GCE instance! Your prompt will change to show `your-username@genieacs-backend`.

### Step 8: Run Setup on GCE Instance

```bash
# Make executable
chmod +x setup-gce-instance.sh

# Run the setup
./setup-gce-instance.sh
```

**You'll be prompted for**:

1. **MongoDB Connection URI**: 
   ```
   mongodb+srv://genieacs-user:YOUR-PASSWORD@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority
   ```

2. **MongoDB Database Name**: 
   ```
   genieacs
   ```
   (or press Enter for default)

3. **External Domain or IP**: 
   - If you have a domain: `genieacs.yourdomain.com`
   - If using IP only: The external IP from Step 5

4. **Firebase App URL**: 
   ```
   https://lte-pci-mapper-nfomthzoza-uc.a.run.app
   ```

5. **Email for SSL**: 
   ```
   your-email@example.com
   ```

**What it installs**:
- ✅ Docker & Docker Compose
- ✅ Node.js 20
- ✅ GenieACS services (CWMP, NBI, FS, UI)
- ✅ Backend API server
- ✅ STUN server (Coturn)
- ✅ Nginx reverse proxy
- ✅ Configures firewall (UFW)
- ✅ Sets up SSL certificates (if domain configured)

**Expected time**: 10-15 minutes

### Step 9: Verify Backend Deployment

Still on the GCE instance:

```bash
# Check all services
/opt/monitor.sh

# Test health endpoint
curl http://localhost:3000/health
```

Expected output:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-10T12:00:00.000Z",
  "services": {
    "genieacs_cwmp": "running",
    "genieacs_nbi": "running",
    "genieacs_fs": "running",
    "genieacs_ui": "running",
    "mongodb": "running"
  }
}
```

### Step 10: Exit GCE and Return to Cloud Shell

```bash
# Exit SSH session
exit
```

You're back in Cloud Shell!

### Step 11: Configure Frontend

```bash
# Navigate to Module_Manager
cd ~/PCI_mapper/Module_Manager

# Copy the GCE backend configuration template
cp apphosting.yaml.gce-backend apphosting.yaml

# Edit with Cloud Shell editor
cloudshell edit apphosting.yaml
```

**In the editor, replace**:
- `<YOUR-GCE-DOMAIN>` → Your domain or `https://YOUR-EXTERNAL-IP`
- `<YOUR-GCE-IP>` → Your external IP from Step 5

Or use sed to replace automatically:
```bash
# Set your values
GCE_IP="35.xxx.xxx.xxx"  # Your external IP
GCE_DOMAIN="genieacs.yourdomain.com"  # Or use IP

# Replace in file
sed -i "s|<YOUR-GCE-DOMAIN>|https://${GCE_DOMAIN}|g" apphosting.yaml
sed -i "s|<YOUR-GCE-IP>|${GCE_IP}|g" apphosting.yaml

# Verify
grep -E "BACKEND_API_URL|CWMP_URL|STUN_SERVER" apphosting.yaml
```

### Step 12: Install Firebase CLI (if not installed)

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login --no-localhost
```

Follow the login link provided and paste the authorization code back.

### Step 13: Deploy Frontend

```bash
# Navigate to project root
cd ~/PCI_mapper

# Deploy to Firebase App Hosting
firebase deploy --only apphosting
```

**Expected time**: 5-10 minutes

### Step 14: Route Traffic to Latest

```bash
# Route all traffic to the latest deployment
gcloud run services update-traffic lte-pci-mapper \
  --region=us-central1 \
  --project=lte-pci-mapper-65450042-bbf71 \
  --to-latest
```

### Step 15: Test Everything

```bash
# Test backend (replace with your domain/IP)
BACKEND="https://genieacs.yourdomain.com"
curl ${BACKEND}/api/health

# Test frontend
curl -I https://lte-pci-mapper-nfomthzoza-uc.a.run.app
```

---

## ✅ Success!

Your complete infrastructure is now deployed:

- ✅ **GCE Backend**: Running GenieACS, STUN, Backend API
- ✅ **Frontend**: Running on Firebase App Hosting
- ✅ **All services**: Monitored and backed up

### Service Endpoints

| Service | URL |
|---------|-----|
| Frontend | `https://lte-pci-mapper-nfomthzoza-uc.a.run.app` |
| Backend API | `https://your-domain.com/api/` |
| Health Check | `https://your-domain.com/api/health` |
| GenieACS NBI | `https://your-domain.com/nbi/` |
| GenieACS UI | `https://your-domain.com/admin/` |
| TR-069 CWMP | `http://YOUR-IP:7547` |
| STUN Server | `stun:YOUR-IP:3478` |

---

## 🔄 Quick Commands for Cloud Shell

### SSH to GCE Instance
```bash
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

### Check Backend Status (from Cloud Shell)
```bash
gcloud compute ssh genieacs-backend --zone=us-central1-a --command="/opt/monitor.sh"
```

### View Backend Logs
```bash
gcloud compute ssh genieacs-backend --zone=us-central1-a --command="sudo journalctl -u backend-api -n 50"
```

### Restart Backend Services
```bash
gcloud compute ssh genieacs-backend --zone=us-central1-a --command="cd /opt/genieacs && docker-compose restart && sudo systemctl restart backend-api"
```

### Copy Files to GCE
```bash
gcloud compute scp LOCAL_FILE genieacs-backend:REMOTE_PATH --zone=us-central1-a
```

### Deploy Frontend Updates
```bash
cd ~/PCI_mapper
firebase deploy --only apphosting
gcloud run services update-traffic lte-pci-mapper --region=us-central1 --to-latest
```

---

## 💡 Cloud Shell Tips

### Keep Cloud Shell Alive
Cloud Shell sessions timeout after 20 minutes of inactivity. To prevent this:
```bash
# Run this in the background
while true; do echo "keep alive"; sleep 300; done &
```

### Upload Files to Cloud Shell
Click the ⋮ menu → **Upload file** → Select your file

### Download Files from Cloud Shell
```bash
cloudshell download FILENAME
```

### Edit Files
```bash
cloudshell edit FILENAME
```

### Boost Cloud Shell (Temporary)
Click **Boost Cloud Shell** for more resources (temporary, free for 24 hours)

---

## 🔧 Troubleshooting in Cloud Shell

### Script Permission Denied
```bash
chmod +x gce-backend/*.sh
```

### Firebase Login Issues
```bash
firebase logout
firebase login --no-localhost
```

### GCE Access Denied
```bash
# Re-authenticate
gcloud auth login --no-launch-browser
```

### Project Not Set
```bash
gcloud config set project lte-pci-mapper-65450042-bbf71
```

### Can't SSH to GCE
```bash
# Check instance is running
gcloud compute instances list

# Start instance if stopped
gcloud compute instances start genieacs-backend --zone=us-central1-a
```

---

## 📋 Cloud Shell Deployment Checklist

- [ ] Open Cloud Shell
- [ ] Clone/pull repository
- [ ] Set GCP project
- [ ] Make scripts executable
- [ ] Run `create-gce-instance.sh`
- [ ] Note external IP
- [ ] Copy setup script to GCE
- [ ] SSH to GCE
- [ ] Run `setup-gce-instance.sh`
- [ ] Provide MongoDB URI, domain, email
- [ ] Verify services with `/opt/monitor.sh`
- [ ] Exit SSH
- [ ] Update `apphosting.yaml` with GCE values
- [ ] Deploy frontend with `firebase deploy`
- [ ] Route traffic to latest
- [ ] Test all endpoints
- [ ] ✅ Done!

---

## 🎯 Advantages of Cloud Shell

✅ **No local installation** - Everything in the browser  
✅ **Pre-authenticated** - No gcloud login needed  
✅ **Pre-configured** - All tools pre-installed  
✅ **5 GB storage** - Persists between sessions  
✅ **Fast network** - Direct connection to GCP  
✅ **Free** - No cost for Cloud Shell usage  
✅ **Secure** - Google's infrastructure  

---

## 🚀 One-Command Deployment (Advanced)

Create a master script in Cloud Shell:

```bash
cat > ~/deploy-all.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting complete deployment..."

cd ~/PCI_mapper

# Step 1: Create GCE instance
echo "📦 Creating GCE instance..."
./gce-backend/create-gce-instance.sh

# Get the external IP
EXTERNAL_IP=$(gcloud compute addresses describe genieacs-backend-ip --region=us-central1 --format='value(address)')
echo "External IP: $EXTERNAL_IP"

# Step 2: Copy and run setup (will require input)
echo "📤 Copying setup script..."
gcloud compute scp gce-backend/setup-gce-instance.sh genieacs-backend:~ --zone=us-central1-a

echo "⚙️  Running setup on GCE (this will prompt for info)..."
gcloud compute ssh genieacs-backend --zone=us-central1-a --command="chmod +x setup-gce-instance.sh && ./setup-gce-instance.sh"

# Step 3: Configure frontend
echo "🎨 Configuring frontend..."
cd Module_Manager
cp apphosting.yaml.gce-backend apphosting.yaml
sed -i "s|<YOUR-GCE-IP>|${EXTERNAL_IP}|g" apphosting.yaml
echo "⚠️  Please manually update <YOUR-GCE-DOMAIN> in apphosting.yaml"

# Step 4: Deploy frontend
echo "🚀 Deploying frontend..."
cd ..
firebase deploy --only apphosting

# Step 5: Route traffic
echo "🔀 Routing traffic..."
gcloud run services update-traffic lte-pci-mapper --region=us-central1 --to-latest

echo "✅ Deployment complete!"
echo "Frontend: https://lte-pci-mapper-nfomthzoza-uc.a.run.app"
echo "Backend: https://${EXTERNAL_IP}/api/health"
EOF

chmod +x ~/deploy-all.sh
```

Then run:
```bash
~/deploy-all.sh
```

---

## 📚 Next Steps

After deployment in Cloud Shell:

1. **Configure DNS** (if using custom domain)
2. **Set up monitoring cron jobs** (SSH to GCE)
3. **Configure automated backups**
4. **Test CPE device connections**
5. **Document your configuration**

---

## 🆘 Need Help?

- **Cloud Shell Docs**: https://cloud.google.com/shell/docs
- **GCE Docs**: https://cloud.google.com/compute/docs
- **Firebase Docs**: https://firebase.google.com/docs
- **Our Guides**: See [README_REFACTORING.md](README_REFACTORING.md)

---

**Cloud Shell Access**: https://console.cloud.google.com/?cloudshell=true

**Status**: ✅ Ready to deploy from Cloud Shell!  
**Time Required**: ~20 minutes  
**Cost**: Free (Cloud Shell) + GCE costs (~$125/month)

---

*Everything can be done from your browser - no local installation needed!* 🌐

