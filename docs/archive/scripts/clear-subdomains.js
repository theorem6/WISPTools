#!/usr/bin/env node

/**
 * Script to clear all subdomains from tenants in the database
 * This is useful when subdomains need to be reset or there are conflicts
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Tenant } = require('../models/tenant');

async function clearSubdomains() {
  try {
    let mongoUri;
    try {
      const appConfig = require('../config/app');
      mongoUri = appConfig.mongodb.uri || process.env.MONGODB_URI;
    } catch (e) {
      mongoUri = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';
    }
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in config or environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all tenants with subdomains
    const tenantsWithSubdomain = await Tenant.find({ subdomain: { $exists: true, $ne: null } })
      .select('_id displayName subdomain')
      .lean();

    if (tenantsWithSubdomain.length === 0) {
      console.log('⚠️  No tenants with subdomains found');
    } else {
      console.log(`📋 Found ${tenantsWithSubdomain.length} tenant(s) with subdomains:\n`);
      tenantsWithSubdomain.forEach((tenant, idx) => {
        console.log(`  ${idx + 1}. ${tenant.displayName || 'Unnamed'}`);
        console.log(`     ID: ${tenant._id}`);
        console.log(`     Subdomain: ${tenant.subdomain}`);
        console.log();
      });

      console.log('\n🗑️  Clearing subdomains (setting to temporary unique values)...\n');
      
      // Set subdomains to temporary unique values based on tenant ID
      // This clears conflicts while keeping the required field satisfied
      let clearedCount = 0;
      for (const tenant of tenantsWithSubdomain) {
        const tempSubdomain = `temp-${tenant._id.toString().slice(0, 16)}`;
        try {
          await Tenant.updateOne(
            { _id: tenant._id },
            { $set: { subdomain: tempSubdomain } }
          );
          console.log(`   ✅ ${tenant.displayName || 'Unnamed'}: ${tenant.subdomain} -> ${tempSubdomain}`);
          clearedCount++;
        } catch (error) {
          console.error(`   ❌ Failed to update ${tenant.displayName || tenant._id}:`, error.message);
        }
      }

      console.log(`\n✅ Cleared ${clearedCount} subdomain(s) successfully`);
      console.log(`   All subdomains are now set to temporary values and can be updated by users`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearSubdomains();

