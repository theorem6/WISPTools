# Update EPC SNMP Discovery Script

A JSON construction bug has been fixed in the SNMP discovery script. The remote EPC needs to download the updated script.

## Quick Update (Run on EPC)

SSH to your remote EPC device and run:

```bash
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh -o /opt/wisptools/epc-snmp-discovery.sh && sudo chmod +x /opt/wisptools/epc-snmp-discovery.sh && echo "✅ SNMP discovery script updated"
```

## What Was Fixed

- **JSON escaping**: The script now properly escapes special characters in SNMP values (quotes, backslashes, newlines)
- **JSON validation**: Added validation to ensure valid JSON before sending to server
- **Better error handling**: Improved error messages for debugging

## Verify Update

After updating, the next SNMP discovery run (every 15 minutes) should work correctly. Check the logs:

```bash
tail -f /var/log/wisptools-checkin.log | grep SNMP-DISCOVERY
```

You should see successful discovery reports instead of JSON errors.

