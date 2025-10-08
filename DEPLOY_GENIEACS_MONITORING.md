# Deploy GenieACS Service Monitoring

## Quick Start

### 1. Deploy Module Manager

```powershell
cd Module_Manager
firebase apphosting:backends:deploy
```

### 2. Access Service Monitoring

Navigate to:
```
https://your-app.web.app/modules/acs-cpe-management/admin/services
```

Or from the UI:
1. Go to ACS CPE Management
2. Click "Administration"
3. Click "Service Status" (first card)

## What You'll See

### Service Dashboard
- **Overall System Health**: Percentage of services online
- **6 Monitored Services**: CWMP, NBI, FS, Sync, Get Devices, PCI Analysis
- **Real-time Status**: Online, Degraded, or Offline indicators
- **Response Times**: Measured for each service
- **Auto-refresh**: Optional 30-second intervals

### Controls Available
- ✅ **Refresh All**: Check all services at once
- ✅ **Check Health**: Test individual service
- ✅ **Restart**: Wake up cold-started functions
- ✅ **Auto-refresh**: Continuous monitoring toggle

## How to Use

### Check Service Health
1. Click **"Refresh All"** to check all services
2. Review status indicators:
   - ✅ **Green = Online**: Service working normally
   - ⚠️ **Yellow = Degraded**: Service slow (>5s response)
   - ❌ **Red = Offline**: Service not responding

### Restart a Service
1. Click **"Restart"** on any service card
2. Confirm the action
3. Service will wake up if cold-started
4. Status updates automatically

### Enable Monitoring
1. Toggle **"Auto-refresh (30s)"**
2. Services check automatically every 30 seconds
3. Leave enabled during important operations
4. Disable to save resources

## Expected Initial State

On first deployment, you'll likely see:

| Service | Status | Reason |
|---------|--------|--------|
| GenieACS CWMP | ✅ Online | Placeholder function responding |
| GenieACS NBI | ✅ Online | Placeholder function responding |
| GenieACS FS | ✅ Online | Placeholder function responding |
| Sync Devices | ⚠️ Degraded/❌ Offline | Needs MongoDB connection |
| Get Devices | ✅ Online | Using Firestore fallback |
| PCI Analysis | ✅ Online | Firestore-based analysis |

## Troubleshooting

### All Services Show Offline

**Cause**: Functions not deployed or wrong project ID

**Fix**:
```powershell
# Check current project
firebase projects:list

# Use correct project
firebase use lte-pci-mapper-65450042-bbf71

# Deploy functions
firebase deploy --only functions

# Check logs
firebase functions:log --limit 10
```

### Services Show "Cold Start" Delays

**Cause**: Firebase Functions sleep when not used

**Solution**:
1. First request after idle will be slow (5-10s)
2. Click "Restart" to wake up the function
3. Subsequent requests will be fast
4. Normal behavior for Cloud Functions

### MongoDB Services Offline

**Cause**: MongoDB connection not configured

**Fix**:
1. Update `MONGODB_URI` in `apphosting.yaml`
2. Replace `<db_password>` with actual password
3. Redeploy: `firebase apphosting:backends:deploy`

## Service Roles Explained

### GenieACS CWMP (Port 7547)
- **What**: TR-069 CWMP server
- **Purpose**: Device management protocol
- **Used By**: CPE devices for auto-configuration

### GenieACS NBI (Port 7557)
- **What**: REST API
- **Purpose**: Programmatic device control
- **Used By**: Web UI, automation scripts

### GenieACS FS (Port 7567)
- **What**: File server
- **Purpose**: Firmware and config distribution
- **Used By**: CPE devices for updates

### Sync CPE Devices
- **What**: Data synchronization function
- **Purpose**: MongoDB → Firestore sync
- **Used By**: Periodic sync job

### Get CPE Devices
- **What**: Data retrieval function
- **Purpose**: Firestore query
- **Used By**: Device list UI

### PCI Analysis
- **What**: Conflict detection engine
- **Purpose**: LTE PCI validation
- **Used By**: Network planning tools

## Next Steps

### 1. Connect MongoDB
Update `apphosting.yaml`:
```yaml
- variable: MONGODB_URI
  value: "mongodb+srv://user:PASSWORD@cluster.mongodb.net/"
```

### 2. Test Services
1. Click "Refresh All"
2. Verify all services show green
3. Check response times (<1s is excellent)

### 3. Enable Auto-Refresh
1. Toggle auto-refresh ON
2. Monitor during device sync operations
3. Watch for degraded performance

### 4. Configure Alerts (Future)
- Set up Firebase monitoring
- Configure email alerts for offline services
- Track response time trends

## Monitoring Best Practices

### Daily
- ✅ Check service status at start of day
- ✅ Review any offline services
- ✅ Note degraded performance

### During Operations
- ✅ Enable auto-refresh
- ✅ Monitor response times
- ✅ Restart cold services as needed

### After Deployment
- ✅ Verify all services online
- ✅ Test functionality
- ✅ Check logs for errors

## Files Changed

```
Module_Manager/src/routes/modules/acs-cpe-management/
  admin/
    services/
      +page.svelte                    # NEW: Service monitoring page
  components/
    AdminMenu.svelte                  # UPDATED: Added Services link
  admin/
    +page.svelte                      # UPDATED: Stats count to 7

Documentation:
  GENIEACS_SERVICE_MONITORING.md      # NEW: Full documentation
  DEPLOY_GENIEACS_MONITORING.md       # NEW: This file
```

## Deployment Commands

```powershell
# Navigate to Module Manager
cd Module_Manager

# Install dependencies (if needed)
npm install

# Build locally (optional - test first)
npm run build

# Deploy to Firebase
firebase apphosting:backends:deploy

# View deployment logs
firebase apphosting:logs --backend <your-backend-id>

# Check function status
firebase functions:list

# View function logs
firebase functions:log --only genieacsCWMP,genieacsNBI
```

## Success Indicators

After deployment, you should see:

✅ All 7 admin menu items clickable  
✅ Service Status page loads without 404  
✅ At least 3-4 services show as Online  
✅ Response times under 5 seconds  
✅ No console errors in browser  
✅ Health checks complete successfully  

## Support

If you see issues:

1. **Check browser console** for errors
2. **View Firebase logs** for backend errors
3. **Verify environment variables** in apphosting.yaml
4. **Test endpoints manually** with curl
5. **Review documentation** in GENIEACS_SERVICE_MONITORING.md

---

**Ready to deploy?** Run:
```powershell
cd Module_Manager
firebase apphosting:backends:deploy
```

Then visit: `/modules/acs-cpe-management/admin/services`

