# Complete Deployment Guide: Firebase App Hosting + GCE Backend

## 🎯 Overview

This guide provides step-by-step instructions for deploying the refactored LTE WISP Management Platform with:
- **Frontend**: Firebase App Hosting (SvelteKit)
- **Backend**: Google Compute Engine (GenieACS, STUN, Firmware Storage)

---

## 📋 Prerequisites

### Required Tools
- **gcloud CLI**: [Install Guide](https://cloud.google.com/sdk/docs/install)
- **Firebase CLI**: `npm install -g firebase-tools`
- **Git**: For version control
- **Node.js 20+**: For local development

### Required Access
- GCP Project: `lte-pci-mapper-65450042-bbf71`
- Firebase Project: Same as GCP
- IAM Permissions:
  - Compute Admin
  - Firebase Admin
  - Service Account User

### Required Information
- MongoDB Atlas connection URI
- Custom domain (optional, can use IP)
- Email for SSL certificates
- Firebase configuration (already set up)

---

## 🚀 Part 1: Deploy GCE Backend

### Step 1.1: Authenticate with Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set the project
gcloud config set project lte-pci-mapper-65450042-bbf71

# Verify authentication
gcloud auth list
gcloud config list
```

### Step 1.2: Create GCE Instance

```bash
# Navigate to the project directory
cd PCI_mapper

# Make the script executable
chmod +x gce-backend/create-gce-instance.sh

# Run the instance creation script
./gce-backend/create-gce-instance.sh
```

This script will:
- ✅ Reserve a static external IP
- ✅ Create firewall rules (HTTP/HTTPS, TR-069, STUN)
- ✅ Create the GCE instance (e2-standard-2)
- ✅ Display the external IP address

**Expected output:**
```
Instance Created Successfully!
Name:          genieacs-backend
Zone:          us-central1-a
External IP:   35.xxx.xxx.xxx
```

**⚠️ Important**: Note down the external IP address!

### Step 1.3: Copy Setup Script to Instance

```bash
# Copy the setup script to the GCE instance
gcloud compute scp gce-backend/setup-gce-instance.sh genieacs-backend:~ --zone=us-central1-a
```

### Step 1.4: SSH into GCE Instance

```bash
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

### Step 1.5: Run Setup Script on GCE Instance

Once connected via SSH:

```bash
# Make the script executable
chmod +x setup-gce-instance.sh

# Run the setup script
./setup-gce-instance.sh
```

You will be prompted for:

1. **MongoDB Connection URI**:
   ```
   mongodb+srv://genieacs-user:<password>@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority
   ```
   (Replace `<password>` with your MongoDB password)

2. **MongoDB Database Name**: `genieacs` (or press Enter for default)

3. **External Domain or IP**: 
   - If using a domain: `genieacs.yourdomain.com`
   - If using IP only: Your GCE external IP

4. **Firebase App URL**: `https://lte-pci-mapper-nfomthzoza-uc.a.run.app`

5. **Email for Let's Encrypt SSL**: Your email address

The script will then:
- ✅ Install Docker, Node.js, Nginx, Coturn
- ✅ Deploy GenieACS containers (CWMP, NBI, FS, UI)
- ✅ Set up Backend API server
- ✅ Configure STUN server
- ✅ Set up Nginx reverse proxy
- ✅ Configure firewall (UFW)
- ✅ Start all services
- ✅ Configure SSL (if using domain)

**Expected time**: 10-15 minutes

### Step 1.6: Verify Backend Deployment

Still on the GCE instance:

```bash
# Check all services
/opt/monitor.sh

# Test health endpoint
curl http://localhost:3000/health

# Check GenieACS containers
docker ps

# Check Backend API
sudo systemctl status backend-api

# Check STUN server
sudo systemctl status coturn

# Check Nginx
sudo systemctl status nginx
```

Expected health check response:
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

### Step 1.7: Configure DNS (If Using Custom Domain)

If you're using a custom domain instead of just the IP:

1. Go to your domain registrar (e.g., Namecheap, GoDaddy, Cloudflare)
2. Add an **A record**:
   - **Name**: `genieacs` (or `@` for root domain)
   - **Type**: `A`
   - **Value**: Your GCE external IP
   - **TTL**: 300 (5 minutes)

3. Wait for DNS propagation (5-30 minutes)

4. Test DNS resolution:
   ```bash
   nslookup genieacs.yourdomain.com
   ```

5. If DNS is working, obtain SSL certificate:
   ```bash
   sudo certbot --nginx -d genieacs.yourdomain.com
   ```

### Step 1.8: Test Backend from External Network

From your local machine (not SSH):

```bash
# Replace with your actual domain/IP
BACKEND_URL="https://genieacs.yourdomain.com"

# Test health endpoint
curl ${BACKEND_URL}/api/health

# Test GenieACS NBI
curl ${BACKEND_URL}/nbi/devices

# Test STUN server (requires STUN client)
# You can use online STUN test tools or:
npm install -g stun
stun YOUR-GCE-IP 3478
```

---

## 🎨 Part 2: Deploy Frontend to Firebase App Hosting

### Step 2.1: Update Frontend Configuration

From your local machine:

```bash
# Navigate to Module_Manager directory
cd Module_Manager

# Copy the GCE-specific apphosting.yaml
cp apphosting.yaml.gce-backend apphosting.yaml

# Edit apphosting.yaml with your actual values
nano apphosting.yaml
```

Replace the following placeholders:
- `<YOUR-GCE-DOMAIN>` → Your domain or `https://YOUR-IP`
- `<YOUR-GCE-IP>` → Your GCE external IP address

**Example**:
```yaml
- variable: PUBLIC_BACKEND_API_URL
  value: "https://genieacs.yourdomain.com/api"

- variable: PUBLIC_GENIEACS_CWMP_URL
  value: "http://35.123.45.67:7547"

- variable: PUBLIC_STUN_SERVER
  value: "stun:35.123.45.67:3478"
```

### Step 2.2: Test Frontend Locally

```bash
# Install dependencies
npm install

# Test build
npm run build

# Preview production build
npm run preview
```

Open browser to `http://localhost:4173` and verify:
- ✅ Login works
- ✅ Dashboard loads
- ✅ Backend API connection (check browser console)
- ✅ No CORS errors

### Step 2.3: Deploy to Firebase App Hosting

From the project root:

```bash
# Login to Firebase
firebase login

# Deploy App Hosting
firebase deploy --only apphosting

# Or deploy everything (App Hosting + Functions + Firestore)
firebase deploy
```

**Expected time**: 5-10 minutes

### Step 2.4: Route Traffic to Latest Version

After deployment:

```bash
# Route 100% traffic to the latest version
gcloud run services update-traffic lte-pci-mapper \
  --region=us-central1 \
  --project=lte-pci-mapper-65450042-bbf71 \
  --to-latest
```

### Step 2.5: Verify Frontend Deployment

```bash
# Get the App Hosting URL
firebase apphosting:backends:list

# Test the production URL
curl https://lte-pci-mapper-nfomthzoza-uc.a.run.app
```

Open in browser:
```
https://lte-pci-mapper-nfomthzoza-uc.a.run.app
```

Verify:
- ✅ Application loads
- ✅ Login functionality
- ✅ Backend API connection
- ✅ GenieACS integration
- ✅ Map rendering

---

## 🔍 Part 3: Testing & Verification

### Test Checklist

#### Backend Tests
```bash
# From your local machine

# 1. Health check
curl https://genieacs.yourdomain.com/api/health

# 2. GenieACS NBI
curl https://genieacs.yourdomain.com/nbi/devices

# 3. Backend API
curl https://genieacs.yourdomain.com/api/devices/stats

# 4. STUN configuration
curl https://genieacs.yourdomain.com/api/stun/config

# 5. GenieACS UI (open in browser)
open https://genieacs.yourdomain.com/admin/
```

#### Frontend Tests
- [ ] Login with Firebase Auth
- [ ] Dashboard displays correctly
- [ ] PCI Resolution module loads
- [ ] ACS/CPE Management module loads
- [ ] Map renders (ArcGIS)
- [ ] Device list loads (GenieACS integration)
- [ ] No console errors

#### CPE Device Connection Test
Configure a test CPE device to connect to:
```
ACS URL: http://YOUR-GCE-IP:7547
```

Monitor CWMP logs:
```bash
# On GCE instance
docker logs genieacs-cwmp -f
```

### Common Issues & Solutions

#### Issue: Health check fails
```bash
# Check if services are running
docker ps
sudo systemctl status backend-api

# Check firewall
sudo ufw status
```

#### Issue: CORS errors in browser console
```bash
# Check Nginx configuration
sudo nginx -t
sudo cat /etc/nginx/sites-available/genieacs-backend | grep CORS

# Verify ALLOWED_ORIGINS in backend
cat /opt/backend-api/.env | grep ALLOWED_ORIGINS
```

#### Issue: CPE devices can't connect
```bash
# Check CWMP port is accessible
curl -I http://YOUR-GCE-IP:7547

# Check firewall rule
gcloud compute firewall-rules describe allow-tr069-cwmp

# Check Docker container
docker logs genieacs-cwmp
```

#### Issue: SSL certificate errors
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Check Nginx SSL config
sudo nginx -t
```

---

## 📊 Part 4: Monitoring & Maintenance

### Set Up Monitoring

#### On GCE Instance

Create monitoring cron job:
```bash
# Edit crontab
crontab -e

# Add monitoring job (every 5 minutes)
*/5 * * * * /opt/monitor.sh >> /var/log/monitor.log 2>&1
```

#### Set Up Alerts (Optional)

Using Google Cloud Monitoring:

```bash
# Create uptime check for backend
gcloud monitoring uptime-configs create backend-health \
  --resource-type=uptime-url \
  --host=genieacs.yourdomain.com \
  --path=/api/health

# Create uptime check for CWMP
gcloud monitoring uptime-configs create cwmp-health \
  --resource-type=uptime-url \
  --host=YOUR-GCE-IP \
  --port=7547 \
  --path=/
```

### Regular Maintenance Tasks

#### Daily
```bash
# Check service health
/opt/monitor.sh

# Review logs for errors
sudo journalctl -u backend-api --since today | grep error
docker-compose -f /opt/genieacs/docker-compose.yml logs --since today | grep error
```

#### Weekly
```bash
# Backup firmware files
/opt/backup-firmware.sh

# Check disk space
df -h

# Update packages
sudo apt-get update
sudo apt-get upgrade -y
```

#### Monthly
```bash
# Review costs
gcloud billing accounts list

# Update SSL certificates (automatic, but verify)
sudo certbot renew --dry-run

# Review security logs
sudo grep -i "failed" /var/log/auth.log | tail -50
```

### Backup Strategy

#### Automated Firmware Backup to Cloud Storage

```bash
# On GCE instance
# Set up daily backup to Cloud Storage
crontab -e

# Add this line:
0 2 * * * /opt/backup-firmware.sh >> /var/log/firmware-backup.log 2>&1
```

#### Configuration Backup

```bash
# Create backup of all configurations
cd /tmp
tar -czf configs-$(date +%Y%m%d).tar.gz \
  /opt/genieacs/docker-compose.yml \
  /opt/backend-api/ \
  /etc/nginx/sites-available/genieacs-backend \
  /etc/turnserver.conf

# Upload to Cloud Storage
gsutil cp configs-$(date +%Y%m%d).tar.gz gs://your-backup-bucket/configs/
```

#### GCE Snapshot

```bash
# From local machine
# Create weekly snapshot
gcloud compute disks snapshot genieacs-backend \
  --zone=us-central1-a \
  --snapshot-names=genieacs-weekly-$(date +%Y%m%d)

# Set up automated snapshots
gcloud compute resource-policies create snapshot-schedule weekly-snapshots \
  --region=us-central1 \
  --max-retention-days=30 \
  --weekly-schedule=SUNDAY \
  --start-time=02:00

gcloud compute disks add-resource-policies genieacs-backend \
  --resource-policies=weekly-snapshots \
  --zone=us-central1-a
```

---

## 🔐 Part 5: Security Hardening

### Implement API Authentication

Update Backend API to validate Firebase tokens:

```javascript
// /opt/backend-api/server.js

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

// Authentication middleware
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Apply to protected routes
app.post('/firmware/upload', authenticateUser, upload.single('firmware'), ...);
```

### Enable Cloud Armor (DDoS Protection)

```bash
# Create security policy
gcloud compute security-policies create genieacs-armor \
  --description "DDoS protection for GenieACS backend"

# Add rate limiting rule
gcloud compute security-policies rules create 1000 \
  --security-policy genieacs-armor \
  --expression "true" \
  --action "rate-based-ban" \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 60 \
  --ban-duration-sec 600

# Apply to backend service (if using Load Balancer)
gcloud compute backend-services update genieacs-backend \
  --security-policy genieacs-armor
```

### Restrict SSH Access

```bash
# Allow SSH only from your IP
gcloud compute firewall-rules update default-allow-ssh \
  --source-ranges YOUR-IP/32
```

### Enable Audit Logging

```bash
# Enable Cloud Logging
gcloud projects add-iam-policy-binding lte-pci-mapper-65450042-bbf71 \
  --member serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role roles/logging.logWriter
```

---

## 📈 Part 6: Scaling & Optimization

### Scale GCE Instance

If you need more resources:

```bash
# Stop instance
gcloud compute instances stop genieacs-backend --zone=us-central1-a

# Change machine type
gcloud compute instances set-machine-type genieacs-backend \
  --zone=us-central1-a \
  --machine-type=e2-standard-4

# Start instance
gcloud compute instances start genieacs-backend --zone=us-central1-a
```

### Scale Frontend

Update `Module_Manager/apphosting.yaml`:

```yaml
runConfig:
  cpu: 2
  memoryMiB: 4096
  minInstances: 1  # Keep 1 instance warm
  maxInstances: 10  # Scale to 10 instances
```

### Load Balancing (Future Enhancement)

For high availability, set up:
- Multiple GCE instances
- Load Balancer
- Health checks
- Auto-scaling

---

## 🎉 Deployment Complete!

Your application is now running with:

### Frontend
- **URL**: https://lte-pci-mapper-nfomthzoza-uc.a.run.app
- **Platform**: Firebase App Hosting
- **Features**: SvelteKit, ArcGIS Maps, Firebase Auth

### Backend
- **URL**: https://genieacs.yourdomain.com
- **Platform**: Google Compute Engine
- **Services**: GenieACS, STUN, Firmware Storage

### Service Endpoints
- Health: `https://genieacs.yourdomain.com/api/health`
- GenieACS NBI: `https://genieacs.yourdomain.com/nbi/`
- GenieACS UI: `https://genieacs.yourdomain.com/admin/`
- CWMP: `http://YOUR-IP:7547`
- STUN: `stun:YOUR-IP:3478`

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs on GCE instance
3. Check Firebase/GCP console
4. Review GitHub issues

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-10  
**Status**: Production Ready

