#!/bin/bash

echo "=================================="
echo "🔍 Tenant Login Diagnostics"
echo "=================================="
echo ""

# 1. Check if backend is running
echo "1️⃣ Checking backend service..."
systemctl status hss-api | grep "Active:"
curl -s http://localhost:3000/health | jq '.'
echo ""

# 2. Check MongoDB connection
echo "2️⃣ Checking MongoDB connection..."
curl -s http://localhost:3000/health | jq '.mongodb'
echo ""

# 3. List all tenants in MongoDB
echo "3️⃣ Listing all tenants in MongoDB..."
cd /root/lte-pci-mapper
node -e "
const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const tenants = await db.collection('tenants').find({}).toArray();
  console.log('📊 Total tenants:', tenants.length);
  tenants.forEach(t => {
    console.log('  - Tenant:', t.displayName || t.name, '(ID:', t._id, ')');
    console.log('    Contact:', t.contactEmail);
    console.log('    Created:', new Date(t.createdAt).toISOString());
  });
  await mongoose.disconnect();
}).catch(err => {
  console.error('❌ MongoDB error:', err.message);
  process.exit(1);
});
"
echo ""

# 4. List all user-tenant associations
echo "4️⃣ Listing all user-tenant associations..."
node -e "
const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const userTenants = await db.collection('usertenants').find({}).toArray();
  console.log('📊 Total user-tenant associations:', userTenants.length);
  userTenants.forEach(ut => {
    console.log('  - User ID:', ut.userId);
    console.log('    Tenant ID:', ut.tenantId);
    console.log('    Role:', ut.role);
    console.log('    Status:', ut.status);
    console.log('');
  });
  await mongoose.disconnect();
}).catch(err => {
  console.error('❌ MongoDB error:', err.message);
  process.exit(1);
});
"
echo ""

# 5. Check recent logs for errors
echo "5️⃣ Recent backend logs..."
journalctl -u hss-api -n 20 --no-pager | grep -E "ERROR|Error|user-tenants|UserTenantAPI" || echo "No errors found"
echo ""

echo "=================================="
echo "✅ Diagnostics complete!"
echo "=================================="

