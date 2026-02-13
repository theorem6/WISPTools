const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || '';
const EPC_ID = process.argv[2] || 'EPC-CB4C5042';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const EPCCommand = mongoose.model('EPCCommand', new mongoose.Schema({}, { strict: false, collection: 'epccommands' }));
    
    // Check all recent commands (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentCommands = await EPCCommand.find({ 
      epc_id: EPC_ID,
      created_at: { $gte: oneDayAgo }
    }).sort({ created_at: -1 }).limit(20).lean();
    
    console.log(`\n=== Recent Commands (Last 24 Hours) for ${EPC_ID} ===\n`);
    console.log(`Total recent commands: ${recentCommands.length}\n`);
    
    if (recentCommands.length > 0) {
      // Group by status
      const byStatus = {};
      recentCommands.forEach(cmd => {
        const status = cmd.status || 'unknown';
        if (!byStatus[status]) byStatus[status] = [];
        byStatus[status].push(cmd);
      });
      
      Object.keys(byStatus).forEach(status => {
        console.log(`\n${status.toUpperCase()} (${byStatus[status].length}):`);
        byStatus[status].forEach((cmd, idx) => {
          console.log(`  ${idx + 1}. ID: ${cmd._id}`);
          console.log(`     Type: ${cmd.command_type || 'N/A'}`);
          console.log(`     Created: ${cmd.created_at || 'N/A'}`);
          console.log(`     Notes: ${cmd.notes || 'N/A'}`);
          if (cmd.script_content) {
            const preview = cmd.script_content.substring(0, 150).replace(/\n/g, ' ');
            console.log(`     Script: ${preview}...`);
          }
          console.log('');
        });
      });
    } else {
      console.log('✅ No recent commands found!\n');
    }
    
    // Also check for specific problematic command ID
    const specificCmd = await EPCCommand.findById('692c72c3f0ccf8e593c8d134').lean();
    if (specificCmd) {
      console.log(`\n=== Found Command ID 692c72c3f0ccf8e593c8d134 ===`);
      console.log(`Status: ${specificCmd.status}`);
      console.log(`Type: ${specificCmd.command_type}`);
      console.log(`Created: ${specificCmd.created_at}`);
      console.log(`Notes: ${specificCmd.notes || 'N/A'}`);
      if (specificCmd.script_content) {
        console.log(`Script preview: ${specificCmd.script_content.substring(0, 200)}...`);
      }
      console.log('');
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

