# How to Check if Update System is Working

## 1. Check Backend Logs

View recent check-in logs with update information:

```bash
journalctl -u lte-wisp-backend -f | grep -E "Agent Version Manager|EPC Check-in|update"
```

Or view last 100 lines:
```bash
journalctl -u lte-wisp-backend -n 100 | grep -E "Agent Version Manager|update"
```

## 2. Check if Agent is Reporting Versions

During check-in, you should see logs like:
```
[EPC Check-in] Script versions reported: {"epc-checkin-agent.sh":{"hash":"..."}}
```

If you see "No script versions reported", the agent isn't sending version info (old agent version).

## 3. Check Update Commands Queue

View pending update commands:
```bash
# Connect to MongoDB
mongo

# Query update commands
use your_database_name
db.epccommands.find({
  notes: /Auto-update/,
  status: { $in: ['pending', 'sent'] }
}).pretty()
```

## 4. Check Agent Logs

On the EPC device, check check-in logs:
```bash
tail -f /var/log/wisptools-checkin.log | grep UPDATE
```

## 5. Manual Update Trigger

To force an update check for an EPC:

1. Clear existing update commands (if stuck):
```javascript
// In MongoDB shell
db.epccommands.deleteMany({
  notes: /Auto-update/,
  status: 'pending'
});
```

2. Next check-in will detect out-of-date scripts and queue new updates

## Expected Log Flow

When working correctly, you should see:

1. **During check-in:**
```
[EPC Check-in] Checking for updates. Agent reported 2 script(s): epc-checkin-agent.sh, epc-snmp-discovery.js
[Agent Version Manager] Checking updates for EPC EPC-XXXXX
[Agent Version Manager] Agent reported scripts: epc-checkin-agent.sh, epc-snmp-discovery.js
[Agent Version Manager] Comparing versions: ...
[Agent Version Manager] Script epc-checkin-agent.sh needs update: { current: 'abc123...', server: '9a95994f...' }
[EPC Check-in] ✓ Queued 1 update command(s) for EPC-XXXXX: Auto-update update for epc-checkin-agent.sh
```

2. **When agent receives command:**
```
[CHECKIN] Executing command XXXXX: script_execution
[UPDATE] Updating epc-checkin-agent.sh (update)...
[UPDATE] Script updated successfully
```

## Troubleshooting

### No update commands queued

- Check if agent is reporting script versions
- Verify manifest has correct SHA256 hashes
- Check if scripts actually differ (maybe agent already has latest)

### Update commands not executing

- Check command queue status in MongoDB
- Verify agent is checking in regularly
- Check agent logs for execution errors

### Hash mismatch errors

- Verify script file on server matches manifest hash
- Run `update-agent-manifest.js` to refresh hashes
- Ensure script was copied to download directory

