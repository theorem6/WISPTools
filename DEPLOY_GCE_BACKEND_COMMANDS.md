# Deploy GCE Backend ISO Route - Commands to Run

## Quick Deployment (One-liner)

Run this on the GCE server via SSH:

```bash
ssh root@136.112.111.167 << 'DEPLOY'
cd /root/lte-pci-mapper
git pull origin main
mkdir -p /opt/gce-backend/routes
cp gce-backend/routes/epc-deployment.js /opt/gce-backend/routes/
cp gce-backend/server.js /opt/gce-backend/
systemctl daemon-reload
systemctl restart gce-backend.service
sleep 3
curl http://localhost:3002/health
echo ""
echo "✅ Deployment complete!"
DEPLOY
```

## Or Step-by-Step on GCE Server

```bash
# 1. SSH into the server
ssh root@136.112.111.167

# 2. Navigate to repo
cd /root/lte-pci-mapper

# 3. Pull latest code
git pull origin main

# 4. Copy updated files
mkdir -p /opt/gce-backend/routes
cp gce-backend/routes/epc-deployment.js /opt/gce-backend/routes/
cp gce-backend/server.js /opt/gce-backend/

# 5. Restart service
systemctl daemon-reload
systemctl restart gce-backend.service

# 6. Check status
systemctl status gce-backend.service

# 7. Test endpoint
curl -X POST http://localhost:3002/api/deploy/generate-epc-iso \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-ID: test' \
  -d '{"siteName":"Test Site"}'
```

## Using Google Cloud Console (Browser SSH)

1. Go to: https://console.cloud.google.com/compute/instances
2. Click on your GCE instance
3. Click "SSH" button (opens browser terminal)
4. Run the commands above

## Verify Deployment

```bash
# Check service is running
systemctl status gce-backend.service

# Check port 3002 is listening
netstat -tlnp | grep 3002

# Test health endpoint
curl http://localhost:3002/health

# Test the route
curl -X POST http://localhost:3002/api/deploy/generate-epc-iso \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-ID: test' \
  -d '{"siteName":"Test"}'
```

## What Gets Deployed

1. **`gce-backend/routes/epc-deployment.js`** → `/opt/gce-backend/routes/epc-deployment.js`
   - Contains the `POST /generate-epc-iso` route handler

2. **`gce-backend/server.js`** → `/opt/gce-backend/server.js`
   - Mounts routes at both `/api/epc` and `/api/deploy`

3. **Service restart** → `systemctl restart gce-backend.service`
   - Loads the new routes

After deployment, the frontend should be able to generate ISOs successfully!

