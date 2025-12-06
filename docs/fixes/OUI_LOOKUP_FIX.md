# OUI Lookup Fix - Manufacturer Detection

## Problem

Mikrotik devices discovered via MNDP were not getting manufacturer information from OUI lookup. The manufacturer field was not being populated in the SNMP device list, even though OUI lookup functionality existed.

## Root Cause

1. **MNDP devices were not getting OUI lookup performed**: When MNDP discovered devices via MAC addresses, the discovery script wasn't performing OUI lookup on those MAC addresses to determine manufacturer.

2. **Backend route missing MAC address fallback**: The backend route checked ARP tables and interfaces for OUI lookup, but didn't check the device's direct `mac_address` field (which MNDP devices have).

## Solution Implemented

### 1. Discovery Script (`epc-snmp-discovery.js`)

**Added OUI lookup for MNDP-discovered devices** (lines 2097-2116):
- When processing MNDP-discovered neighbors, the script now:
  - Extracts the MAC address from the MNDP neighbor
  - Normalizes the MAC address format
  - Performs OUI lookup to find the manufacturer
  - Sets `manufacturer_from_oui` and `oui_detection` fields in the device entry
  - Logs the detected manufacturer for visibility

```javascript
// Perform OUI lookup on MNDP-discovered device's MAC address
let manufacturerFromOUI = null;
let oui_detection = null;

if (mndpNeighbor.mac_address && ouiLookup) {
  const normalizedMac = ouiLookup.normalizeMacAddress(mndpNeighbor.mac_address);
  if (normalizedMac) {
    manufacturerFromOUI = ouiLookup.lookupManufacturer(normalizedMac);
    if (manufacturerFromOUI) {
      oui_detection = {
        manufacturer: manufacturerFromOUI,
        detected_at: new Date().toISOString(),
        source: 'mndp_mac_address',
        mac_address: normalizedMac,
        oui: ouiLookup.extractOUI(normalizedMac)
      };
      log(`  Detected manufacturer ${manufacturerFromOUI} for MNDP device via OUI lookup from MAC ${normalizedMac}`);
    }
  }
}
```

### 2. Backend Route (`backend-services/routes/epc-snmp.js`)

**Added fallback OUI lookup for direct MAC addresses** (after line 137):
- When a device doesn't have `manufacturer_from_oui` from the discovery script, and backend OUI lookup from ARP/interfaces hasn't found a manufacturer, the backend now:
  - Checks the device's direct `mac_address` field
  - Performs OUI lookup on that MAC address
  - Uses the detected manufacturer

```javascript
// Also check device's direct MAC address (from MNDP or other sources)
if (!manufacturerFromOUI && ouiLookup && device.mac_address) {
  const normalizedMac = ouiLookup.normalizeMacAddress(device.mac_address);
  if (normalizedMac) {
    const manufacturer = ouiLookup.lookupManufacturer(normalizedMac);
    if (manufacturer) {
      manufacturerFromOUI = manufacturer;
      console.log(`[SNMP Discovery] Detected manufacturer ${manufacturerFromOUI} for device ${ip_address} via OUI lookup from device MAC address ${normalizedMac}`);
    }
  }
}
```

## Manufacturer Detection Priority

The backend route now uses this priority order for determining manufacturer:

1. **`manufacturer_from_oui`** from discovery script (highest priority)
2. **Backend OUI lookup from ARP tables** (collected from discovered devices)
3. **Backend OUI lookup from device interfaces** (device's own interfaces)
4. **Backend OUI lookup from direct MAC address** (device's mac_address field) - NEW
5. **Device type-based detection** (Mikrotik, Cisco, etc. based on sysObjectID/sysDescr)
6. **Fallback to "Unknown" or "Generic"**

## Expected Results

After this fix:

1. **MNDP-discovered Mikrotik devices** will have `manufacturer_from_oui` set to "Mikrotik" (or appropriate manufacturer) based on their MAC address OUI

2. **All devices with MAC addresses** will get manufacturer detection, even if:
   - They don't respond to SNMP
   - They don't have ARP table entries
   - They don't have interface information

3. **Manufacturer field in NetworkEquipment** will be properly populated:
   - `NetworkEquipment.manufacturer` will contain the detected manufacturer name
   - `NetworkEquipment.notes.manufacturer_detected_via_oui` will contain the OUI-detected manufacturer
   - `NetworkEquipment.notes.oui_detection` will contain detailed OUI detection info

## Testing

To verify the fix:

1. Run SNMP discovery on a network with Mikrotik devices
2. Check logs for: `"Detected manufacturer Mikrotik for MNDP device via OUI lookup from MAC"`
3. Check backend logs for: `"Using manufacturer Mikrotik from discovery script OUI lookup"`
4. Verify in database that `NetworkEquipment.manufacturer` field is set correctly
5. Check frontend SNMP device list to see manufacturer column populated

## Files Modified

1. `backend-services/scripts/epc-snmp-discovery.js` - Added OUI lookup for MNDP devices
2. `backend-services/routes/epc-snmp.js` - Added fallback OUI lookup for direct MAC addresses

## Deployment

1. Deploy updated `epc-snmp-discovery.js` script to `/var/www/html/downloads/scripts/`
2. Deploy updated backend route (restart PM2 services)
3. EPC agents will download updated script on next update command
4. Next SNMP discovery run will perform OUI lookup on all MNDP devices

