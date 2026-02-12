---
title: Backend Deployment Instructions
description: Deploy backend to GCE (SSH, gcloud, PM2).
---

# Backend Deployment Instructions

## Status: gcloud Authenticated ✅

You're now authenticated as: `david@4gengineer.com`

---

## Option 1: Direct SSH to Server (If you have SSH access)

If you have direct SSH access to the server at `hss.wisptools.io` or `136.112.111.167`, you can deploy directly:

```bash
# SSH to the server (using your SSH key or password)
ssh user@hss.wisptools.io
# OR
ssh user@136.112.111.167

# Once connected, run:
cd /opt/lte-pci-mapper 2>/dev/null || cd /root/lte-pci-mapper
git pull origin main
cd backend-services
npm install --production
pm2 restart all
pm2 save
pm2 status
```

---

## Option 2: Find Correct GCE Project/Instance

The instance might be in a different GCP project. Let's check:

```powershell
# List all projects you have access to
gcloud projects list

# Switch to the correct project (if different)
gcloud config set project PROJECT_ID

# List instances in that project
gcloud compute instances list

# If you find the instance, note its name and zone, then:
gcloud compute ssh INSTANCE_NAME --zone=ZONE --tunnel-through-iap
```

---

## Option 3: Manual Deployment Script

If the server is accessible via other means, here's what needs to be run on the server:

```bash
#!/bin/bash
# Run these commands on the backend server

# Navigate to repository
cd /opt/lte-pci-mapper 2>/dev/null || cd /root/lte-pci-mapper

# Pull latest changes from GitHub
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Check latest commit
echo "📝 Latest commit:"
git log -1 --oneline

# Install/update dependencies
echo "📦 Installing dependencies..."
cd backend-services
npm install --production

# Restart services
echo "🔄 Restarting PM2 services..."
pm2 restart all --update-env
pm2 save

# Show status
echo "📊 Service Status:"
pm2 status

echo ""
echo "✅ Backend deployment complete!"
```

---

## Environment variables

Copy `backend-services/.env.example` to `backend-services/.env` and set at least:

- **MONGODB_URI** – MongoDB connection string.
- **INTERNAL_API_KEY** – Same value as in Firebase Functions (for internal/cron routes).
- **API_BASE_URL** (optional) – Public base URL for the API (e.g. `https://hss.wisptools.io`). Used for deployment photo URLs (GridFS) and any links the backend generates. If the backend is behind a load balancer or custom domain, set this so generated URLs are correct.

See `backend-services/.env.example` for all options.

---

## What Gets Deployed

**File Changed**: `backend-services/routes/monitoring-graphs.js`

**Changes**:
1. Fixed ping stats response format (`avg_response_time_ms`, `current_status`)
2. Fixed status dataset format for ECharts compatibility
3. Added missing SNMP throughput datasets (interface_in_octets, interface_out_octets)

---

## Verification

After deployment, verify the changes are live:

```bash
# Test the endpoint (replace with your tenant ID and token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Tenant-ID: YOUR_TENANT_ID" \
     https://hss.wisptools.io/api/monitoring/graphs/devices

# Check PM2 logs for errors
pm2 logs main-api --lines 50
```

---

## Current Status

- ✅ **Frontend**: Deployed and live
- ✅ **Code**: Committed and pushed to GitHub
- ⏳ **Backend**: Needs to be deployed to server

The backend code is ready on GitHub - it just needs to be pulled and services restarted on the server.

