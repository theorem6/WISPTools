# HTML Detection False Positive Fix

## 🔍 Problem

The agent was incorrectly detecting valid JSON responses as HTML error pages:

```
2025-12-03 12:22:55 [CHECKIN] ERROR: Check-in failed - Backend returned HTML error page (HTTP 200)
2025-12-03 12:22:55 [CHECKIN] Response preview: {"status":"ok","epc_id":"EPC-CB4C5042",...
```

The response was valid JSON with HTTP 200, but the HTML detection was triggering false positives.

## ✅ Fix Applied

**Changed HTML detection logic:**
- **Before**: Checked for HTML on ALL responses, including successful 200 responses
- **After**: Only check for HTML on error status codes (4xx, 5xx)

### Code Change

```bash
# OLD - Checked HTML on all responses
if echo "$response" | grep -q "<!DOCTYPE\|<html\|Bad Gateway\|502\|503\|504"; then
    log "ERROR: Check-in failed - Backend returned HTML error page"
    return 1
fi

# NEW - Only check HTML on error status codes
if [ "$http_code" -ge 400 ]; then
    # Only then check for HTML structure
    if echo "$response" | head -c 100 | grep -qiE "^[[:space:]]*<(!DOCTYPE|html|head|body)"; then
        log "ERROR: Check-in failed - Backend returned HTML error page (HTTP $http_code)"
        return 1
    fi
fi
```

## 📋 Status

- ✅ Fix committed to Git
- ✅ Script deployed to server (`/var/www/html/downloads/scripts/epc-checkin-agent.sh`)
- ⏳ Remote agent needs to be updated

## 🚀 Update Remote Agent

Run this on the remote device (10.0.25.134):

```bash
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh
sudo chmod +x /opt/wisptools/epc-checkin-agent.sh
sudo systemctl restart wisptools-checkin
```

## ✅ Expected Behavior After Fix

**Successful Check-in (HTTP 200 + JSON)**:
```
[CHECKIN] Checking in as YALNTFQC from 10.0.25.134
[CHECKIN] Check-in successful. EPC: EPC-CB4C5042, Commands: 0
```

**Actual HTML Error (HTTP 502)**:
```
[CHECKIN] ERROR: Check-in failed - Backend returned HTML error page (HTTP 502)
[CHECKIN] Response preview: <!DOCTYPE html>...
```

**No more false positives on valid JSON responses!**


