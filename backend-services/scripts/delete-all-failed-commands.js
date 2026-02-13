const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || '';
const EPC_ID = process.argv[2] || 'EPC-CB4C5042';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const EPCCommand = mongoose.model('EPCCommand', new mongoose.Schema({}, { strict: false, collection: 'epccommands' }));
    
    console.log(`\n=== Deleting all failed auto-update commands for ${EPC_ID} ===\n`);
    
    // Delete all failed auto-update commands
    const result = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      status: 'failed',
      notes: { $regex: 'Auto-update' }
    });
    
    console.log(`✅ Deleted ${result.deletedCount} failed auto-update command(s)\n`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

