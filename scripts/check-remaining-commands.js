const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || '';
const EPC_ID = process.argv[2] || 'EPC-CB4C5042';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const EPCCommand = mongoose.model('EPCCommand', new mongoose.Schema({}, { strict: false, collection: 'epccommands' }));
    
    const allCommands = await EPCCommand.find({ epc_id: EPC_ID })
      .sort({ created_at: -1 })
      .limit(20)
      .lean();
    
    console.log(`\n=== Commands for ${EPC_ID} ===\n`);
    console.log(`Total commands: ${allCommands.length}\n`);
    
    if (allCommands.length === 0) {
      console.log('✅ No commands found - all clear!\n');
    } else {
      allCommands.forEach((cmd, idx) => {
        console.log(`${idx + 1}. ID: ${cmd._id}`);
        console.log(`   Type: ${cmd.command_type || 'N/A'}`);
        console.log(`   Status: ${cmd.status || 'N/A'}`);
        console.log(`   Created: ${cmd.created_at || 'N/A'}`);
        console.log(`   Notes: ${cmd.notes || 'N/A'}`);
        if (cmd.script_content && cmd.script_content.length > 0) {
          const preview = cmd.script_content.substring(0, 100).replace(/\n/g, ' ');
          console.log(`   Script preview: ${preview}...`);
        }
        console.log('');
      });
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

