# Complete EPC Monitoring Fixes - Status Report

## ✅ **Issue #1: EPC Monitoring Panel Missing CPU/Memory/Uptime - FIXED**

**Status**: ✅ **COMPLETED**

**Changes Made**:
1. Updated `Module_Manager/src/lib/components/EPCMonitoringPanel.svelte`
   - Added **CPU Usage** stat card to System Overview section (line 414-417)
   - Added **Memory Usage** stat card with MB details (line 418-424)
   - System Uptime was already present and working

**Result**: The EPC monitoring panel now displays:
- ✅ CPU Usage: `{serviceStatus?.system?.cpu_percent ?? 'N/A'}%`
- ✅ Memory Usage: `{serviceStatus?.system?.memory_percent ?? 'N/A'}%` with `(memory_used_mb / memory_total_mb)`
- ✅ System Uptime: Already working via `formatUptime(serviceStatus?.system?.uptime_seconds)`

---

## ✅ **Issue #2: EPC Name Should Use Actual Deployment Name - FIXED**

**Status**: ✅ **COMPLETED**

**Changes Made**:

1. **Backend Update Endpoint** (`backend-services/routes/hss-management.js`):
   - Added `PUT /api/hss/epc/:epc_id` endpoint (line 703)
   - Supports updating `site_name`, `deployment_type`, `hss_config`, `snmp_config`, `network_config`
   - Uses `RemoteEPC` collection correctly

2. **Backend Update Endpoint** (`backend-services/routes/epc-deployment.js`):
   - Updated `PUT /api/epc/:epc_id` to accept `site_name` parameter (line 600)

3. **Frontend Edit Form** (`Module_Manager/src/routes/modules/hardware/+page.svelte`):
   - Added `site_name` field to `epcEditForm` object (line 241)
   - Added Site Name input field in EPC edit modal (line 893-898)
   - Updated `editEPCDevice()` to populate `site_name` from device data (line 251)
   - Updated `saveEPCDevice()` to send `site_name` in PUT request (line 296)

**How to Use**:
1. Click the edit (✏️) button on any EPC device in Hardware page
2. Edit the "Site Name" field
3. Click "Save Changes"
4. The EPC name will update immediately

**Note**: For the existing device with "Remote EPC Device", you can now edit it directly in the UI or use the update script:
```bash
node backend-services/scripts/update-epc-name.js YALNTFQC "Your Actual Site Name"
```

---

## 🔧 **Issue #3: SNMP Should Be Active Agent That Scans and Reports Devices - IN PROGRESS**

**Status**: 🔧 **IMPLEMENTATION STARTED**

**What's Done**:
1. Created `backend-services/scripts/epc-snmp-discovery.sh`:
   - Network scanning function to find SNMP-enabled devices
   - Tests common SNMP communities (public, private, community)
   - Identifies device type (Mikrotik, Cisco, Huawei, generic)
   - Reports discovered devices to backend API

**What's Needed**:

### 3.1 Integrate Discovery into Check-in Agent
**File**: `backend-services/scripts/epc-checkin-agent.sh`

Add SNMP discovery call (periodically, e.g., every 15 minutes):
```bash
# Run SNMP discovery every 15 minutes (separate from regular check-in)
if [ -f /opt/wisptools/epc-snmp-discovery.sh ]; then
    /opt/wisptools/epc-snmp-discovery.sh &
fi
```

### 3.2 Backend API for Discovered Devices
**New Endpoint**: `POST /api/epc/snmp/discovered`

**Functionality**:
- Accept discovered devices from EPC check-in agent
- Store in `NetworkEquipment` collection
- Link to EPC via `epc_id` or `discovered_by_epc`
- Make available via `/api/snmp/devices`

**Implementation Plan**:
1. Create route in `backend-services/routes/epc-deployment.js` or new `backend-services/routes/epc-snmp.js`
2. Store discovered devices with metadata:
   - `ip_address`, `sysDescr`, `sysObjectID`, `device_type`
   - `community`, `snmp_version`
   - `discovered_by_epc`, `discovered_at`
   - `epc_id` (link to discovering EPC)

### 3.3 Frontend Display
- Show discovered devices in Monitoring page
- Add "Discovered by EPC" indicator
- Allow configuration/editing of discovered devices

---

## 🔧 **Issue #4: SNMP Agent Should Walk OIDs and Auto-Configure Graphs - IN PROGRESS**

**Status**: 🔧 **DESIGN COMPLETE - IMPLEMENTATION NEEDED**

**Implementation Plan**:

### 4.1 OID Walking Service
**New File**: `backend-services/services/snmpOIDWalker.js`

**Functionality**:
- Walk OID tree for discovered devices
- Identify device type from `sysObjectID`
- Map available OIDs to metric types
- Store OID mappings in database

### 4.2 Device Type Detection
**Logic**:
- Mikrotik: `1.3.6.1.4.1.14988.*` → Router/AP/LTE router
- Cisco: `1.3.6.1.4.1.9.*` → Router/Switch
- Huawei: `1.3.6.1.4.1.2011.*` → Router/Base Station
- Generic: Standard MIB-II OIDs

### 4.3 Auto Graph Configuration
**Database Schema Addition**:
```javascript
{
  device_id: "...",
  device_type: "mikrotik_router",
  graph_config: {
    cpu: { oid: "1.3.6.1.4.1.14988.1.1.1.3.1.0", type: "gauge", unit: "percent" },
    memory: { oid: "...", type: "gauge", unit: "percent" },
    interfaces: [
      { name: "ether1", in_octets: "...", out_octets: "..." }
    ],
    wireless: { /* Mikrotik-specific OIDs */ }
  }
}
```

**Auto-Generated Graphs Based on Device Type**:
- **Mikrotik Router**: CPU, Memory, Interface throughput, Temperature
- **Mikrotik AP**: Wireless clients, Signal strength, CPU, Memory
- **Generic SNMP**: CPU, Memory, Disk, Interface stats

---

## 📋 **Implementation Priority & Status**

1. ✅ **Issue #1**: CPU/Memory/Uptime Display - **COMPLETED**
2. ✅ **Issue #2**: EPC Site Name Editing - **COMPLETED**
3. 🔧 **Issue #3**: SNMP Active Discovery - **IN PROGRESS** (Script created, needs integration)
4. 🔧 **Issue #4**: OID Walking & Auto Graphs - **DESIGNED** (Needs implementation)

---

## 🚀 **Next Steps**

### Immediate (Complete SNMP Discovery):
1. ✅ Add SNMP discovery script (DONE)
2. Integrate discovery into check-in agent (run every 15 minutes)
3. Create backend endpoint `/api/epc/snmp/discovered`
4. Store discovered devices in database
5. Display in frontend Monitoring page

### Short-term (OID Walking):
1. Create `snmpOIDWalker.js` service
2. Implement OID tree walking
3. Device type detection and OID mapping
4. Store graph configuration

### Medium-term (Auto Graph Configuration):
1. Auto-generate graphs based on device type
2. Frontend graph rendering with auto-config
3. Graph customization UI

---

## 📝 **Files Modified**

### Completed Fixes:
- ✅ `Module_Manager/src/lib/components/EPCMonitoringPanel.svelte` - Added CPU/Memory display
- ✅ `Module_Manager/src/routes/modules/hardware/+page.svelte` - Added site name editing
- ✅ `backend-services/routes/hss-management.js` - Added PUT endpoint for EPC updates
- ✅ `backend-services/routes/epc-deployment.js` - Updated PUT endpoint to accept site_name

### New Files Created:
- ✅ `backend-services/scripts/epc-snmp-discovery.sh` - SNMP network discovery script
- ✅ `backend-services/scripts/update-epc-name.js` - Script to update EPC site name
- ✅ `backend-services/scripts/check-epc-devices.js` - Script to check EPC devices in database

### Files Still Needed:
- 🔧 `backend-services/routes/epc-snmp.js` - SNMP discovery API endpoints
- 🔧 `backend-services/services/snmpOIDWalker.js` - OID walking service
- 🔧 `backend-services/services/snmpGraphConfig.js` - Auto graph configuration

---

## 🧪 **Testing**

### To Test Issue #1 Fix:
1. Open EPC monitoring panel in frontend
2. Verify CPU, Memory, and Uptime are displayed in System Overview section

### To Test Issue #2 Fix:
1. Go to Hardware page
2. Click edit button on EPC device
3. Change Site Name field
4. Click Save
5. Verify name updates in monitoring panel

### To Test Issue #3 (When Implemented):
1. Ensure EPC has `snmpd` service running
2. Wait for discovery scan (runs every 15 minutes)
3. Check Monitoring page for discovered devices

### To Test Issue #4 (When Implemented):
1. Discovered devices should automatically show appropriate graphs
2. Verify graphs match device type (Mikrotik shows wireless stats, etc.)

