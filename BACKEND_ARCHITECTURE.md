# Backend Service Architecture

## Overview

The backend uses a **unified API architecture** with services organized by port and function.

## Service Ports

### Port 3001: Unified Main API Server ✅ (PRIMARY)
**Service**: `backend-services/server.js`  
**Status**: ✅ Active and handling all requests

**Routes Handled**:
- `/api/customers` - Customer management
- `/api/work-orders` - Work orders and tickets
- `/api/inventory` - Inventory management
- `/api/plans` - Service plans
- `/api/maintain` - Maintenance module (unified)
- `/api/hss` - HSS management (Open5GS subscribers)
- `/api/billing` - Billing operations
- `/api/network` - Network management
- `/api/monitoring` - System monitoring
- `/api/system` - System operations
- `/api/equipment-pricing` - Equipment pricing
- `/api/installation-documentation` - Installation docs
- `/api/subcontractors` - Subcontractor management
- `/admin/**` - Admin routes
- `/api/users`, `/api/tenants` - User and tenant management

**Database**: MongoDB Atlas  
**Health Check**: `http://136.112.111.167:3001/health`

### Port 3002: EPC/ISO Generation API ✅
**Service**: `min-epc-server.js` or `gce-backend/server.js`  
**Status**: ✅ Active

**Routes Handled**:
- `/api/deploy/**` - EPC deployment and ISO generation
- `/api/deploy/generate-epc-iso` - ISO image generation

**Health Check**: `http://136.112.111.167:3002/health`

### Port 3000: Reserved for Future Use ⏸️
**Status**: ⏸️ Currently unused, available if needed

**Potential Use**: Separate HSS service if services need to be split in the future  
**Current**: HSS routes are handled by the main API on port 3001 at `/api/hss`

## Firebase Function Proxies

### `apiProxy` (formerly `hssProxy`)
**Purpose**: HTTPS proxy for the unified main API (port 3001)  
**Routes**: `/api/**` (except `/api/deploy/**`) and `/admin/**`  
**Backend**: `http://136.112.111.167:3001`

### `isoProxy`
**Purpose**: HTTPS proxy for EPC/ISO API (port 3002)  
**Routes**: `/api/deploy/**`  
**Backend**: `http://136.112.111.167:3002`

## Architecture Decision

**Unified API Server (Port 3001)** is used because:
- ✅ Simpler to maintain - one codebase
- ✅ Shared authentication/authorization
- ✅ Consistent error handling
- ✅ Single database connection pool
- ✅ Easier debugging and logging
- ✅ All routes can share middleware

**Separate services would be needed if**:
- Different scaling requirements
- Different security boundaries
- Independent deployment cycles

## Firewall Configuration

All ports are open:
- **Port 3001**: `allow-hss-api-3001` (source: `0.0.0.0/0`, no tag restrictions)
- **Port 3002**: `allow-hss-api-3002` (source: `0.0.0.0/0`, no tag restrictions)
- **Port 3000**: `allow-hss-api` (source: `0.0.0.0/0`, targets: `acs-server` tag)

## Service Files

### Active Services

1. **Main API Server** (`backend-services/server.js`)
   - Location: `/opt/hss-api/server.js` or `/root/lte-pci-mapper/backend-services/server.js`
   - Port: 3001
   - Process: Multiple instances may run (check with `ps aux | grep server.js`)

2. **EPC/ISO Server** (`min-epc-server.js`)
   - Location: `/opt/gce-backend/server.js` or similar
   - Port: 3002
   - Process: Check with `ps aux | grep '3002\|epc'`

### Alternative Service Files (Not Currently Used)

- `backend-services/hss-server.js` - Standalone HSS server (port 3001)
- `backend-services/server-modular.js` - Alternative modular server (port 3000)
- `backend-services/min-epc-server.js` - EPC server (port 3002)

## Deployment

### Updating Services

```bash
# Update main API (port 3001)
gcloud compute scp backend-services/server.js acs-hss-server:/opt/hss-api/server.js --zone=us-central1-a
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="sudo systemctl restart hss-api"

# Update EPC API (port 3002)  
gcloud compute scp backend-services/min-epc-server.js acs-hss-server:/opt/gce-backend/server.js --zone=us-central1-a
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="pm2 restart epc-api"
```

## Monitoring

```bash
# Check service health
curl http://136.112.111.167:3001/health
curl http://136.112.111.167:3002/health

# Check listening ports
sudo netstat -tlnp | grep -E ':3001|:3002|:3000'

# Check running processes
ps aux | grep 'node.*server\|node.*3001\|node.*3002'
```

## Summary

✅ **Current Architecture**: Unified API on port 3001  
✅ **Firebase Function**: `apiProxy` (renamed from `hssProxy` for clarity)  
✅ **EPC Service**: Separate on port 3002  
⏸️ **Port 3000**: Reserved but unused  

This architecture is clean, maintainable, and scales well for current needs.

