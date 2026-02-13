#!/usr/bin/env node

/**
 * Script to check if a tenant exists with a given subdomain
 * Usage: node check-tenant-by-subdomain.js <subdomain>
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Tenant } = require('../models/tenant');

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

async function checkTenantBySubdomain(subdomain) {
  await connectDB();

  try {
    console.log(`🔍 Looking for tenant with subdomain: ${subdomain}\n`);

    const tenant = await Tenant.findOne({ subdomain }).lean();

    if (!tenant) {
      console.log('✅ No tenant found with this subdomain - subdomain is available');
    } else {
      console.log(`❌ Tenant found with this subdomain:\n`);
      console.log(`   ID: ${tenant._id}`);
      console.log(`   Name: ${tenant.name || 'N/A'}`);
      console.log(`   Display Name: ${tenant.displayName || 'N/A'}`);
      console.log(`   Email: ${tenant.contactEmail || 'N/A'}`);
      console.log(`   Subdomain: ${tenant.subdomain}`);
      console.log(`   Created By: ${tenant.createdBy || 'N/A'}`);
      console.log();
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Get subdomain from command line
const subdomain = process.argv[2];

if (!subdomain) {
  console.error('❌ Usage: node check-tenant-by-subdomain.js <subdomain>');
  console.error('\nExample:');
  console.error('   node check-tenant-by-subdomain.js peterson-consulting');
  process.exit(1);
}

checkTenantBySubdomain(subdomain).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

