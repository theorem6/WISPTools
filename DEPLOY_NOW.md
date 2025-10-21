# Quick Deployment Commands

**Run these commands in your GCE SSH session:**

```bash
# 1. Navigate to repository and pull latest
cd /root/lte-pci-mapper
git pull origin main

# 2. Stop the backend service
systemctl stop hss-api
sleep 3

# 3. Navigate to backend directory and backup
cd /opt/hss-api
cp server.js server.js.backup-$(date +%Y%m%d-%H%M%S)

# 4. Copy new backend files
cp /root/lte-pci-mapper/backend-services/role-auth-middleware.js .
cp /root/lte-pci-mapper/backend-services/user-management-api.js .

# 5. Verify files copied
ls -lh role-auth-middleware.js user-management-api.js

# 6. Check syntax
node --check role-auth-middleware.js
node --check user-management-api.js

# 7. Update server.js (add requires and routes)
# Add middleware import (after other requires)
sed -i "/const express = require('express')/a const { verifyAuth, extractTenantId, requireRole, requireModule } = require('./role-auth-middleware');" server.js

# Add user management API import and route
sed -i "/const express = require('express')/a const userManagementAPI = require('./user-management-api');" server.js

# Find a good place to add the route (after other API routes)
# This adds it after the monitoring API if it exists
if grep -q "app.use('/api/monitoring'" server.js; then
    sed -i "/app.use('\/api\/monitoring'/a app.use('/api/users', userManagementAPI);" server.js
else
    # Fallback - add after express.json()
    sed -i "/app.use(express.json())/a app.use('/api/users', userManagementAPI);" server.js
fi

# 8. Verify server.js syntax
node --check server.js

# 9. If syntax check passed, restart service
systemctl start hss-api
sleep 3

# 10. Check service status
systemctl status hss-api

# 11. Test health endpoint
curl http://localhost:3001/health

# 12. View logs (press Ctrl+C to exit)
journalctl -u hss-api -f
```

---

## If anything goes wrong:

```bash
# Restore backup
cd /opt/hss-api
ls -lt server.js.backup-*
cp server.js.backup-XXXXXXXXXX server.js  # Use most recent backup
systemctl start hss-api
```

---

## Success indicators:
- ✅ `systemctl status hss-api` shows "active (running)" in green
- ✅ `curl http://localhost:3001/health` returns JSON with status "ok"
- ✅ Logs show no error messages
- ✅ `ls -lh` shows both new files exist

---

## After deployment:
New API endpoints will be available at:
- POST /api/users/invite
- GET /api/users/tenant/:tenantId
- PUT /api/users/:userId/role
- And more...

All protected by Firebase authentication and role-based access control!

