# Monitoring Architecture - Remote Agent Based

## ✅ Current Status: Backend Services DISABLED

The backend **NEVER** runs ping or SNMP sweeps. All monitoring is performed by remote EPC/SNMP agents.

### Backend Services Status
- ✅ `ping-monitoring-service.js` - **DISABLED** in `server.js` (lines 154-165)
- ✅ `snmp-polling-service.js` - **DISABLED** in `server.js` (lines 142-152)

The backend only:
- Receives ping metrics from remote agents via `/api/epc/checkin/ping-metrics`
- Receives SNMP discovery data from remote agents via `/api/epc/snmp/discovered`
- Stores metrics in MongoDB for graphing
- Serves metrics to frontend via API endpoints

## Remote Agent NPM Modules

### Current Implementation
Remote agents use:
- **`ping-scanner`** - For ping sweeps (with native ping fallback)
- **`net-snmp`** - For SNMP queries (standard, well-maintained)
- **Native `ping` command** - Via `exec()` for individual pings

### Recommendations for Better NPM Modules

#### For Ping Monitoring:
1. **Current: `ping-scanner`** ⚠️
   - Status: Less actively maintained
   - Alternative: Use native `ping` command via `exec()` (already implemented as fallback)
   - Better: Consider `node-ping` or `ping` package for better cross-platform support

2. **Recommended: Native `ping` command** ✅
   - Already implemented in `epc-ping-monitor.js`
   - Most reliable, no dependencies
   - Works on all Linux systems
   - Current implementation is good

#### For SNMP:
1. **Current: `net-snmp`** ✅
   - Status: **EXCELLENT** - Industry standard
   - Well-maintained, comprehensive SNMP v1/v2c/v3 support
   - Native bindings for performance
   - **Keep using this** - it's the best option

2. **Alternative: `snmp-native`** (not recommended)
   - Less feature-complete than `net-snmp`
   - No significant advantages

### Recommended Changes

1. **Remove `ping-scanner` dependency** - Use native ping only
   - Already has fallback implemented
   - More reliable, no npm dependency needed
   - Update `install-epc-npm-packages.sh` to only install `net-snmp`

2. **Keep `net-snmp`** - It's the best SNMP library for Node.js

3. **Ensure backend never enables monitoring services**
   - Current code is correct (commented out)
   - Add explicit check to prevent accidental enabling

## Files to Update

1. `backend-services/scripts/install-epc-npm-packages.sh` - Remove `ping-scanner`
2. `backend-services/scripts/epc-snmp-discovery.js` - Already has native ping fallback
3. `backend-services/scripts/epc-ping-monitor.js` - Already uses native ping (good!)
4. `backend-services/server.js` - Add explicit guard to prevent enabling services

