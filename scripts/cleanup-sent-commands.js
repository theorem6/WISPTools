#!/usr/bin/env node
/**
 * Cleanup Sent Commands
 * Deletes old "sent" commands that were never executed
 * Usage: node cleanup-sent-commands.js [EPC_ID]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Load models
const { EPCCommand } = require('../models/distributed-epc-schema');

const EPC_ID = process.argv[2];

async function main() {
  try {
    // Connect to MongoDB
    require('dotenv').config();
    const appConfig = require('../config/app');
    const mongoUri = appConfig.mongodb.uri;
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Build query
    const query = {
      action: 'update_scripts',
      status: 'sent',
      expires_at: { $lt: new Date() } // Only delete expired ones
    };
    
    if (EPC_ID) {
      query.epc_id = EPC_ID;
    }

    // Find and delete expired "sent" commands
    const result = await EPCCommand.deleteMany(query);
    
    console.log(`\n✅ Deleted ${result.deletedCount} expired "sent" update command(s)`);
    
    if (EPC_ID) {
      console.log(`   For EPC: ${EPC_ID}`);
    } else {
      console.log(`   For all EPCs`);
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

