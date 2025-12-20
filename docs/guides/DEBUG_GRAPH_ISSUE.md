# Debug Graph Data Issue

## Current Status

- ✅ Backend: Deployed with enhanced logging
- ⏳ Frontend: Needs deployment to see new logs
- 🔍 Issue: "Nothing on the screen" even though 4 devices are loaded

## What We Know

From console logs:
- `[SNMP Graphs] Loaded 4 devices for graphing` ✅
- But NO logs for:
  - Device selection
  - Ping metrics API calls
  - Chart initialization
  - Errors

## Enhanced Logging Added

### Frontend (`SNMPGraphsPanel.svelte`)
- Logs when devices are loaded (with device list)
- Logs when device is auto-selected
- Logs when device is manually selected
- Logs device capabilities (hasPing, hasSNMP, ipAddress)
- Logs when fetching ping metrics
- Logs ping data received (with label count, dataset count, stats)
- Logs chart initialization steps
- Logs why charts are skipped (missing data, etc.)

### Backend (`monitoring-graphs.js`)
- Logs when fetching ping metrics
- Logs number of metrics found
- Logs sample device_ids if no metrics found
- Returns valid structure even with empty data

## Next Steps

1. **Deploy Frontend**: Push to Firebase to see new logs
   ```bash
   firebase deploy --only hosting
   ```

2. **Check Browser Console**: After refresh, look for:
   - `[SNMP Graphs] Auto-selecting first device:`
   - `[SNMP Graphs] Loading metrics for device:`
   - `[SNMP Graphs] Fetching ping metrics for device...`
   - `[SNMP Graphs] Ping data received:`
   - Any errors

3. **Check Backend Logs**: On GCE server:
   ```bash
   pm2 logs main-api | grep "Monitoring Graphs"
   ```
   Look for:
   - Device ID being queried
   - Number of metrics found
   - Sample device_ids if none found

## Possible Issues

1. **Device ID Mismatch**: 
   - Frontend uses device `_id` from NetworkEquipment/InventoryItem
   - Ping metrics stored with `device_id` from remote EPC agent
   - These might not match!

2. **Device Not Selected**:
   - Auto-select might not be working
   - Component might be waiting for manual selection

3. **API Route Issue**:
   - Frontend might not be calling the correct endpoint
   - Tenant ID header might be missing

4. **Empty Data Response**:
   - API returns valid structure but empty arrays
   - Frontend checks for empty labels and skips chart init

## How to Verify Device ID Match

1. Check what device_ids exist in PingMetrics collection:
   ```javascript
   // In MongoDB shell or via script
   db.pingmetrics.distinct("device_id", { tenant_id: "690abdc14a6f067977986db3" })
   ```

2. Check what device _ids the frontend is using:
   - Look at the 4 devices loaded
   - Compare their `id` field with device_ids in PingMetrics

3. If mismatch found:
   - Need to ensure remote EPC agents send correct device_id
   - Or update graph endpoint to query by IP address instead

