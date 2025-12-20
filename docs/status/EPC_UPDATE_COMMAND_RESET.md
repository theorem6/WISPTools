# EPC Update Command Reset

## Status

The update command has been reset to pending status and will be delivered on the next check-in.

## Details

- **Command ID**: `6930b49d625103bad230f840`
- **Previous Status**: `sent` (was sent but never completed)
- **New Status**: `pending` (will be delivered on next check-in)
- **EPC**: YALNTFQC (EPC-CB4C5042)

## What Happened

1. ✅ Latest scripts copied to `/var/www/html/downloads/scripts/`
2. ✅ Update command was created earlier but marked as "sent"
3. ✅ Command has been reset to "pending" status
4. ⏳ Next check-in (within 60 seconds) will deliver the command

## Next Steps

The EPC should receive the update command on its next check-in. The command will:
- Download latest `epc-checkin-agent.sh`
- Download latest `epc-snmp-discovery.sh`
- Download latest `epc-snmp-discovery.js`
- Install and restart the check-in service

## Monitoring

Watch for the update on the EPC:
```bash
tail -f /var/log/wisptools-checkin.log
```

You should see:
- `[AUTO-UPDATE] Updating epc-checkin-agent.sh...`
- `[AUTO-UPDATE] Updated epc-checkin-agent.sh successfully`
- `[AUTO-UPDATE] Auto-update complete`

## If Updates Still Don't Appear

If the EPC still shows "Commands: 0" after the next check-in:
1. Check backend logs for command delivery
2. Verify scripts are accessible at download URLs
3. Check if command execution is failing silently


