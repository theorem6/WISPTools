# Cloud Backend Services - SNMP/Ping Disabled

## Summary

All SNMP polling and ping monitoring services have been **DISABLED** on the cloud backend (GCE server). These services should **ONLY** run on remote EPC agents.

## Why Disabled

The cloud backend cannot:
- Reach devices on private IP addresses (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
- Access devices behind NAT or firewalls
- Perform effective network discovery on remote networks

## Changes Made

### 1. Automatic Services Disabled

**File**: `backend-services/server.js`
- ✅ SNMP Polling Service - DISABLED (commented out)
- ✅ Ping Monitoring Service - DISABLED (commented out)
- Added clear comments explaining why services are disabled

### 2. Manual Poll Route Disabled

**File**: `backend-services/routes/snmp-routes/snmp-metrics.js`
- ✅ Manual SNMP poll endpoint (`POST /api/snmp/poll/:deviceId`) now returns error
- Returns HTTP 503 with explanation that polling is disabled
- Suggests using remote EPC agents instead

## Correct Architecture

**Remote EPC Agents** (on customer networks):
- ✅ Run SNMP discovery (`epc-snmp-discovery.js`)
- ✅ Perform ping monitoring (via check-in agent)
- ✅ Report discovery data to cloud backend
- ✅ Report ping metrics to cloud backend

**Cloud Backend** (GCE server):
- ❌ Does NOT run SNMP polling
- ❌ Does NOT run ping sweeps
- ✅ Receives discovery data from agents
- ✅ Receives ping metrics from agents
- ✅ Stores and serves data via API
- ✅ Provides endpoints for agents to report data

## Next Steps

1. ✅ Code changes committed and pushed to GitHub
2. ⏭️ Deploy to GCE server (pull latest code and restart backend services)
3. ✅ Remote EPC agents already configured to perform discovery and monitoring

## Deployment

To deploy these changes:

```bash
# SSH to GCE server
gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap

# Pull latest code
cd /opt/lte-pci-mapper
sudo git pull origin main

# Restart backend services
cd /opt/lte-pci-mapper
pm2 restart ecosystem.config.js
```

## Verification

After deployment, check logs to confirm services are disabled:

```bash
# Check server startup logs
pm2 logs main-api --lines 50 | grep -i "snmp\|ping"

# Should see:
# ⚠️ SNMP polling service DISABLED - cloud backend should not perform SNMP polling
# ⚠️ Ping monitoring service DISABLED - cloud backend should not perform ping sweeps
```

