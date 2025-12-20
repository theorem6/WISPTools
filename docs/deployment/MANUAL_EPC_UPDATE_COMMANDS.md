# Manual EPC Update Commands

If the automatic update mechanism isn't working, use these commands to manually update the EPC.

## Quick Update Command (Run on EPC)

SSH to your EPC device and run:

```bash
# Update check-in agent
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && sudo chmod +x /opt/wisptools/epc-checkin-agent.sh && sudo systemctl restart wisptools-checkin && echo "✅ Check-in agent updated and restarted"

# Update SNMP discovery script
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh -o /opt/wisptools/epc-snmp-discovery.sh && sudo chmod +x /opt/wisptools/epc-snmp-discovery.sh && echo "✅ SNMP discovery script updated"
```

## One-Line Command (All Updates)

```bash
sudo bash -c 'curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && chmod +x /opt/wisptools/epc-checkin-agent.sh && curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh -o /opt/wisptools/epc-snmp-discovery.sh && chmod +x /opt/wisptools/epc-snmp-discovery.sh && systemctl restart wisptools-checkin && echo "✅ All scripts updated and service restarted"'
```

## Verify Update

After updating, verify the version:

```bash
# Check if update worked
tail -f /var/log/wisptools-checkin.log

# Or trigger a manual check-in
sudo /opt/wisptools/epc-checkin-agent.sh once
```

## Step-by-Step Manual Update

If the one-liner doesn't work, do it step by step:

```bash
# 1. Download check-in agent
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh

# 2. Make it executable
sudo chmod +x /opt/wisptools/epc-checkin-agent.sh

# 3. Download SNMP discovery script
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh -o /opt/wisptools/epc-snmp-discovery.sh

# 4. Make it executable
sudo chmod +x /opt/wisptools/epc-snmp-discovery.sh

# 5. Restart the service
sudo systemctl restart wisptools-checkin

# 6. Check status
sudo systemctl status wisptools-checkin

# 7. Trigger immediate check-in to test
sudo /opt/wisptools/epc-checkin-agent.sh once
```

## Troubleshooting

If curl fails, check:
- Internet connectivity: `ping -c 3 hss.wisptools.io`
- DNS resolution: `nslookup hss.wisptools.io`
- Firewall/proxy settings

If service won't restart:
- Check logs: `journalctl -u wisptools-checkin -n 50`
- Check script permissions: `ls -la /opt/wisptools/`
- Verify script works: `bash -n /opt/wisptools/epc-checkin-agent.sh`

