/**
 * Clear ALL old update commands for an EPC
 * More aggressive cleanup
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
    console.log('Connected to MongoDB');

    console.log(`\nClearing ALL old commands for EPC: ${EPC_ID}\n`);

    // Delete ALL script_execution commands regardless of status (except reset commands)
    // Also delete by old hash patterns directly
    const result = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      command_type: 'script_execution',
      $or: [
        { notes: { $not: { $regex: 'Force reset all agent scripts' } } },
        { script_content: { $regex: '9a95994f1dcc8092037c2df5f28c28ef45535f08f077628152344c0e08df13d2' } }, // Old epc-checkin-agent.sh hash
        { script_content: { $regex: '1780dd83d5e189e55c690f37062e1c13b17e76505da20e96298ef56bfaf19da6' } }, // Old epc-snmp-discovery.sh hash
        { script_content: { $regex: '5aa0bcc4b95dec66e441c938b132f8e3a7c07533e8db8643ff819d4c03404f58' } }  // Old install-epc-dependencies.sh hash
      ]
    });

    console.log(`✅ Deleted ${result.deletedCount} script_execution command(s) (keeping reset commands)\n`);

    // Also delete any commands that mention "update" or "Auto-generated" in any status
    const result2 = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      $or: [
        { script_content: { $regex: 'Auto-generated update script' } },
        { script_content: { $regex: 'Expected hash.*9a95994f|1780dd83|5aa0bcc4' } }, // Old hashes
        { notes: { $regex: 'Auto-update' } },
        { script_content: { $regex: 'epc-checkin-agent.sh.*update' } },
        { script_content: { $regex: 'epc-snmp-discovery.*update' } },
        { script_content: { $regex: 'install-epc-dependencies.*install' } }
      ],
      notes: { $not: { $regex: 'Force reset all agent scripts' } } // Keep reset commands
    });

    console.log(`✅ Deleted ${result2.deletedCount} additional matching command(s)\n`);
    
    // Delete commands with wrong hashes (old hash patterns)
    const oldHashes = [
      '9a95994f1dcc8092037c2df5f28c28ef45535f08f077628152344c0e08df13d2',
      '1780dd83d5e189e55c690f37062e1c13b17e76505da20e96298ef56bfaf19da6',
      '5aa0bcc4b95dec66e441c938b132f8e3a7c07533e8db8643ff819d4c03404f58'
    ];
    
    for (const oldHash of oldHashes) {
      const result3 = await EPCCommand.deleteMany({
        epc_id: EPC_ID,
        script_content: { $regex: oldHash }
      });
      if (result3.deletedCount > 0) {
        console.log(`✅ Deleted ${result3.deletedCount} command(s) with old hash ${oldHash.substring(0, 16)}...\n`);
      }
    }

    console.log('=== All Old Commands Cleared ===');
    console.log(`Now queue a fresh reset command.`);

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

