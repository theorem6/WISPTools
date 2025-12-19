#!/usr/bin/env node

/**
 * Script to remove or update records containing david@4gengineer.com or david@4GEngineer.com
 * This script searches across multiple collections and updates or removes records
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import all models that might contain email addresses
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../models/network');
const { Tenant } = require('../models/tenant');
const { UserTenant } = require('../models/user');
const { PlanProject } = require('../models/plan');
const { Customer } = require('../models/customer');
const { WorkOrder } = require('../models/work-order');
const { InventoryItem } = require('../models/inventory');

// Email patterns to search for (case insensitive)
const TARGET_EMAILS = [
  'david@4gengineer.com',
  'david@4GEngineer.com',
  /david@4[gG]engineer\.com/i
];

const REPLACEMENT_EMAIL = 'system@wisptools.io';

async function connectDB() {
  try {
    let mongoUri;
    try {
      const appConfig = require('../config/app');
      mongoUri = appConfig.mongodb.uri || process.env.MONGODB_URI;
    } catch (e) {
      mongoUri = process.env.MONGODB_URI;
    }
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in config or environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

function matchesTargetEmail(value) {
  if (!value || typeof value !== 'string') return false;
  const lowerValue = value.toLowerCase();
  return lowerValue === 'david@4gengineer.com';
}

async function findAndUpdateRecords(collectionName, model, fieldsToCheck) {
  console.log(`\n📋 Checking ${collectionName}...`);
  let found = 0;
  let updated = 0;

  try {
    const records = await model.find({}).lean();
    
    for (const record of records) {
      let needsUpdate = false;
      const updateData = {};
      
      for (const field of fieldsToCheck) {
        const value = record[field];
        if (matchesTargetEmail(value)) {
          found++;
          needsUpdate = true;
          updateData[field] = REPLACEMENT_EMAIL;
        }
      }
      
      // Also check nested fields like contact.email, user.email, etc.
      if (record.contact && matchesTargetEmail(record.contact.email)) {
        found++;
        needsUpdate = true;
        if (!updateData.contact) updateData.contact = { ...record.contact };
        updateData.contact.email = REPLACEMENT_EMAIL;
      }
      
      if (record.user && matchesTargetEmail(record.user.email)) {
        found++;
        needsUpdate = true;
        if (!updateData.user) updateData.user = { ...record.user };
        updateData.user.email = REPLACEMENT_EMAIL;
      }
      
      if (needsUpdate) {
        await model.updateOne({ _id: record._id }, { $set: updateData });
        updated++;
        console.log(`  ✓ Updated ${collectionName} record ${record._id}`);
      }
    }
    
    if (found === 0) {
      console.log(`  ✓ No records found with target email in ${collectionName}`);
    } else {
      console.log(`  ✓ Found ${found} field(s), updated ${updated} record(s) in ${collectionName}`);
    }
  } catch (error) {
    console.error(`  ❌ Error processing ${collectionName}:`, error.message);
  }
}

async function cleanupEmails() {
  try {
    await connectDB();
    
    console.log('🔍 Searching for records containing david@4gengineer.com or david@4GEngineer.com...\n');
    console.log(`📝 Will replace with: ${REPLACEMENT_EMAIL}\n`);
    
    // Check UnifiedSite
    await findAndUpdateRecords('UnifiedSite', UnifiedSite, [
      'createdBy', 'updatedBy', 'contact', 'towerContact', 'buildingContact', 'siteContact'
    ]);
    
    // Check UnifiedSector
    await findAndUpdateRecords('UnifiedSector', UnifiedSector, [
      'createdBy', 'updatedBy'
    ]);
    
    // Check UnifiedCPE
    await findAndUpdateRecords('UnifiedCPE', UnifiedCPE, [
      'createdBy', 'updatedBy'
    ]);
    
    // Check NetworkEquipment
    await findAndUpdateRecords('NetworkEquipment', NetworkEquipment, [
      'createdBy', 'updatedBy'
    ]);
    
    // Check Tenant
    await findAndUpdateRecords('Tenant', Tenant, [
      'email', 'createdBy', 'updatedBy'
    ]);
    
    // Check UserTenant (email field in user object)
    console.log(`\n📋 Checking UserTenant...`);
    try {
      const userTenants = await UserTenant.find({}).lean();
      let found = 0;
      let updated = 0;
      
      for (const ut of userTenants) {
        let needsUpdate = false;
        const updateData = {};
        
        if (ut.userEmail && matchesTargetEmail(ut.userEmail)) {
          found++;
          needsUpdate = true;
          updateData.userEmail = REPLACEMENT_EMAIL;
        }
        
        if (needsUpdate) {
          await UserTenant.updateOne({ _id: ut._id }, { $set: updateData });
          updated++;
          console.log(`  ✓ Updated UserTenant record ${ut._id}`);
        }
      }
      
      if (found === 0) {
        console.log(`  ✓ No records found with target email in UserTenant`);
      } else {
        console.log(`  ✓ Found ${found} field(s), updated ${updated} record(s) in UserTenant`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing UserTenant:`, error.message);
    }
    
    // Check PlanProject
    await findAndUpdateRecords('PlanProject', PlanProject, [
      'createdBy', 'updatedBy', 'deployment.assignedTo'
    ]);
    
    // Check Customer
    await findAndUpdateRecords('Customer', Customer, [
      'email', 'createdBy', 'updatedBy'
    ]);
    
    // Check WorkOrder
    await findAndUpdateRecords('WorkOrder', WorkOrder, [
      'createdBy', 'updatedBy', 'assignedTo'
    ]);
    
    // Check InventoryItem
    await findAndUpdateRecords('InventoryItem', InventoryItem, [
      'createdBy', 'updatedBy'
    ]);
    
    console.log('\n✅ Cleanup complete!');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the cleanup
cleanupEmails();

