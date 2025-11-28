# EPC Deployment Fix - Prevent Waiting Page on Reboot

## Problem

After an EPC device is successfully deployed and linked, reboots would show the "Waiting for Configuration" page again, even though the device is already configured and registered.

## Solution

The startup script now:
1. **Checks if device is already configured** before showing waiting page
2. **Verifies with server** that device is still registered (checks both local file and server status)
3. **Disables startup service** once deployment is complete, so it doesn't run on subsequent reboots
4. **Skips waiting page entirely** if device is already registered on the server

## Changes Made

### File: `backend-services/scripts/build-live-iso.sh`

#### 1. Enhanced Configuration Check (Lines 455-531)
- If `CONFIGURED_FILE` exists, verify with server that device is still registered
- If registered, disable startup service and skip deployment (reboots go straight to functional system)
- If not registered, re-enter deployment mode

#### 2. Pre-Waiting Page Server Check (Lines 533-610)
- Before showing the "Waiting for Configuration" page, check with server if device is already registered
- If already registered, mark as configured, disable startup service, and skip waiting page
- This handles the case where device was registered but configuration file was lost

#### 3. Disable Service After Deployment (Lines 726-728)
- After successful deployment, disable the `wisptools-startup.service`
- This prevents the deployment script from running on next reboot
- Device boots directly to functional system

## How It Works

### First Boot (Unregistered Device)
1. Startup script runs (systemd service enabled)
2. No configuration file exists
3. Checks server - device not registered
4. Shows "Waiting for Configuration" page
5. Waits for device code to be entered in portal
6. Once linked, deploys configuration
7. Creates `CONFIGURED_FILE`
8. **Disables startup service**
9. System is functional

### Subsequent Reboots (Registered Device)
1. Startup script tries to run, but **service is disabled** → **Doesn't run!**
2. OR if service somehow runs:
   - Finds `CONFIGURED_FILE`
   - Verifies with server (device is registered)
   - Disables service again
   - Shows "System Running" page (not waiting page)
   - Exits immediately

### Edge Case: Configuration File Lost
1. Startup script runs
2. No `CONFIGURED_FILE` found
3. **Checks server before showing waiting page**
4. If device is registered on server → marks as configured, disables service, skips waiting
5. If device is NOT registered → shows waiting page as normal

## Benefits

- ✅ **No more waiting page on reboot** - configured devices boot directly to functional system
- ✅ **Deployment service auto-disables** - doesn't interfere with normal operation
- ✅ **Server verification** - ensures device is actually registered, not just locally flagged
- ✅ **Recovery from lost config files** - if config file is deleted, device can still skip waiting if registered on server

## Testing

After deploying this fix to a new ISO build:
1. Boot device from ISO
2. Enter device code in portal
3. Wait for deployment to complete
4. Reboot device
5. **Expected**: Device boots directly to functional system, no waiting page
6. **Expected**: Startup service is disabled (verify with `systemctl status wisptools-startup.service`)

## Deployment

This fix is in the ISO build script (`build-live-iso.sh`). To apply:
1. Build a new ISO with this updated script
2. Deploy ISO to new devices
3. Existing devices will continue working (they already have startup service disabled after first deployment)

