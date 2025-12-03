#!/usr/bin/env node
/**
 * Create a NEW EPC Update Command (deletes old one first)
 * Usage: node create-new-epc-update-command.js <DEVICE_CODE> [TENANT_ID]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const appConfig = require('../config/app');
const { RemoteEPC, EPCCommand } = require('../models/distributed-epc-schema');
const { checkForUpdates, generateUpdateCommand } = require('../utils/epc-auto-update');

const DEVICE_CODE = process.argv[2];
const TENANT_ID = process.argv[3] || process.env.DEFAULT_TENANT_ID || '690abdc14a6f067977986db3';

if (!DEVICE_CODE) {
  console.error('Usage: node create-new-epc-update-command.js <DEVICE_CODE> [TENANT_ID]');
  console.error('Example: node create-new-epc-update-command.js YALNTFQC 690abdc14a6f067977986db3');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(appConfig.mongodb.uri);
    console.log('✅ Connected to MongoDB\n');

    // Find EPC by device code
    console.log(`Finding EPC for device code: ${DEVICE_CODE}...`);
    const epc = await RemoteEPC.findOne({ device_code: DEVICE_CODE.toUpperCase(), tenant_id: TENANT_ID }).lean();

    if (!epc) {
      console.error(`❌ EPC not found for device code: ${DEVICE_CODE} and tenant ID: ${TENANT_ID}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('Found EPC:');
    console.log(`  EPC ID: ${epc.epc_id}`);
    console.log(`  Device Code: ${epc.device_code}`);
    console.log(`  Site Name: ${epc.site_name || 'N/A'}`);
    console.log(`  Tenant ID: ${epc.tenant_id}`);
    console.log('');

    // Delete any existing update commands (pending or sent)
    console.log('Cleaning up old update commands...');
    const deleted = await EPCCommand.deleteMany({
      epc_id: epc.epc_id,
      action: 'update_scripts',
      status: { $in: ['pending', 'sent'] }
    });
    console.log(`  Deleted ${deleted.deletedCount} old command(s)\n`);

    // Check for updates (empty versions to force update check)
    console.log(`Checking for script updates...`);
    const updateInfo = await checkForUpdates(epc.epc_id, {}); // Pass empty versions to force check

    if (!updateInfo.has_updates) {
      console.log('No updates available for', epc.epc_id);
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`✅ Updates available: ${Object.keys(updateInfo.scripts).join(', ')}\n`);

    // Generate update command
    const updateCommand = generateUpdateCommand(updateInfo);

    if (!updateCommand) {
      console.error('Failed to generate update command');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Create and save command
    const cmd = new EPCCommand({
      ...updateCommand,
      epc_id: epc.epc_id,
      tenant_id: TENANT_ID,
      status: 'pending',
      created_at: new Date(),
      description: `Manual script update: ${Object.keys(updateInfo.scripts).join(', ')}`
    });

    await cmd.save();
    console.log(`✅ New update command created successfully!`);
    console.log(`   EPC ID: ${epc.epc_id}`);
    console.log(`   Device Code: ${epc.device_code}`);
    console.log(`   Command ID: ${cmd._id.toString()}`);
    console.log(`   Scripts to update: ${Object.keys(updateInfo.scripts).join(', ')}`);
    console.log(`\nThe EPC will download and execute the update on its next check-in (within ${epc.metrics_config?.update_interval_seconds || 60} seconds).`);

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

