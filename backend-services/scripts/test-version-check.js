#!/usr/bin/env node
/**
 * Test script to verify version checking is working
 * Simulates what happens during a check-in
 */

const agentVersionManager = require('../utils/agent-version-manager');

async function testVersionCheck() {
  console.log('=== Testing Agent Version Check ===\n');
  
  // Test 1: Load manifest
  console.log('1. Loading manifest...');
  const manifest = await agentVersionManager.getCurrentManifest();
  if (!manifest) {
    console.error('ERROR: Failed to load manifest');
    process.exit(1);
  }
  console.log(`   ✓ Manifest loaded: ${manifest.version}`);
  console.log(`   Scripts in manifest: ${Object.keys(manifest.scripts).join(', ')}\n`);
  
  // Test 2: Compare with empty versions (should trigger install)
  console.log('2. Testing with no scripts reported (should trigger install)...');
  const emptyVersions = {};
  const updates1 = agentVersionManager.compareVersions(emptyVersions, manifest);
  console.log(`   Updates needed: ${updates1.length}`);
  updates1.forEach(u => {
    console.log(`     - ${u.script}: ${u.action} (hash: ${u.server_hash.substring(0, 16)}...)`);
  });
  console.log('');
  
  // Test 3: Compare with wrong hash (should trigger update)
  console.log('3. Testing with wrong hash (should trigger update)...');
  const wrongHash = {
    'epc-checkin-agent.sh': {
      hash: 'wronghash1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    }
  };
  const updates2 = agentVersionManager.compareVersions(wrongHash, manifest);
  console.log(`   Updates needed: ${updates2.length}`);
  updates2.forEach(u => {
    console.log(`     - ${u.script}: ${u.action}`);
    console.log(`       Current: ${u.current_hash?.substring(0, 16) || 'none'}...`);
    console.log(`       Server:  ${u.server_hash.substring(0, 16)}...`);
  });
  console.log('');
  
  // Test 4: Compare with correct hash (should be up to date)
  console.log('4. Testing with correct hash (should be up to date)...');
  const correctHash = {
    'epc-checkin-agent.sh': {
      hash: manifest.scripts['epc-checkin-agent.sh'].sha256
    }
  };
  const updates3 = agentVersionManager.compareVersions(correctHash, manifest);
  console.log(`   Updates needed: ${updates3.length}`);
  if (updates3.length === 0) {
    console.log('   ✓ All scripts up to date!');
  }
  console.log('');
  
  // Test 5: Show manifest script hashes
  console.log('5. Current manifest script hashes:');
  for (const [name, info] of Object.entries(manifest.scripts)) {
    console.log(`   ${name}:`);
    console.log(`     Hash: ${info.sha256.substring(0, 16)}...${info.sha256.substring(info.sha256.length - 8)}`);
    console.log(`     URL: ${info.url}`);
  }
  
  console.log('\n=== Test Complete ===');
}

testVersionCheck().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

