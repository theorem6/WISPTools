#!/usr/bin/env node
/**
 * Check for pending update commands for an EPC
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { EPCCommand } = require('../models/distributed-epc-schema');

async function checkUpdateCommands(epcId) {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/lte-pci-mapper';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB\n');
    
    // Find all commands for this EPC
    const allCommands = await EPCCommand.find({ epc_id: epcId })
      .sort({ created_at: -1 })
      .limit(10)
      .lean();
    
    console.log(`=== Commands for EPC ${epcId} ===\n`);
    console.log(`Total commands found: ${allCommands.length}\n`);
    
    // Find pending update commands
    const pendingUpdates = await EPCCommand.find({
      epc_id: epcId,
      status: 'pending',
      notes: /Auto-update/
    }).lean();
    
    console.log(`Pending update commands: ${pendingUpdates.length}`);
    pendingUpdates.forEach(cmd => {
      console.log(`  - ${cmd._id}: ${cmd.command_type} - ${cmd.notes}`);
      console.log(`    Status: ${cmd.status}, Priority: ${cmd.priority}`);
      console.log(`    Created: ${cmd.created_at}`);
      console.log('');
    });
    
    // Find all pending commands
    const allPending = await EPCCommand.find({
      epc_id: epcId,
      status: 'pending',
      expires_at: { $gt: new Date() }
    }).lean();
    
    console.log(`All pending commands: ${allPending.length}`);
    allPending.forEach(cmd => {
      console.log(`  - ${cmd._id}: ${cmd.command_type} - ${cmd.notes || 'no notes'}`);
    });
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

const epcId = process.argv[2] || 'EPC-CB4C5042';
checkUpdateCommands(epcId);

