# Backend Cloud Services - SNMP/Ping Disabled

## Problem

The cloud backend on GCE should **NEVER** run SNMP polling or ping sweeps. These operations:
- Cannot reach devices on private IP addresses (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
- Should only be performed by remote EPC agents on local networks
- Waste resources and will fail for most devices

## Solution

Both services have been **DISABLED** in `backend-services/server.js`:

1. **SNMP Polling Service** - DISABLED
   - Should only run on remote EPC agents
   - Cloud backend cannot access devices on private networks

2. **Ping Monitoring Service** - DISABLED
   - Should only run on remote EPC agents
   - Cloud backend cannot reach private IP addresses

## Architecture

**Remote EPC Agents** (on customer networks):
- ✅ Run SNMP discovery (`epc-snmp-discovery.js`)
- ✅ Perform ping monitoring (via check-in agent)
- ✅ Report results to cloud backend

**Cloud Backend** (GCE server):
- ❌ Does NOT run SNMP polling
- ❌ Does NOT run ping sweeps
- ✅ Receives discovery data from agents
- ✅ Receives ping metrics from agents
- ✅ Stores and serves data via API

## Changes Made

- `backend-services/server.js`: Commented out SNMP polling and ping monitoring service initialization
- Added clear comments explaining why these services are disabled

