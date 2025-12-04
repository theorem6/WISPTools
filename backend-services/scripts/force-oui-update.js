#!/usr/bin/env node
/**
 * Force Update Command for OUI Lookup Fix
 * Creates an update command to push the updated discovery script to EPC agents
 */

require('dotenv').config();
const mongoose = require('mongoose');
const appConfig = require('../config/app');
const { RemoteEPC, EPCCommand } = require('../models/distributed-epc-schema');
const { checkForUpdates, generateUpdateCommand } = require('../utils/epc-auto-update');

const DEVICE_CODE = process.argv[2] || 'YALNTFQC';
const TENANT_ID = process.argv[3] || process.env.DEFAULT_TENANT_ID || '690abdc14a6f067977986db3';

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(appConfig.mongodb.uri);
    console.log('✅ Connected to MongoDB\n');

    // Find EPC by device code
    console.log(`Finding EPC for device code: ${DEVICE_CODE}...`);
    const epc = await RemoteEPC.findOne({ 
      device_code: DEVICE_CODE.toUpperCase(), 
      tenant_id: TENANT_ID 
    }).lean();

    if (!epc) {
      console.error(`❌ EPC not found for device code: ${DEVICE_CODE} and tenant ID: ${TENANT_ID}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('Found EPC:');
    console.log(`  EPC ID: ${epc.epc_id}`);
    console.log(`  Device Code: ${epc.device_code}`);
    console.log(`  Site Name: ${epc.site_name || 'N/A'}`);
    console.log(`  Tenant ID: ${epc.tenant_id}\n`);

    // Delete any existing update commands
    console.log('Cleaning up old update commands...');
    const deleted = await EPCCommand.deleteMany({
      epc_id: epc.epc_id,
      action: 'update_scripts',
      status: { $in: ['pending', 'sent'] }
    });
    console.log(`  Deleted ${deleted.deletedCount} old command(s)\n`);

    // Check for updates (force check - pass empty versions)
    console.log('Checking for script updates...');
    const updateInfo = await checkForUpdates(epc.epc_id, {});

    if (!updateInfo.has_updates) {
      console.log('⚠️  No updates detected. This might mean:');
      console.log('   1. Scripts are already up to date');
      console.log('   2. Script hashes match');
      console.log('\nForcing update anyway for epc-snmp-discovery.js...');
      
      // Force include epc-snmp-discovery.js even if hash matches
      const fs = require('fs').promises;
      const crypto = require('crypto');
      const path = require('path');
      
      const scriptPath = '/var/www/html/downloads/scripts/epc-snmp-discovery.js';
      try {
        const content = await fs.readFile(scriptPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const stats = await fs.stat(scriptPath);
        
        updateInfo.has_updates = true;
        updateInfo.scripts = {
          'epc-snmp-discovery.js': {
            url: `https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.js`,
            hash: hash,
            size: stats.size,
            updated: true
          }
        };
        console.log('✅ Forced update for epc-snmp-discovery.js');
      } catch (error) {
        console.error('❌ Error reading script file:', error.message);
        await mongoose.disconnect();
        process.exit(1);
      }
    } else {
      console.log(`✅ Updates available: ${Object.keys(updateInfo.scripts).join(', ')}\n`);
    }

    // Generate update command
    const updateCommand = generateUpdateCommand(updateInfo);

    if (!updateCommand) {
      console.error('❌ Failed to generate update command');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Create and save command
    const cmd = new EPCCommand({
      ...updateCommand,
      epc_id: epc.epc_id,
      tenant_id: TENANT_ID,
      status: 'pending',
      created_at: new Date(),
      description: `OUI lookup fix: Update epc-snmp-discovery.js - ${Object.keys(updateInfo.scripts).join(', ')}`
    });

    await cmd.save();
    
    console.log('\n✅ Update command created successfully!');
    console.log(`   Command ID: ${cmd._id.toString()}`);
    console.log(`   EPC ID: ${epc.epc_id}`);
    console.log(`   Device Code: ${epc.device_code}`);
    console.log(`   Scripts to update: ${Object.keys(updateInfo.scripts).join(', ')}`);
    console.log(`\nThe EPC will download and execute the update on its next check-in (within ${epc.metrics_config?.update_interval_seconds || 60} seconds).\n`);

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

