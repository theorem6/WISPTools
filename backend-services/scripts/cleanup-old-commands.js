#!/usr/bin/env node
/**
 * Cleanup Old EPC Commands
 * Deletes old/stuck commands for an EPC
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const { EPCCommand } = require('../models/distributed-epc-schema');
const appConfig = require('../config/app');

const EPC_ID = process.argv[2] || 'EPC-CB4C5042';
const COMMAND_ID = process.argv[3]; // Optional: delete specific command ID

async function main() {
  try {
    await mongoose.connect(appConfig.mongodb.uri);
    console.log('Connected to MongoDB');

    // If specific command ID provided (and it looks like an ObjectId), delete just that one
    if (COMMAND_ID && /^[a-f\d]{24}$/i.test(COMMAND_ID)) {
      const result = await EPCCommand.deleteOne({ _id: COMMAND_ID });
      console.log(`\n✅ Deleted ${result.deletedCount} command(s) with ID ${COMMAND_ID}`);
      if (result.deletedCount === 0) {
        console.log('⚠️  Command not found (may have already been deleted)');
      }
      await mongoose.disconnect();
      process.exit(0);
    }

    // Delete all commands for this EPC (pending, sent, or failed - but keep completed for history)
    const result = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      status: { $in: ['pending', 'sent', 'failed'] }
    });

    console.log(`\n✅ Deleted ${result.deletedCount} old command(s) for ${EPC_ID}`);
    
    // Also delete expired pending commands
    const expiredResult = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      status: 'pending',
      expires_at: { $lt: new Date() }
    });

    if (expiredResult.deletedCount > 0) {
      console.log(`✅ Deleted ${expiredResult.deletedCount} expired command(s)`);
    }

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

