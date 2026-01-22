#!/usr/bin/env node
/**
 * Check EPC Command Status
 * Usage: node check-epc-command-status.js <DEVICE_CODE or EPC_ID>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const appConfig = require('../config/app');
const { RemoteEPC, EPCCommand } = require('../models/distributed-epc-schema');

const IDENTIFIER = process.argv[2];

if (!IDENTIFIER) {
  console.error('Usage: node check-epc-command-status.js <DEVICE_CODE or EPC_ID>');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(appConfig.mongodb.uri);
    console.log('✅ Connected to MongoDB\n');

    // Find EPC
    const epc = await RemoteEPC.findOne({
      $or: [
        { device_code: IDENTIFIER.toUpperCase() },
        { epc_id: IDENTIFIER }
      ]
    }).lean();

    if (!epc) {
      console.error(`❌ EPC not found: ${IDENTIFIER}`);
      process.exit(1);
    }

    console.log(`EPC: ${epc.epc_id} (${epc.device_code})`);
    console.log(`Last Seen: ${epc.last_seen || 'Never'}`);
    console.log(`Status: ${epc.status || 'unknown'}\n`);

    // Check all commands for this EPC
    const allCommands = await EPCCommand.find({
      epc_id: epc.epc_id
    })
    .sort({ created_at: -1 })
    .limit(10)
    .lean();

    console.log(`Found ${allCommands.length} recent command(s):\n`);

    for (const cmd of allCommands) {
      console.log(`Command: ${cmd._id}`);
      console.log(`  Type: ${cmd.command_type}/${cmd.action || 'N/A'}`);
      console.log(`  Status: ${cmd.status}`);
      console.log(`  Created: ${cmd.created_at}`);
      console.log(`  Sent: ${cmd.sent_at || 'Not sent'}`);
      console.log(`  Completed: ${cmd.completed_at || 'Not completed'}`);
      if (cmd.description) {
        console.log(`  Description: ${cmd.description}`);
      }
      console.log('');
    }

    // Check for pending commands
    const pendingCommands = await EPCCommand.find({
      epc_id: epc.epc_id,
      status: 'pending',
      expires_at: { $gt: new Date() }
    }).lean();

    console.log(`\n📋 Pending commands: ${pendingCommands.length}`);
    if (pendingCommands.length > 0) {
      console.log('These commands should be delivered on next check-in:\n');
      for (const cmd of pendingCommands) {
        console.log(`  - ${cmd._id}: ${cmd.command_type}/${cmd.action || 'N/A'} (expires: ${cmd.expires_at})`);
      }
    }

    // Check for sent but not completed commands
    const sentCommands = await EPCCommand.find({
      epc_id: epc.epc_id,
      status: 'sent',
      completed_at: null,
      sent_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).lean();

    console.log(`\n📤 Sent but not completed: ${sentCommands.length}`);
    if (sentCommands.length > 0) {
      console.log('These commands were sent but not completed:\n');
      for (const cmd of sentCommands) {
        console.log(`  - ${cmd._id}: ${cmd.command_type}/${cmd.action || 'N/A'} (sent: ${cmd.sent_at})`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();

