#!/usr/bin/env node
/**
 * Create EPC Timezone Configuration Command
 * Sets NTP and timezone for a remote EPC device
 * Usage: node create-timezone-command.js <DEVICE_CODE> <TIMEZONE>
 * Example: node create-timezone-command.js YALNTFQC America/Chicago
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;

const { EPCCommand } = require('../models/distributed-epc-schema');
const { RemoteEPC } = require('../models/distributed-epc-schema');
const appConfig = require('../config/app');

const DEVICE_CODE = process.argv[2];
const TIMEZONE = process.argv[3] || 'America/Chicago'; // Default to Central Time

if (!DEVICE_CODE) {
  console.error('Usage: node create-timezone-command.js <DEVICE_CODE> [TIMEZONE]');
  console.error('Example: node create-timezone-command.js YALNTFQC America/Chicago');
  console.error('');
  console.error('Common US timezones:');
  console.error('  America/Chicago (Central Time)');
  console.error('  America/New_York (Eastern Time)');
  console.error('  America/Denver (Mountain Time)');
  console.error('  America/Los_Angeles (Pacific Time)');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(appConfig.mongodb.uri);
    console.log('Connected to MongoDB');

    // Find EPC by device code
    const epc = await RemoteEPC.findOne({ device_code: DEVICE_CODE.toUpperCase() }).lean();
    
    if (!epc) {
      console.error(`Error: EPC not found for device_code: ${DEVICE_CODE}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`Found EPC: ${epc.epc_id} (${epc.site_name})`);

    // Read the setup script
    const scriptPath = path.join(__dirname, 'setup-ntp-timezone.sh');
    let scriptContent = await fs.readFile(scriptPath, 'utf8');
    
    // Replace timezone placeholder if needed
    scriptContent = scriptContent.replace(/TIMEZONE="\${1:-America\/Chicago}"/, `TIMEZONE="${TIMEZONE}"`);

    // Create command
    const cmd = new EPCCommand({
      epc_id: epc.epc_id,
      tenant_id: epc.tenant_id,
      command_type: 'script_execution',
      action: 'configure_timezone',
      script_content: scriptContent,
      priority: 3, // Medium-high priority
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      description: `Configure NTP and set timezone to ${TIMEZONE}`,
      status: 'pending',
      created_at: new Date()
    });

    await cmd.save();
    console.log(`\n✅ Timezone configuration command queued successfully`);
    console.log(`   Command ID: ${cmd._id.toString()}`);
    console.log(`   EPC: ${epc.epc_id}`);
    console.log(`   Timezone: ${TIMEZONE}`);
    console.log(`   The EPC will configure NTP and timezone on its next check-in.`);

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

