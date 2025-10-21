/**
 * Setup Tenant Admin Script
 * Creates user_tenants record to make a user the owner/admin of a tenant
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../../functions/service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function setupTenantAdmin() {
  try {
    console.log('🔧 Setting up tenant admin...\n');
    
    // Get all tenants
    const tenantsSnapshot = await db.collection('tenants').get();
    
    if (tenantsSnapshot.empty) {
      console.log('❌ No tenants found in database');
      console.log('Please create a tenant first from the web app');
      return;
    }
    
    console.log(`Found ${tenantsSnapshot.size} tenant(s):\n`);
    
    tenantsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ${data.name || data.displayName || 'Unnamed'} (ID: ${doc.id})`);
      console.log(`   Created by: ${data.createdBy || 'Unknown'}`);
      console.log(`   Email: ${data.ownerEmail || 'Unknown'}`);
      console.log('');
    });
    
    // For now, let's set up the user as owner of all tenants
    const userEmail = 'david@david.com'; // Update this to your email
    
    console.log(`\n🔍 Looking for user with email: ${userEmail}`);
    
    // Get user by email
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(userEmail);
      console.log(`✅ Found user: ${userRecord.uid}`);
    } catch (error) {
      console.log(`❌ User not found: ${userEmail}`);
      console.log('Please login to the web app first to create your user account');
      return;
    }
    
    // Create user_tenants records
    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data();
      const userTenantId = `${userRecord.uid}_${tenantId}`;
      
      console.log(`\n📝 Creating user_tenant record for tenant: ${tenantData.name || tenantId}`);
      
      await db.collection('user_tenants').doc(userTenantId).set({
        userId: userRecord.uid,
        tenantId: tenantId,
        role: 'owner',
        status: 'active',
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
        invitedBy: userRecord.uid,
        invitedAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Set as owner of: ${tenantData.name || tenantId}`);
    }
    
    // Also update user profile to ensure it exists
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || userRecord.email,
      photoURL: userRecord.photoURL || '',
      primaryRole: 'owner',
      isPlatformAdmin: userEmail === 'david@david.com',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('\n✅ User profile updated');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log('');
    console.log(`${userEmail} is now owner of all tenants`);
    console.log('');
    console.log('What you can now do:');
    console.log('  - Access User Management module');
    console.log('  - Invite other users');
    console.log('  - Configure module access');
    console.log('  - Manage all tenant settings');
    console.log('');
    console.log('Refresh your browser to see User Management module!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

setupTenantAdmin();

