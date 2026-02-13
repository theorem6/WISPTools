# 🚀 Complete HSS Deployment - Final Steps

**Current Status:** Backend ✅ Complete | Frontend ⏳ Needs Proxy Deployment

---

## 🎯 **What You Need to Do Now**

### **Step 1: Deploy Firebase Functions Proxy (5 minutes)**

Open Google Cloud Shell:
👉 **https://console.cloud.google.com/** (click **>_** icon in top right)

Then run:

```bash
bash <(curl -s https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/deploy-firebase-functions.sh)
```

**OR manually:**

```bash
# Clone/update repo
cd /home/user
git clone https://github.com/theorem6/lte-pci-mapper.git 2>/dev/null || \
  (cd lte-pci-mapper && git pull origin main)

# Deploy function
cd lte-pci-mapper/functions
npm install
npm run build
firebase deploy --only functions:hssProxy --project lte-pci-mapper-65450042-bbf71
```

**Expected Output:**
```
✔  functions[hssProxy(us-central1)] Deployed successfully
Function URL: https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy
```

**Test It:**
```bash
curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/health
```

Should return: `{"status":"ok",...}`

---

### **Step 2: Wait for Frontend Auto-Deploy (10 minutes)**

The frontend will automatically redeploy from your GitHub push.

**Monitor Progress:**
```
https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
```

Look for:
- Build status: "Building..." → "Deployed ✅"
- Commit: `db16038` or later

---

### **Step 3: Test the HSS Module (5 minutes)**

Once frontend deploys, go to:
```
https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/hss-management
```

**You should see:**
- ✅ No more CORS errors
- ✅ Dashboard loads
- ✅ All tabs functional

---

### **Step 4: Create Initial Data (10 minutes)**

#### **A. Create Bandwidth Plans:**

Click "Bandwidth Plans" tab → "➕ Add Plan"

**Bronze Plan:**
- Name: Bronze
- Upload: 25 Mbps
- Download: 100 Mbps
- QCI: 9
- Description: Basic residential service

**Silver Plan:**
- Name: Silver
- Upload: 50 Mbps
- Download: 300 Mbps
- QCI: 9
- Description: Standard service

**Gold Plan:**
- Name: Gold
- Upload: 100 Mbps
- Download: 500 Mbps
- QCI: 9
- Description: Premium high-speed service

#### **B. Create Subscriber Groups:**

Click "Groups" tab → "➕ Add Group"

**Residential Group:**
- Name: Residential
- Description: Home users
- Default Plan: Silver

**Business Group:**
- Name: Business
- Description: Business customers
- Default Plan: Gold

**VIP Group:**
- Name: VIP
- Description: Premium customers
- Default Plan: Gold

#### **C. Add Test Subscriber:**

Click "Subscribers" tab → "➕ Add Subscriber"

- **IMSI:** `001010000000001`
- **Subscriber Name:** Test User
- **Ki:** Click "🎲 Generate"
- **OPc:** Click "🎲 Generate"
- **AMF:** `8000` (default)
- **SQN:** `000000000000` (default)
- **QCI:** `9 - Default Bearer (Internet)`
- **APN:** `internet`
- **Group:** Select "Residential"
- **Bandwidth Plan:** Select "Silver"
- **Enable:** ✓ Checked

Click "✅ Add Subscriber"

---

### **Step 5: Verify in MongoDB (2 minutes)**

**Test MongoDB connection:**

```bash
# On your local machine or in Cloud Shell
mongosh "mongodb+srv://user:****@cluster0.1radgkw.mongodb.net/open5gs"

# View subscribers
db.subscribers.find().pretty()

# Count subscribers
db.subscribers.count()

# View groups (in lte-wisp database)
use lte-wisp
db.subscriber_groups.find().pretty()
db.bandwidth_plans.find().pretty()
```

---

### **Step 6: Configure Remote MME (When Ready)**

When you're ready to connect an MME, follow **MME_CONNECTION_GUIDE.md**:

**On MME server, configure `/etc/freeDiameter/mme.conf`:**

```conf
Identity = "mme.open5gs.org";
Realm = "open5gs.org";

ConnectPeer = "hss.open5gs.org" {
    ConnectTo = "136.112.111.167";
    Port = 3868;
    No_TLS;
};

Port = 3868;
No_SCTP;
ListenOn = "0.0.0.0";

LoadExtension = "dbg_msg_dumps.fdx";
LoadExtension = "dict_nasreq.fdx";
LoadExtension = "dict_nas_mipv6.fdx";
```

**Start MME:**
```bash
systemctl start open5gs-mmed
journalctl -u open5gs-mmed -f
```

**Verify on HSS:**
```bash
ssh root@136.112.111.167 "tail -f /var/log/open5gs/hss.log | grep peer"
```

Should show: "Diameter peer 'mme.open5gs.org' connected"

---

## ✅ **Deployment Checklist**

Track your progress:

- [ ] **Step 1:** Deploy Firebase Functions proxy
  - Open Cloud Shell
  - Run deployment script
  - Verify function URL works
  
- [ ] **Step 2:** Wait for frontend deploy
  - Check Firebase Console
  - Wait for "Deployed ✅" status
  - Clear browser cache
  
- [ ] **Step 3:** Test HSS Module
  - Access web UI
  - Verify no CORS errors
  - Check all tabs load
  
- [ ] **Step 4:** Create initial data
  - Create 3 bandwidth plans
  - Create 3 subscriber groups
  - Add test subscriber
  
- [ ] **Step 5:** Verify in MongoDB
  - Connect to Atlas
  - Check subscriber exists
  - Verify groups and plans
  
- [ ] **Step 6:** Optional - Connect MME
  - Configure MME FreeDiameter
  - Start MME service
  - Verify connection in HSS logs
  - Test UE attachment

---

## 🎯 **Success Criteria**

You'll know it's working when:

✅ Firebase Function responds to curl  
✅ Web UI loads without errors  
✅ Can create bandwidth plans  
✅ Can create subscriber groups  
✅ Can add subscribers  
✅ Data appears in MongoDB  
✅ (Optional) MME connects to HSS  
✅ (Optional) UE can attach and authenticate  

---

## 🚨 **If Something Fails**

### **Firebase Function Build Error:**
```bash
# Check TypeScript errors
cd /home/user/lte-pci-mapper/functions
npm run build

# If errors, share output and I'll fix
```

### **Frontend Still Shows CORS Errors:**
```bash
# Check deployment status
gcloud app services list --project=lte-pci-mapper-65450042-bbf71

# Force redeploy via Firebase Console
# Or make a small change and push to trigger rebuild
```

### **Can't Add Subscribers:**
```bash
# Check backend API
ssh root@136.112.111.167 "curl http://localhost:3000/health"

# Check service
ssh root@136.112.111.167 "systemctl status hss-api.service"

# Check logs
ssh root@136.112.111.167 "journalctl -u hss-api.service -n 50"
```

---

## 📞 **Quick Reference**

**HSS Server:** `136.112.111.167`

**Services:**
- Open5GS HSS: `systemctl status open5gs-hssd` (Port 3868)
- HSS API: `systemctl status hss-api.service` (Port 3000)
- GenieACS: `systemctl status genieacs-cwmp` (Port 7547)

**Web UI:**
```
https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/hss-management
```

**API Proxy (after deployment):**
```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy
```

**MongoDB:**
```
mongodb+srv://user:****@cluster0.1radgkw.mongodb.net/open5gs
```

---

## 🎉 **Ready to Deploy!**

**Just run Step 1 in Cloud Shell and you're done!**

All other steps will happen automatically or via the web UI.

**The system is 98% complete - just one command away from 100%!** 🚀

---

**For detailed documentation, see:**
- `HSS_PRODUCTION_GUIDE.md` - Complete system documentation
- `MME_CONNECTION_GUIDE.md` - MME configuration
- `HSS_DEPLOYMENT_COMPLETE.md` - System overview
- `FINAL_DEPLOYMENT_STATUS.md` - Status report

