# Deployment Notes - Port Configuration

## 🔌 **Port Allocation**

### **GCE VM (acs-hss-server):**
- **Port 3000**: GenieACS UI (GenieACS web interface)
- **Port 3001**: HSS Management API (all backend APIs)
  - `/api/inventory/*` - Inventory Management
  - `/api/network/*` - Coverage Map (sites, sectors, CPE)
  - `/api/monitoring/*` - Monitoring & Alerts
  - `/api/epc/*` - Distributed EPC
  - `/dashboard/*` - Dashboard stats
  - `/groups`, `/bandwidth-plans`, `/subscribers/*` - HSS endpoints

### **Google Cloud Firewall:**
✅ **Port 3000** - Open (for GenieACS UI)
✅ **Port 3001** - Open (for HSS API)

### **Cloud Functions:**
- **hssProxy**: Routes to `http://136.112.111.167:3001`
- **genieacsNBIMultitenant**: Routes to GenieACS NBI

---

## 📝 **Important for Future Deployments:**

### **Backend Port Configuration:**

**File: `/opt/hss-api/.env`**
```bash
PORT=3001  # HSS API port (DO NOT change to 3000)
```

**File: `/opt/hss-api/server.js`**
```javascript
const PORT = process.env.PORT || 3001;
```

### **Cloud Function Configuration:**

**File: `functions/src/index.ts`**
```typescript
const backendUrl = 'http://136.112.111.167:3001';  // HSS API
```

---

## ⚠️ **Common Issues:**

### **Issue: EADDRINUSE on port 3000**
**Cause:** GenieACS UI uses port 3000
**Solution:** HSS API must use port 3001

### **Issue: 500 Proxy errors**
**Causes:**
1. Firewall not open for port 3001
2. hssProxy not deployed with port 3001 update
3. Backend .env still has PORT=3000

**Solution:**
1. Open firewall: `gcloud compute firewall-rules create allow-hss-api-3001 --allow tcp:3001`
2. Deploy hssProxy: `firebase deploy --only functions:hssProxy`
3. Clean .env: Remove duplicate PORT entries, keep only PORT=3001

---

## 🚀 **Quick Deployment Checklist:**

### **Backend Updates:**
```bash
# On GCE VM
cd /root/lte-pci-mapper
git pull origin main
cd /opt/hss-api
# Copy new files
cp /root/lte-pci-mapper/backend-services/*.js .
# Verify .env has PORT=3001
grep PORT .env
# Restart
systemctl restart hss-api
# Test
curl http://localhost:3001/health
```

### **Cloud Function Updates:**
```bash
# In Firebase Web IDE
cd lte-pci-mapper/functions
git pull origin main
firebase deploy --only functions:hssProxy
```

### **Frontend Updates:**
- Auto-deploys from Git via Firebase App Hosting
- Wait 10-15 minutes or manual deploy

---

*Last Updated: Current session*
*Port Configuration: GenieACS (3000), HSS API (3001)*

