# Troubleshooting Guide - EPC Data Not Showing

## Quick Checks

### 1. Verify EPC is Checking In
On GCE server:
```bash
# Check recent check-ins
pm2 logs main-api --lines 200 | grep "EPC Check-in"

# Should see messages like:
# [EPC Check-in] Device YALNTFQC checking in from 192.168.2.234
# [EPC Check-in] Saved service status for EPC-CB4C5042
```

### 2. Check Database for Service Status
On GCE server:
```bash
cd /opt/lte-pci-mapper
node backend-services/scripts/debug-epc-data.js YALNTFQC 690abdc14a6f067977986db3
```

This will show:
- Whether EPC exists in database
- Whether service status records exist
- What metrics are stored
- Recent logs

### 3. Test API Endpoint Directly
```bash
# Get auth token first, then:
curl -H "X-Tenant-ID: 690abdc14a6f067977986db3" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://hss.wisptools.io/api/hss/epc/remote/list
```

### 4. Check Frontend Console
Open browser DevTools → Console, look for:
- `[Monitoring] Loaded X EPC devices`
- Any API errors
- What data is being received

### 5. Verify EPC Agent is Sending Data
On EPC device:
```bash
# Check check-in log
tail -f /var/log/wisptools-checkin.log

# Should see:
# Check-in successful. EPC: EPC-CB4C5042, Commands: X
```

## Common Issues

### Issue: "N/A" for all metrics
**Cause**: Service status not being saved or retrieved
**Fix**: 
1. Check if check-in is saving service status (see debug script)
2. Verify system object is in check-in payload
3. Check if latestStatus query is working

### Issue: No EPCs showing in monitoring
**Cause**: API endpoint not returning data
**Fix**:
1. Check tenant ID is correct
2. Verify EPC is linked to tenant
3. Test API endpoint directly

### Issue: No logs showing
**Cause**: Logs not being sent or stored
**Fix**:
1. Check if check-in agent is sending logs array
2. Verify logs endpoint path is correct (`/api/epc/:epc_id/logs`)
3. Check EPCLog collection in database

### Issue: SNMP devices not discovered
**Cause**: Discovery script not running or failing silently
**Fix**:
1. Check `/var/log/wisptools-checkin.log` for SNMP discovery messages
2. Verify `snmpget` command is installed on EPC
3. Check network connectivity from EPC

## Debug Steps

1. **Check EPC Check-in Data**
   ```bash
   # On GCE
   node backend-services/scripts/debug-epc-data.js YALNTFQC
   ```

2. **Check Backend Logs**
   ```bash
   # On GCE
   pm2 logs main-api --lines 100 | grep -E "EPC Check-in|Service Status|metrics"
   ```

3. **Check Frontend Network Requests**
   - Open DevTools → Network tab
   - Filter by "epc"
   - Check request/response for `/api/hss/epc/remote/list`
   - Verify response contains metrics data

4. **Force Check-in**
   ```bash
   # On EPC device
   sudo /opt/wisptools/epc-checkin-agent.sh once
   ```

5. **Check Service Status Collection**
   ```bash
   # On GCE, connect to MongoDB and check:
   # db.epcservicestatuses.find().sort({timestamp: -1}).limit(5)
   ```

