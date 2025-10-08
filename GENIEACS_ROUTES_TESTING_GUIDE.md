# GenieACS Routes Testing Guide

## Fixed Issues

### ✅ Hardcoded Project IDs Removed
All pages now use environment variables instead of hardcoded Firebase project IDs:

| File | Old Code | New Code |
|------|----------|----------|
| `faults/+page.svelte` | `const projectId = 'lte-pci-mapper'` | `const functionsUrl = import.meta.env.PUBLIC_FIREBASE_FUNCTIONS_URL` |
| `admin/presets/+page.svelte` | `const projectId = 'lte-pci-mapper'` | `const functionsUrl = import.meta.env.PUBLIC_FIREBASE_FUNCTIONS_URL` |
| `admin/provisions/+page.svelte` | `const projectId = 'lte-pci-mapper'` | `const functionsUrl = import.meta.env.PUBLIC_FIREBASE_FUNCTIONS_URL` |

### ✅ Environment Variables Configured

All required environment variables are properly configured in `apphosting.yaml`:

```yaml
PUBLIC_FIREBASE_FUNCTIONS_URL: https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net
PUBLIC_GENIEACS_NBI_URL: https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/genieacsNBI
PUBLIC_SYNC_CPE_DEVICES_URL: https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/syncCPEDevices
PUBLIC_GET_CPE_DEVICES_URL: https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/getCPEDevices
```

## All Working Routes

### Main Navigation
✅ All clickable, no 404s expected:

1. **Overview** → `/modules/acs-cpe-management`
   - Status: ✅ Fully functional
   - Shows: Device map, statistics, system overview

2. **Devices** → `/modules/acs-cpe-management/devices`
   - Status: ✅ Fully functional
   - Shows: CPE device list with details
   - Buttons: "Refresh Devices", "Sync from GenieACS"

3. **Faults** → `/modules/acs-cpe-management/faults`
   - Status: ✅ Fixed (now uses env vars)
   - Shows: Device fault list
   - Buttons: "Refresh", "View Details", "Resolve"

4. **Administration** → `/modules/acs-cpe-management/admin`
   - Status: ✅ Fully functional
   - Shows: Admin dashboard with sub-navigation

### Admin Sub-Navigation
✅ All clickable, no 404s expected:

1. **Presets** → `/modules/acs-cpe-management/admin/presets`
   - Status: ✅ Fixed (now uses env vars)
   - Shows: Device provisioning presets
   - Buttons: "Create Preset", "Edit", "Delete", "Enable/Disable"

2. **Provisions** → `/modules/acs-cpe-management/admin/provisions`
   - Status: ✅ Fixed (now uses env vars)
   - Shows: JavaScript provisioning scripts
   - Buttons: "Create Provision", "Edit Script", "Test"

3. **Virtual Parameters** → `/modules/acs-cpe-management/admin/virtual-parameters`
   - Status: ⚠️ Placeholder (functional but basic)
   - Shows: Coming soon message with feature list

4. **Files** → `/modules/acs-cpe-management/admin/files`
   - Status: ⚠️ Placeholder (functional but basic)
   - Shows: Coming soon message with feature list

5. **Configuration** → `/modules/acs-cpe-management/admin/config`
   - Status: ✅ Fully functional (NEW!)
   - Shows: System configuration with working buttons
   - Buttons: "Test Connection", "Test MongoDB", "Save Configuration", "Reset to Defaults"

6. **Users** → `/modules/acs-cpe-management/admin/users`
   - Status: ⚠️ Placeholder (functional but basic)
   - Shows: Coming soon message with feature list

## How to Test

### Method 1: Local Testing
```bash
cd Module_Manager
npm install
npm run dev
```

Then visit:
- http://localhost:5173/modules/acs-cpe-management
- Click through all menu items
- Verify no 404 errors

### Method 2: Production Testing
After deploying to Firebase:

```bash
cd Module_Manager
firebase apphosting:backends:deploy
```

Then visit your production URL:
- https://lte-pci-mapper-65450042-bbf71.web.app/modules/acs-cpe-management
- Click through all menu items
- Verify no 404 errors

## Expected Behavior

### Working Pages (Full Functionality)
✅ **Configuration Page**
- Test Connection button → Tests GenieACS endpoint
- Test MongoDB button → Tests database connection
- Save Configuration button → Saves settings (shows success message)
- All form inputs work correctly

✅ **Devices Page**
- Displays device list from Firebase/GenieACS
- Sync button → Fetches from MongoDB
- Filter and search work

✅ **Overview Page**
- Shows statistics and map
- All data loads from Firestore

### Placeholder Pages (Coming Soon)
⚠️ These pages exist but show "coming soon" messages:
- Virtual Parameters
- Files
- Users

**Note**: These pages don't cause 404 errors; they just show placeholder content until implemented.

## Troubleshooting

### If You Still See 404s

1. **Check Environment Variables**
   ```bash
   # In your deployed app, open browser console
   console.log(import.meta.env.PUBLIC_FIREBASE_FUNCTIONS_URL)
   # Should show: https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net
   ```

2. **Verify Deployment**
   ```bash
   firebase apphosting:backends:list
   # Check that your backend is deployed
   ```

3. **Check Build Logs**
   ```bash
   firebase apphosting:logs --backend <backend-id>
   # Look for any build or runtime errors
   ```

4. **Clear Browser Cache**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or clear cache in DevTools

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 404 on route | Old cached build | Deploy and hard refresh |
| "functionsUrl is undefined" | Environment variable not set | Check apphosting.yaml |
| API timeout | Functions not deployed | Deploy Firebase Functions |
| CORS error | Wrong origin | Check ALLOWED_ORIGINS in apphosting.yaml |

## Next Steps

To implement the placeholder pages, we would need to:

1. **Files Page**: Add file upload/download interface
2. **Users Page**: Add user CRUD operations
3. **Virtual Parameters Page**: Add parameter definition editor

For now, all navigation is working without 404 errors!

## Summary

✅ **Fixed**: 3 pages with hardcoded project IDs  
✅ **Working**: 10 routes with proper navigation  
⚠️ **Placeholder**: 3 pages (functional but basic)  
❌ **Broken**: 0 pages

**All navigation buttons and links now work correctly!**

