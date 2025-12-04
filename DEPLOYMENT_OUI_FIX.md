# OUI Lookup Fix - Deployment Summary

## Deployment Status

✅ **Discovery Script**: Deployed successfully
- File: `/var/www/html/downloads/scripts/epc-snmp-discovery.js`
- Size: 87K
- Status: Available for EPC agents to download

✅ **Backend Route**: Updated via git reset
- File: `/opt/lte-pci-mapper/backend-services/routes/epc-snmp.js`
- Changes: Added fallback OUI lookup for direct MAC addresses
- Status: Will take effect when backend services restart/reload

✅ **Git Repository**: Synced
- HEAD is now at: `e25c634 Fix OUI lookup: Add manufacturer detection for MNDP-discovered devices`

## What Was Deployed

### 1. Discovery Script Updates (`epc-snmp-discovery.js`)
- ✅ OUI lookup for MNDP-discovered devices
- ✅ Manufacturer detection from MAC addresses
- ✅ Enhanced logging for manufacturer detection

### 2. Backend Route Updates (`epc-snmp.js`)
- ✅ Fallback OUI lookup for direct MAC addresses
- ✅ Multiple layers of manufacturer detection

## Next Steps

### For Backend Services

The backend route has been updated, but PM2 processes may need to be restarted to load the changes. The services are managed via PM2 ecosystem config:

- **main-api**: Main backend API server
- **epc-api**: EPC-specific API server

**To restart services** (run on GCE server):
```bash
cd /opt/lte-pci-mapper/backend-services
pm2 restart main-api epc-api
# OR if using ecosystem config:
pm2 restart ecosystem.config.js
```

### For EPC Agents

The updated discovery script is available for download. EPC agents will get it when:

1. An update command is queued for the EPC
2. The EPC checks in and receives the update command
3. The EPC downloads and installs the updated script

**To trigger update for EPC agents**, create an update command:
```bash
cd /opt/lte-pci-mapper
node backend-services/scripts/create-new-epc-update-command.js <DEVICE_CODE>
```

## Verification

After deployment, verify the fix by:

1. **Check backend logs** for OUI lookup messages:
   ```bash
   pm2 logs main-api --lines 50 | grep -i "manufacturer\|oui"
   ```

2. **Check discovery script** has OUI lookup:
   ```bash
   grep -c "manufacturerFromOUI" /var/www/html/downloads/scripts/epc-snmp-discovery.js
   ```

3. **Check backend route** has MAC address fallback:
   ```bash
   grep -A 5 "device.mac_address" /opt/lte-pci-mapper/backend-services/routes/epc-snmp.js
   ```

4. **Run SNMP discovery** on an EPC and check logs for:
   - `"Detected manufacturer Mikrotik for MNDP device via OUI lookup from MAC"`
   - `"Using manufacturer Mikrotik from discovery script OUI lookup"`

5. **Check database** - verify `NetworkEquipment.manufacturer` field is populated:
   - Query MongoDB for devices with manufacturer set
   - Check frontend SNMP device list shows manufacturer column

## Expected Results

- ✅ MNDP-discovered devices will have manufacturer detected via OUI lookup
- ✅ Manufacturer field will be populated in NetworkEquipment records
- ✅ Frontend SNMP device list will show manufacturer information
- ✅ Enhanced logging will show manufacturer detection in logs


