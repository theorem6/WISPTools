# Manual EPC Agent Update Command

## Quick Update (One Line)

```bash
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && sudo chmod +x /opt/wisptools/epc-checkin-agent.sh && sudo systemctl restart wisptools-checkin
```

## Step-by-Step (If You Prefer)

```bash
# 1. Download latest agent script
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh

# 2. Make it executable
sudo chmod +x /opt/wisptools/epc-checkin-agent.sh

# 3. Restart the service
sudo systemctl restart wisptools-checkin

# 4. Check status
sudo systemctl status wisptools-checkin
```

## Verification

After updating, check the logs to verify it's working:

```bash
# Check recent logs
sudo tail -50 /var/log/wisptools-checkin.log

# Look for hash reporting
grep "epc-ping-monitor.js" /var/log/wisptools-checkin.log

# Check service status
sudo systemctl status wisptools-checkin
```

## What This Updates

- ✅ Reports `epc-ping-monitor.js` hash (fixes infinite loop)
- ✅ Background result reporting (survives daemon restart)
- ✅ Better error handling and logging
- ✅ Version-based duplicate prevention support

---

**Run this on your EPC device via SSH**

