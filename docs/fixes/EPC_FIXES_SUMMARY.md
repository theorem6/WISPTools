# EPC Monitoring Fixes - Implementation Summary

## ✅ Issue 1: EPC Monitoring Panel Missing CPU/Memory/Uptime - FIXED
**Status**: ✅ Completed

**Changes Made**:
- Updated `Module_Manager/src/lib/components/EPCMonitoringPanel.svelte`
- Added CPU Usage stat card to System Overview
- Added Memory Usage stat card with MB values
- System Uptime was already present, now all three metrics are visible

**Result**: EPC monitoring panel now displays:
- CPU Usage: `{serviceStatus?.system?.cpu_percent ?? 'N/A'}%`
- Memory Usage: `{serviceStatus?.system?.memory_percent ?? 'N/A'}%` with MB details
- System Uptime: Already working via `formatUptime(serviceStatus?.system?.uptime_seconds)`

---

## 🔧 Issue 2: EPC Name Should Use Actual Deployment Name
**Status**: In Progress

**Current Issue**:
- When device is restored or linked, name defaults to "Remote EPC Device" or "New EPC Device"
- Frontend displays `epc?.site_name || epc?.name || 'EPC Device'` (line 380 of EPCMonitoringPanel.svelte)
- Site name is set in `backend-services/routes/epc-deployment.js` line 365: `site_name: config?.site_name || 'New EPC Device'`

**Solution Options**:
1. **Quick Fix**: Update existing EPC record directly in database
   - Use script: `backend-services/scripts/update-epc-name.js YALNTFQC "Your Site Name"`
   
2. **Frontend Fix**: Add site name editing in Hardware page
   - EPC edit modal already exists at `Module_Manager/src/routes/modules/hardware/+page.svelte`
   - Need to add `site_name` field to edit form
   - Use existing PUT endpoint: `/api/hss/epcs/:id` (line 791 of hss-management.js)

3. **Backend Fix**: Update link-device endpoint to require site_name
   - Currently defaults to 'New EPC Device'
   - Should prompt user or use deployment wizard site name

**Recommended Approach**: Add site name field to EPC edit modal + provide update script

---

## 📡 Issue 3: SNMP Should Be Active Agent That Scans and Reports Devices
**Status**: Requires Implementation

**Current State**:
- `snmpd` daemon runs passively on EPC (responds to SNMP queries)
- No active scanning/discovery implemented
- Check-in agent (`epc-checkin-agent.sh`) doesn't scan for network devices

**Required Implementation**:

### 3.1 Add SNMP Discovery to Check-in Agent
**File**: `backend-services/scripts/epc-checkin-agent.sh`

Add function to:
1. Scan local network for SNMP-enabled devices
2. Test common SNMP communities (public, private)
3. Identify device type (Mikrotik, generic SNMP, etc.)
4. Report discovered devices in check-in payload

**New Check-in Payload Field**:
```json
{
  "device_code": "...",
  "snmp_discovered_devices": [
    {
      "ip_address": "192.168.1.100",
      "sysDescr": "...",
      "sysObjectID": "...",
      "device_type": "mikrotik",
      "community": "public",
      "last_seen": "..."
    }
  ]
}
```

### 3.2 Backend API for SNMP Discovery
**New Endpoint**: `POST /api/epc/:epc_id/snmp/discovered`

**Functionality**:
- Store discovered devices in `NetworkEquipment` collection
- Link to EPC via `epc_id` or device location
- Make available via `/api/snmp/devices`

**Database Schema Update**:
- Add `discovered_by_epc` field to `NetworkEquipment`
- Add `discovery_timestamp` field
- Add `snmp_config` field with community, version, OIDs

### 3.3 Frontend Display
- Show discovered devices in Monitoring page
- Add "Discovered by EPC" badge
- Allow manual device configuration/editing

---

## 🔍 Issue 4: SNMP Agent Should Walk OIDs and Auto-Configure Graphs
**Status**: Requires Implementation

**Current State**:
- SNMP collector service exists but doesn't auto-walk OIDs
- Graph configuration is manual
- No device type detection based on OIDs

**Required Implementation**:

### 4.1 OID Walking Function
**File**: `backend-services/services/snmpCollector.js`

Add function:
```javascript
async walkOIDs(deviceId, baseOID = '1.3.6.1.2.1') {
  // Walk OID tree to discover available metrics
  // Identify device type based on sysObjectID
  // Map OIDs to metric types (CPU, Memory, Interface, etc.)
}
```

### 4.2 Device Type Detection
**Logic**:
- Check `sysObjectID` (1.3.6.1.2.1.1.2.0)
- Mikrotik: `1.3.6.1.4.1.14988.*`
- Cisco: `1.3.6.1.4.1.9.*`
- Generic SNMP: Standard MIB-II OIDs

### 4.3 Auto Graph Configuration
**Based on Device Type**:
- **Mikrotik Router**: CPU, Memory, Interface throughput, Wireless stats
- **Mikrotik AP**: Wireless clients, Signal strength, CPU, Memory
- **Generic SNMP**: CPU, Memory, Disk, Interface stats
- **Switch**: Port utilization, Packet counts, Error rates

**Store Configuration**:
```javascript
{
  device_id: "...",
  device_type: "mikrotik_router",
  graph_config: {
    cpu: { oid: "...", type: "gauge", unit: "percent" },
    memory: { oid: "...", type: "gauge", unit: "percent" },
    interfaces: [
      { name: "ether1", in_octets: "...", out_octets: "..." }
    ]
  }
}
```

### 4.4 Frontend Graph Rendering
- Use stored graph configuration to render appropriate charts
- Automatically create graphs based on device type
- Allow manual graph customization

---

## Implementation Priority

1. **HIGH PRIORITY**: Issue 1 ✅ (Already fixed)
2. **HIGH PRIORITY**: Issue 2 (Site name editing)
3. **MEDIUM PRIORITY**: Issue 3 (SNMP discovery)
4. **MEDIUM PRIORITY**: Issue 4 (OID walking and auto graphs)

## Next Steps

1. Complete site name editing in frontend
2. Implement SNMP discovery in check-in agent
3. Create backend API for discovered devices
4. Implement OID walking and device type detection
5. Auto-configure graphs based on device type

