# Deploy Complete HSS Backend Implementation

## ✅ What Was Done

I've implemented a **complete HSS backend** with full CRUD operations for:

### 1. **Groups Management** (`/api/hss/groups`)
- ✅ `GET /api/hss/groups` - List all groups with full details
- ✅ `GET /api/hss/groups/:group_id` - Get single group by ID  
- ✅ `POST /api/hss/groups` - Create new group with validation
- ✅ `PUT /api/hss/groups/:group_id` - Update group with cascade updates
- ✅ `DELETE /api/hss/groups/:group_id` - Delete (prevents if has subscribers)

**Features:**
- Duplicate name validation
- Auto-generates unique `group_id` (e.g., `group_1730000000123`)
- Supports lookup by both `group_id` and MongoDB `_id`
- Cascades bandwidth plan changes to all subscribers in group
- Returns formatted response with `count` and `groups` array

### 2. **Bandwidth Plans Management** (`/api/hss/bandwidth-plans`)
- ✅ `GET /api/hss/bandwidth-plans` - List all plans
- ✅ `GET /api/hss/bandwidth-plans/:plan_id` - Get single plan by ID
- ✅ `POST /api/hss/bandwidth-plans` - Create new plan with validation
- ✅ `PUT /api/hss/bandwidth-plans/:plan_id` - Update plan with cascade updates
- ✅ `DELETE /api/hss/bandwidth-plans/:plan_id` - Delete (prevents if in use)

**Features:**
- Speed validation (must be > 0)
- Duplicate name validation
- Auto-generates unique `plan_id` (e.g., `plan_1730000000456`)
- Supports lookup by both `plan_id` and MongoDB `_id`
- Cascades name changes to all groups and subscribers using the plan
- Returns formatted response with `count` and `plans` array

### 3. **Dashboard Stats** (`/api/hss/dashboard/stats`)
- ✅ Subscriber counts by status (total, active, suspended, disabled)
- ✅ Online subscriber count
- ✅ Total groups count
- ✅ Total bandwidth plans count
- ✅ Tenant-filtered data

---

## 🚀 Deployment Steps

### **Option A: Automated Deployment (Recommended)**

SSH to the GCE server and run:

```bash
ssh root@136.112.111.167

# Pull latest code and run deployment script
cd /root/lte-pci-mapper
git pull origin main
chmod +x deploy-hss-complete.sh
./deploy-hss-complete.sh
```

The script will:
1. Stop the backend service
2. Backup existing files
3. Deploy new HSS management routes
4. Verify syntax
5. Restart the service
6. Test all endpoints

---

### **Option B: Manual Deployment**

```bash
ssh root@136.112.111.167

# Step 1: Pull code
cd /root/lte-pci-mapper
git pull origin main

# Step 2: Stop service
pm2 stop main-api
# OR
systemctl stop hss-api

# Step 3: Deploy file
cd /opt/hss-api
cp /root/lte-pci-mapper/backend-services/routes/hss-management.js routes/

# Step 4: Restart service
pm2 restart main-api
# OR
systemctl start hss-api

# Step 5: Check status
pm2 logs main-api --lines 20
# OR
journalctl -u hss-api -n 20 --no-pager
```

---

## 🧪 Testing

### **1. Test from Terminal (on GCE server)**

```bash
# Health check
curl http://localhost:3001/health

# Groups endpoint (should return 400 - tenant required)
curl http://localhost:3001/api/hss/groups

# Test with tenant ID
curl -H "X-Tenant-ID: 68f8df4d38ce540968cdc450" http://localhost:3001/api/hss/groups

# Bandwidth plans
curl -H "X-Tenant-ID: 68f8df4d38ce540968cdc450" http://localhost:3001/api/hss/bandwidth-plans

# Dashboard stats
curl -H "X-Tenant-ID: 68f8df4d38ce540968cdc450" http://localhost:3001/api/hss/dashboard/stats
```

### **2. Test from Frontend**

1. Open: https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app
2. Go to **Deploy** module
3. Click **"HSS Management"** button
4. Modal should load with:
   - ✅ Groups list (with count)
   - ✅ Bandwidth plans list (with count)
   - ✅ Dashboard stats
5. Try creating a new group or bandwidth plan
6. Try editing an existing one

---

## 📊 Expected Results

### **Before (Old Implementation)**
- ❌ Groups: Basic CRUD, no validation
- ❌ Bandwidth Plans: Basic CRUD, no validation
- ❌ No proper ID management (used MongoDB _id directly)
- ❌ No duplicate checking
- ❌ No cascade updates
- ❌ Simple error handling

### **After (New Implementation)**
- ✅ Groups: Full CRUD with validation and cascade updates
- ✅ Bandwidth Plans: Full CRUD with validation and cascade updates
- ✅ Proper ID management (`group_id`, `plan_id`)
- ✅ Duplicate name prevention
- ✅ Cascade updates to related entities
- ✅ Prevents deletion of in-use entities
- ✅ Comprehensive error handling and validation
- ✅ Formatted responses with counts

---

## 🐛 Troubleshooting

### **Service won't start**

```bash
# Check logs
pm2 logs main-api --err
# OR
journalctl -u hss-api -f

# Restore backup if needed
cd /opt/hss-api/routes
ls -la hss-management.js.backup-*
cp hss-management.js.backup-XXXXXXX hss-management.js
pm2 restart main-api
```

### **404 errors on frontend**

1. Check `hssProxy` Cloud Function is deployed:
   ```bash
   # On your Windows machine
   cd functions
   firebase deploy --only functions:hssProxy
   ```

2. Verify backend is running on port 3001:
   ```bash
   # On GCE server
   netstat -tulpn | grep 3001
   ```

3. Check firewall allows port 3001:
   ```bash
   gcloud compute firewall-rules list | grep 3001
   ```

### **Endpoints return empty data**

The database collections are:
- `subscriber_groups` (not `groups`)
- `bandwidth_plans` (correct)

If you have existing data in `groups` collection, migrate it:

```bash
# SSH to GCE server
ssh root@136.112.111.167

# Run MongoDB migration
node -e "
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'YOUR_MONGODB_URI';

(async () => {
  const client = await MongoClient.connect(uri);
  const db = client.db();
  
  // Migrate groups to subscriber_groups
  const oldGroups = await db.collection('groups').find({}).toArray();
  if (oldGroups.length > 0) {
    console.log('Migrating', oldGroups.length, 'groups...');
    await db.collection('subscriber_groups').insertMany(oldGroups);
    console.log('✅ Migration complete');
  }
  
  await client.close();
})();
"
```

---

## ✨ What's Fixed

The frontend was calling these endpoints that were returning errors:

1. ❌ `GET /api/hss/groups/group_xxx` → **404** (endpoint didn't exist)
   - ✅ **FIXED**: Added `GET /groups/:group_id` endpoint

2. ❌ `PUT /api/hss/groups/group_xxx` → **404** (endpoint didn't exist)
   - ✅ **FIXED**: Added `PUT /groups/:group_id` with proper validation

3. ❌ `GET /api/hss/bandwidth-plans/plan_xxx` → **404** (endpoint didn't exist)
   - ✅ **FIXED**: Added `GET /bandwidth-plans/:plan_id` endpoint

4. ❌ `GET /api/hss/dashboard/stats` → **404** (endpoint didn't exist)
   - ✅ **FIXED**: Added proper dashboard stats endpoint

5. ❌ Groups returned simple MongoDB `_id` instead of `group_id`
   - ✅ **FIXED**: Returns both `id` and `group_id` for compatibility

---

## 🎯 Next Steps

1. **Deploy the backend** using steps above
2. **Test from frontend** - try creating/editing groups and plans
3. **Verify no more 404 errors** in browser console
4. **Create test data**:
   - Create 2-3 bandwidth plans (e.g., "Basic 10/5", "Standard 25/10", "Premium 100/50")
   - Create 1-2 groups (e.g., "Residential", "Business")
   - Assign plans to groups

---

## 📝 Files Changed

- `backend-services/routes/hss-management.js` - **Complete rewrite**
- `hss-module/api/hss-management.js` - New standalone module (for future)
- `hss-module/api/hss-management.ts` - TypeScript version (for future)
- `deploy-hss-complete.sh` - Automated deployment script

---

**Status**: ✅ Code committed and pushed to GitHub (commit `b926aa8`)  
**Ready to deploy**: YES  
**Breaking changes**: NO (backward compatible with old simple endpoints)

