#!/bin/bash

# Test tenant creation and user association
echo "=== Testing Tenant Creation Process ==="

cd /opt/hss-api

# Test 1: Check if david@tenant.com exists in Firebase Auth
echo "1. Checking if david@tenant.com exists in Firebase Auth..."
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

admin.auth().getUserByEmail('david@tenant.com')
  .then(user => {
    console.log('✅ User exists:', user.email, 'UID:', user.uid);
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ User does not exist:', error.message);
    process.exit(1);
  });
"

if [ $? -eq 0 ]; then
  echo "✅ david@tenant.com exists in Firebase Auth"
else
  echo "❌ david@tenant.com does NOT exist in Firebase Auth"
  echo "This is why tenant creation fails to create user-tenant association!"
fi

echo ""
echo "2. Testing tenant creation with proper error handling..."

# Test 2: Create a tenant and see what happens
node -e "
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const { Tenant } = require('./tenant-schema');
const { UserTenant } = require('./user-schema');

const MONGODB_URI = 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Check if user exists
    const firebaseUser = await admin.auth().getUserByEmail('david@tenant.com');
    console.log('✅ Firebase user found:', firebaseUser.email, 'UID:', firebaseUser.uid);
    
    // Create tenant
    const tenant = new Tenant({
      name: 'test-tenant',
      displayName: 'Test Tenant',
      subdomain: 'test-tenant-' + Date.now(),
      contactEmail: 'david@tenant.com',
      cwmpUrl: 'https://test-tenant.example.com',
      createdBy: 'test-admin',
      status: 'active'
    });
    
    await tenant.save();
    console.log('✅ Tenant created:', tenant._id.toString());
    
    // Create user-tenant association
    const userTenant = new UserTenant({
      userId: firebaseUser.uid,
      tenantId: tenant._id.toString(),
      role: 'owner',
      status: 'active',
      invitedBy: 'test-admin',
      invitedAt: new Date(),
      acceptedAt: new Date(),
      addedAt: new Date()
    });
    
    await userTenant.save();
    console.log('✅ User-tenant association created');
    
    // Verify it was created
    const userTenants = await UserTenant.find({ userId: firebaseUser.uid });
    console.log('✅ Found', userTenants.length, 'tenant associations for user');
    
    // Clean up
    await UserTenant.deleteMany({ tenantId: tenant._id.toString() });
    await Tenant.findByIdAndDelete(tenant._id);
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
});
"

echo ""
echo "=== Test Complete ==="
