# 🚨 CRITICAL: Deploy Backend First!

## ⚠️ **Current Issue:**

The frontend is trying to call `/api/epc/register` but the backend doesn't have the distributed EPC API yet.

**Error in console:**
```
Failed to load resource: the server responded with a status of 500
```

This is because the backend at `136.112.111.167:3000` needs to be updated with the new distributed EPC code.

---

## ✅ **Solution: Deploy Backend Now**

### **Step 1: SSH to Server**
```bash
ssh root@136.112.111.167
```

### **Step 2: Verify Files Are There**
```bash
ls -la /root/distributed-epc-*.js
```

**You should see:**
```
-rw-r--r-- 1 root root  distributed-epc-api.js
-rw-r--r-- 1 root root  distributed-epc-schema.js
```

### **Step 3: Run Deployment**
```bash
cd /root
./deploy-hss-api.sh
```

**Expected output:**
```
═══════════════════════════════════════════════════════════
  🚀 Deploying HSS Management API
═══════════════════════════════════════════════════════════

📦 Installing dependencies...
📝 Creating server...
📦 Copying distributed EPC files from /root...
✅ Distributed EPC files copied successfully    ← IMPORTANT!
...
🚀 HSS Management API running on port 3000
📡 Health check: http://localhost:3000/health
🔍 Monitoring enabled with auto-refresh
🌐 Distributed EPC API enabled                 ← IMPORTANT!
✅ Deployment complete!
```

### **Step 4: Verify Backend**
```bash
# Check service status
systemctl status hss-api

# Should show "active (running)"

# Check logs
journalctl -u hss-api -n 20 --no-pager

# Should NOT show any errors
```

### **Step 5: Test API**
```bash
# Test health endpoint
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"..."}

# Test EPC list endpoint (will return empty array initially)
curl -H "X-Tenant-ID: test" http://localhost:3000/api/epc/list

# Should return:
# {"success":true,"count":0,"epcs":[]}
```

---

## 🔧 **If Deployment Fails:**

### **Check for File Copy Issues:**
```bash
# Verify files are in /root
ls -la /root/distributed-epc-*.js

# If missing, they're in the repo at:
# C:\Users\david\Downloads\PCI_mapper\distributed-epc-schema.js
# C:\Users\david\Downloads\PCI_mapper\distributed-epc-api.js
```

### **Check Service Logs:**
```bash
journalctl -u hss-api -n 50 --no-pager
```

Look for errors like:
- "Cannot find module" - means files weren't copied
- "SyntaxError" - means file corruption during copy
- "MongoError" - means database connection issue

---

## ✅ **After Backend Deploys:**

1. **Refresh Frontend** - Hard refresh: `Ctrl + Shift + R`
2. **Navigate to Remote EPCs** - HSS Management → Remote EPCs tab
3. **Click "Register New EPC"** - Should now work!
4. **Fill form and submit** - Will create EPC and show credentials

---

## 🎯 **Quick Deploy Checklist:**

- [ ] SSH to `136.112.111.167`
- [ ] Verify files in `/root/`
- [ ] Run `./deploy-hss-api.sh`
- [ ] See "✅ Distributed EPC files copied successfully"
- [ ] See "🌐 Distributed EPC API enabled"
- [ ] Service shows "active (running)"
- [ ] Test `/health` endpoint works
- [ ] Test `/api/epc/list` endpoint works
- [ ] Refresh frontend and test Register EPC button

---

**Deploy the backend now and the registration will work!** 🚀

