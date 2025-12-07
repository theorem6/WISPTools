#!/usr/bin/env node

/**
 * Quick script to list all tenant IDs in the database
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '../../.env' });

const { Tenant } = require('../models/tenant');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wisptools';

async function listTenants() {
  try {
    await mongoose.connect(MONGODB_URI);
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

