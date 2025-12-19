#!/usr/bin/env node

/**
 * Script to list all tenants with their subdomains
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
      mongoUri = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';
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

async function listAllTenants() {
  await connectDB();

  try {
    const tenants = await Tenant.find({}).select('_id name displayName subdomain contactEmail createdBy').lean();

    if (tenants.length === 0) {
      console.log('✅ No tenants found in database');
    } else {
      console.log(`📋 Found ${tenants.length} tenant(s):\n`);
      tenants.forEach((tenant, idx) => {
        console.log(`  ${idx + 1}. ${tenant.displayName || tenant.name || 'Unnamed'}`);
        console.log(`     ID: ${tenant._id}`);
        console.log(`     Subdomain: ${tenant.subdomain || 'N/A'}`);
        console.log(`     Email: ${tenant.contactEmail || 'N/A'}`);
        console.log(`     Created By: ${tenant.createdBy || 'N/A'}`);
        console.log();
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

listAllTenants().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

