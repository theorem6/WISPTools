# Backend Deployment Steps - User Role System

**Date:** October 21, 2025  
**Status:** Ready for Deployment

---

## 📋 What Needs to Be Deployed

### **New Backend Files:**
1. `backend-services/role-auth-middleware.js` - Authentication & authorization middleware
2. `backend-services/user-management-api.js` - User management API endpoints

### **Updated Files:**
1. `firestore.rules` - Role-based security rules (auto-deployed by Firebase)
2. Server integration (needs manual update)

---

## 🚀 Deployment Instructions

### **Option 1: Automated Deployment (Recommended)**

#### **Step 1: Upload Deployment Script**
From your Windows machine:
```powershell
# Navigate to PCI_mapper directory
cd C:\Users\david\Downloads\PCI_mapper

# Copy deployment script to GCE
gcloud compute scp deploy-user-management-backend.sh genieacs-backend:~ --zone=us-central1-a
```

#### **Step 2: SSH into GCE Instance**
```powershell
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

#### **Step 3: Run Deployment Script**
On the GCE instance:
```bash
chmod +x deploy-user-management-backend.sh
./deploy-user-management-backend.sh
```

The script will:
- ✅ Pull latest code from GitHub
- ✅ Stop the backend service
- ✅ Copy new files to `/opt/hss-api/`
- ✅ Update `server.js` with new routes
- ✅ Verify syntax
- ✅ Restart the service
- ✅ Verify it's running

**Expected time:** 2-3 minutes

---

### **Option 2: Manual Deployment**

If you prefer manual control:

#### **Step 1: SSH into GCE**
```powershell
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

#### **Step 2: Pull Latest Code**
```bash
cd /root/lte-pci-mapper
git pull origin main
```

#### **Step 3: Stop Service**
```bash
systemctl stop hss-api
```

#### **Step 4: Copy Files**
```bash
cd /opt/hss-api

# Backup current server.js
cp server.js server.js.backup-$(date +%Y%m%d-%H%M%S)

# Copy new backend files
cp /root/lte-pci-mapper/backend-services/role-auth-middleware.js .
cp /root/lte-pci-mapper/backend-services/user-management-api.js .
```

#### **Step 5: Update server.js**

Open server.js:
```bash
nano server.js
```

Add after the requires section:
```javascript
const { verifyAuth, extractTenantId, requireRole, requireModule } = require('./role-auth-middleware');
const userManagementAPI = require('./user-management-api');
```

Add after the other `app.use()` statements:
```javascript
app.use('/api/users', userManagementAPI);
```

Save and exit (Ctrl+O, Enter, Ctrl+X)

#### **Step 6: Verify Syntax**
```bash
node --check role-auth-middleware.js
node --check user-management-api.js
node --check server.js
```

All should return no output (success).

#### **Step 7: Start Service**
```bash
systemctl start hss-api
systemctl status hss-api
```

Look for "active (running)" in green.

#### **Step 8: Test Endpoints**
```bash
# Test health endpoint
curl http://localhost:3001/health

# Should return: {"status":"ok","timestamp":"..."}
```

---

## 🔒 Firestore Rules Deployment

Firestore rules are **automatically deployed** when you push to GitHub and Firebase App Hosting rebuilds.

However, if you want to deploy them manually:

```powershell
# From your Windows machine (in PCI_mapper directory)
firebase deploy --only firestore:rules
```

This will deploy the updated `firestore.rules` file with role-based access control.

---

## ✅ Verification Steps

After deployment, verify everything works:

### **1. Check Service Status**
```bash
systemctl status hss-api
```
Should show "active (running)"

### **2. Check Logs**
```bash
journalctl -u hss-api -f
```
Look for:
- No error messages
- "Server running on port 3001"

Press Ctrl+C to exit.

### **3. Test API Endpoint**
```bash
curl http://localhost:3001/health
```
Should return JSON with status "ok"

### **4. Test New Endpoints (requires auth token)**

From your web app, the following endpoints should now work:
- `POST /api/users/invite` - Invite user
- `GET /api/users/tenant/:tenantId` - List users
- `PUT /api/users/:userId/role` - Update role
- etc.

---

## 🐛 Troubleshooting

### **Service Won't Start**
```bash
# Check logs
journalctl -u hss-api -n 100 --no-pager

# Common issues:
# 1. Syntax error - check with: node --check server.js
# 2. Port in use - check with: lsof -i:3001
# 3. Missing dependencies - run: npm install
```

### **Syntax Errors in server.js**
```bash
# Restore backup
cd /opt/hss-api
ls -lt server.js.backup-*
cp server.js.backup-XXXXXXXX server.js
systemctl start hss-api
```

### **Endpoints Return 404**
Check that routes are registered:
```bash
grep "userManagementAPI" /opt/hss-api/server.js
```
Should show the require statement and app.use() statement.

### **Firestore Permission Denied**
- Ensure Firestore rules are deployed
- Check user has valid Firebase auth token
- Verify user is member of tenant

---

## 📊 What Gets Deployed

### **Backend API Routes (Port 3001)**
```
POST   /api/users/invite                      - Invite user to tenant
GET    /api/users/tenant/:tenantId           - List tenant users
PUT    /api/users/:userId/role               - Update user role
PUT    /api/users/:userId/modules            - Update module access
POST   /api/users/:userId/suspend            - Suspend user
POST   /api/users/:userId/activate           - Activate user
DELETE /api/users/:userId/tenant/:tenantId   - Remove from tenant
GET    /api/users/:userId/activity           - User activity log
```

### **Middleware Functions**
Available for protecting other routes:
- `verifyAuth()` - Verify Firebase token
- `extractTenantId()` - Get tenant from request
- `requireRole([roles])` - Require specific role(s)
- `requireModule(moduleName)` - Check module access
- `requireWorkOrderPermission(action)` - Check WO permission
- `filterWorkOrdersByRole()` - Filter for installers

### **Firestore Rules**
- Role-based work order access
- User-tenant association rules
- Tenant config rules
- Notification rules

---

## 🎯 Next Steps After Deployment

1. ✅ **Verify backend is running** (health endpoint)
2. ✅ **Test user invitation** from frontend (when built)
3. ✅ **Check Firestore rules** are enforced
4. ✅ **Monitor logs** for errors

Then continue with:
- **Phase 2:** Build User Management Frontend
- **Phase 3:** Build Role-Based Module Configuration
- **Phase 4:** Build Help Desk Module
- **Phase 5:** Implement Push Notifications

---

## 📞 Support

If deployment fails:
1. Check logs: `journalctl -u hss-api -n 100`
2. Verify syntax: `node --check server.js`
3. Check port: `lsof -i:3001`
4. Review deployment script output
5. Restore backup if needed

---

## 🎉 Success Indicators

After successful deployment:
- ✅ Service shows "active (running)"
- ✅ Health endpoint returns 200 OK
- ✅ No errors in journalctl logs
- ✅ New API endpoints accessible (with auth)
- ✅ Firestore rules enforce role-based access

**Your backend is now ready for Phase 2!** 🚀

