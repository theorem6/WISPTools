# Manual EPC Agent Update

## Quick Update (One Command)

Run this on the EPC device:

```bash
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && sudo chmod +x /opt/wisptools/epc-checkin-agent.sh && sudo systemctl restart wisptools-checkin
```

## Step-by-Step Update

### 1. Download Latest Agent Script
```bash
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh
```

### 2. Make it Executable
```bash
sudo chmod +x /opt/wisptools/epc-checkin-agent.sh
```

### 3. Restart the Service
```bash
sudo systemctl restart wisptools-checkin
```

### 4. Verify it's Running
```bash
sudo systemctl status wisptools-checkin
```

### 5. Check Logs
```bash
sudo tail -f /var/log/wisptools-checkin.log
```

## Update All Scripts

To update all EPC scripts at once:

```bash
sudo bash << 'EOF'
CENTRAL_SERVER="hss.wisptools.io"
SCRIPTS_DIR="/opt/wisptools"

# Update check-in agent
curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-checkin-agent.sh" -o "${SCRIPTS_DIR}/epc-checkin-agent.sh"
chmod +x "${SCRIPTS_DIR}/epc-checkin-agent.sh"

# Update SNMP discovery script
curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-snmp-discovery.sh" -o "${SCRIPTS_DIR}/epc-snmp-discovery.sh"
chmod +x "${SCRIPTS_DIR}/epc-snmp-discovery.sh"

# Update ping monitor (if exists)
curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-ping-monitor.js" -o "${SCRIPTS_DIR}/epc-ping-monitor.js" 2>/dev/null
[ -f "${SCRIPTS_DIR}/epc-ping-monitor.js" ] && chmod +x "${SCRIPTS_DIR}/epc-ping-monitor.js"

# Restart service
systemctl restart wisptools-checkin

echo "✅ All scripts updated and service restarted"
EOF
```

## Verify Update Worked

After updating, check:

1. **Service is running:**
   ```bash
   sudo systemctl status wisptools-checkin
   ```

2. **Recent check-ins in logs:**
   ```bash
   sudo grep "Check-in successful" /var/log/wisptools-checkin.log | tail -5
   ```

3. **No errors:**
   ```bash
   sudo grep "ERROR" /var/log/wisptools-checkin.log | tail -10
   ```

4. **Script version (if agent reports it):**
   ```bash
   sudo grep "Script versions" /var/log/wisptools-checkin.log | tail -1
   ```

## Troubleshooting

### If service won't start:
```bash
# Check for syntax errors
sudo bash -n /opt/wisptools/epc-checkin-agent.sh

# Check permissions
ls -la /opt/wisptools/epc-checkin-agent.sh

# Try running manually
sudo /opt/wisptools/epc-checkin-agent.sh once
```

### If update fails:
```bash
# Check connectivity
curl -I https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh

# Download to temp file first
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /tmp/epc-checkin-agent.sh
sudo mv /tmp/epc-checkin-agent.sh /opt/wisptools/epc-checkin-agent.sh
sudo chmod +x /opt/wisptools/epc-checkin-agent.sh
```

---

**Note**: After updating, the agent will automatically check in within 60 seconds and report the new script version.

