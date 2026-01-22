#!/usr/bin/env node
/**
 * Diagnose the infinite update loop issue
 * Checks what the agent is reporting and what the backend is doing
 */

const mongoose = require('mongoose');
const { RemoteEPC, EPCCommand, EPCServiceStatus } = require('../models/distributed-epc-schema');
const { checkForUpdates } = require('../utils/epc-auto-update');

const EPC_ID = process.argv[2] || 'EPC-CB4C5042';

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lte-pci-mapper');
    console.log('Connected to MongoDB\n');

    // Get EPC
    const epc = await RemoteEPC.findOne({ epc_id: EPC_ID });
    if (!epc) {
      console.error(`EPC ${EPC_ID} not found`);
      process.exit(1);
    }

    console.log(`=== EPC: ${epc.epc_id} (${epc.site_name}) ===`);
    console.log(`Device Code: ${epc.device_code}`);
    console.log(`Last Seen: ${epc.last_seen}`);
    console.log(`Status: ${epc.status}\n`);

    // Get latest service status (contains versions)
    const latestStatus = await EPCServiceStatus.findOne({ epc_id: EPC_ID })
      .sort({ timestamp: -1 });

    if (latestStatus && latestStatus.versions) {
      console.log('=== Latest Versions Reported ===');
      console.log(JSON.stringify(latestStatus.versions, null, 2));
      
      if (latestStatus.versions.scripts) {
        console.log('\n=== Script Hashes Reported ===');
        console.log(JSON.stringify(latestStatus.versions.scripts, null, 2));
        console.log(`Has epc-ping-monitor.js: ${!!latestStatus.versions.scripts['epc-ping-monitor.js']}`);
        if (latestStatus.versions.scripts['epc-ping-monitor.js']) {
          console.log(`epc-ping-monitor.js hash: ${latestStatus.versions.scripts['epc-ping-monitor.js'].hash}`);
        }
      } else {
        console.log('\n⚠️  No scripts hash reported in latest status');
      }
    } else {
      console.log('⚠️  No service status found');
    }

    // Check what updates would be needed
    console.log('\n=== Update Check ===');
    const scriptVersions = latestStatus?.versions?.scripts || {};
    const updateInfo = await checkForUpdates(EPC_ID, scriptVersions);
    
    console.log(`Has Updates: ${updateInfo.has_updates}`);
    if (updateInfo.has_updates) {
      console.log(`Version: ${updateInfo.version}`);
      console.log(`Scripts to update: ${Object.keys(updateInfo.scripts).join(', ')}`);
      Object.entries(updateInfo.scripts).forEach(([name, info]) => {
        console.log(`  ${name}: ${info.hash.substring(0, 16)}...`);
      });
    } else {
      console.log('✅ All scripts are up to date');
    }

    // Check recent commands
    console.log('\n=== Recent Update Commands ===');
    const recentCommands = await EPCCommand.find({
      epc_id: EPC_ID,
      action: 'update_scripts'
    })
      .sort({ created_at: -1 })
      .limit(5);

    if (recentCommands.length === 0) {
      console.log('No update commands found');
    } else {
      recentCommands.forEach((cmd, i) => {
        console.log(`\nCommand ${i + 1}:`);
        console.log(`  ID: ${cmd._id}`);
        console.log(`  Status: ${cmd.status}`);
        console.log(`  Version: ${cmd.version || 'none'}`);
        console.log(`  Created: ${cmd.created_at}`);
        console.log(`  Completed: ${cmd.completed_at || 'not completed'}`);
      });
    }

    // Check for active commands
    const activeCommands = await EPCCommand.find({
      epc_id: EPC_ID,
      action: 'update_scripts',
      status: { $in: ['pending', 'sent'] }
    });

    console.log(`\n=== Active Update Commands: ${activeCommands.length} ===`);
    activeCommands.forEach((cmd, i) => {
      console.log(`  ${i + 1}. ID: ${cmd._id}, Status: ${cmd.status}, Version: ${cmd.version || 'none'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

diagnose();
