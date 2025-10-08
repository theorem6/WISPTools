# GenieACS Configuration Buttons - Fix Guide

## Issue Identified

The GenieACS configuration buttons weren't working because:

1. ❌ **Hardcoded Project ID**: Code was using `'lte-pci-mapper'` instead of actual project ID
2. ❌ **Not Using Environment Variables**: Ignored pre-configured URLs in `apphosting.yaml`
3. ✅ **MongoDB Password Missing**: Connection string has placeholder `<db_password>`

## What Was Fixed

### 1. Updated GenieACS Pages to Use Environment Variables

**Files Fixed:**
- `Module_Manager/src/routes/modules/acs-cpe-management/+page.svelte`
- `Module_Manager/src/routes/modules/acs-cpe-management/devices/+page.svelte`

**Changes:**
- ✅ Replaced hardcoded URLs with `import.meta.env.PUBLIC_GET_CPE_DEVICES_URL`
- ✅ Replaced hardcoded URLs with `import.meta.env.PUBLIC_SYNC_CPE_DEVICES_URL`
- ✅ Added proper error handling when URLs not configured
- ✅ Graceful fallback to sample data

### 2. Environment Variables Already Configured

In `Module_Manager/apphosting.yaml`, these are already set:

```yaml
PUBLIC_GET_CPE_DEVICES_URL:
  value: "https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/getCPEDevices"

PUBLIC_SYNC_CPE_DEVICES_URL:
  value: "https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/syncCPEDevices"
```

## What You Need to Do

### Step 1: Configure MongoDB Password

Edit `Module_Manager/apphosting.yaml` and replace `<db_password>`:

```yaml
- variable: MONGODB_URI
  value: "mongodb+srv://genieacs-user:YOUR_ACTUAL_PASSWORD@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  availability:
    - RUNTIME
```

### Step 2: Deploy Firebase Functions

The GenieACS integration requires Firebase Functions to be deployed:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

This deploys:
- `getCPEDevices` - Get CPE devices from MongoDB/Firestore
- `syncCPEDevices` - Sync devices from GenieACS MongoDB to Firestore
- `genieacsBridge` - Proxy to GenieACS NBI API

### Step 3: Deploy Module Manager

After functions are deployed, deploy the Module Manager:

```bash
cd Module_Manager
firebase apphosting:backends:deploy
```

### Step 4: Test the Buttons

1. Navigate to: `https://your-app.web.app/modules/acs-cpe-management`
2. Click **"🔄 Sync CPE Devices"** button
3. Should now connect to Firebase Functions
4. Functions connect to MongoDB
5. Devices sync and display

## Verification

### Check if Functions are Deployed

```bash
firebase functions:list
```

Should show:
- ✅ `getCPEDevices`
- ✅ `syncCPEDevices`
- ✅ `proxyGenieACSNBI`
- ✅ Other GenieACS functions

### Check Function Logs

```bash
firebase functions:log --only syncCPEDevices
```

### Test Function Directly

```bash
curl "https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/getCPEDevices"
```

Should return:
```json
{
  "success": true,
  "devices": [...],
  "count": 0
}
```

## MongoDB Configuration

### Current Settings

From `apphosting.yaml`:
- **Database**: `genieacs`
- **User**: `genieacs-user`
- **Cluster**: `cluster0.1radgkw.mongodb.net`
- **Collections**: `devices`, `faults`, `tasks`, `presets`, `provisions`

### Required MongoDB Setup

1. **Create Database**: `genieacs` in MongoDB Atlas
2. **Create User**: `genieacs-user` with readWrite permissions
3. **Whitelist IPs**: Add Firebase Function IP ranges
4. **Connection String**: Update with actual password

## Firebase Functions Structure

```
functions/
├── src/
│   ├── index.ts ← Exports all functions
│   ├── genieacsIntegration.ts ← Main sync functions
│   ├── genieacsBridge.ts ← Proxy to GenieACS API
│   ├── mongoConnection.js ← MongoDB connection handler
│   └── simpleGenieacsIntegration.js ← Simplified version
├── package.json
└── tsconfig.json
```

## How the Flow Works

### Sync Flow:
```
GenieACS (MongoDB)
    ↓
Firebase Function (syncCPEDevices)
    ↓
Firestore (cpe_devices collection)
    ↓
Module Manager UI (displays devices)
```

### Button Click Flow:
```
User clicks "Sync CPE Devices"
    ↓
Calls PUBLIC_SYNC_CPE_DEVICES_URL
    ↓
Firebase Function connects to MongoDB
    ↓
Reads GenieACS device data
    ↓
Converts to CPE format
    ↓
Saves to Firestore
    ↓
Returns success/failure
    ↓
UI refreshes and shows devices
```

## Deployment Checklist

- [ ] MongoDB password configured in `apphosting.yaml`
- [ ] Firebase Functions deployed (`firebase deploy --only functions`)
- [ ] Module Manager deployed (`firebase apphosting:backends:deploy`)
- [ ] Environment variables available at runtime
- [ ] MongoDB Atlas configured with correct user and permissions
- [ ] Function URLs accessible (test with curl)
- [ ] Firestore rules allow writes to `cpe_devices` collection

## Quick Test

After deployment, test in browser console:

```javascript
// Test if environment variable is available
console.log(import.meta.env.PUBLIC_GET_CPE_DEVICES_URL);

// Should output: 
// https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/getCPEDevices
```

## Common Errors

### Error: "Sync endpoint not configured"
**Fix**: Deploy Module Manager with environment variables

### Error: "CORS error"
**Fix**: Functions already have CORS enabled, redeploy if needed

### Error: "MongoDB connection failed"
**Fix**: Check MongoDB password and IP whitelist

### Error: "Function not found"
**Fix**: Deploy Firebase Functions first

## Summary

✅ **Fixed**: GenieACS pages now use environment variables  
✅ **Configured**: URLs already in `apphosting.yaml`  
🔧 **Action Needed**: Configure MongoDB password  
🚀 **Action Needed**: Deploy Functions and Module Manager  

Once deployed, the "Sync CPE Devices" and "Refresh" buttons will work properly!

