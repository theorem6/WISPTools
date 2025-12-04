# SNMP Discovery Reporting Fix

## Problem

The SNMP discovery process finds devices but sometimes fails to report them to the backend. This happens because:
1. Discovery runs in the background during check-in
2. Reporting failures can happen silently
3. No retry logic if the initial report fails
4. Device code might not be available when discovery runs

## Solution

### 1. Added Retry Logic

**File**: `backend-services/scripts/epc-snmp-discovery.js`

- Added retry mechanism (up to 3 attempts) for reporting discovered devices
- 5-second delay between retries
- Better error logging at each attempt
- Always attempts to report, even if discovery fails partially

### 2. Improved Error Handling

- Reports devices even if discovery encounters errors
- Logs detailed error messages for debugging
- Lists all discovered device IPs in error messages
- Attempts to report empty array if discovery fails completely

### 3. Enhanced Check-in Agent

**File**: `backend-services/scripts/epc-checkin-agent.sh`

- Ensures device code is available for discovery script
- Caches device code in discovery-friendly location
- Better logging of discovery process launch
- Captures discovery PID for tracking

## How It Works

1. **Check-in Agent** triggers discovery every hour (if not run recently)
2. **Discovery Script** scans network and finds devices
3. **Reporting Function** attempts to send devices to backend:
   - First attempt: Immediate
   - Retry 1: After 5 seconds if first fails
   - Retry 2: After 5 more seconds if second fails
   - Retry 3: Final attempt after another 5 seconds
4. **Backend API** (`/api/epc/snmp/discovered`) receives and stores devices
5. **Logging** provides detailed feedback about success/failure

## Expected Behavior

- Discovery finds devices ✅
- Reporting attempts up to 3 times with retries ✅
- Detailed logs show which devices were found ✅
- Errors are logged with device information ✅
- Devices are stored in backend database ✅

## Next Steps

After deploying this fix, the discovery script will:
1. Always attempt to report devices (even if empty)
2. Retry up to 3 times if reporting fails
3. Log detailed information about discovered devices
4. Continue reporting even if some discovery phases fail


