# Safe API Deployment Guide

## Quick Start

### Deploy All Services
```bash
cd backend-services
./deploy-api.sh all
```

### Deploy Specific Service
```bash
./deploy-api.sh main-api
./deploy-api.sh epc-api
```

## Architecture Overview

- **Port 3001**: Main API (all routes except deploy)
- **Port 3002**: EPC/ISO API (deploy routes only)

Each service runs independently in PM2, so updating one doesn't affect the other.

## Manual Deployment Steps

1. **Backup current service:**
   ```bash
   gcloud compute ssh acs-hss-server --zone=us-central1-a \
     --command="mkdir -p /opt/gce-backend/backups/main-api && \
     cp /opt/gce-backend/server.js /opt/gce-backend/backups/main-api/server.js.\$(date +%Y%m%d_%H%M%S)"
   ```

2. **Copy new file:**
   ```bash
   gcloud compute scp backend-services/server.js \
     acs-hss-server:/opt/gce-backend/server.js \
     --zone=us-central1-a
   ```

3. **Restart only affected service:**
   ```bash
   gcloud compute ssh acs-hss-server --zone=us-central1-a \
     --command="pm2 restart main-api"
   ```

4. **Verify health:**
   ```bash
   gcloud compute ssh acs-hss-server --zone=us-central1-a \
     --command="curl -s http://localhost:3001/health"
   ```

## Rollback

If deployment breaks a service:

```bash
gcloud compute ssh acs-hss-server --zone=us-central1-a \
  --command="
    LATEST=\$(ls -t /opt/gce-backend/backups/main-api/server.js.* | head -1);
    cp \$LATEST /opt/gce-backend/server.js;
    pm2 restart main-api
  "
```

## PM2 Management

```bash
# View all services
pm2 status

# View logs
pm2 logs main-api
pm2 logs epc-api

# Restart service
pm2 restart main-api

# Stop service
pm2 stop main-api

# Start service
pm2 start ecosystem.config.js --only main-api
```

## Important Notes

1. **Always backup before deploying** - The deploy script does this automatically
2. **One service at a time** - Update services individually to prevent cascading failures
3. **Health checks** - Always verify service health after deployment
4. **Rollback ready** - Keep backups for quick rollback if needed

See `API_ARCHITECTURE.md` for complete documentation.

