# Final Fix - Duplicate Command Prevention

## Problem Identified

The duplicate prevention wasn't working because:
1. **Expiration check was too strict** - Commands with `status: 'sent'` were only blocked if `expires_at > now()`, but we should block ALL sent commands regardless of expiration
2. **Agent script needs priority** - If the agent script itself needs updating, it should be updated FIRST to enable hash reporting for other scripts

## Fixes Applied

### 1. Removed Expiration Check for Sent Commands
**File**: `backend-services/routes/epc-checkin.js`

**Before**:
```javascript
{ status: { $in: ['pending', 'sent'] }, expires_at: { $gt: new Date() } }
```

**After**:
```javascript
{ status: { $in: ['pending', 'sent'] } }  // Block ALL sent commands, regardless of expiration
```

This ensures that if a command is 'sent' (even if expired), we don't create a duplicate until it's completed or failed.

### 2. Prioritize Agent Script Updates
**File**: `backend-services/utils/epc-auto-update.js`

- Agent script updates now get `priority: 1` (highest priority)
- Other script updates get `priority: 5`
- Scripts are sorted by priority before generating the update command
- Agent script will be updated first, enabling hash reporting for subsequent updates

## Expected Behavior

1. ✅ **First update command** - Updates agent script (if needed) or ping-monitor (if agent is up to date)
2. ✅ **Command marked as 'sent'** - Backend won't create duplicate
3. ✅ **After agent update** - Agent reports hashes, backend knows scripts are up to date
4. ✅ **No more duplicates** - Loop stops

## Deployment Status

✅ **Backend deployed** - Changes are live on the server

⚠️ **Agent still needs manual update** - The agent script on the EPC is still the old version

## Next Steps

**Option 1: Wait for auto-update** (if agent script is included in update)
- The backend will prioritize updating the agent script first
- Once agent is updated, it will report hashes
- Loop should stop

**Option 2: Manual agent update** (faster)
```bash
# SSH to EPC and run:
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && sudo chmod +x /opt/wisptools/epc-checkin-agent.sh && sudo systemctl restart wisptools-checkin
```

## Verification

After deployment, check backend logs:
```bash
# Should see improved duplicate prevention
grep "Update command already exists" /var/log/pm2/backend-services.log

# Should see agent script prioritized
grep "epc-checkin-agent.sh needs update" /var/log/pm2/backend-services.log
```

---

**Status**: Backend ✅ Deployed | Agent ⚠️ Needs Update (or wait for auto-update)

