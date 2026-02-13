const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || '';
const EPC_ID = process.argv[2] || 'EPC-CB4C5042';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const EPCCommand = mongoose.model('EPCCommand', new mongoose.Schema({}, { strict: false, collection: 'epccommands' }));
    
    // Delete ALL commands with wrong hashes (old wrong hashes)
    const wrongHashes = [
      '9a95994f1dcc8092037c2df5f28c28ef45535f08f077628152344c0e08df13d2', // epc-checkin-agent.sh (wrong)
      '1780dd83d5e189e55c690f37062e1c13b17e76505da20e96298ef56bfaf19da6', // epc-snmp-discovery.sh (wrong)
      '5aa0bcc4b95dec66e441c938b132f8e3a7c07533e8db8643ff819d4c03404f58'  // install-epc-dependencies.sh (wrong)
    ];
    
    console.log(`=== Deleting ALL commands with wrong hashes for ${EPC_ID} ===`);
    
    // Delete by wrong hash patterns
    let totalDeleted = 0;
    
    for (const hash of wrongHashes) {
      const result = await EPCCommand.deleteMany({
        epc_id: EPC_ID,
        script_content: { $regex: hash }
      });
      if (result.deletedCount > 0) {
        console.log(`✅ Deleted ${result.deletedCount} command(s) with hash ${hash.substring(0, 16)}...`);
        totalDeleted += result.deletedCount;
      }
    }
    
    // Also delete all auto-generated update commands (catch-all)
    const autoUpdateResult = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      script_content: { $regex: 'Auto-generated update script' }
    });
    if (autoUpdateResult.deletedCount > 0) {
      console.log(`✅ Deleted ${autoUpdateResult.deletedCount} auto-generated update command(s)`);
      totalDeleted += autoUpdateResult.deletedCount;
    }
    
    // Delete all script_execution commands with priority < 5 (auto-update commands)
    const priorityResult = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      command_type: 'script_execution',
      priority: { $lt: 5 }
    });
    if (priorityResult.deletedCount > 0) {
      console.log(`✅ Deleted ${priorityResult.deletedCount} low-priority script_execution command(s)`);
      totalDeleted += priorityResult.deletedCount;
    }
    
    console.log(`\n✅ Total deleted: ${totalDeleted} command(s) for ${EPC_ID}`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

