# Distributed EPC System - Deployment Instructions

## 📋 **Prerequisites**

1. ✅ Cloud HSS already running on `136.112.111.167`
2. ✅ MongoDB Atlas connection configured
3. ✅ Firebase Functions deployed
4. ✅ Web app access to server

---

## 🚀 **Step-by-Step Deployment**

### **Step 1: Upload Backend Files to Server**

Using your web app file manager or SSH, upload these files to `/root/`:

```
/root/distributed-epc-schema.js
/root/distributed-epc-api.js
```

**Location in repo:** 
- `distributed-epc-schema.js` (root directory)
- `distributed-epc-api.js` (root directory)

**File sizes:**
- `distributed-epc-schema.js` - ~11 KB
- `distributed-epc-api.js` - ~24 KB

---

### **Step 2: Deploy Backend**

SSH into the server and run:

```bash
ssh root@136.112.111.167
cd /root
./deploy-hss-api.sh
```

**The script will:**
1. Stop existing hss-api service
2. Copy distributed EPC files from `/root/` to `/opt/hss-api/`
3. Install dependencies
4. Restart hss-api service with new endpoints

**Expected output:**
```
📦 Copying distributed EPC files from /root...
✅ Distributed EPC files copied successfully
...
🚀 HSS Management API running on port 3000
📡 Health check: http://localhost:3000/health
🔍 Monitoring enabled with auto-refresh
🌐 Distributed EPC API enabled
```

---

### **Step 3: Verify Backend**

Check that the new endpoints are available:

```bash
# Health check
curl http://localhost:3000/health

# Test EPC endpoints (should return 400 for missing tenant ID)
curl http://localhost:3000/api/epc/list

# Check service status
systemctl status hss-api

# View logs
journalctl -u hss-api -f
```

---

### **Step 4: Deploy Frontend**

The frontend is already deployed automatically via GitHub push!

```bash
# In your local project
cd Module_Manager
git add -A
git commit -m "Deploy distributed EPC frontend"
git push origin main

# Firebase will auto-deploy
```

**Or manually:**
```bash
firebase apphosting:backends:deploy
```

---

### **Step 5: Test the System**

1. **Open the web app:**
   ```
   https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/
   ```

2. **Navigate to:**
   ```
   Dashboard → HSS & Subscriber Management → Remote EPCs
   ```

3. **Register a test EPC:**
   - Click "Register New EPC"
   - Fill in:
     - Site name: "Test Tower"
     - Coordinates: 40.7128, -74.0060 (New York)
     - MCC: 001
     - MNC: 01
     - TAC: 1
   - Click "Register EPC"
   - **Save the credentials shown!**

4. **Download deployment script:**
   - Click "📥 Script" button on the new EPC card
   - File downloads: `deploy-epc-test-tower.sh`

5. **Check status:**
   - Should show "🔵 Registered" initially
   - After deploying and agent starts: "🟢 Online"

---

## 🔧 **Troubleshooting**

### **Problem: Files not found during deploy**

**Solution:**
```bash
# Verify files exist in /root
ls -la /root/distributed-epc-*.js

# If missing, upload them via web app file manager
# Or copy from repo:
cd /root
curl -O https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/distributed-epc-schema.js
curl -O https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/distributed-epc-api.js
```

### **Problem: API endpoints not responding**

**Solution:**
```bash
# Check if hss-api is running
systemctl status hss-api

# Check for errors
journalctl -u hss-api -n 50 --no-pager

# Restart service
systemctl restart hss-api
```

### **Problem: Frontend doesn't show Remote EPCs tab**

**Solution:**
```bash
# Verify latest code is deployed
# Check browser console for errors
# Hard refresh: Ctrl+Shift+R (Chrome/Firefox)
```

---

## 📁 **File Locations After Deployment**

### **On Server (136.112.111.167)**

```
/opt/hss-api/
├── server.js                    # Main API server
├── monitoring-schema.js         # Monitoring schemas
├── monitoring-service.js        # Monitoring service
├── monitoring-api.js            # Monitoring API
├── email-service.js             # Email service
├── tenant-email-schema.js       # Email config schema
├── distributed-epc-schema.js    # ← NEW: EPC schemas
├── distributed-epc-api.js       # ← NEW: EPC API
├── package.json
├── node_modules/
└── .env

/etc/systemd/system/
└── hss-api.service              # Systemd service

/var/log/
└── (hss-api logs via journald)
```

---

## 🌐 **API Endpoints Available**

After deployment, these endpoints will be available:

### **Via Firebase Functions Proxy:**
```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/epc/register
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/epc/list
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/epc/:id
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/epc/:id/deployment-script
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/dashboard
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/metrics/heartbeat
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/metrics/submit
...
```

### **Direct (HTTP, server-side only):**
```
http://136.112.111.167:3000/api/epc/register
http://136.112.111.167:3000/api/epc/list
...
```

---

## ✅ **Deployment Checklist**

- [ ] Upload `distributed-epc-schema.js` to `/root/`
- [ ] Upload `distributed-epc-api.js` to `/root/`
- [ ] SSH to server
- [ ] Run `./deploy-hss-api.sh`
- [ ] Verify hss-api service is running
- [ ] Test API endpoints
- [ ] Open web app
- [ ] Navigate to Remote EPCs tab
- [ ] Register test EPC
- [ ] Download deployment script
- [ ] Test on remote server (optional)

---

## 📝 **Quick Deploy Commands**

```bash
# 1. Upload files via web app to /root/

# 2. SSH and deploy
ssh root@136.112.111.167
cd /root
./deploy-hss-api.sh

# 3. Verify
systemctl status hss-api
curl http://localhost:3000/health
journalctl -u hss-api -f

# 4. Test from frontend
# Navigate to: HSS Management → Remote EPCs
```

---

## 🎉 **Success Indicators**

You'll know it worked when:
1. ✅ `deploy-hss-api.sh` shows: "✅ Distributed EPC files copied successfully"
2. ✅ Service starts with: "🌐 Distributed EPC API enabled"
3. ✅ No errors in: `systemctl status hss-api`
4. ✅ Frontend shows "Remote EPCs" tab
5. ✅ You can register a new EPC
6. ✅ You can download deployment script

---

## 💡 **Next After Deployment**

Once backend is deployed:
1. Register your first EPC site in the UI
2. Download the generated deployment script
3. Copy script to a remote Ubuntu 22.04 server
4. Run: `sudo bash deploy-epc-sitename.sh`
5. Wait 1-2 minutes
6. Watch status change from "Registered" to "Online"
7. Click "Monitor" to see real-time dashboard
8. View attach/detach events as UEs connect

---

**Ready to deploy!** Upload the two files to `/root/` and run the deploy script! 🚀

