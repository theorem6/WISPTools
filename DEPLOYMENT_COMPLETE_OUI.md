# OUI Lookup Fix - Deployment Complete

## ✅ Deployment Status

**Backend Services**: Restarted and running
- `main-api`: Online
- `epc-api`: Online

**Discovery Script**: Deployed to `/var/www/html/downloads/scripts/epc-snmp-discovery.js`
- Size: 87K
- Contains OUI lookup for MNDP devices
- Available for EPC agents to download

## How It Works (Correct Flow)

### 1. Remote Agent (EPC) - Collects MAC Addresses

The remote agent is on the same local network as devices, so it can:
- ✅ Query ARP tables via SNMP (contains MAC → IP mappings)
- ✅ Query interface tables via SNMP (contains device MAC addresses)
- ✅ Listen for MNDP broadcasts (contains Mikrotik MAC addresses)

### 2. Remote Agent (EPC) - Performs OUI Lookup

On the remote agent, the discovery script (`epc-snmp-discovery.js`):
- ✅ Performs OUI lookup on MNDP-discovered device MAC addresses (lines 2097-2116)
- ✅ Sets `manufacturer_from_oui` field in device entry (line 2129)
- ✅ Includes `mac_address` field in device entry (line 2137)
- ✅ Includes `oui_detection` metadata (line 2130)

### 3. Remote Agent (EPC) - Sends to Backend

The discovery script sends the entire device object to the backend:
- ✅ Includes `manufacturer_from_oui` (already looked up)
- ✅ Includes `mac_address` (from MNDP or ARP tables)
- ✅ Includes `arp_table` and `interfaces` arrays (with MAC addresses)

```javascript
// Line 2208: All device data is sent to backend
const payload = {
  device_code: deviceCode,
  discovered_devices: discoveredDevices || []  // Contains manufacturer_from_oui, mac_address, etc.
};
```

### 4. Backend - Receives and Uses

The backend route (`epc-snmp.js`):
- ✅ Receives `manufacturer_from_oui` from discovery script (line 69)
- ✅ Uses it as priority #1 for manufacturer (line 214)
- ✅ Falls back to backend OUI lookup only if not provided (lines 217-149)
- ✅ Stores manufacturer in `NetworkEquipment.manufacturer` field (line 242)

## Key Point

**MAC addresses are ONLY available on the remote agent** where devices are locally accessible. The backend just receives and stores the results that the remote agent already computed.

## What Was Fixed

1. ✅ **Remote agent performs OUI lookup** on MNDP-discovered MAC addresses
2. ✅ **Remote agent sends `manufacturer_from_oui`** to backend
3. ✅ **Backend uses `manufacturer_from_oui`** as primary source
4. ✅ **Backend fallback** for edge cases (if manufacturer_from_oui missing)

## Deployment Complete

- ✅ Discovery script deployed to downloads directory
- ✅ Backend services restarted with latest code
- ✅ All changes committed and pushed to GitHub

The fix is complete and deployed. EPC agents will get the updated discovery script on their next update command, and then MNDP-discovered devices will have manufacturer information populated.

