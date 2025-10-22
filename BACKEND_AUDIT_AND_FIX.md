# Backend API Audit & Unified MongoDB Migration

## Problem
Multiple versions of backend API files exist, causing inconsistency:
- Some use **Firestore** (`db.collection()`)
- Some use **MongoDB** (`UserTenant.find()`)
- Multiple duplicate files (`user-management-api.js`, `user-management-api-mongo.js`, `user-management-api-mongodb.js`)

## Files That Use Firestore (NEED FIX)
1. ✅ `user-management-api.js` - **FIXED** in new version
2. `role-auth-middleware.js` - Check if uses Firestore
3. `module-auth.js` - Check if uses Firestore
4. `monitoring-api.js` - Check if uses Firestore
5. `email-service.js` - Probably OK (just sends emails)
6. `monitoring-service.js` - Check if uses Firestore

## Files That Use MongoDB (GOOD)
1. ✅ `user-tenant-api.js` - New, MongoDB only
2. ✅ `admin-tenant-api.js` - Should be MongoDB
3. ✅ `work-order-api.js` - Should be MongoDB
4. ✅ `customer-api.js` - MongoDB
5. ✅ `inventory-api.js` - MongoDB
6. ✅ `coverage-map-api.js` - MongoDB
7. ✅ `unified-network-api.js` - MongoDB

## Action Plan

### Step 1: Replace user-management-api.js
```bash
# On GCE server
cd /opt/hss-api
cp user-management-api.js user-management-api.js.FIRESTORE.backup
cp /root/lte-pci-mapper/backend-services/user-management-api-mongodb.js user-management-api.js
```

### Step 2: Audit role-auth-middleware.js
Check if it queries Firestore for user-tenant data (it should use MongoDB)

### Step 3: Remove Duplicate Files
Delete these from the repository:
- `user-management-api-mongo.js`
- `user-management-api-mongodb.js` (after copying to user-management-api.js)

### Step 4: Verify All APIs Use Correct Database

**Firestore Should Only Be Used For:**
- Tenant metadata (read-only from backend)
- Maybe invitations (temporary, until user signs up)

**MongoDB Should Be Used For:**
- UserTenant records (user-tenant associations, roles)
- WorkOrders
- Customers
- Inventory
- Coverage map data
- All business logic

### Step 5: Deploy Clean Version
```bash
cd /opt/hss-api
cp /root/lte-pci-mapper/backend-services/user-management-api-mongodb.js user-management-api.js
systemctl restart hss-api
```

## Expected Behavior After Fix

### User Invite Flow:
1. Admin enters email in User Management
2. Backend checks Firebase Auth for user
3. **If exists**: Creates active record in MongoDB immediately
4. **If not exists**: Returns error "User must create account first"
5. User can login and access tenant immediately

### User Login Flow:
1. User authenticates with Firebase
2. Frontend queries `/api/user-tenants/{uid}` (MongoDB)
3. Returns list of tenants user belongs to
4. Frontend auto-selects single tenant
5. User accesses modules

## Testing Checklist
- [ ] Platform admin can create tenants
- [ ] Platform admin can add users to tenants (via User Management)
- [ ] Users with Firebase accounts can be added immediately
- [ ] Added users can login and see their tenant
- [ ] User Management shows correct Firebase UIDs (not emails)
- [ ] All module APIs work with MongoDB tenant isolation

