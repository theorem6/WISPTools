#!/usr/bin/env node
/**
 * Check EPC Update Status
 * Diagnose why update commands aren't being queued
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { RemoteEPC, EPCCommand, EPCServiceStatus } = require('../models/distributed-epc-schema');
const agentVersionManager = require('../utils/agent-version-manager');

async function checkEPCUpdateStatus(epcId) {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/lte-pci-mapper';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB\n');
    
    // Find EPC
    const epc = await RemoteEPC.findOne({ epc_id: epcId }).lean();
    if (!epc) {
      console.error(`EPC ${epcId} not found`);
      process.exit(1);
    }
    
    console.log(`=== EPC: ${epc.epc_id} ===\n`);
    console.log(`Device Code: ${epc.device_code}`);
    console.log(`Status: ${epc.status}`);
    console.log(`Last Seen: ${epc.last_seen || 'Never'}\n`);
    
    // Get latest service status (contains versions)
    const latestStatus = await EPCServiceStatus.findOne({ epc_id: epcId })
      .sort({ timestamp: -1 })
      .lean();
    
    if (!latestStatus || !latestStatus.versions) {
      console.log('⚠️  No service status found (device may not have checked in yet)\n');
      process.exit(1);
    }
    
    console.log('=== Latest Check-in Versions ===');
    console.log(JSON.stringify(latestStatus.versions, null, 2));
    console.log('');
    
    // Get agent scripts from latest check-in
    const agentScripts = latestStatus.versions?.scripts || {};
    console.log(`Agent reported ${Object.keys(agentScripts).length} script(s):`);
    for (const [script, info] of Object.entries(agentScripts)) {
      const hash = info?.hash || 'unknown';
      console.log(`  - ${script}: ${hash.substring(0, 16)}...`);
    }
    console.log('');
    
    // Get server manifest
    console.log('=== Server Manifest ===');
    const serverManifest = await agentVersionManager.getCurrentManifest();
    if (!serverManifest) {
      console.error('ERROR: Could not load server manifest');
      process.exit(1);
    }
    
    console.log(`Manifest version: ${serverManifest.version}`);
    console.log(`Updated at: ${serverManifest.updated_at}`);
    console.log(`Scripts in manifest: ${Object.keys(serverManifest.scripts || {}).length}\n`);
    
    // Compare versions
    console.log('=== Version Comparison ===');
    const updatesNeeded = agentVersionManager.compareVersions(agentScripts, serverManifest);
    
    if (updatesNeeded.length === 0) {
      console.log('✅ All scripts are up to date!\n');
    } else {
      console.log(`⚠️  ${updatesNeeded.length} update(s) needed:\n`);
      updatesNeeded.forEach(update => {
        console.log(`  - ${update.script}: ${update.action}`);
        console.log(`    Current: ${update.current_hash?.substring(0, 16) || 'none'}...`);
        console.log(`    Server:  ${update.server_hash?.substring(0, 16)}...`);
      });
      console.log('');
    }
    
    // Check for existing update commands
    console.log('=== Existing Update Commands ===');
    const existingCommands = await EPCCommand.find({
      epc_id: epcId,
      notes: /Auto-update/
    }).sort({ created_at: -1 }).limit(5).lean();
    
    if (existingCommands.length === 0) {
      console.log('No update commands found in database\n');
    } else {
      console.log(`Found ${existingCommands.length} update command(s):\n`);
      existingCommands.forEach(cmd => {
        console.log(`  - ${cmd._id}`);
        console.log(`    Type: ${cmd.command_type}`);
        console.log(`    Status: ${cmd.status}`);
        console.log(`    Created: ${cmd.created_at}`);
        console.log(`    Notes: ${cmd.notes}`);
        console.log('');
      });
    }
    
    // Check for any pending commands
    console.log('=== All Pending Commands ===');
    const pendingCommands = await EPCCommand.find({
      epc_id: epcId,
      status: 'pending',
      expires_at: { $gt: new Date() }
    }).sort({ created_at: -1 }).lean();
    
    if (pendingCommands.length === 0) {
      console.log('No pending commands found\n');
    } else {
      console.log(`Found ${pendingCommands.length} pending command(s):\n`);
      pendingCommands.forEach(cmd => {
        console.log(`  - ${cmd._id}: ${cmd.command_type} - ${cmd.notes || 'no notes'}`);
      });
    }
    
    // If updates are needed but no commands exist, offer to create them
    if (updatesNeeded.length > 0 && existingCommands.length === 0) {
      console.log('\n=== Recommendation ===');
      console.log('Updates are needed but no commands have been queued.');
      console.log('This suggests the update check during check-in may not be running properly.');
      console.log('Check the backend logs for update check messages.\n');
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

const epcId = process.argv[2] || 'EPC-CB4C5042';
checkEPCUpdateStatus(epcId);

