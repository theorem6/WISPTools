#!/usr/bin/env node
/**
 * Create EPC Update Command using device code
 * Usage: node create-update-for-device-code.js <DEVICE_CODE> [TENANT_ID]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Load models and utilities
const { RemoteEPC, EPCCommand } = require('../models/distributed-epc-schema');
const { checkForUpdates, generateUpdateCommand } = require('../utils/epc-auto-update');

const DEVICE_CODE = process.argv[2];
const TENANT_ID = process.argv[3] || process.env.DEFAULT_TENANT_ID || '690abdc14a6f067977986db3';

if (!DEVICE_CODE) {
  console.error('Usage: node create-update-for-device-code.js <DEVICE_CODE> [TENANT_ID]');
  console.error('Example: node create-update-for-device-code.js YALNTFQC 690abdc14a6f067977986db3');
  process.exit(1);
}

async function main() {
  try {
    // Connect to MongoDB
    require('dotenv').config();
    const appConfig = require('../config/app');
    const mongoUri = appConfig.mongodb.uri;
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find EPC by device code
    const epc = await RemoteEPC.findOne({ 
      device_code: DEVICE_CODE.toUpperCase() 
    }).lean();

    if (!epc) {
      console.error(`❌ EPC not found for device code: ${DEVICE_CODE}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`Found EPC:`);
    console.log(`  EPC ID: ${epc.epc_id}`);
    console.log(`  Device Code: ${epc.device_code}`);
    console.log(`  Site Name: ${epc.site_name || 'N/A'}`);
    console.log(`  Tenant ID: ${epc.tenant_id}`);
    console.log('');

    // Check for updates (empty versions to force update check)
    console.log(`Checking for script updates...`);
    const updateInfo = await checkForUpdates(epc.epc_id, {});

    if (!updateInfo.has_updates) {
      console.log('ℹ️  No updates available - scripts are already up to date');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('📦 Updates available:', Object.keys(updateInfo.scripts).join(', '));
    console.log('');

    // Generate update command
    const updateCommand = generateUpdateCommand(updateInfo);

    if (!updateCommand) {
      console.error('❌ Failed to generate update command');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Check if update command already exists
    const existingUpdate = await EPCCommand.findOne({
      epc_id: epc.epc_id,
      action: 'update_scripts',
      status: { $in: ['pending', 'sent'] }
    });

    if (existingUpdate) {
      console.log(`⚠️  Update command already exists:`);
      console.log(`   Command ID: ${existingUpdate._id}`);
      console.log(`   Status: ${existingUpdate.status}`);
      console.log(`   Created: ${existingUpdate.created_at}`);
      console.log('');
      console.log('To force a new update, delete the existing command first:');
      console.log(`   node delete-epc-command.js ${existingUpdate._id}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create and save command
    const cmd = new EPCCommand({
      ...updateCommand,
      epc_id: epc.epc_id,
      tenant_id: epc.tenant_id || TENANT_ID,
      status: 'pending',
      created_at: new Date(),
      description: `Manual script update: ${Object.keys(updateInfo.scripts).join(', ')}`
    });

    await cmd.save();
    
    console.log(`✅ Update command queued successfully!`);
    console.log('');
    console.log(`   EPC ID: ${epc.epc_id}`);
    console.log(`   Device Code: ${epc.device_code}`);
    console.log(`   Command ID: ${cmd._id.toString()}`);
    console.log(`   Scripts to update: ${Object.keys(updateInfo.scripts).join(', ')}`);
    console.log('');
    console.log(`The EPC will download and execute the update on its next check-in (within 60 seconds).`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();

