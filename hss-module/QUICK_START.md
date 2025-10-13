# HSS Module - Quick Start Guide

> Get up and running in 30 minutes

## 🚀 Speed Run (Minimal Setup)

### Prerequisites
```bash
✓ Node.js 18+
✓ MongoDB connection string
✓ Firebase project (optional for local testing)
```

### 1. Database Setup (5 minutes)

```bash
# Set MongoDB URI
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net"

# Initialize database
cd hss-module
npm install mongodb
node scripts/init-database.js

# ✅ Verify: Should create 6 collections with indexes
```

### 2. Generate Encryption Key (1 minute)

```bash
# Generate 256-bit key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy output and save securely
export HSS_ENCRYPTION_KEY="your_64_character_hex_key_here"
```

### 3. Test Locally (10 minutes)

```bash
# Install dependencies
npm install express cors mongodb

# Create test server
cat > test-server.js << 'EOF'
const express = require('express');
const app = require('./hss-module/api/rest-api').default;

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`HSS API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
EOF

# Start server
node test-server.js

# ✅ Verify: curl http://localhost:3000/health
```

### 4. Create Test Subscriber (5 minutes)

```bash
# Create subscriber
curl -X POST http://localhost:3000/subscribers \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_test" \
  -d '{
    "imsi": "001010123456789",
    "ki": "00112233445566778899AABBCCDDEEFF",
    "opc": "63BFA50EE6523365FF14C1F45F88737D",
    "msisdn": "+1234567890"
  }'

# ✅ Verify: Should return {"success": true}
```

### 5. Verify It Works (5 minutes)

```bash
# Get subscriber
curl http://localhost:3000/subscribers/001010123456789 \
  -H "X-Tenant-ID: tenant_test"

# Disable subscriber
curl -X POST http://localhost:3000/subscribers/001010123456789/disable \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test"}'

# Enable subscriber
curl -X POST http://localhost:3000/subscribers/001010123456789/enable

# ✅ Verify: All operations should succeed
```

### 6. Deploy to Firebase (5 minutes)

```bash
# Copy to functions
cp -r hss-module functions/src/

# Update functions/src/index.ts - Add this line:
# export { hssApi } from './hss-module/api/rest-api';

# Set secrets
firebase functions:secrets:set HSS_ENCRYPTION_KEY
firebase functions:secrets:set MONGODB_URI

# Deploy
firebase deploy --only functions:hssApi

# ✅ Verify: Test the cloud function URL
```

---

## 📝 Essential Commands

### Subscriber Management

```bash
# Create subscriber
curl -X POST $API_URL/subscribers \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{"imsi":"...","ki":"...","opc":"..."}'

# List subscribers
curl "$API_URL/subscribers?status=active" \
  -H "X-Tenant-ID: $TENANT_ID"

# Get details
curl $API_URL/subscribers/{IMSI}

# Enable
curl -X POST $API_URL/subscribers/{IMSI}/enable

# Disable
curl -X POST $API_URL/subscribers/{IMSI}/disable \
  -d '{"reason":"Non-payment"}'
```

### ACS Integration

```bash
# Sync CPE devices from GenieACS
curl -X POST $API_URL/acs/sync \
  -H "X-Tenant-ID: $TENANT_ID"

# Check correlation stats
curl "$API_URL/dashboard/stats" \
  -H "X-Tenant-ID: $TENANT_ID"
```

### Bulk Operations

```bash
# Bulk import from JSON
curl -X POST $API_URL/subscribers/bulk-import \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{"subscribers":[...]}'

# Export to CSV
curl "$API_URL/export/subscribers?format=csv" \
  -H "X-Tenant-ID: $TENANT_ID" \
  > subscribers.csv
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/hss
HSS_ENCRYPTION_KEY=64_character_hex_key

# Optional
GENIEACS_API_URL=http://localhost:7557
NODE_ENV=production
```

### MongoDB Collections

```javascript
hss.active_subscribers      // Active users
hss.inactive_subscribers    // Disabled users
hss.subscriber_cpe_mappings // IMSI → CPE correlation
hss.subscriber_sessions     // Network sessions
hss.authentication_vectors  // Auth vectors cache
hss.subscriber_audit_log    // Audit trail
```

### Firebase Secrets

```bash
# Set once
firebase functions:secrets:set HSS_ENCRYPTION_KEY
firebase functions:secrets:set MONGODB_URI

# View secrets
firebase functions:secrets:access HSS_ENCRYPTION_KEY

# Delete secret (if needed)
firebase functions:secrets:destroy HSS_ENCRYPTION_KEY
```

---

## 🐛 Troubleshooting

### Issue: "Connection refused" to MongoDB

```bash
# Check connection string
mongo $MONGODB_URI --eval "db.adminCommand('ping')"

# Verify IP whitelist in MongoDB Atlas
# Add 0.0.0.0/0 for testing (restrict in production)
```

### Issue: "Subscriber not found"

```bash
# Check if in inactive table
mongo $MONGODB_URI/hss --eval "db.inactive_subscribers.find({imsi:'...'})"

# Move back to active if needed
curl -X POST $API_URL/subscribers/{IMSI}/enable
```

### Issue: "No IMSI from CPE"

```bash
# Check GenieACS device data
mongo $GENIEACS_MONGODB_URI/genieacs --eval "
  db.devices.findOne({}, {'Device.Cellular':1})
"

# Manually trigger sync
curl -X POST $API_URL/acs/sync
```

### Issue: "High API latency"

```bash
# Check database indexes
mongo $MONGODB_URI/hss --eval "
  db.active_subscribers.getIndexes()
"

# Should see indexes on: imsi, tenantId, status
# If missing, run: node scripts/init-database.js
```

---

## 📊 Monitoring

### Health Check

```bash
# API health
curl $API_URL/health

# Expected:
# {
#   "status": "healthy",
#   "service": "HSS User Management API",
#   "version": "1.0.0"
# }
```

### Stats Dashboard

```bash
# Get tenant statistics
curl "$API_URL/dashboard/stats" \
  -H "X-Tenant-ID: $TENANT_ID"

# Returns:
# {
#   "subscribers": {
#     "total_active": 100,
#     "total_inactive": 5,
#     "total_with_acs": 95
#   },
#   "cpe_correlation": {
#     "subscribers_with_cpe": 95,
#     "cpe_online": 87,
#     "cpe_offline": 8
#   }
# }
```

### Audit Log

```bash
# View subscriber audit log
curl "$API_URL/subscribers/{IMSI}/audit-log?limit=50"

# Returns recent actions: created, enabled, disabled, etc.
```

---

## 🔒 Security Checklist

- [ ] Generated strong encryption key (256-bit)
- [ ] Stored key in Firebase Secrets (not in code)
- [ ] MongoDB connection uses TLS
- [ ] MongoDB IP whitelist configured
- [ ] Firebase Auth enabled on endpoints
- [ ] Tenant isolation tested
- [ ] Audit logging enabled
- [ ] Database backups scheduled
- [ ] Never log Ki/OPc values
- [ ] Production encryption key rotated regularly

---

## 📚 Quick Reference

### File Locations

```
hss-module/
├── services/hss-core.ts           → HSS functionality
├── services/acs-integration.ts    → ACS sync
├── services/user-management.ts    → User operations
├── api/rest-api.ts                → REST endpoints
├── scripts/init-database.js       → Setup script
└── README.md                      → Full docs
```

### Key Functions

| Service | Function | Purpose |
|---------|----------|---------|
| HSSCore | `addSubscriber()` | Create new subscriber |
| HSSCore | `deactivateSubscriber()` | Move to inactive table |
| HSSCore | `reactivateSubscriber()` | Move to active table |
| HSSCore | `generateAuthenticationVectors()` | For EPC auth |
| ACSIntegration | `syncCPEDevices()` | Extract IMSI from ACS |
| ACSIntegration | `getUnifiedSubscriberView()` | Subscriber + CPE status |
| UserManagement | `enableSubscriber()` | Activate user |
| UserManagement | `disableSubscriber()` | Deactivate user |

### Common Status Values

```javascript
subscriber.status:
  - "active"    → Can authenticate
  - "inactive"  → Cannot authenticate (in inactive table)
  - "suspended" → Temporarily disabled

cpe.online:
  - true  → Device online (last inform < 5 min)
  - false → Device offline
```

---

## 🎯 Production Checklist

Before going live:

- [ ] Database initialized with indexes
- [ ] Encryption key generated and secured
- [ ] Firebase Functions deployed
- [ ] ACS sync scheduled (every 5 min)
- [ ] Test subscriber created and verified
- [ ] Enable/disable workflow tested
- [ ] Audit logging verified
- [ ] Backup strategy implemented
- [ ] Monitoring alerts configured
- [ ] Admin staff trained
- [ ] Emergency runbook prepared

---

## 🆘 Emergency Contacts

- **Documentation**: `hss-module/README.md`
- **Implementation Guide**: `hss-module/IMPLEMENTATION_GUIDE.md`
- **Analysis**: `HSS_MODULE_ANALYSIS.md`

---

**Questions?** Check the full README.md for detailed documentation.

**Ready to deploy!** 🚀


