# GenieACS Service Monitoring Guide

## Overview

The **Service Status & Monitoring** page provides real-time health monitoring and control for all GenieACS services and Firebase Functions. Access it at:

```
/modules/acs-cpe-management/admin/services
```

## Monitored Services

### 1. GenieACS CWMP (🌐)
- **Endpoint**: `genieacsCWMP`
- **Port**: 7547 (standard TR-069)
- **Purpose**: TR-069 CWMP server for device management
- **Function**: Handles CPE device communication via TR-069 protocol

### 2. GenieACS NBI (🔌)
- **Endpoint**: `genieacsNBI`
- **Port**: 7557
- **Purpose**: North Bound Interface REST API
- **Function**: Provides programmatic access to device management functions

### 3. GenieACS FS (📁)
- **Endpoint**: `genieacsFS`
- **Port**: 7567
- **Purpose**: File Server
- **Function**: Serves firmware files and configuration files to CPE devices

### 4. Sync CPE Devices (🔄)
- **Endpoint**: `syncCPEDevices`
- **Purpose**: Device Synchronization
- **Function**: Syncs device data from MongoDB (GenieACS) to Firestore (app database)

### 5. Get CPE Devices (📱)
- **Endpoint**: `getCPEDevices`
- **Purpose**: Device Data Retrieval
- **Function**: Retrieves CPE device list from Firestore for UI display

### 6. PCI Analysis (📊)
- **Endpoint**: `analyzePCI`
- **Purpose**: LTE PCI Conflict Analysis
- **Function**: Analyzes Physical Cell ID conflicts in LTE networks

## Service Status Indicators

### ✅ Online
- Service is responding normally
- Response time < 5 seconds
- No errors detected

### ⚠️ Degraded
- Service is responding but slowly
- Response time > 5 seconds
- May indicate cold start or high load
- Service may need optimization

### ❌ Offline
- Service is not responding
- Connection timeout or HTTP error
- Service may need restart or troubleshooting

### 🔄 Checking
- Health check in progress
- Wait for result

## Dashboard Features

### Overall Health Card
- Shows percentage of services online
- Real-time calculation: (Online Services / Total Services) × 100%
- Green progress bar for visual health status

### Status Summary Cards
- **Online**: Count of healthy services
- **Degraded**: Count of slow-responding services
- **Offline**: Count of non-responding services

## Control Features

### 🔄 Refresh All
- Checks health of all services simultaneously
- Runs parallel health checks (faster)
- Updates all status indicators

### Individual Service Controls

#### 🔍 Check Health
- Tests single service endpoint
- Measures response time
- Updates status immediately

#### 🔄 Restart
- Triggers health check to "wake up" service
- Useful for cold-started Cloud Functions
- Shows confirmation dialog before executing

### Auto-Refresh Toggle
- Enable automatic health checks every 30 seconds
- Useful for continuous monitoring
- Disable to save resources

## Service Metrics

### Response Time
- Measured in milliseconds (ms) or seconds (s)
- **Good**: < 1000ms
- **Acceptable**: 1000-5000ms
- **Slow**: > 5000ms (shown in warning color)

### Last Check
- Shows how long ago the service was checked
- Formats: "Xs ago", "Xm ago", "Xh ago"
- "Never" if not yet checked

## Understanding Service Behavior

### Cold Starts
Firebase Cloud Functions may "sleep" when not used:
- First request after idle period is slower (cold start)
- Response time may be 5-10 seconds
- Subsequent requests are fast (warm)
- Use "Restart" to wake up a cold function

### Response Time Guidelines
- **< 1s**: Excellent (function is warm)
- **1-3s**: Good (normal Cloud Function response)
- **3-5s**: Acceptable (may be warming up)
- **5-10s**: Slow (cold start or high load)
- **> 10s**: Timeout (service offline or overloaded)

## Troubleshooting

### Service Shows Offline

1. **Check Firebase Functions Deployment**
   ```bash
   firebase deploy --only functions
   ```

2. **View Function Logs**
   ```bash
   firebase functions:log
   ```

3. **Verify Environment Variables**
   - Check `apphosting.yaml` for correct endpoints
   - Ensure all PUBLIC_* variables are set

4. **Test Endpoint Manually**
   ```bash
   curl https://your-endpoint.cloudfunctions.net/serviceName
   ```

### Service Shows Degraded

1. **Wait and Retry**: May be a cold start
2. **Check Function Memory**: May need more than 256MiB
3. **Review Function Logs**: Look for performance issues
4. **Consider Function Optimization**: Reduce startup time

### All Services Offline

1. **Check Internet Connection**
2. **Verify Firebase Project**: Ensure correct project ID
3. **Check CORS Settings**: Verify allowed origins
4. **Review Browser Console**: Look for CORS or network errors

## Service Dependencies

```
┌─────────────────┐
│  GenieACS CWMP  │ ← TR-069 Device Communication
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     MongoDB     │ ← Device Data Storage
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Sync Devices   │ ← Data Synchronization
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Firestore    │ ← App Database
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Get Devices    │ ← UI Data Access
└─────────────────┘
```

## Best Practices

### Regular Monitoring
- Check service status at start of work session
- Enable auto-refresh during critical operations
- Monitor response times for performance trends

### Proactive Maintenance
- Keep functions warm during peak hours
- Schedule regular health checks
- Review logs for recurring errors

### Performance Optimization
- Pre-warm functions before heavy use
- Increase memory for slow functions
- Optimize cold start times

## API Health Check Endpoints

All services respond to GET requests:

```javascript
// Example: Check GenieACS CWMP
fetch('https://your-project.cloudfunctions.net/genieacsCWMP')
  .then(r => r.json())
  .then(data => console.log(data));

// Expected response:
{
  "success": true,
  "message": "GenieACS CWMP service placeholder",
  "note": "MongoDB integration required for full functionality"
}
```

## Deployment

After making changes to Firebase Functions:

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:genieacsCWMP

# Deploy and test
firebase deploy --only functions && firebase functions:log --limit 10
```

## Environment Variables

All service endpoints are configured in `apphosting.yaml`:

```yaml
PUBLIC_GENIEACS_CWMP_URL: https://us-central1-PROJECT.cloudfunctions.net/genieacsCWMP
PUBLIC_GENIEACS_NBI_URL: https://us-central1-PROJECT.cloudfunctions.net/genieacsNBI
PUBLIC_GENIEACS_FS_URL: https://us-central1-PROJECT.cloudfunctions.net/genieacsFS
PUBLIC_SYNC_CPE_DEVICES_URL: https://us-central1-PROJECT.cloudfunctions.net/syncCPEDevices
PUBLIC_GET_CPE_DEVICES_URL: https://us-central1-PROJECT.cloudfunctions.net/getCPEDevices
PUBLIC_PCI_ANALYSIS_URL: https://us-central1-PROJECT.cloudfunctions.net/analyzePCI
PUBLIC_FIREBASE_FUNCTIONS_URL: https://us-central1-PROJECT.cloudfunctions.net
```

## Next Steps

1. **Deploy Functions**: Ensure all functions are deployed
2. **Test Endpoints**: Use Service Status page to verify
3. **Configure MongoDB**: Connect to real GenieACS database
4. **Monitor Performance**: Track response times
5. **Optimize**: Improve slow functions

## Support

For issues or questions:
1. Check service status first
2. Review Firebase Functions logs
3. Verify environment variables
4. Test endpoints manually
5. Check MongoDB connection

---

**Location**: `/modules/acs-cpe-management/admin/services`  
**Updated**: January 2025  
**Version**: 1.0

