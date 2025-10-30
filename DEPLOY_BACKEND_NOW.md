# 🚀 Deploy Backend EPC Route to GCE - Quick Guide

The EPC deployment route (`/api/deploy/generate-epc-iso`) needs to be deployed to the GCE backend server.

## Quick Deploy (One Command)

**SSH to GCE server:**
```bash
ssh root@136.112.111.167 "cd /root/lte-pci-mapper && git pull && sudo bash scripts/deployment/deploy-backend-epc-route.sh"
```

Or step by step:

```bash
# 1. SSH into server
ssh root@136.112.111.167

# 2. Pull latest code
cd /root/lte-pci-mapper
git pull origin main

# 3. Run deployment script
sudo bash scripts/deployment/deploy-backend-epc-route.sh
```

## What This Does

1. ✅ Pulls latest code from GitHub
2. ✅ Stops the `hss-api` service
3. ✅ Copies `backend-services/routes/epc-deployment.js` to `/opt/hss-api/routes/`
4. ✅ Updates `server.js` to register the route
5. ✅ Verifies syntax
6. ✅ Restarts the service
7. ✅ Tests the endpoint

## Verify Deployment

```bash
# Check service status
systemctl status hss-api

# Check logs
journalctl -u hss-api -n 50 -f

# Test endpoint
curl http://localhost:3001/api/deploy/generate-epc-iso -X POST \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: test" \
  -d '{"siteName":"test","location":{},"networkConfig":{},"contact":{},"hssConfig":{}}'
```

## Expected Result

The endpoint should be available at:
- **Local**: `http://localhost:3001/api/deploy/generate-epc-iso`
- **External**: `http://136.112.111.167:3001/api/deploy/generate-epc-iso`
- **Via Proxy**: `https://hss.wisptools.io/api/deploy/generate-epc-iso`


