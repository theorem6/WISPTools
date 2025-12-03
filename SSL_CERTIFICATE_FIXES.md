# SSL Certificate and Connection Fixes

## Issues Fixed

### 1. SNMP Discovery - Self-Signed Certificate Error
**Error**: `ERROR: Failed to report discovered devices: self-signed certificate`

**Fix Applied**:
- Added `rejectUnauthorized: false` to HTTPS request options in `epc-snmp-discovery.js`
- This allows the script to accept self-signed SSL certificates from the backend

**File**: `backend-services/scripts/epc-snmp-discovery.js`
**Location**: Line 2073 in `reportDiscoveredDevices()` function

### 2. Check-in Agent - HTTP 000 Connection Errors
**Error**: `ERROR: Check-in failed (HTTP 000) -`

**Fixes Applied**:
- Added `-k` flag to all curl commands to bypass SSL certificate validation
- Added connection timeouts (`--max-time 30`, `--connect-timeout 10`)
- Improved error handling to detect HTTP 000 (connection failed)
- Better error messages showing curl exit codes

**Files Modified**:
- `backend-services/scripts/epc-checkin-agent.sh`
  - Check-in request (line 716)
  - Monitoring devices query (line 483)
  - Ping metrics upload (line 588)
  - Command result reporting (line 620)

## Changes Made

### SNMP Discovery Script
```javascript
const options = {
  // ... other options ...
  rejectUnauthorized: false // Allow self-signed certificates
};
```

### Check-in Agent Script
```bash
# All curl commands now include:
curl -k -s --max-time 30 --connect-timeout 10 ...
```

## HTTP 000 Error Explanation

HTTP 000 from curl typically means:
- **DNS resolution failed** - `hss.wisptools.io` can't be resolved
- **Network unreachable** - Backend server not accessible from remote network
- **Connection refused** - Backend service not listening on port
- **Firewall blocking** - Outbound HTTPS connections blocked

## Next Steps

1. **For Remote EPCs**:
   - Scripts will auto-update on next check-in
   - Or manually update: `curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh | sudo bash -s install`

2. **Verify Connectivity**:
   - From remote EPC, test: `curl -k -v https://hss.wisptools.io/api/health`
   - Check DNS resolution: `nslookup hss.wisptools.io`
   - Check network connectivity: `ping hss.wisptools.io`

3. **Check Backend Status**:
   - Verify backend is running: `pm2 status`
   - Check nginx is proxying correctly: `curl -k https://hss.wisptools.io/api/health`

## Status

- ✅ SNMP discovery certificate issue fixed
- ✅ Check-in agent SSL bypass added
- ✅ Better error handling for connection failures
- ⏳ Remote EPCs need to update scripts (auto-update on next check-in)

