# EPC Monitoring and Logging Fixes

## Issues Identified

1. **Uptime not updating after reboot** - System uptime should reset after reboot but monitoring shows old value
2. **No log viewing capability** - Need to see remote EPC logs for troubleshooting
3. **SNMP discovery not showing data** - SNMP system should discover devices but nothing appears
4. **No indication remote connection is working** - Need visibility into check-in status

## Fixes Implemented

### 1. Log Collection and Storage
- ✅ Added `EPCLog` schema to `distributed-epc-schema.js`
- ✅ Modified `epc-checkin-agent.sh` to collect last 50 log lines and send with check-in
- ✅ Added log storage logic to `/api/epc/checkin` endpoint in `server.js`
- ✅ Created `/api/epc/:epc_id/logs` endpoint in `epc-logs.js`
- ✅ Added log viewer tab to EPC Details modal in `RemoteEPCs.svelte`

### 2. Uptime Tracking Fix
- ✅ Added system uptime storage in `RemoteEPC` update during check-in
- ✅ Uptime is now stored in `metrics.system_uptime_seconds` field

### 3. Backend Log Storage
- ✅ Logs are parsed from pipe-separated format
- ✅ Individual log entries are stored with timestamp, level, source, and message
- ✅ Logs expire after 30 days

### 4. Frontend Log Viewer
- ✅ Added "Logs" tab to EPC Details modal
- ✅ Shows last 200 logs with timestamp, level, source, and message
- ✅ Auto-refreshes when tab is opened
- ✅ Displays error messages if log loading fails

## Files Modified

1. `backend-services/models/distributed-epc-schema.js` - Added EPCLog schema
2. `backend-services/server.js` - Added log storage to check-in endpoint, imported EPCLog
3. `backend-services/routes/epc-logs.js` - NEW - Log retrieval endpoint
4. `backend-services/scripts/epc-checkin-agent.sh` - Added log collection
5. `Module_Manager/src/routes/modules/hss-management/components/RemoteEPCs.svelte` - Added log viewer tab

## Next Steps

1. Deploy backend changes to GCE
2. Deploy frontend changes to Firebase
3. Update remote EPC check-in agent script
4. Test log viewing functionality
5. Verify uptime tracking after reboot
6. Debug SNMP discovery (separate issue)

## Testing Checklist

- [ ] Remote EPC sends logs with check-in
- [ ] Logs appear in database (EPCLog collection)
- [ ] Logs are visible in frontend log viewer
- [ ] Uptime resets correctly after reboot
- [ ] System uptime is displayed in monitoring panel

