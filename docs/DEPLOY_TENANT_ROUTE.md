# Quick Deployment Guide for Tenant Route

## Issue: 404 on /api/tenants

The route file exists but hasn't been deployed to GCE backend yet.

## Files to Deploy:

1. `backend-services/routes/tenants.js` - New user tenant creation route
2. `backend-services/server.js` - Updated to mount the route
3. `backend-services/config/firebase.js` - Firebase Admin SDK config (if not already deployed)

## Deployment Commands:

```bash
# Copy tenant route
gcloud compute scp backend-services/routes/tenants.js acs-hss-server:/opt/hss-api/routes/ --zone=us-central1-a

# Copy updated server.js
gcloud compute scp backend-services/server.js acs-hss-server:/opt/hss-api/ --zone=us-central1-a

# Copy Firebase config (if needed)
gcloud compute scp backend-services/config/firebase.js acs-hss-server:/opt/hss-api/config/ --zone=us-central1-a

# Restart backend
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="cd /opt/hss-api && pm2 restart main-api"
```

## Verify Deployment:

After deployment, check logs:
```bash
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="cd /opt/hss-api && pm2 logs main-api --lines 50"
```

You should see:
- `✅ Firebase Admin initialized successfully`
- `🚀 User Management System API running on port 3001`
- Route mounting confirmation

## Additional: Fix Firebase Admin SDK 401 Error

The 401 error on `/api/user-tenants` is because the backend Firebase Admin SDK needs the service account key:

```bash
# Copy service account key to GCE
gcloud compute scp wisptools-production-firebase-adminsdk-fbsvc-9c4b245a08.json acs-hss-server:/opt/hss-api/wisptools-production-firebase-adminsdk.json --zone=us-central1-a

# Restart backend
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="cd /opt/hss-api && pm2 restart main-api"
```

Then set environment variable or ensure the file is in the expected location.

