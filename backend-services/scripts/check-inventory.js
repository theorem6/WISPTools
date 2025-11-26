#!/usr/bin/env node
// Check inventory database contents

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { InventoryItem } = require('../models/inventory');

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    // Check all inventory items
    const total = await InventoryItem.countDocuments();
    console.log('\n=== Inventory Statistics ===');
    console.log('Total inventory items:', total);
    
    // Count by tenant
    const byTenant = await InventoryItem.aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 } } }
    ]);
    console.log('\nItems by tenant:', JSON.stringify(byTenant, null, 2));
    
    // Count by status
    const byStatus = await InventoryItem.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('\nItems by status:', JSON.stringify(byStatus, null, 2));
    
    // Sample a few items
    if (total > 0) {
      const sample = await InventoryItem.find().limit(3).lean();
      console.log('\nSample items:');
      sample.forEach((item, i) => {
        console.log(`\n  ${i+1}. ${item.category || 'Unknown'} - ${item.model || item.serialNumber}`);
        console.log(`     Status: ${item.status}, Location: ${item.currentLocation?.type}`);
        console.log(`     TenantId: ${item.tenantId}`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();

