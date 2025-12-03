# Fixes Summary - Graphs, SNMP Discovery, and Uptime

## ✅ Issue 1: Graphs Not Showing - FIXED

### Problem
- Graphs endpoint was excluding discovered SNMP devices that didn't have a `siteId`
- Discovered devices from EPC agents were not being included in the graphs list

### Solution
1. **Removed `siteId` requirement** from graphs endpoint (`backend-services/routes/monitoring-graphs.js`)
   - Changed query to include all network equipment, not just those with `siteId`
   - Discovered devices may not be deployed yet but should still be graphable

2. **Enhanced device detection** for discovered SNMP devices
   - Added check for `discovery_source === 'epc_snmp_agent'`
   - Always include discovered devices in graphs (they have SNMP capability)
   - Improved device name/model detection from discovery metadata

### Files Changed
- `backend-services/routes/monitoring-graphs.js` (lines 263-322)

---

## ✅ Issue 2: SNMP Discovery Data Storage - VERIFIED

### Verification
SNMP discovery data **IS** being recorded during checkin:

1. **Check-in Agent** (`backend-services/scripts/epc-checkin-agent.sh`)
   - Lines 607-633: Triggers SNMP discovery every hour
   - Runs `epc-snmp-discovery.sh` or `epc-snmp-discovery.js` in background
   - Discovery script sends data to `/api/epc/snmp/discovered`

2. **Backend Route** (`backend-services/routes/epc-snmp.js`)
   - Lines 231-301: Stores discovered devices with full metadata
   - Includes: `discovery_source: 'epc_snmp_agent'`
   - Sets `enable_graphs: true` by default
   - Stores all SNMP data: OIDs, interfaces, ARP tables, neighbors (CDP/LLDP)

3. **Check-in Service** (`backend-services/routes/epc-checkin.js`)
   - Records `system.uptime_seconds` in `epc.metrics.system_uptime_seconds`
   - Stores service status including uptime in `EPCServiceStatus` collection

### Data Flow
```
EPC Device Check-in (every 60s)
  ↓
Collects system metrics (CPU, memory, uptime)
  ↓
Sends to /api/epc/checkin
  ↓
Stored in RemoteEPC and EPCServiceStatus collections

SNMP Discovery (every 1 hour)
  ↓
Runs discovery script on EPC
  ↓
Sends discovered devices to /api/epc/snmp/discovered
  ↓
Stored in NetworkEquipment collection
  ↓
Available for graphs and monitoring
```

### Files Verified
- `backend-services/scripts/epc-checkin-agent.sh` (SNMP discovery trigger)
- `backend-services/routes/epc-snmp.js` (SNMP discovery storage)
- `backend-services/routes/epc-checkin.js` (uptime storage)

---

## ✅ Issue 3: Uptime Display in Monitoring - FIXED

### Problem
- Monitoring dashboard only showed device uptime percentage (online/offline ratio)
- Actual EPC system uptime (how long the system has been running) was not displayed

### Solution
1. **Added EPC System Uptime Card** to MonitoringMap component
   - New function `getEPCSystemUptime()` extracts and formats actual system uptime
   - Parses uptime from EPC device metrics (supports formatted strings and seconds)
   - Shows the longest uptime among all EPC devices (most reliable)

2. **Enhanced Status Cards**
   - Kept "Device Uptime" card showing online percentage
   - Added "EPC System Uptime" card showing actual runtime (e.g., "10d 5h 30m")
   - Card only appears if EPC devices with uptime data exist

### Files Changed
- `Module_Manager/src/routes/modules/monitoring/components/MonitoringMap.svelte`
  - Added `getEPCSystemUptime()` function (lines 189-230)
  - Added EPC System Uptime status card in template
  - Enhanced CSS for 5-card grid layout

### Data Source
- EPC uptime comes from `/api/monitoring/epc/list` endpoint
- Route extracts uptime from:
  1. Latest `EPCServiceStatus` collection entry (`system.uptime_seconds`)
  2. Fallback to `RemoteEPC.metrics.system_uptime_seconds`
- Uptime is formatted using `formatUptime()` helper function

---

## 📋 Testing Checklist

- [ ] Verify graphs endpoint returns discovered SNMP devices
- [ ] Confirm SNMP discovery runs during EPC check-in
- [ ] Verify discovered devices appear in graphs panel
- [ ] Check EPC system uptime displays correctly in monitoring dashboard
- [ ] Confirm device uptime percentage still works
- [ ] Test with deployed and non-deployed SNMP devices

---

## 🔧 Next Steps

1. **Deploy backend changes** to GCE server
   - Update `monitoring-graphs.js` route
   - Verify SNMP discovery is running

2. **Deploy frontend changes** to Firebase
   - Update `MonitoringMap.svelte` component
   - Test uptime display

3. **Verify end-to-end**
   - Wait for EPC check-in to trigger SNMP discovery
   - Check that discovered devices appear in graphs
   - Verify uptime displays correctly
