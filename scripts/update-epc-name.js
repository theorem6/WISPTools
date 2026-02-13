#!/usr/bin/env node
/**
 * Update EPC site name
 */

const mongoose = require('mongoose');
const { RemoteEPC } = require('../models/distributed-epc-schema');

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || '';

async function updateEPCName() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!\n');

    const deviceCode = process.argv[2];
    const newSiteName = process.argv[3];

    if (!deviceCode || !newSiteName) {
      console.error('Usage: node update-epc-name.js <device_code> <new_site_name>');
      console.error('Example: node update-epc-name.js YALNTFQC "My EPC Site"');
      process.exit(1);
    }

    console.log(`=== Updating EPC name ===`);
    console.log(`Device Code: ${deviceCode}`);
    console.log(`New Site Name: ${newSiteName}\n`);

    const epc = await RemoteEPC.findOne({ device_code: deviceCode.toUpperCase() });
    
    if (!epc) {
      console.error(`❌ EPC not found with device code: ${deviceCode}`);
      process.exit(1);
    }

    console.log(`Current site name: ${epc.site_name}`);
    console.log(`EPC ID: ${epc.epc_id}`);
    
    epc.site_name = newSiteName;
    await epc.save();

    console.log(`✅ Updated site name to: ${newSiteName}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateEPCName();

