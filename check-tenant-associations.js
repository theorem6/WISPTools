// Diagnostic script to check tenant associations in Firestore
// Run with: node check-tenant-associations.js <userEmail>

const admin = require('firebase-admin');

// Initialize Firebase Admin (uses default credentials or GOOGLE_APPLICATION_CREDENTIALS env var)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkUserTenants(userEmail) {
  try {
    console.log('\n🔍 Checking tenant associations for:', userEmail);
    console.log('='.repeat(60));
    
    // Get the user's UID from Firebase Auth
    let uid;
    try {
      const userRecord = await admin.auth().getUserByEmail(userEmail);
      uid = userRecord.uid;
      console.log('✅ User found in Firebase Auth');
      console.log('   UID:', uid);
    } catch (error) {
      console.error('❌ User not found in Firebase Auth:', error.message);
      return;
    }
    
    // Check user_tenants collection for associations
    console.log('\n📋 Checking user_tenants collection...');
    const userTenantsSnapshot = await db.collection('user_tenants')
      .where('userId', '==', uid)
      .get();
    
    if (userTenantsSnapshot.empty) {
      console.log('❌ No tenant associations found for this user');
      console.log('   Expected document ID format: ' + uid + '_<tenantId>');
      
      // Check if there are ANY user_tenants documents at all
      const allAssociations = await db.collection('user_tenants').limit(5).get();
      console.log('\n📊 Sample user_tenants documents in database:');
      if (allAssociations.empty) {
        console.log('   ⚠️  No user_tenants documents exist at all!');
      } else {
        allAssociations.docs.forEach(doc => {
          console.log(`   - ${doc.id}: userId=${doc.data().userId}, tenantId=${doc.data().tenantId}`);
        });
      }
    } else {
      console.log(`✅ Found ${userTenantsSnapshot.size} tenant association(s):`);
      
      for (const doc of userTenantsSnapshot.docs) {
        const data = doc.data();
        console.log('\n   Association ID:', doc.id);
        console.log('   Tenant ID:', data.tenantId);
        console.log('   Role:', data.role);
        console.log('   Created:', data.createdAt?.toDate?.() || data.createdAt);
        
        // Get the actual tenant document
        try {
          const tenantDoc = await db.collection('tenants').doc(data.tenantId).get();
          if (tenantDoc.exists) {
            const tenant = tenantDoc.data();
            console.log('   ✅ Tenant exists:', tenant.displayName);
            console.log('      Subdomain:', tenant.subdomain);
            console.log('      Created by:', tenant.createdBy);
          } else {
            console.log('   ❌ Tenant document NOT FOUND!');
          }
        } catch (error) {
          console.log('   ❌ Error reading tenant:', error.message);
        }
      }
    }
    
    // Check if user created any tenants
    console.log('\n🏢 Checking tenants created by this user...');
    const createdTenantsSnapshot = await db.collection('tenants')
      .where('createdBy', '==', uid)
      .get();
    
    if (createdTenantsSnapshot.empty) {
      console.log('❌ No tenants created by this user');
    } else {
      console.log(`✅ Found ${createdTenantsSnapshot.size} tenant(s) created by this user:`);
      createdTenantsSnapshot.docs.forEach(doc => {
        const tenant = doc.data();
        console.log(`   - ${doc.id}: ${tenant.displayName} (${tenant.subdomain})`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnostic complete\n');
    
  } catch (error) {
    console.error('\n❌ Error during diagnostic:', error);
  }
}

// Get email from command line argument
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('Usage: node check-tenant-associations.js <userEmail>');
  console.error('Example: node check-tenant-associations.js david@tenant.com');
  process.exit(1);
}

checkUserTenants(userEmail)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

