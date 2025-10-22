# Deploy Unified MongoDB Backend

## Summary
The `user-management-api.js` was still using Firestore. I've created a clean MongoDB-only version (`user-management-api-mongodb.js`).

## What's Wrong
- `user-management-api.js` writes to Firestore `db.collection('user_tenants')`
- This creates records like `david_david_com` instead of Firebase UIDs
- Login fails because MongoDB has no records with proper UIDs

## The Fix

### Files to Deploy (All MongoDB-based):
1. `user-management-api-mongodb.js` → Replace `user-management-api.js`
2. `user-tenant-api.js` (already deployed)
3. `role-auth-middleware.js` (already has MongoDB + Firestore fallback for migration)

### Deployment Commands

Run this on the GCE server:

```bash
cd /root/lte-pci-mapper
git pull

cd /opt/hss-api

# Backup old file
cp user-management-api.js user-management-api.js.FIRESTORE.backup

# Deploy new MongoDB-only version
cp /root/lte-pci-mapper/backend-services/user-management-api-mongodb.js user-management-api.js

# Verify it was copied
ls -lh user-management-api*.js

# Check the file doesn't have db.collection calls
grep "db.collection" user-management-api.js && echo "ERROR: Still has Firestore!" || echo "OK: MongoDB only"

# Restart service
systemctl stop hss-api
fuser -k 3001/tcp
sleep 2
systemctl start hss-api
sleep 3
systemctl status hss-api

# Test the API
curl http://localhost:3001/api/health
```

### After Deployment

1. Login as platform admin (`david@david.com`)
2. Go to a tenant's User Management
3. Invite `david@tenant.com` as Owner
4. The backend will:
   - Find Firebase UID for david@tenant.com
   - Create MongoDB record with proper UID
   - Set status to 'active' immediately
5. Login as `david@tenant.com` - should work!

## Verification
After adding a user, check MongoDB has proper UID:

```bash
# On GCE server
node -e "
const mongoose = require('mongoose');
const { UserTenant } = require('./user-schema');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const users = await UserTenant.find({}).lean();
  console.log('User-Tenant Records:');
  users.forEach(u => {
    console.log('  userId:', u.userId);
    console.log('  email:', u.tenantId);
    console.log('  role:', u.role);
    console.log('');
  });
  process.exit(0);
});
" 2>/dev/null
```

The `userId` should be a long Firebase UID (like `e6VVuSMxyzZIbm8q1E2eOI7eh6V2`), NOT an email!

## Files to Clean Up Later
- Delete `user-management-api-mongo.js`
- Delete `user-management-api-mongodb.js` (after merging into main)
- Delete `user-management-api.js.FIRESTORE.backup` (after testing)

