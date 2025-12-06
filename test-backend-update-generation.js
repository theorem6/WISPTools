// Test script to verify backend update command generation
const update = require('./backend-services/utils/epc-auto-update.js');

const testInfo = {
  has_updates: true,
  scripts: {
    'epc-ping-monitor.js': {
      hash: 'test1234567890abcdef',
      priority: 1
    }
  },
  version: 'testversion123'
};

const cmd = update.generateUpdateCommand(testInfo);

if (cmd) {
  console.log('=== UPDATE COMMAND GENERATION TEST ===');
  console.log('Script length:', cmd.script_content.length);
  console.log('Has git clone:', cmd.script_content.includes('git clone'));
  console.log('Has git fetch:', cmd.script_content.includes('git fetch'));
  console.log('Has curl:', cmd.script_content.includes('curl'));
  console.log('Has downloads:', cmd.script_content.includes('downloads'));
  console.log('\n=== FIRST 500 CHARS ===');
  console.log(cmd.script_content.substring(0, 500));
  console.log('\n=== LAST 200 CHARS ===');
  console.log(cmd.script_content.substring(cmd.script_content.length - 200));
} else {
  console.log('No command generated!');
}
