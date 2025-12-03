#!/usr/bin/env node
/**
 * Debug check-in command delivery
 * Usage: node debug-checkin-commands.js <DEVICE_CODE>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const appConfig = require('../config/app');
const { RemoteEPC, EPCCommand } = require('../models/distributed-epc-schema');
const checkinService = require('../services/epc-checkin-service');

const DEVICE_CODE = process.argv[2];

if (!DEVICE_CODE) {
  console.error('Usage: node debug-checkin-commands.js <DEVICE_CODE>');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(appConfig.mongodb.uri);
    console.log('✅ Connected to MongoDB\n');

    // Find EPC by device code (same as check-in does)
    console.log(`Finding EPC by device_code: ${DEVICE_CODE}...`);
    const epc = await checkinService.findEPCByDeviceCode(DEVICE_CODE);

    if (!epc) {
      console.error(`❌ EPC not found for device_code: ${DEVICE_CODE}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ EPC found:`);
    console.log(`  epc_id: ${epc.epc_id}`);
    console.log(`  device_code: ${epc.device_code}`);
    console.log(`  tenant_id: ${epc.tenant_id}`);
    console.log('');

    // Check what getPendingCommands would return
    console.log(`Querying pending commands for epc_id: ${epc.epc_id}...`);
    const commands = await checkinService.getPendingCommands(epc.epc_id);

    console.log(`Found ${commands.length} pending command(s):\n`);

    for (const cmd of commands) {
      console.log(`Command: ${cmd._id}`);
      console.log(`  Type: ${cmd.command_type}/${cmd.action || 'N/A'}`);
      console.log(`  Status: ${cmd.status}`);
      console.log(`  Created: ${cmd.created_at}`);
      console.log(`  Expires: ${cmd.expires_at}`);
      console.log(`  Expired? ${cmd.expires_at < new Date()}`);
      console.log(`  Priority: ${cmd.priority}`);
      console.log('');
    }

    // Also check raw query
    console.log('\n=== Raw Query Test ===');
    const now = new Date();
    console.log(`Current time: ${now}`);
    
    const rawCommands = await EPCCommand.find({
      epc_id: epc.epc_id,
      status: 'pending',
      expires_at: { $gt: now }
    })
    .sort({ priority: 1, created_at: 1 })
    .lean();

    console.log(`Raw query found ${rawCommands.length} command(s)`);

    if (rawCommands.length !== commands.length) {
      console.error(`⚠️  MISMATCH: getPendingCommands returned ${commands.length} but raw query returned ${rawCommands.length}`);
    }

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

