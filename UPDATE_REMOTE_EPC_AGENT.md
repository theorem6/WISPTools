# Update Remote EPC Agent

The EPC/SNMP hardware agent can be updated manually or automatically.

## Auto-Update (Recommended)
The agent automatically checks for updates every check-in (60 seconds). If scripts on the server are newer, it will download and update them automatically.

## Manual Update Command

SSH to your remote EPC device and run:

```bash
sudo bash -c 'curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && chmod +x /opt/wisptools/epc-checkin-agent.sh && curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh -o /opt/wisptools/epc-snmp-discovery.sh && chmod +x /opt/wisptools/epc-snmp-discovery.sh && systemctl restart wisptools-checkin && echo "✅ All scripts updated and service restarted"'
```

## Verify Update

After updating, check the logs:

```bash
tail -f /var/log/wisptools-checkin.log
```

Or trigger a manual check-in:

```bash
sudo /opt/wisptools/epc-checkin-agent.sh once
```

## What the Agent Does

1. **Check-in**: Reports status every 60 seconds
2. **SNMP Discovery**: Scans network for SNMP devices every 15 minutes
3. **Auto-Update**: Checks for script updates on each check-in
4. **Command Execution**: Executes queued commands from the server

## Current Status

- ✅ Agent includes SNMP discovery
- ✅ Scripts are served from GCE server
- ✅ Auto-update system is active
- ✅ SNMP discovery endpoint is ready

