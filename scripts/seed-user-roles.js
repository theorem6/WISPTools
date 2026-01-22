/**
 * Seed User Roles Script
 * Bulk assign roles to users based on email patterns
 * 
 * Usage:
 * node scripts/seed-user-roles.js
 * 
 * Or with MongoDB connection string:
 * MONGODB_URI="..." node scripts/seed-user-roles.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { admin, auth } = require('../config/firebase');
const { UserTenant } = require('../models/user');
const { determineRoleFromEmail, getRoleDisplayName, getRoleDescription } = require('../config/user-hierarchy');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

async function seedUserRoles() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all users from Firebase Auth
    console.log('📋 Fetching all users from Firebase Auth...');
    const listUsers = await auth.listUsers();
    const users = listUsers.users;
    console.log(`Found ${users.length} users in Firebase Auth`);

    // For each user, check if they need role assignment
    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const userRecord of users) {
      try {
        const email = userRecord.email;
        if (!email) {
          console.log(`⚠️  Skipping user ${userRecord.uid} - no email`);
          skipped++;
          continue;
        }

        // Determine role from email
        const suggestedRole = determineRoleFromEmail(email);
        if (!suggestedRole || suggestedRole === 'platform_admin') {
          console.log(`⏭️  Skipping ${email} - suggested role: ${suggestedRole || 'none'}`);
          skipped++;
          continue;
        }

        // Check existing UserTenant records
        const existing = await UserTenant.find({ userId: userRecord.uid }).lean();
        
        if (existing.length === 0) {
          console.log(`ℹ️  User ${email} has no tenant associations - cannot auto-assign without tenant`);
          skipped++;
          continue;
        }

        // For each tenant, check if role needs to be assigned
        for (const userTenant of existing) {
          // If role is already set and not 'viewer', skip
          if (userTenant.role && userTenant.role !== 'viewer' && userTenant.role !== 'pending') {
            continue;
          }

          // If suggested role matches current role, skip
          if (userTenant.role === suggestedRole) {
            continue;
          }

          // Update role
          await UserTenant.updateOne(
            { userId: userRecord.uid, tenantId: userTenant.tenantId },
            { 
              role: suggestedRole,
              updatedAt: new Date()
            }
          );

          console.log(`✅ Assigned role '${getRoleDisplayName(suggestedRole)}' to ${email} in tenant ${userTenant.tenantId}`);
          assigned++;
        }
      } catch (error) {
        console.error(`❌ Error processing user ${userRecord.email}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Assigned: ${assigned}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);

    await mongoose.connection.close();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedUserRoles();
}

module.exports = { seedUserRoles };

