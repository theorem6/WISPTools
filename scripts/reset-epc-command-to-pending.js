#!/usr/bin/env node
/**
 * Reset an EPC command back to pending status
 * Usage: node reset-epc-command-to-pending.js <COMMAND_ID>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const appConfig = require('../config/app');
const { EPCCommand } = require('../models/distributed-epc-schema');

const COMMAND_ID = process.argv[2];

if (!COMMAND_ID) {
  console.error('Usage: node reset-epc-command-to-pending.js <COMMAND_ID>');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(appConfig.mongodb.uri);
    console.log('✅ Connected to MongoDB\n');

    const command = await EPCCommand.findById(COMMAND_ID);

    if (!command) {
      console.error(`❌ Command not found: ${COMMAND_ID}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`Command found:`);
    console.log(`  EPC ID: ${command.epc_id}`);
    console.log(`  Type: ${command.command_type}/${command.action || 'N/A'}`);
    console.log(`  Current Status: ${command.status}`);
    console.log(`  Sent: ${command.sent_at || 'Never'}`);
    console.log(`  Completed: ${command.completed_at || 'Never'}`);
    console.log('');

    // Reset to pending
    command.status = 'pending';
    command.sent_at = null;
    command.completed_at = null;
    command.result = null;

    await command.save();

    console.log(`✅ Command reset to pending status`);
    console.log(`   It will be delivered on the next EPC check-in`);

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

