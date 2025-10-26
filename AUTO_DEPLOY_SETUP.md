# Automated Google Cloud Deployment Setup

This document explains how to set up automated deployment from your Git repository to Google Cloud.

## 🚀 Deployment Options

### Option 1: Google Cloud Build (Recommended)
Automatically deploys when you push to the main branch.

### Option 2: GitHub Actions
Uses GitHub's CI/CD pipeline for deployment.

### Option 3: Cron-based Deployment
Runs on a schedule to check for updates and deploy automatically.

## 📋 Prerequisites

- Google Cloud Project with billing enabled
- Firebase project configured
- Git repository with your code
- GCE instance (optional, for backend services)

## 🔧 Option 1: Google Cloud Build Setup

### Step 1: Run the Setup Script
```bash
cd /workspace
./setup-cloud-build-trigger.sh
```

### Step 2: Configure Firebase Token
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Generate a new private key
5. Save it as `firebase-service-account.json`
6. Create a secret in Google Cloud Secret Manager:
   ```bash
   gcloud secrets create firebase-token --data-file=firebase-service-account.json
   ```

### Step 3: Create GCE Instance (Optional)
```bash
gcloud compute instances create backend-server \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --tags=wisptools-backend
```

### Step 4: Test Deployment
Push changes to the main branch and watch the Cloud Build logs:
```bash
gcloud builds list --limit=5
```

## 🔧 Option 2: GitHub Actions Setup

### Step 1: Configure Secrets
In your GitHub repository, go to Settings → Secrets and Variables → Actions, and add:

- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `FIREBASE_TOKEN`: Firebase service account token
- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `GCP_SA_KEY`: Google Cloud service account key (JSON)

### Step 2: Enable GitHub Actions
The workflow file is already created at `.github/workflows/auto-deploy.yml`. It will automatically run when you push to main or master.

## 🔧 Option 3: Cron-based Deployment

### Step 1: Run the Setup Script
```bash
cd /workspace
./setup-auto-deploy-cron.sh
```

### Step 2: Verify Setup
```bash
# Check cron job
crontab -l

# Check systemd timer
sudo systemctl status wisptools-deploy.timer

# View logs
tail -f /var/log/wisptools-deploy.log
```

## 📊 What Gets Deployed

### Firebase Functions
- PCI Analysis API
- GenieACS Integration
- CBRS Management
- MongoDB Operations
- HSS Proxy

### App Hosting (Frontend)
- SvelteKit application
- Static assets
- Environment configuration

### Backend Services (GCE)
- User Management API (Port 3000)
- HSS Service (Port 3001)
- Database connections
- Systemd services

## 🔍 Monitoring Deployment

### Cloud Build Logs
```bash
gcloud builds list --limit=10
gcloud builds log [BUILD_ID]
```

### Service Status
```bash
# Check backend services
sudo systemctl status wisptools-backend
sudo systemctl status wisptools-hss

# View logs
journalctl -u wisptools-backend -f
journalctl -u wisptools-hss -f
```

### Health Checks
```bash
# Backend API
curl http://localhost:3000/health

# HSS API
curl http://localhost:3001/health

# Firebase Functions
curl https://us-central1-PROJECT_ID.cloudfunctions.net/analyzePCI
```

## 🛠️ Manual Deployment

If you need to deploy manually:

```bash
# Deploy from current directory
./deploy-from-git.sh

# Deploy specific branch
BRANCH=feature-branch ./deploy-from-git.sh

# Deploy to specific project
PROJECT_ID=my-project ./deploy-from-git.sh
```

## 🔧 Configuration Files

### Cloud Build
- `cloudbuild-auto-deploy.yaml`: Main Cloud Build configuration
- `setup-cloud-build-trigger.sh`: Setup script for Cloud Build

### GitHub Actions
- `.github/workflows/auto-deploy.yml`: GitHub Actions workflow

### Cron Deployment
- `deploy-from-git.sh`: Main deployment script
- `setup-auto-deploy-cron.sh`: Cron setup script

## 🚨 Troubleshooting

### Common Issues

1. **Firebase Token Expired**
   ```bash
   # Regenerate token
   firebase login:ci
   # Update secret in Cloud Build or GitHub Actions
   ```

2. **GCE Instance Not Found**
   ```bash
   # Check if instance exists
   gcloud compute instances list
   
   # Create if missing
   gcloud compute instances create backend-server --zone=us-central1-a
   ```

3. **Services Not Starting**
   ```bash
   # Check service status
   sudo systemctl status wisptools-backend
   
   # Check logs
   journalctl -u wisptools-backend -n 50
   
   # Restart services
   sudo systemctl restart wisptools-backend wisptools-hss
   ```

4. **Port Conflicts**
   ```bash
   # Check what's using the ports
   sudo lsof -i :3000
   sudo lsof -i :3001
   
   # Kill conflicting processes
   sudo kill -9 [PID]
   ```

### Log Locations

- Cloud Build: Google Cloud Console → Cloud Build → History
- GitHub Actions: Repository → Actions tab
- Cron: `/var/log/wisptools-deploy.log`
- Services: `journalctl -u wisptools-backend`

## 📈 Performance Optimization

### Cloud Build
- Uses `N1_HIGHCPU_8` machine type for faster builds
- Parallel deployment steps
- Caching of dependencies

### GCE Instance
- Automatic service restart on failure
- Health checks and monitoring
- Log rotation to prevent disk full

## 🔒 Security Considerations

1. **Service Account Permissions**
   - Minimal required permissions
   - Separate accounts for different services
   - Regular key rotation

2. **Secrets Management**
   - Use Google Secret Manager
   - Never commit secrets to git
   - Rotate tokens regularly

3. **Network Security**
   - Firewall rules for GCE instances
   - VPC configuration
   - HTTPS only for external access

## 📞 Support

If you encounter issues:

1. Check the logs first
2. Verify all prerequisites are met
3. Test manual deployment
4. Check Google Cloud Console for errors

## 🎉 Success!

Once set up, your deployment will be fully automated:

- ✅ Push to main branch
- ✅ Automatic build and test
- ✅ Deploy to Firebase Functions
- ✅ Deploy to App Hosting
- ✅ Update GCE backend services
- ✅ Health checks and monitoring
- ✅ Rollback on failure

Your WISPTools.io platform will stay up-to-date automatically! 🚀