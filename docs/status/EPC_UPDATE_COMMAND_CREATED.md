# EPC Update Command Created

## Summary

An update command has been successfully created and queued for EPC device code **YALNTFQC**.

## Details

- **EPC ID**: `EPC-CB4C5042`
- **Device Code**: `YALNTFQC`
- **Command ID**: `6930b49d625103bad230f840`
- **Status**: `pending`
- **Scripts to Update**:
  - `epc-checkin-agent.sh`
  - `epc-snmp-discovery.sh`
  - `epc-snmp-discovery.js`

## What Happens Next

1. The EPC will check in within the next 60 seconds (check-in interval)
2. The update command will be delivered to the EPC
3. The EPC will download and install the updated scripts
4. The check-in service will restart automatically after updating the agent

## Expected Timeline

- **Within 60 seconds**: EPC checks in and receives the update command
- **Within 2-3 minutes**: Scripts are downloaded and installed
- **After update**: Check-in agent restarts with new scripts

## Monitoring

Watch the EPC logs to see the update progress:

```bash
# On the remote EPC
tail -f /var/log/wisptools-checkin.log
```

You should see:
- `[AUTO-UPDATE] Updating epc-checkin-agent.sh...`
- `[AUTO-UPDATE] Updated epc-checkin-agent.sh successfully`
- `[AUTO-UPDATE] Restarted check-in agent`
- `[AUTO-UPDATE] Auto-update complete`

## Why No Updates Were Sent Before

The automatic script update check is **temporarily disabled** in the check-in route (line 82-84 of `backend-services/routes/epc-checkin.js`). The comment says:

```javascript
// Check for agent script updates (TEMPORARILY DISABLED - commands have wrong hashes)
// TODO: Re-enable once manifest hashes are verified and commands use correct hashes
```

The manual update command was created using the `create-update-for-device-code.js` script, which:
1. Finds the EPC by device code
2. Checks for available script updates
3. Creates an update command if updates are needed
4. Queues the command for delivery

## Future Automatic Updates

To re-enable automatic updates, the disabled code in `backend-services/routes/epc-checkin.js` needs to be uncommented and the hash verification issue resolved.

## Script Location

The update script can be found at:
- `backend-services/scripts/create-update-for-device-code.js`

Usage:
```bash
node backend-services/scripts/create-update-for-device-code.js <DEVICE_CODE>
```

