# Guide: Checking Backend Logs for Graph Issues

## Current Issue
Graphs are not showing data - console shows `labelsCount: 0` which means no metrics found in database.

## What to Check in Backend Logs

### 1. Check PM2 Logs for Monitoring Graphs API Calls

SSH to the backend server and run:

```bash
# Check recent logs for monitoring graphs requests
pm2 logs main-api --lines 1000 --nostream | grep -i "Monitoring Graphs\|monitoring/graphs" | tail -50

# Check for device_id queries
pm2 logs main-api --lines 1000 --nostream | grep -i "device_id\|Fetching ping\|Found.*metrics" | tail -50
```

### 2. Look for These Key Log Messages

When a graph request comes in, you should see:

```
[Monitoring Graphs] Fetching ping metrics for device <deviceId>, tenant <tenantId>, hours: 24
[Monitoring Graphs] Found X ping metrics for device <deviceId>
```

If no metrics found:
```
[Monitoring Graphs] No metrics found for device <deviceId>. Looking for device_id: "<deviceId>"
[Monitoring Graphs] Sample device_ids in database for tenant <tenantId>: [array of IDs]
[Monitoring Graphs] Total unique device_ids in database: X
```

### 3. Check Database Directly

To check what device_ids exist in the database:

```bash
cd /opt/lte-pci-mapper/backend-services
node -e "
const mongoose = require('mongoose');
const PingMetrics = require('./models/ping-metrics-schema');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const deviceIds = await PingMetrics.distinct('device_id');
  console.log('Device IDs in PingMetrics:', deviceIds);
  const count = await PingMetrics.countDocuments();
  console.log('Total metrics:', count);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
"
```

### 4. Compare Device IDs

**Frontend sends**: `selectedDevice.id` (from `/api/monitoring/graphs/devices` endpoint)
- This is `equipment._id.toString()` or `item._id.toString()`

**Database stores**: `device_id` in PingMetrics collection
- Should match the `_id.toString()` format

## Common Issues

1. **No Data Collected Yet**
   - Check if ping monitoring service is running
   - Check if EPC agents are sending metrics
   - Verify devices have IP addresses configured

2. **Device ID Mismatch**
   - Frontend device ID doesn't match database device_id
   - Check logs for "Sample device_ids in database" to see what format is stored

3. **Tenant ID Mismatch**
   - Metrics stored with different tenant_id than querying with
   - Check tenant_id in logs

## Next Steps After Checking Logs

1. If no metrics in database → Start ping monitoring service or verify EPC agents
2. If device_id mismatch → Fix device_id format when storing metrics
3. If tenant_id mismatch → Fix tenant_id handling

## Quick Check Commands

```bash
# Recent monitoring graph requests
pm2 logs main-api --lines 2000 --nostream | grep "Monitoring Graphs" | tail -20

# All device_id mentions
pm2 logs main-api --lines 2000 --nostream | grep "device_id" | tail -30

# Error messages
pm2 logs main-api --lines 1000 --nostream | grep -i "error\|failed\|exception" | tail -50
```

