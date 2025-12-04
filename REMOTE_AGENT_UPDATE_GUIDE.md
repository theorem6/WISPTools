# Remote EPC Agent Update Guide

## 🔍 Issues Found

The remote agent (YALNTFQC) is experiencing check-in failures with:

1. **502 Bad Gateway**: Backend was temporarily down, causing nginx to return HTML error pages
2. **JSON Parse Error**: Agent tried to parse HTML 502 page as JSON → "Invalid numeric literal at line 1, column 7"
3. **Control Characters**: Log data in JSON payload contains control characters that break JSON parsing

---

## ✅ Fixes Applied

### **Backend Updates** (Already Deployed)
- ✅ Improved error handling for malformed JSON
- ✅ Better error messages for check-in endpoint
- ✅ Backend is now running and stable

### **Agent Script Updates** (Need to Deploy to Remote Agents)

Updated `epc-checkin-agent.sh` to:

1. **Detect HTML Responses**: Checks if response is HTML before parsing as JSON
2. **Sanitize Control Characters**: Removes control characters from log data before sending
3. **Better Error Handling**: Provides clearer error messages and handles HTTP status codes

---

## 🚀 Update Remote Agents

### **Option 1: Automatic Update (Recommended)**

The agent script will automatically check for updates. However, you can force an immediate update:

```bash
# On each remote EPC device
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh
sudo chmod +x /opt/wisptools/epc-checkin-agent.sh
sudo systemctl restart wisptools-checkin
```

### **Option 2: Manual Update**

1. SSH to each remote EPC device
2. Download the updated script:
   ```bash
   sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh
   sudo chmod +x /opt/wisptools/epc-checkin-agent.sh
   ```

3. Restart the check-in service:
   ```bash
   sudo systemctl restart wisptools-checkin
   ```

4. Check status:
   ```bash
   sudo systemctl status wisptools-checkin
   tail -f /var/log/wisptools-checkin.log
   ```

---

## 🔍 Verify Fix

After updating, check the agent logs on the remote device:

```bash
tail -f /var/log/wisptools-checkin.log
```

**Expected Behavior:**
- ✅ No more "Invalid numeric literal" errors
- ✅ Clear error messages if backend is down (instead of trying to parse HTML)
- ✅ Successful check-ins when backend is available

---

## 📋 What Changed in Agent Script

1. **HTML Detection**:
   ```bash
   # Check if response is HTML (502 Bad Gateway or other errors)
   if echo "$response" | grep -q "<!DOCTYPE\|<html\|Bad Gateway\|502\|503\|504"; then
       log "ERROR: Check-in failed - Backend returned HTML error page"
       return 1
   fi
   ```

2. **Control Character Sanitization**:
   ```bash
   # Sanitize control characters from log data
   local recent_logs=$(tail -n 50 "$LOG_FILE" | head -c 5000 | tr -d '\000-\010\013-\037' || echo "")
   ```

3. **Better Error Messages**:
   - Shows HTTP status code
   - Shows error message from backend if available
   - Logs response preview for debugging

---

## ⚠️ Important Notes

- **Backend is now stable**: The backend server is running and accepting connections
- **Previous failures were temporary**: Backend was down temporarily (connection refused)
- **Agent will retry**: The agent retries every 60 seconds (default interval)
- **No data loss**: Check-in failures are logged but don't prevent future check-ins

---

## 🎯 Devices to Update

Based on the error log, the following device needs updating:
- **YALNTFQC** (10.0.25.134)

---

## 🔧 Troubleshooting

If check-ins still fail after updating:

1. **Check backend connectivity**:
   ```bash
   curl -v https://hss.wisptools.io/api/epc/checkin
   ```

2. **Check agent logs**:
   ```bash
   tail -50 /var/log/wisptools-checkin.log
   ```

3. **Verify device code**:
   ```bash
   cat /etc/wisptools/device-code.env
   # or
   cat /etc/wisptools/device_code
   ```

4. **Test manually**:
   ```bash
   sudo /opt/wisptools/epc-checkin-agent.sh once
   ```

---

**Update Date**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Backend Status**: ✅ Running and stable
**Agent Script Version**: Updated with HTML detection and control character sanitization


