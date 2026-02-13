const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || '';
const EPC_ID = process.argv[2] || 'EPC-CB4C5042';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const EPCCommand = mongoose.model('EPCCommand', new mongoose.Schema({}, { strict: false, collection: 'epccommands' }));
    
    console.log(`\n=== Deleting ALL auto-update commands for ${EPC_ID} ===\n`);
    
    // Delete ALL commands that match auto-update patterns (any status)
    const patterns = [
      { script_content: { $regex: 'Auto-generated update script' } },
      { script_content: { $regex: 'Auto-update' } },
      { notes: { $regex: 'Auto-update' } },
      { notes: { $regex: 'Auto-generated' } }
    ];
    
    let totalDeleted = 0;
    
    for (const pattern of patterns) {
      const result = await EPCCommand.deleteMany({
        epc_id: EPC_ID,
        ...pattern
      });
      
      if (result.deletedCount > 0) {
        console.log(`✅ Deleted ${result.deletedCount} command(s) matching pattern`);
        totalDeleted += result.deletedCount;
      }
    }
    
    // Also delete by wrong hashes
    const wrongHashes = [
      '9a95994f1dcc8092037c2df5f28c28ef45535f08f077628152344c0e08df13d2',
      '1780dd83d5e189e55c690f37062e1c13b17e76505da20e96298ef56bfaf19da6',
      '5aa0bcc4b95dec66e441c938b132f8e3a7c07533e8db8643ff819d4c03404f58'
    ];
    
    for (const hash of wrongHashes) {
      const result = await EPCCommand.deleteMany({
        epc_id: EPC_ID,
        script_content: { $regex: hash }
      });
      
      if (result.deletedCount > 0) {
        console.log(`✅ Deleted ${result.deletedCount} command(s) with wrong hash ${hash.substring(0, 16)}...`);
        totalDeleted += result.deletedCount;
      }
    }
    
    // Delete all script_execution commands that are auto-update related
    const scriptResult = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      command_type: 'script_execution',
      $or: [
        { notes: { $regex: 'Auto-update|Auto-generated' } },
        { script_content: { $regex: 'Auto-generated update script|Auto-update' } },
        { priority: { $lt: 5 } } // Auto-update commands usually have priority < 5
      ]
    });
    
    if (scriptResult.deletedCount > 0) {
      console.log(`✅ Deleted ${scriptResult.deletedCount} script_execution command(s) (auto-update related)`);
      totalDeleted += scriptResult.deletedCount;
    }
    
    console.log(`\n✅ Total deleted: ${totalDeleted} command(s)\n`);
    
    // Verify no more auto-update commands
    const remaining = await EPCCommand.countDocuments({
      epc_id: EPC_ID,
      $or: [
        { notes: { $regex: 'Auto-update|Auto-generated' } },
        { script_content: { $regex: 'Auto-generated update script|Auto-update' } }
      ]
    });
    
    if (remaining > 0) {
      console.log(`⚠️  Warning: ${remaining} auto-update command(s) still remain`);
    } else {
      console.log(`✅ Verified: No auto-update commands remain\n`);
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

