#!/usr/bin/env node
/**
 * Test script to verify auto-update system detects script changes
 */

const { checkForUpdates } = require('../utils/epc-auto-update');

async function testAutoUpdate() {
  console.log('🧪 Testing Auto-Update System\n');
  
  // Test 1: Check with old hash (should detect update)
  console.log('Test 1: Checking with old hash (should detect update)...');
  const result1 = await checkForUpdates('test-epc', {
    scripts: {
      'epc-ping-monitor.js': { hash: 'old_hash_that_will_not_match' }
    }
  });
  
  console.log('Result:', {
    has_updates: result1.has_updates,
    scripts: Object.keys(result1.scripts),
    version: result1.version
  });
  
  if (result1.has_updates && result1.scripts['epc-ping-monitor.js']) {
    console.log('✅ Update detected for epc-ping-monitor.js');
    console.log(`   New hash: ${result1.scripts['epc-ping-monitor.js'].hash.substring(0, 32)}...`);
  } else {
    console.log('❌ Update NOT detected');
  }
  
  console.log('\n');
  
  // Test 2: Check with current hash (should not detect update)
  if (result1.scripts['epc-ping-monitor.js']) {
    const currentHash = result1.scripts['epc-ping-monitor.js'].hash;
    console.log('Test 2: Checking with current hash (should NOT detect update)...');
    const result2 = await checkForUpdates('test-epc', {
      scripts: {
        'epc-ping-monitor.js': { hash: currentHash }
      }
    });
    
    console.log('Result:', {
      has_updates: result2.has_updates,
      scripts: Object.keys(result2.scripts)
    });
    
    if (!result2.has_updates) {
      console.log('✅ Correctly detected no updates needed');
    } else {
      console.log('❌ Incorrectly detected updates when hash matches');
    }
  }
  
  console.log('\n✅ Auto-update system test complete');
}

testAutoUpdate().catch(console.error);

