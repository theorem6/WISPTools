#!/usr/bin/env node
/**
 * Update EPC and Force Check-in Test
 * Queues an update command and provides instructions to force immediate check-in
 * Usage: node update-and-test-epc.js <EPC_ID or DEVICE_CODE> [TENANT_ID] [EPC_SSH_HOST]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { spawn } = require('child_process');
const { EPCCommand, RemoteEPC } = require('../models/distributed-epc-schema');
const { checkForUpdates, generateUpdateCommand } = require('../utils/epc-auto-update');
const appConfig = require('../config/app');

const IDENTIFIER = process.argv[2];
const TENANT_ID = process.argv[3] || process.env.DEFAULT_TENANT_ID || '690abdc14a6f067977986db3';
const EPC_SSH_HOST = process.argv[4]; // Optional: EPC SSH hostname/IP for direct check-in trigger

if (!IDENTIFIER) {
  console.error('Usage: node update-and-test-epc.js <EPC_ID or DEVICE_CODE> [TENANT_ID] [EPC_SSH_HOST]');
  console.error('Example: node update-and-test-epc.js EPC-CB4C5042');
  console.error('Example: node update-and-test-epc.js YALNTFQC 690abdc14a6f067977986db3 192.168.2.234');
  process.exit(1);
}

async function main() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(appConfig.mongodb.uri);
    console.log('✅ Connected to MongoDB\n');

    // Find EPC
    const epc = await RemoteEPC.findOne({
      $or: [
        { epc_id: IDENTIFIER },
        { device_code: IDENTIFIER.toUpperCase() }
      ],
      tenant_id: TENANT_ID
    }).lean();

    if (!epc) {
      console.error(`❌ EPC not found: ${IDENTIFIER}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('=== EPC Information ===');
    console.log(`EPC ID: ${epc.epc_id}`);
    console.log(`Device Code: ${epc.device_code}`);
    console.log(`IP Address: ${epc.ip_address || 'Unknown'}`);
    console.log(`Status: ${epc.status || 'unknown'}`);
    console.log('');

    // Step 1: Check for updates
    console.log('=== Step 1: Checking for Updates ===');
    const updateInfo = await checkForUpdates(epc.epc_id, {});

    if (!updateInfo.has_updates) {
      console.log('✅ All scripts are up to date');
      console.log('No update needed, but we can still trigger a check-in test.\n');
    } else {
      console.log('📦 Updates available:');
      for (const [script, info] of Object.entries(updateInfo.scripts)) {
        console.log(`  - ${script} (hash: ${info.hash.substring(0, 16)}...)`);
      }
      console.log('');

      // Check if update already queued
      const existingUpdate = await EPCCommand.findOne({
        epc_id: epc.epc_id,
        action: 'update_scripts',
        status: { $in: ['pending', 'sent'] }
      });

      if (existingUpdate) {
        console.log('⚠️  Update command already queued (ID:', existingUpdate._id.toString() + ')');
        console.log('   Will use existing command for testing.\n');
      } else {
        // Create update command
        console.log('=== Step 2: Queueing Update Command ===');
        const updateCommand = generateUpdateCommand(updateInfo);
        
        if (updateCommand) {
          const cmd = new EPCCommand({
            ...updateCommand,
            epc_id: epc.epc_id,
            tenant_id: TENANT_ID,
            status: 'pending',
            created_at: new Date(),
            description: `Manual update and test: ${Object.keys(updateInfo.scripts).join(', ')}`
          });

          await cmd.save();
          console.log(`✅ Update command queued successfully`);
          console.log(`   Command ID: ${cmd._id.toString()}`);
          console.log(`   Scripts: ${Object.keys(updateInfo.scripts).join(', ')}\n`);
        }
      }
    }

    // Step 3: Force check-in
    console.log('=== Step 3: Triggering Immediate Check-in ===');
    
    if (EPC_SSH_HOST) {
      console.log(`Attempting to trigger check-in via SSH to ${EPC_SSH_HOST}...`);
      
      // Try to trigger check-in via SSH
      const sshUser = process.env.EPC_SSH_USER || 'wisp';
      const sshCommand = `/opt/wisptools/epc-checkin-agent.sh once`;
      
      console.log(`Running: ssh ${sshUser}@${EPC_SSH_HOST} "${sshCommand}"`);
      
      const ssh = spawn('ssh', [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=5',
        `${sshUser}@${EPC_SSH_HOST}`,
        sshCommand
      ], {
        stdio: 'inherit'
      });

      ssh.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Check-in triggered successfully via SSH');
        } else {
          console.log(`\n⚠️  SSH check-in failed (exit code: ${code})`);
          console.log('\n📋 Manual check-in instructions:');
          printManualCheckInInstructions(epc);
        }
        
        setTimeout(async () => {
          await checkCommandStatus(epc.epc_id);
          await mongoose.disconnect();
          process.exit(code === 0 ? 0 : 1);
        }, 3000);
      });

      ssh.on('error', (err) => {
        console.error(`\n❌ SSH error: ${err.message}`);
        console.log('\n📋 Manual check-in instructions:');
        printManualCheckInInstructions(epc);
        setTimeout(async () => {
          await mongoose.disconnect();
          process.exit(1);
        }, 1000);
      });

    } else {
      // No SSH host provided - show manual instructions
      console.log('📋 Manual check-in instructions:');
      printManualCheckInInstructions(epc);
      
      // Wait a bit and check status
      console.log('\n⏳ Waiting 5 seconds, then checking command status...');
      setTimeout(async () => {
        await checkCommandStatus(epc.epc_id);
        await mongoose.disconnect();
        process.exit(0);
      }, 5000);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

function printManualCheckInInstructions(epc) {
  const ip = epc.ip_address || 'EPC_IP_ADDRESS';
  console.log('');
  console.log('To trigger a manual check-in on the EPC device:');
  console.log('');
  console.log('  Option 1: SSH to EPC and run:');
  console.log(`    ssh wisp@${ip}`);
  console.log('    sudo /opt/wisptools/epc-checkin-agent.sh once');
  console.log('');
  console.log('  Option 2: If you have SSH key access:');
  console.log(`    ssh -o StrictHostKeyChecking=no wisp@${ip} "sudo /opt/wisptools/epc-checkin-agent.sh once"`);
  console.log('');
  console.log('  Option 3: Watch for automatic check-in (within 60 seconds)');
  console.log(`    tail -f /var/log/wisptools-checkin.log`);
  console.log('');
}

async function checkCommandStatus(epc_id) {
  console.log('\n=== Checking Command Status ===');
  
  try {
    const commands = await EPCCommand.find({
      epc_id: epc_id,
      status: { $in: ['pending', 'sent', 'completed'] }
    }).sort({ created_at: -1 }).limit(5).lean();

    if (commands.length === 0) {
      console.log('No recent commands found');
      return;
    }

    console.log(`Found ${commands.length} recent command(s):\n`);
    for (const cmd of commands) {
      console.log(`  [${cmd.status}] ${cmd.command_type}/${cmd.action || 'N/A'}`);
      console.log(`    Created: ${cmd.created_at}`);
      if (cmd.result) {
        console.log(`    Result: ${cmd.result.success ? '✅ Success' : '❌ Failed'}`);
        if (cmd.result.output) {
          console.log(`    Output: ${cmd.result.output.substring(0, 100)}...`);
        }
      }
      console.log('');
    }
  } catch (err) {
    console.error('Error checking command status:', err.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nInterrupted. Cleaning up...');
  await mongoose.disconnect();
  process.exit(0);
});

main();

