/**
 * Fix User IDs in MongoDB
 * Converts email-based userIds to proper Firebase UIDs
 */

const admin = require('firebase-admin');
const mongoose = require('mongoose');
const { UserTenant } = require('./user-schema');

// Initialize Firebase Admin (check if already initialized by server.js)
if (!admin.apps.length) {
  // Load service account from environment or file
  const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS 
    ? require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : null;
  
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
}

// MongoDB connection - use same as server.js
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:WJANdi3M9qLGhxdT@cluster0.vwchurv.mongodb.net/hss_management?retryWrites=true&w=majority&appName=hss-api';

// UserTenant model is imported from user-schema.js

async function fixUserIds() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all user-tenant records
    const userTenants = await UserTenant.find({});
    console.log(`\n📊 Found ${userTenants.length} user-tenant records`);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const userTenant of userTenants) {
      console.log(`\n🔍 Checking: ${userTenant.userId}`);
      
      // Check if userId looks like an email (contains @ or _)
      if (userTenant.userId.includes('@') || userTenant.userId.includes('_')) {
        console.log(`  ⚠️ Looks like email format: ${userTenant.userId}`);
        
        // Try to convert email format to actual email
        let email = userTenant.userId;
        if (email.includes('_') && !email.includes('@')) {
          // Convert david_david_com to david@david.com
          email = email.replace(/_/g, '.');
          // Find the last dot and convert it to @
          const lastDotIndex = email.lastIndexOf('.');
          if (lastDotIndex > 0) {
            email = email.substring(0, lastDotIndex) + '@' + email.substring(lastDotIndex + 1);
          }
        }
        
        console.log(`  🔍 Converted to email: ${email}`);
        
        try {
          // Get user from Firebase Auth by email
          const userRecord = await admin.auth().getUserByEmail(email);
          console.log(`  ✅ Found Firebase user: ${userRecord.uid}`);
          
          if (userRecord.uid !== userTenant.userId) {
            // Update the record with correct UID
            userTenant.userId = userRecord.uid;
            await userTenant.save();
            console.log(`  ✅ Updated userId to: ${userRecord.uid}`);
            fixed++;
          } else {
            console.log(`  ✓ Already has correct UID`);
            skipped++;
          }
        } catch (authError) {
          console.error(`  ❌ Could not find Firebase user for ${email}:`, authError.message);
        }
      } else {
        console.log(`  ✓ Already looks like UID`);
        skipped++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Fixed: ${fixed}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Total: ${userTenants.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Done');
    process.exit(0);
  }
}

fixUserIds();

