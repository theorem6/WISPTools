# Deploy Backend Fixes for EPC Command Issues

## Files Changed (Backend Only)

1. `backend-services/routes/epc-checkin.js`
   - Enhanced result reporting endpoint with verification
   - Safety filter for pending commands
   - Mark commands as sent BEFORE returning them
   - Better duplicate prevention for auto-updates

2. `backend-services/services/epc-checkin-service.js`
   - Added clarifying comments (no functional changes)

3. `backend-services/utils/epc-auto-update.js`
   - Added comment about restart timing (no functional changes)

4. `backend-services/scripts/check-queued-commands.js`
   - New utility script for checking queued commands

## Deployment Steps

### 1. Backup Current Files

```bash
cd /opt/lte-pci-mapper

# Backup routes
cp backend-services/routes/epc-checkin.js backend-services/routes/epc-checkin.js.backup.$(date +%Y%m%d_%H%M%S)

# Backup services
cp backend-services/services/epc-checkin-service.js backend-services/services/epc-checkin-service.js.backup.$(date +%Y%m%d_%H%M%S)

# Backup utils
cp backend-services/utils/epc-auto-update.js backend-services/utils/epc-auto-update.js.backup.$(date +%Y%m%d_%H%M%S)
```

### 2. Deploy Updated Files

Copy the updated files from your local machine to the server:

```bash
# From your local machine (Windows)
scp backend-services/routes/epc-checkin.js user@server:/opt/lte-pci-mapper/backend-services/routes/
scp backend-services/services/epc-checkin-service.js user@server:/opt/lte-pci-mapper/backend-services/services/
scp backend-services/utils/epc-auto-update.js user@server:/opt/lte-pci-mapper/backend-services/utils/
scp backend-services/scripts/check-queued-commands.js user@server:/opt/lte-pci-mapper/backend-services/scripts/
```

Or if using git:
```bash
# On server
cd /opt/lte-pci-mapper
git pull origin main  # or your branch name
```

### 3. Verify Files

```bash
cd /opt/lte-pci-mapper

# Check syntax
node -c backend-services/routes/epc-checkin.js
node -c backend-services/services/epc-checkin-service.js
node -c backend-services/utils/epc-auto-update.js
node -c backend-services/scripts/check-queued-commands.js

# Make script executable
chmod +x backend-services/scripts/check-queued-commands.js
```

### 4. Restart Backend Service

```bash
# Check current status
sudo systemctl status lte-pci-mapper-backend
# or
sudo systemctl status node-backend
# or whatever your service name is

# Restart the service
sudo systemctl restart lte-pci-mapper-backend
# or
sudo systemctl restart node-backend

# Check it started successfully
sudo systemctl status lte-pci-mapper-backend
```

### 5. Verify Deployment

```bash
# Check backend logs
sudo journalctl -u lte-pci-mapper-backend -f
# or
tail -f /var/log/backend.log

# Look for:
# - No errors on startup
# - Routes loaded successfully
# - Check-in endpoint working
```

### 6. Test the Check-Queued-Commands Script

```bash
cd /opt/lte-pci-mapper
node backend-services/scripts/check-queued-commands.js EPC-CB4C5042
# or
node backend-services/scripts/check-queued-commands.js YALNTFQC
```

## What These Fixes Do

1. **Prevents duplicate commands** - Checks for both 'pending' and 'sent' status before creating new update commands
2. **Better result reporting** - Verifies command exists and device code matches before updating status
3. **Safety filters** - Only returns truly pending commands (filters out any that slipped through)
4. **Immediate marking** - Commands marked as 'sent' BEFORE being returned to agent (prevents race conditions)

## Rollback (If Needed)

If something goes wrong:

```bash
cd /opt/lte-pci-mapper

# Restore backups
cp backend-services/routes/epc-checkin.js.backup.* backend-services/routes/epc-checkin.js
cp backend-services/services/epc-checkin-service.js.backup.* backend-services/services/epc-checkin-service.js
cp backend-services/utils/epc-auto-update.js.backup.* backend-services/utils/epc-auto-update.js

# Restart service
sudo systemctl restart lte-pci-mapper-backend
```

## Expected Behavior After Deployment

✅ **No duplicate update commands** - System checks for existing 'sent' commands before creating new ones
✅ **Commands properly completed** - Result reporting endpoint verifies and updates commands correctly
✅ **Better error handling** - All failures are logged with details
✅ **Safety checks** - Only truly pending commands are returned to agents

## Monitoring

After deployment, monitor:

1. **Backend logs** - Watch for any errors
2. **Command queue** - Use the check script to see if commands are completing
3. **EPC check-ins** - Verify agents are checking in successfully

```bash
# Check queued commands
node backend-services/scripts/check-queued-commands.js EPC-CB4C5042

# Watch backend logs
sudo journalctl -u lte-pci-mapper-backend -f | grep -E "EPC Check-in|Command|ERROR"
```

---

**Note**: The agent script (`epc-checkin-agent.sh`) needs to be deployed separately on each EPC device. The backend changes will work with both old and new agent versions, but the new agent version is needed for the immediate result reporting fix.

