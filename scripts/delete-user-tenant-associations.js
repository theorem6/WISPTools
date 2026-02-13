#!/usr/bin/env node

/**
 * Script to delete UserTenant associations for a user by Firebase UID or email
 * Usage: node delete-user-tenant-associations.js <uid|email>
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { UserTenant } = require('../routes/users/user-schema');

async function connectDB() {
  try {
    let mongoUri;
    try {
      const appConfig = require('../config/app');
      mongoUri = appConfig.mongodb.uri || process.env.MONGODB_URI;
    } catch (e) {
      mongoUri = process.env.MONGODB_URI || '';
    }
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in config or environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

async function deleteUserTenantAssociations(identifier) {
  await connectDB();

  try {
    console.log(`🔍 Looking for UserTenant associations: ${identifier}\n`);

    // Find all associations
    const associations = await UserTenant.find({
      $or: [
        { userId: identifier },
        { userEmail: identifier }
      ]
    }).lean();

    if (associations.length === 0) {
      console.log('✅ No UserTenant associations found for this user');
      await mongoose.disconnect();
      return;
    }

    console.log(`📋 Found ${associations.length} UserTenant association(s):\n`);
    associations.forEach((assoc, idx) => {
      console.log(`  ${idx + 1}. Tenant ID: ${assoc.tenantId}`);
      console.log(`     User ID: ${assoc.userId}`);
      console.log(`     User Email: ${assoc.userEmail || 'N/A'}`);
      console.log(`     Role: ${assoc.role || 'N/A'}`);
      console.log(`     Status: ${assoc.status || 'N/A'}`);
      console.log();
    });

    console.log('🗑️  Deleting all UserTenant associations...\n');

    // Delete all associations
    const result = await UserTenant.deleteMany({
      $or: [
        { userId: identifier },
        { userEmail: identifier }
      ]
    });

    console.log(`✅ Deleted ${result.deletedCount} UserTenant association(s)`);

    // Verify deletion
    const remaining = await UserTenant.find({
      $or: [
        { userId: identifier },
        { userEmail: identifier }
      ]
    }).lean();

    if (remaining.length === 0) {
      console.log('✅ Verified: All associations deleted successfully');
    } else {
      console.log(`⚠️  Warning: ${remaining.length} association(s) still remain`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Get identifier from command line
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Usage: node delete-user-tenant-associations.js <uid|email>');
  console.error('\nExample:');
  console.error('   node delete-user-tenant-associations.js BYnROkw3Yre4Go928sSuoE0qES52');
  console.error('   node delete-user-tenant-associations.js david@4gengineer.com');
  process.exit(1);
}

deleteUserTenantAssociations(identifier).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

