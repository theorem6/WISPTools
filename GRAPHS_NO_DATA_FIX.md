# Graphs Showing No Data - Root Cause & Fix

## 🔍 Problem Identified

Graphs are displaying but showing **"No data available"** because:

1. **Ping Monitoring Service** was only pinging deployed devices (with `siteId`)
2. **SNMP Polling Service** was only polling deployed devices (with `siteId`)
3. **Graphs Endpoint** includes ALL devices (deployed + discovered)
4. **Result**: Devices show in graphs but have no metrics because they're not being polled

---

## ✅ Fixes Applied

### 1. **Ping Monitoring Service** (`backend-services/services/ping-monitoring-service.js`)

**Changed:**
- Removed `siteId` requirement for network equipment
- Now pings ALL active devices (same logic as graphs endpoint)
- Includes discovered SNMP devices without siteId

**Before:**
```javascript
const networkEquipment = await NetworkEquipment.find({
  status: 'active',
  siteId: { $exists: true, $ne: null } // ❌ Only deployed devices
}).select('_id tenantId notes').lean();
```

**After:**
```javascript
const networkEquipment = await NetworkEquipment.find({
  status: 'active' // ✅ All active devices
}).select('_id tenantId notes').lean();
```

Plus added filtering for `enable_graphs` and discovered devices.

---

### 2. **SNMP Polling Service** (`backend-services/services/snmp-polling-service.js`)

**Changed:**
- Removed `siteId` requirement
- Now polls ALL active devices with graphs enabled
- Enhanced to detect and poll discovered devices from EPC agents

**Before:**
```javascript
const devices = await NetworkEquipment.find({
  siteId: { $exists: true, $ne: null }, // ❌ Only deployed devices
  status: 'active'
}).lean();
```

**After:**
```javascript
const devices = await NetworkEquipment.find({
  status: 'active' // ✅ All active devices
}).lean();
```

Plus added logic to:
- Check for discovered devices (`discovery_source: 'epc_snmp_agent'`)
- Always poll discovered devices (they have SNMP capability)
- Match graphs endpoint filtering logic exactly

---

## 📋 Files Changed

1. ✅ `backend-services/services/ping-monitoring-service.js`
   - Line 271-274: Removed `siteId` requirement
   - Added filtering logic for discovered devices

2. ✅ `backend-services/services/snmp-polling-service.js`
   - Line 65-68: Removed `siteId` requirement
   - Lines 123-133: Enhanced device filtering to match graphs endpoint

---

## 🚀 Deployment Required

**Backend deployment is required** for graphs to start working:

1. **Deploy to GCE server:**
   ```bash
   cd backend-services
   git add .
   git commit -m "Fix: Poll all devices for graphs (not just deployed)"
   git push origin main
   
   # On server
   cd /opt/lte-pci-mapper/backend-services
   git pull origin main
   pm2 restart main-api
   ```

2. **Services will automatically:**
   - Start polling all devices (including discovered ones)
   - Collect ping metrics every 5 minutes
   - Collect SNMP metrics every 5 minutes
   - Store data in `PingMetrics` and `SNMPMetrics` collections

3. **Wait for polling cycle:**
   - First poll happens 10 seconds after service start
   - Then every 5 minutes
   - **You should see data within 5 minutes**

---

## 🔧 Verification Steps

After deployment, check backend logs:

```bash
# Check if services started
pm2 logs main-api | grep -E "Ping Monitoring|SNMP Polling"

# Should see:
# ✅ Ping monitoring service initialized
# ✅ SNMP polling service initialized
# [Ping Monitoring] Service started - pinging every 300s
# [SNMP Polling] Service started - polling every 300s

# Check polling activity
pm2 logs main-api | grep -E "Ping Monitoring.*Found|SNMP Polling.*Found"

# Should see devices being polled:
# [Ping Monitoring] Found X inventory items and Y network equipment to check
# [SNMP Polling] Found X deployed devices to check
```

---

## ⏱️ Expected Timeline

- **Immediate**: Devices appear in graphs (already working)
- **Within 5 minutes**: First ping/SNMP data collected
- **Within 10 minutes**: Graphs start showing data
- **Within 1 hour**: Full historical data available

---

## 🐛 Troubleshooting

If graphs still show no data after deployment:

1. **Check if services are running:**
   ```bash
   pm2 status
   # Should show main-api as "online"
   ```

2. **Check for errors:**
   ```bash
   pm2 logs main-api --err
   # Look for ping/SNMP errors
   ```

3. **Verify devices have IP addresses:**
   - Check database for devices
   - Ensure `notes.management_ip` or `notes.ip_address` is set

4. **Check database collections:**
   ```bash
   # Connect to MongoDB
   use your_database
   
   # Check for ping metrics
   db.pingmetrics.find().limit(5)
   
   # Check for SNMP metrics  
   db.snmpmetrics.find().limit(5)
   ```

5. **Manually trigger poll (if needed):**
   - Check API endpoint: `POST /api/snmp/poll/:deviceId`
   - Or restart services: `pm2 restart main-api`

---

## 📊 Summary

**Root Cause**: Polling services only polled deployed devices, but graphs showed all devices.

**Solution**: Updated both services to poll the same devices available in the graphs endpoint.

**Status**: ✅ **Fixed** - Ready for deployment

