# MNDP Device Reporting Fix

## Problem

Mikrotik devices discovered via MNDP (Mikrotik Neighbor Discovery Protocol) were not being sent to the backend APIs or updated in the frontend properly. The discovery script was finding devices via MNDP, but they weren't being converted into device entries for reporting.

## Root Cause

1. MNDP-discovered devices were added to `allDiscoveredNeighbors` array but never converted to device entries
2. Only IP addresses from `allDiscoveredIPs` were processed in Phase 3 (SNMP scan)
3. Devices with invalid IPs (like `0.0.0.0`) or MAC addresses without valid IPs were skipped entirely
4. No mechanism to resolve MAC addresses to IP addresses from ARP tables

## Solution

### 1. MAC-to-IP Resolution via ARP Tables
- Collect ARP tables from all discovered devices during Phase 3
- Build a MAC-to-IP mapping from ARP table entries
- Use OUI lookup utility to normalize MAC addresses for comparison
- Match MNDP-discovered MAC addresses to ARP entries to resolve IP addresses

### 2. MNDP Device Processing (Phase 4)
- After Phase 3 completes, process all MNDP-discovered neighbors
- For each MNDP device:
  - Try to resolve IP from MAC address using ARP table lookup
  - Create device entry even if IP is invalid (use MAC/identity as identifier)
  - Attempt SNMP queries using resolved IP address
  - Include all available MNDP information (identity, version, board name, platform)

### 3. Device Entry Creation
- All MNDP-discovered devices are now converted to proper device entries
- Devices with invalid IPs (`0.0.0.0`) are still included if they have MAC address or identity
- Resolved IP addresses are used for SNMP queries and device identification

## Changes Made

**File: `backend-services/scripts/epc-snmp-discovery.js`**

1. **MAC-to-IP Mapping** (lines 2031-2053):
   - Collect ARP tables from all discovered devices
   - Build `macToIPMap` and `macToDeviceInfoMap` for MAC-to-IP resolution

2. **MNDP Device Processing** (lines 2055-2130):
   - Process all MNDP-discovered neighbors
   - Resolve IP addresses from MAC addresses using ARP table lookup
   - Create device entries for all MNDP devices, even with invalid IPs
   - Attempt SNMP queries on resolved IPs

3. **Device Information**:
   - Include `ip_resolved_from_mac` flag when IP is resolved from MAC
   - Store `original_mndp_ip` to track original MNDP-reported IP
   - Enhanced logging to show IP resolution status

## Example Output

```
Phase 4: Processing MNDP-discovered devices...
  Built MAC-to-IP mapping from ARP tables: 45 MAC address(es) mapped
  Resolved MNDP MAC 4C:5E:0C:12:34:56 to IP 10.0.25.148 via ARP table from 10.0.25.1
  Added MNDP-discovered Mikrotik device: 10.0.25.148 (MyRouter) (IP resolved from MAC) with SNMP
  Added MNDP-discovered Mikrotik device: 0.0.0.0 (Unknown Device) (SNMP not available)
Discovery complete: 98 total devices (45 SNMP-enabled, 51 ping-only, 2 MNDP-discovered)
```

## Benefits

1. **Complete Device Discovery**: All MNDP-discovered devices are now reported to backend
2. **IP Resolution**: MAC addresses are matched to ARP tables to find IP addresses
3. **Better Device Identification**: Devices with invalid IPs are still included with MAC/identity
4. **Enhanced SNMP Queries**: Resolved IPs are used for SNMP queries to gather more device info

## Testing

To verify the fix:

1. Run SNMP discovery on a network with Mikrotik devices
2. Check logs for MNDP discovery messages
3. Verify devices appear in backend database
4. Check frontend to ensure MNDP-discovered devices are displayed

## Next Steps

- Monitor logs to ensure MNDP devices are being resolved and reported correctly
- Verify devices appear in frontend after discovery
- Consider additional enhancements for MAC-based device matching

