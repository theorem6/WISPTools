#!/usr/bin/env node
/**
 * Create EPC Update Command
 * Manually creates an update command for a remote EPC device
 * Usage: node create-epc-update-command.js <EPC_ID> [TENANT_ID]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Load models and utilities
const { EPCCommand } = require('../models/distributed-epc-schema');
const { checkForUpdates, generateUpdateCommand } = require('../utils/epc-auto-update');

const EPC_ID = process.argv[2];
const TENANT_ID = process.argv[3] || process.env.DEFAULT_TENANT_ID || '690abdc14a6f067977986db3';

if (!EPC_ID) {
  console.error('Usage: node create-epc-update-command.js <EPC_ID> [TENANT_ID]');
  console.error('Example: node create-epc-update-command.js EPC-12345 690abdc14a6f067977986db3');
  process.exit(1);
}

async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wisptools';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Check for updates (empty versions to force update check)
    console.log(`Checking for updates for EPC: ${EPC_ID}...`);
    const updateInfo = await checkForUpdates(EPC_ID, {});

    if (!updateInfo.has_updates) {
      console.log('No updates available for', EPC_ID);
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('Updates available:', Object.keys(updateInfo.scripts).join(', '));

    // Generate update command
    const updateCommand = generateUpdateCommand(updateInfo);

    if (!updateCommand) {
      console.error('Failed to generate update command');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Check if update command already exists
    const existingUpdate = await EPCCommand.findOne({
      epc_id: EPC_ID,
      action: 'update_scripts',
      status: { $in: ['pending', 'sent'] }
    });

    if (existingUpdate) {
      console.log(`Update command already exists (ID: ${existingUpdate._id}, Status: ${existingUpdate.status})`);
      console.log('To force a new update, delete the existing command first or wait for it to complete.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create and save command
    const cmd = new EPCCommand({
      ...updateCommand,
      epc_id: EPC_ID,
      tenant_id: TENANT_ID,
      status: 'pending',
      created_at: new Date(),
      description: `Manual script update: ${Object.keys(updateInfo.scripts).join(', ')}`
    });

    await cmd.save();
    console.log(`\n✅ Update command queued successfully for ${EPC_ID}`);
    console.log(`   Command ID: ${cmd._id.toString()}`);
    console.log(`   Tenant ID: ${TENANT_ID}`);
    console.log(`   Scripts to update: ${Object.keys(updateInfo.scripts).join(', ')}`);
    console.log(`   The EPC will download and execute the update on its next check-in.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();

