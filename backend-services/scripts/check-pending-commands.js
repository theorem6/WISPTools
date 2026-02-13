const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || '';
const EPC_ID = process.argv[2] || 'EPC-CB4C5042';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const EPCCommand = mongoose.model('EPCCommand', new mongoose.Schema({}, { strict: false, collection: 'epccommands' }));
    
    const pending = await EPCCommand.countDocuments({ 
      epc_id: EPC_ID, 
      status: { $in: ['pending', 'sent', 'queued'] } 
    });
    
    console.log(`\n=== Pending/Sent Commands for ${EPC_ID} ===\n`);
    console.log(`Total pending/sent: ${pending}\n`);
    
    if (pending > 0) {
      const commands = await EPCCommand.find({ 
        epc_id: EPC_ID, 
        status: { $in: ['pending', 'sent', 'queued'] } 
      }).sort({ created_at: -1 }).lean();
      
      commands.forEach((cmd, idx) => {
        console.log(`${idx + 1}. ID: ${cmd._id}`);
        console.log(`   Type: ${cmd.command_type || 'N/A'}`);
        console.log(`   Status: ${cmd.status || 'N/A'}`);
        console.log(`   Created: ${cmd.created_at || 'N/A'}`);
        console.log(`   Notes: ${cmd.notes || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('✅ No pending/sent commands found!\n');
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

