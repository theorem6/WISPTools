# API Architecture - Isolated Multi-Port System

## Overview

This architecture isolates each API service into its own port and process, preventing changes to one service from affecting others. Each service can be deployed, updated, and rolled back independently.

## Service Port Allocation

| Service Name | Port | Script | Purpose | Status |
|-------------|------|--------|---------|--------|
| **main-api** | 3001 | `server.js` | Unified Main API - All routes except deploy | ✅ Active |
| **epc-api** | 3002 | `min-epc-server.js` | EPC/ISO Generation API | ✅ Active |
| **genieacs-ui** | 3000 | (external) | GenieACS Web UI | ✅ Active |
| **genieacs-nbi** | 7557 | (external) | GenieACS NBI API | ✅ Active |
| **genieacs-cwmp** | 7547 | (external) | GenieACS CWMP | ✅ Active |
| **genieacs-fs** | 7567 | (external) | GenieACS FS | ✅ Active |

## Main API (Port 3001) - `main-api`

**Routes Handled:**
- `/api/users` - User management
- `/api/tenants` - Tenant management
- `/api/user-tenants` - User-tenant associations
- `/api/customers` - Customer management
- `/api/work-orders` - Work orders
- `/api/inventory` - Inventory management
- `/api/plans` - Deployment plans
- `/api/network` - Network assets (sites, sectors, CPE)
- `/api/hss` - HSS management (Open5GS subscribers)
- `/api/monitoring` - System monitoring
- `/api/maintain` - Maintenance module
- `/api/billing` - Billing operations
- `/api/system` - System operations
- `/api/equipment-pricing` - Equipment pricing
- `/api/installation-documentation` - Installation docs
- `/api/subcontractors` - Subcontractor management
- `/api/notifications` - Notifications
- `/admin/**` - Admin routes

**Health Check:** `http://localhost:3001/health`

## EPC API (Port 3002) - `epc-api`

**Routes Handled:**
- `/api/deploy/**` - EPC deployment
- `/api/deploy/generate-epc-iso` - ISO image generation
- `/api/deploy/bootstrap` - Bootstrap scripts

**Health Check:** `http://localhost:3002/health`

## Process Management

All services are managed by **PM2** using the ecosystem configuration file:

```bash
# Start all services
pm2 start ecosystem.config.js

# Start specific service
pm2 start ecosystem.config.js --only main-api

# Restart specific service
pm2 restart main-api

# Stop specific service
pm2 stop main-api

# View logs
pm2 logs main-api
pm2 logs epc-api

# View status
pm2 status
```

## Deployment Strategy

### Safe Deployment Script

Use `deploy-api.sh` for safe deployments:

```bash
# Deploy all services
./deploy-api.sh all

# Deploy specific service
./deploy-api.sh main-api
./deploy-api.sh epc-api
```

**Features:**
- ✅ Pre-deployment health checks
- ✅ Automatic backups before deployment
- ✅ Post-deployment health checks
- ✅ Automatic rollback on failure
- ✅ Isolated service updates (one service doesn't affect others)

### Manual Deployment

```bash
# 1. Backup current service
gcloud compute ssh acs-hss-server --zone=us-central1-a \
  --command="cp /opt/gce-backend/server.js /opt/gce-backend/backups/server.js.$(date +%Y%m%d_%H%M%S)"

# 2. Copy new file
gcloud compute scp backend-services/server.js \
  acs-hss-server:/opt/gce-backend/server.js \
  --zone=us-central1-a

# 3. Restart only the affected service
gcloud compute ssh acs-hss-server --zone=us-central1-a \
  --command="pm2 restart main-api"

# 4. Verify health
gcloud compute ssh acs-hss-server --zone=us-central1-a \
  --command="curl -s http://localhost:3001/health"
```

## Rollback Procedure

If a deployment breaks a service:

```bash
# Automatic rollback (via deploy script)
./deploy-api.sh main-api  # Will auto-rollback on failure

# Manual rollback
gcloud compute ssh acs-hss-server --zone=us-central1-a \
  --command="
    LATEST_BACKUP=\$(ls -t /opt/gce-backend/backups/main-api/server.js.* | head -1);
    cp \$LATEST_BACKUP /opt/gce-backend/server.js;
    pm2 restart main-api
  "
```

## Firebase Function Proxies

| Function | Routes | Backend Port | Service |
|----------|--------|--------------|---------|
| `apiProxy` | `/api/**` (except `/api/deploy/**`), `/admin/**` | 3001 | main-api |
| `isoProxy` | `/api/deploy/**` | 3002 | epc-api |

## Benefits of This Architecture

1. **Isolation**: Each service runs independently - updating one doesn't affect others
2. **Independent Scaling**: Services can be scaled separately based on load
3. **Safe Updates**: Deployments include health checks and automatic rollback
4. **Easy Debugging**: Each service has its own logs and process
5. **Resource Management**: Each service can have different memory/CPU limits
6. **Zero Downtime**: Services can be updated one at a time without affecting others

## Monitoring

```bash
# Check all services
pm2 status

# Check specific service logs
pm2 logs main-api --lines 50
pm2 logs epc-api --lines 50

# Monitor resource usage
pm2 monit

# Check service health
curl http://localhost:3001/health
curl http://localhost:3002/health
```

## Troubleshooting

### Service Won't Start

1. Check if port is in use:
   ```bash
   sudo lsof -i:3001
   sudo lsof -i:3002
   ```

2. Kill conflicting processes:
   ```bash
   sudo pkill -9 -f "node.*server.js"
   ```

3. Restart service:
   ```bash
   pm2 restart main-api
   ```

### Service Keeps Crashing

1. Check logs:
   ```bash
   pm2 logs main-api --err --lines 100
   ```

2. Check PM2 status:
   ```bash
   pm2 status
   ```

3. Restart with fresh state:
   ```bash
   pm2 delete main-api
   pm2 start ecosystem.config.js --only main-api
   ```

### Port Conflict

If multiple processes are using the same port:

```bash
# Find all processes on port
sudo lsof -i:3001

# Kill specific process
sudo kill -9 <PID>

# Or kill all node processes (use with caution)
sudo pkill -9 node

# Restart PM2 services
pm2 restart all
```

## Future Expansion

To add a new API service:

1. Create new service file (e.g., `new-service.js`)
2. Add to `ecosystem.config.js`:
   ```javascript
   {
     name: 'new-service',
     script: './new-service.js',
     env: { PORT: 3003 },
     // ... other config
   }
   ```
3. Add to `deploy-api.sh` SERVICES array
4. Update Firebase Functions if needed
5. Deploy: `./deploy-api.sh new-service`

