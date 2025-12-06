# Manual Backend Deployment Instructions

Since automated deployment may require gcloud configuration, here are manual steps:

## Option 1: Using Git (Recommended if repo is on GitHub)

**On the GCE server:**
```bash
cd /opt/lte-pci-mapper
sudo bash scripts/deployment/update-backend-from-git.sh
```

This will pull latest code from GitHub and restart services.

## Option 2: Manual File Copy via SCP

**From your Windows machine:**

```powershell
# Set variables
$server = "acs-hss-server"
$zone = "us-central1-a"

# Copy files
gcloud compute scp backend-services/routes/epc-checkin.js ${server}:/opt/lte-pci-mapper/backend-services/routes/epc-checkin.js --zone=$zone --tunnel-through-iap

gcloud compute scp backend-services/services/epc-checkin-service.js ${server}:/opt/lte-pci-mapper/backend-services/services/epc-checkin-service.js --zone=$zone --tunnel-through-iap

gcloud compute scp backend-services/utils/epc-auto-update.js ${server}:/opt/lte-pci-mapper/backend-services/utils/epc-auto-update.js --zone=$zone --tunnel-through-iap

gcloud compute scp backend-services/scripts/check-queued-commands.js ${server}:/opt/lte-pci-mapper/backend-services/scripts/check-queued-commands.js --zone=$zone --tunnel-through-iap
```

**Then SSH to server and restart:**
```bash
gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap

# On server:
cd /opt/lte-pci-mapper

# Backup
mkdir -p backend-services/backups
cp backend-services/routes/epc-checkin.js backend-services/backups/epc-checkin.js.backup.$(date +%Y%m%d_%H%M%S)

# Verify syntax
node -c backend-services/routes/epc-checkin.js
node -c backend-services/services/epc-checkin-service.js
node -c backend-services/utils/epc-auto-update.js
node -c backend-services/scripts/check-queued-commands.js

# Make script executable
chmod +x backend-services/scripts/check-queued-commands.js

# Restart services
pm2 restart epc-api
pm2 restart hss-api  # if exists
pm2 restart main-api  # if exists

# Check status
pm2 status
```

## Option 3: Direct SSH and Edit

**SSH to server:**
```bash
gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap
```

**Then manually copy/paste the file contents or use git pull if changes are committed.**

## Quick Verification

After deployment, verify it worked:

```bash
# On server
cd /opt/lte-pci-mapper
node backend-services/scripts/check-queued-commands.js EPC-CB4C5042

# Check logs
pm2 logs epc-api --lines 20
```

---

**Files to deploy:**
1. `backend-services/routes/epc-checkin.js`
2. `backend-services/services/epc-checkin-service.js`
3. `backend-services/utils/epc-auto-update.js`
4. `backend-services/scripts/check-queued-commands.js` (new)

