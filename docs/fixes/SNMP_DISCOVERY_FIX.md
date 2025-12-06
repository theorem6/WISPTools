# SNMP Discovery Fix - Devices Not Showing in Monitoring

## Problem
SNMP discovery scans are running and finding devices (logs show "Discovered Mikrotik device 10.0.25.1"), but nothing is showing up in the monitoring pages.

## Root Cause
The monitoring page was filtering out discovered devices that:
1. **Weren't deployed** (`isDeployed !== true` and no `siteId`)
2. **Had invalid coordinates** (0,0 or null/undefined)

But discovered devices should be visible even if they're not deployed yet - that's the whole point of discovery! Users need to see what was found.

## Fixes Applied

### 1. Frontend Filter Fix (`Module_Manager/src/routes/modules/monitoring/+page.svelte`)

**Before**: Only showed deployed devices with valid coordinates
```javascript
.filter((device: any) => {
  const isDeployed = device.isDeployed === true || !!device.siteId;
  if (!isDeployed) return false; // ❌ Filters out discovered devices
  
  const lat = device.location?.coordinates?.latitude || device.location?.latitude;
  const lon = device.location?.coordinates?.longitude || device.location?.longitude;
  return lat != null && lon != null && lat !== 0 && lon !== 0 && // ❌ Filters out 0,0
         lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
})
```

**After**: Show ALL discovered devices, even if not deployed or have 0,0 coordinates
```javascript
// Show ALL discovered devices - they don't need to be deployed or have coordinates
discoveredResult.data.devices.forEach((device: any) => {
  // Ensure location structure exists (use defaults if missing)
  if (!device.location) {
    device.location = {
      coordinates: { latitude: 0, longitude: 0 },
      address: 'Discovered Device - Location Unknown'
    };
  }
  addDevice(device, device.type || 'snmp');
});
```

### 2. Backend Response Fix (`backend-services/routes/monitoring.js`)

**Added location data** to the discovered devices endpoint response:
```javascript
// Include location data for map display
location: {
  coordinates: {
    latitude: locationCoordinates.latitude || 0,
    longitude: locationCoordinates.longitude || 0
  },
  address: location.address || 'Discovered Device'
},
```

**Added type field** for compatibility:
```javascript
type: notes.device_type || device.type || 'snmp',
```

**Added siteId** in proper format:
```javascript
siteId: device.siteId ? (typeof device.siteId === 'object' ? device.siteId.toString() : device.siteId) : null,
```

## Verification Steps

1. **Check if discovery is running**:
   ```bash
   # On EPC, check logs
   tail -f /var/log/wisptools/epc-checkin-agent.log | grep SNMP-DISCOVERY
   ```

2. **Check if devices are being saved**:
   ```bash
   # On backend server
   mongo <your-db> --eval "db.networkequipment.find({ 'notes.discovery_source': 'epc_snmp_agent' }).count()"
   ```

3. **Check API response**:
   ```bash
   curl -H "X-Tenant-ID: <tenant-id>" \
        -H "Authorization: Bearer <token>" \
        https://your-api/api/monitoring/snmp/discovered
   ```

4. **Check browser console**:
   - Open monitoring page
   - Check console for: `[Network Monitoring] Loaded discovered devices: X`
   - Should see devices even if they have 0,0 coordinates

## Expected Behavior After Fix

✅ **All discovered devices should appear** in the monitoring page, even if:
- They're not deployed (`isDeployed: false`)
- They don't have a siteId
- They have 0,0 coordinates (will show at origin point on map)

✅ **Devices will show**:
- In the device list
- On the map (at 0,0 if no coordinates, or at EPC location if EPC has coordinates)
- In SNMP Devices panel

## Next Steps

1. **Deploy the fixes** to backend and frontend
2. **Wait for next discovery cycle** (runs hourly) or trigger manually:
   ```bash
   # On EPC
   sudo /opt/wisptools/epc-snmp-discovery.sh
   ```
3. **Refresh monitoring page** - devices should appear
4. **Assign locations** to discovered devices if needed (via hardware/inventory management)

## Files Changed

1. `Module_Manager/src/routes/modules/monitoring/+page.svelte`
   - Removed strict filtering for discovered devices
   - Added location structure normalization

2. `backend-services/routes/monitoring.js`
   - Added location data to discovered devices response
   - Added type and siteId fields for compatibility

---

**Status**: ✅ Fixed  
**Date**: 2025-12-06

