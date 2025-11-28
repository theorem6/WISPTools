# Implementation Plan for EPC Monitoring Fixes

## Issues to Fix:

1. ✅ **EPC monitoring panel missing CPU, memory, uptime** - FIXED
   - Added CPU and Memory stat cards to System Overview section
   - Uptime was already there, now all three are visible

2. **EPC name should use actual deployment name**
   - When device is restored, uses generic "Remote EPC Device"
   - Need to update existing EPC or allow name editing in frontend
   - Site name comes from `config.site_name` in deployment wizard

3. **SNMP should be active agent that scans and reports devices**
   - Currently snmpd is passive
   - Need to add network scanning to check-in agent
   - Discover SNMP devices and report to backend
   - Backend stores discovered devices and makes them available to frontend

4. **SNMP agent should walk OIDs and auto-configure graphs**
   - Implement OID walking when devices are discovered
   - Detect device type (Mikrotik, generic SNMP, etc.)
   - Automatically configure appropriate graphs based on device type

## Implementation Steps:

### Step 1: Fix EPC Name (Quick Fix)
- Update existing EPC record to use proper site name
- Or add edit functionality in frontend

### Step 2: Add SNMP Discovery to Check-in Agent
- Add network scanning function to `epc-checkin-agent.sh`
- Scan local network for SNMP-enabled devices
- Report discovered devices in check-in payload
- Backend stores discovered devices in database

### Step 3: Create Backend API for SNMP Discovery
- New endpoint: `POST /api/epc/:epc_id/snmp/discovered`
- Store discovered devices with device type, OIDs, etc.
- Make discovered devices available to frontend via `/api/snmp/devices`

### Step 4: Implement OID Walking and Graph Auto-configuration
- When device is discovered, walk common OIDs to identify device type
- Based on device type, configure appropriate graph types
- Store graph configuration in database

### Step 5: Update Frontend
- Display discovered SNMP devices in monitoring page
- Show auto-configured graphs based on device type

