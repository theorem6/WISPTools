#!/usr/bin/env node

/**
 * Quick script to list all tenant IDs in the database
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Tenant } = require('../models/tenant');

async function listTenants() {
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

    const tenants = await Tenant.find({}).select('_id displayName email').lean();

    if (tenants.length === 0) {
      console.log('⚠️  No tenants found in database');
    } else {
      console.log(`📋 Found ${tenants.length} tenant(s):\n`);
      tenants.forEach((tenant, idx) => {
        console.log(`  ${idx + 1}. ${tenant.displayName || 'Unnamed'}`);
        console.log(`     ID: ${tenant._id}`);
        if (tenant.email) {
          console.log(`     Email: ${tenant.email}`);
        }
        console.log();
      });
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listTenants();

