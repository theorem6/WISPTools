/**
 * Delete ALL auto-generated update commands for an EPC
 * Usage: node delete-all-auto-update-commands.js EPC-CB4C5042
 */

const mongoose = require('mongoose');
const { EPCCommand } = require('../models/distributed-epc-schema');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || require('../config/app').mongodb.uri;
const EPC_ID = process.argv[2] || 'EPC-CB4C5042';

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.\n');

    console.log(`=== DELETING ALL AUTO-UPDATE COMMANDS for ${EPC_ID} ===\n`);

    // Delete ALL commands that have "Auto-generated update script" or "Auto-update" in them
    const result = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      $or: [
        { script_content: { $regex: 'Auto-generated update script' } },
        { notes: { $regex: 'Auto-update' } },
        { command_type: 'script_execution', priority: { $lt: 5 } } // Auto-update commands have priority < 5
      ]
    });

    console.log(`✅ Deleted ${result.deletedCount} auto-update command(s)\n`);

    // Also delete commands with wrong hashes (old hash patterns)
    const oldHashes = [
      '9a95994f1dcc8092037c2df5f28c28ef45535f08f077628152344c0e08df13d2',
      '1780dd83d5e189e55c690f37062e1c13b17e76505da20e96298ef56bfaf19da6',
      '5aa0bcc4b95dec66e441c938b132f8e3a7c07533e8db8643ff819d4c03404f58'
    ];

    for (const oldHash of oldHashes) {
      const hashResult = await EPCCommand.deleteMany({
        epc_id: EPC_ID,
        script_content: { $regex: oldHash }
      });
      if (hashResult.deletedCount > 0) {
        console.log(`✅ Deleted ${hashResult.deletedCount} command(s) with old hash ${oldHash.substring(0, 16)}...`);
      }
    }

    console.log('\n=== COMPLETE ===');
    console.log('All auto-update commands have been deleted.\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();

