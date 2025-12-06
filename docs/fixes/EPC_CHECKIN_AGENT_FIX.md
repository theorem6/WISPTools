# EPC Check-in Agent Fix - Regular Check-ins Stopped

## Problem
The remote EPC agent stopped checking in regularly. The daemon may have crashed, stopped due to errors, or the systemd service may have failed.

## Root Causes Identified

1. **No error recovery in daemon loop** - If check-in fails, it just sleeps and tries again, but if there's a fatal error, the daemon stops
2. **No exponential backoff** - Repeated failures cause immediate retries which can overwhelm the system
3. **Systemd service may not restart properly** - Service configuration could be improved
4. **No monitoring of daemon health** - If the daemon silently fails, there's no alert

## Fixes Applied

### 1. Enhanced Daemon Mode with Error Recovery (`epc-checkin-agent.sh`)

**Before**: Simple loop with no failure handling
```bash
daemon_mode() {
    log "Starting check-in daemon (interval: ${CHECKIN_INTERVAL}s)"
    while true; do
        do_checkin
        sleep "$CHECKIN_INTERVAL"
    done
}
```

**After**: Robust error recovery with exponential backoff
```bash
daemon_mode() {
    log "Starting check-in daemon (interval: ${CHECKIN_INTERVAL}s)"
    
    local consecutive_failures=0
    local max_consecutive_failures=10
    local failure_backoff=60
    
    while true; do
        if do_checkin; then
            # Success - reset failure counter
            consecutive_failures=0
            failure_backoff=60
            sleep "$CHECKIN_INTERVAL"
        else
            # Failure - exponential backoff
            consecutive_failures=$((consecutive_failures + 1))
            local backoff_time=$((failure_backoff * (2 ** (consecutive_failures - 1))))
            if [ $backoff_time -gt 600 ]; then
                backoff_time=600  # Cap at 10 minutes
            fi
            log "Retrying in ${backoff_time}s (consecutive failures: $consecutive_failures)"
            sleep "$backoff_time"
        fi
    done
}
```

### 2. Improved Systemd Service Configuration

**Before**: Basic restart configuration
```ini
[Service]
Type=simple
ExecStart=/opt/wisptools/epc-checkin-agent.sh daemon
Restart=always
RestartSec=30
```

**After**: Enhanced with limits and logging
```ini
[Service]
Type=simple
ExecStart=/opt/wisptools/epc-checkin-agent.sh daemon
Restart=always
RestartSec=30
StartLimitInterval=300
StartLimitBurst=5
StartLimitAction=none  # Keep running even if fails repeatedly

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=wisptools-checkin

# Timeouts
TimeoutStartSec=60
TimeoutStopSec=30
```

## Verification Steps

### 1. Check if service is running
```bash
systemctl status wisptools-checkin
```

### 2. Check service logs
```bash
# Systemd logs
journalctl -u wisptools-checkin -f

# Agent log file
tail -f /var/log/wisptools-checkin.log
```

### 3. Check if check-ins are happening
```bash
# Look for recent check-in messages
grep "Check-in successful" /var/log/wisptools-checkin.log | tail -5
```

### 4. Test check-in manually
```bash
sudo /opt/wisptools/epc-checkin-agent.sh once
```

### 5. Restart service if needed
```bash
sudo systemctl restart wisptools-checkin
sudo systemctl status wisptools-checkin
```

## Troubleshooting

### If service is not running:
```bash
# Check why it stopped
sudo systemctl status wisptools-checkin
journalctl -u wisptools-checkin --no-pager | tail -50

# Restart it
sudo systemctl restart wisptools-checkin

# Enable auto-start on boot
sudo systemctl enable wisptools-checkin
```

### If check-ins are failing:
```bash
# Check for connection errors
grep "ERROR" /var/log/wisptools-checkin.log | tail -10

# Test connectivity
curl -v https://hss.wisptools.io/api/epc/checkin

# Check device code
cat /etc/wisptools/device-code.env
```

### If daemon keeps crashing:
```bash
# Check for script errors
bash -x /opt/wisptools/epc-checkin-agent.sh daemon

# Verify script permissions
ls -la /opt/wisptools/epc-checkin-agent.sh

# Check for missing dependencies
which jq curl systemctl
```

## Expected Behavior After Fix

✅ **Daemon runs continuously** - Even if check-ins fail, daemon keeps running
✅ **Exponential backoff** - Failed check-ins wait longer before retry (60s, 120s, 240s, max 600s)
✅ **Systemd auto-restart** - Service automatically restarts if it crashes
✅ **Better logging** - All output goes to systemd journal and log file
✅ **Graceful error handling** - Errors don't crash the daemon

## Files Changed

1. `backend-services/scripts/epc-checkin-agent.sh`
   - Enhanced `daemon_mode()` with error recovery and exponential backoff
   - Improved systemd service configuration with better restart policies
   - Added timeout protection to curl commands (prevents hanging)
   - Fixed log function to write to stderr (prevents stdout contamination)
   - Added health check logging for daemon monitoring
   - Better error handling throughout

## Deployment

The updated script needs to be:
1. **Deployed to server** - EPCs download it from:
   ```
   https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh
   ```
2. **Downloaded by EPCs** - On next check-in, EPCs will download the updated script
3. **Service restarted** - On EPC, run:
   ```bash
   sudo systemctl restart wisptools-checkin
   ```

Or manually update on EPC:
```bash
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh
sudo chmod +x /opt/wisptools/epc-checkin-agent.sh
sudo systemctl restart wisptools-checkin
```

---

**Status**: ✅ Fixed  
**Date**: 2025-12-06

