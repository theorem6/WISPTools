#!/usr/bin/env node
/**
 * Check EPC Status
 * Check the current status of an EPC, including script versions and queued commands
 * Usage: node check-epc-status.js <EPC_ID or DEVICE_CODE> [TENANT_ID]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { RemoteEPC, EPCCommand, EPCServiceStatus } = require('../models/distributed-epc-schema');

const IDENTIFIER = process.argv[2];
const TENANT_ID = process.argv[3] || process.env.DEFAULT_TENANT_ID || '690abdc14a6f067977986db3';

if (!IDENTIFIER) {
  console.error('Usage: node check-epc-status.js <EPC_ID or DEVICE_CODE> [TENANT_ID]');
  console.error('Example: node check-epc-status.js EPC-CB4C5042');
  console.error('Example: node check-epc-status.js YALNTFQC');
  process.exit(1);
}

async function main() {
  try {
    // Connect to MongoDB - use same config as server.js
    require('dotenv').config();
    const appConfig = require('../config/app');
    const mongoUri = appConfig.mongodb.uri;
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Find EPC by ID or device code
    const epc = await RemoteEPC.findOne({
      $or: [
        { epc_id: IDENTIFIER },
        { device_code: IDENTIFIER.toUpperCase() }
      ],
      tenant_id: TENANT_ID
    }).lean();

    if (!epc) {
      console.error(`EPC not found: ${IDENTIFIER}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('=== EPC Status ===');
    console.log(`EPC ID: ${epc.epc_id}`);
    console.log(`Device Code: ${epc.device_code}`);
    console.log(`Site Name: ${epc.site_name || 'N/A'}`);
    console.log(`Status: ${epc.status || 'unknown'}`);
    console.log(`Last Seen: ${epc.last_seen || 'Never'}`);
    console.log(`IP Address: ${epc.ip_address || 'Unknown'}`);
    console.log('');

    // Get latest service status
    const latestStatus = await EPCServiceStatus.findOne({
      epc_id: epc.epc_id,
      tenant_id: TENANT_ID
    }).sort({ timestamp: -1 }).lean();

    if (latestStatus) {
      console.log('=== Latest Check-in ===');
      console.log(`Timestamp: ${latestStatus.timestamp}`);
      if (latestStatus.versions) {
        console.log(`OS: ${latestStatus.versions.os || 'N/A'}`);
        console.log(`Open5GS: ${latestStatus.versions.open5gs || 'N/A'}`);
        if (latestStatus.versions.scripts) {
          console.log('\n=== Script Versions Reported ===');
          for (const [script, info] of Object.entries(latestStatus.versions.scripts)) {
            const hash = info?.hash || 'unknown';
            console.log(`  ${script}: ${hash.substring(0, 16)}...`);
          }
        } else {
          console.log('\n⚠️  No script versions reported in latest check-in');
        }
      }
      if (latestStatus.system) {
        console.log('\n=== System Metrics ===');
        console.log(`CPU: ${latestStatus.system.cpu_percent || 'N/A'}%`);
        console.log(`Memory: ${latestStatus.system.memory_percent || 'N/A'}%`);
        console.log(`Uptime: ${latestStatus.system.uptime_seconds || 0}s`);
      }
      console.log('');
    } else {
      console.log('⚠️  No service status found (device may not have checked in yet)\n');
    }

    // Get pending/sent commands
    const commands = await EPCCommand.find({
      epc_id: epc.epc_id,
      tenant_id: TENANT_ID,
      status: { $in: ['pending', 'sent'] }
    }).sort({ created_at: -1 }).lean();

    console.log(`=== Queued Commands (${commands.length}) ===`);
    if (commands.length === 0) {
      console.log('No pending commands');
    } else {
      for (const cmd of commands) {
        console.log(`  [${cmd.status}] ${cmd.command_type}/${cmd.action || 'N/A'} - Created: ${cmd.created_at}`);
        if (cmd.description) {
          console.log(`    Description: ${cmd.description}`);
        }
      }
    }
    console.log('');

    // Check for available updates
    console.log('=== Update Check ===');
    const { checkForUpdates } = require('../utils/epc-auto-update');
    const scriptVersions = latestStatus?.versions?.scripts || {};
    const updateInfo = await checkForUpdates(epc.epc_id, scriptVersions);
    
    if (updateInfo.has_updates) {
      console.log('✅ Updates available:');
      for (const [script, info] of Object.entries(updateInfo.scripts)) {
        console.log(`  - ${script} (hash: ${info.hash.substring(0, 16)}...)`);
      }
      console.log('\n💡 To manually queue an update:');
      console.log(`   node backend-services/scripts/create-epc-update-command.js ${epc.epc_id} ${TENANT_ID}`);
    } else {
      console.log('✅ All scripts are up to date');
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

