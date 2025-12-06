#!/usr/bin/env node
/**
 * Check Queued EPC Commands
 * Shows pending and sent commands for an EPC
 * 
 * Usage: node check-queued-commands.js [EPC_ID or DEVICE_CODE]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { EPCCommand, RemoteEPC } = require('../models/distributed-epc-schema');

async function checkQueuedCommands(epcIdOrDeviceCode) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING);
    console.log('✅ Connected to MongoDB\n');
    
    // Find EPC
    let epc;
    if (epcIdOrDeviceCode.startsWith('EPC-')) {
      epc = await RemoteEPC.findOne({ epc_id: epcIdOrDeviceCode });
    } else {
      epc = await RemoteEPC.findOne({ device_code: epcIdOrDeviceCode.toUpperCase() });
    }
    
    if (!epc) {
      console.log(`❌ EPC not found: ${epcIdOrDeviceCode}`);
      console.log('   Try with EPC ID (EPC-XXXXX) or device code');
      process.exit(1);
    }
    
    console.log(`📡 EPC: ${epc.epc_id} (${epc.device_code})`);
    console.log(`   Site: ${epc.site_name || 'N/A'}`);
    console.log(`   Status: ${epc.status || 'unknown'}`);
    console.log(`   Last seen: ${epc.last_seen || 'never'}\n`);
    
    // Find all pending/sent commands
    const commands = await EPCCommand.find({
      epc_id: epc.epc_id,
      status: { $in: ['pending', 'sent'] }
    }).sort({ created_at: -1 }).lean();
    
    if (commands.length === 0) {
      console.log('✅ No queued commands\n');
    } else {
      console.log(`📋 Found ${commands.length} queued command(s):\n`);
      console.log('='.repeat(80));
      
      commands.forEach((cmd, index) => {
        console.log(`\n${index + 1}. Command ID: ${cmd._id}`);
        console.log(`   Type: ${cmd.command_type} / ${cmd.action || 'N/A'}`);
        console.log(`   Status: ${cmd.status}`);
        console.log(`   Priority: ${cmd.priority || 5}`);
        console.log(`   Created: ${cmd.created_at}`);
        if (cmd.sent_at) {
          const ageMinutes = Math.floor((Date.now() - new Date(cmd.sent_at)) / 1000 / 60);
          console.log(`   Sent: ${cmd.sent_at} (${ageMinutes} minutes ago)`);
          if (ageMinutes > 10) {
            console.log(`   ⚠️  WARNING: Command stuck in 'sent' status for ${ageMinutes} minutes`);
          }
        }
        if (cmd.expires_at) {
          const expiresIn = Math.floor((new Date(cmd.expires_at) - Date.now()) / 1000 / 60);
          if (expiresIn < 0) {
            console.log(`   ⚠️  EXPIRED: ${Math.abs(expiresIn)} minutes ago`);
          } else {
            console.log(`   Expires: ${expiresIn} minutes`);
          }
        }
        if (cmd.description) {
          console.log(`   Description: ${cmd.description}`);
        }
      });
      
      // Summary
      const updateCommands = commands.filter(c => c.action === 'update_scripts');
      const pending = commands.filter(c => c.status === 'pending');
      const sent = commands.filter(c => c.status === 'sent');
      const stuck = sent.filter(c => {
        if (!c.sent_at) return false;
        const age = (Date.now() - new Date(c.sent_at)) / 1000 / 60;
        return age > 10;
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('📊 Summary:');
      console.log(`   Total queued: ${commands.length}`);
      console.log(`   Update commands: ${updateCommands.length}`);
      console.log(`   Pending: ${pending.length}`);
      console.log(`   Sent: ${sent.length}`);
      if (stuck.length > 0) {
        console.log(`   ⚠️  Stuck (sent >10min): ${stuck.length}`);
      }
      
      // Show completed/failed commands from last 24 hours
      const recentCompleted = await EPCCommand.find({
        epc_id: epc.epc_id,
        status: { $in: ['completed', 'failed'] },
        completed_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).sort({ completed_at: -1 }).limit(5).lean();
      
      if (recentCompleted.length > 0) {
        console.log(`\n📜 Recent completed commands (last 24h): ${recentCompleted.length}`);
        recentCompleted.forEach(cmd => {
          const result = cmd.result?.success ? '✅' : '❌';
          console.log(`   ${result} ${cmd.command_type}/${cmd.action || 'N/A'} - ${cmd.status} at ${cmd.completed_at}`);
        });
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get EPC ID or device code from command line
const epcIdOrDeviceCode = process.argv[2];

if (!epcIdOrDeviceCode) {
  console.log('Usage: node check-queued-commands.js [EPC_ID or DEVICE_CODE]');
  console.log('\nExamples:');
  console.log('  node check-queued-commands.js EPC-CB4C5042');
  console.log('  node check-queued-commands.js YALNTFQC');
  process.exit(1);
}

checkQueuedCommands(epcIdOrDeviceCode);

