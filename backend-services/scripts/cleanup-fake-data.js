/**
 * Cleanup Script: Remove Fake/Test Data from Network Collections
 * 
 * This script identifies and removes fake/test data from:
 * - UnifiedTower (Tower Sites)
 * - UnifiedSector (Sectors)
 * - UnifiedCPE (CPE Devices)
 * - NetworkEquipment (Equipment)
 * 
 * Usage:
 *   node scripts/cleanup-fake-data.js [--dry-run] [--tenant-id=xxx]
 * 
 * Options:
 *   --dry-run: Show what would be deleted without actually deleting
 *   --tenant-id: Only clean data for specific tenant
 */

require('dotenv').config();
const path = require('path');

// Add parent directory to module path
const parentDir = path.resolve(__dirname, '..');
process.env.NODE_PATH = `${process.env.NODE_PATH || ''}:${parentDir}`;
require('module').Module._initPaths();

const mongoose = require('mongoose');
const { UnifiedTower, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../models/network');
const appConfig = require('../config/app');

// Patterns that indicate fake/test data
const FAKE_PATTERNS = {
  names: [
    /test/i,
    /demo/i,
    /sample/i,
    /fake/i,
    /dummy/i,
    /example/i,
    /placeholder/i,
    /temp/i,
    /temporary/i,
    /^test-/i,
    /^demo-/i,
    /^sample-/i,
    /^fake-/i,
  ],
  addresses: [
    /test/i,
    /demo/i,
    /sample/i,
    /fake/i,
    /dummy/i,
    /example/i,
    /123 test/i,
    /test street/i,
    /test road/i,
  ],
  serialNumbers: [
    /^TEST/i,
    /^DEMO/i,
    /^SAMPLE/i,
    /^FAKE/i,
    /^TEMP/i,
    /^000000/i,
    /^123456/i,
    /^999999/i,
  ]
};

function isFakeName(name) {
  if (!name || typeof name !== 'string') return false;
  return FAKE_PATTERNS.names.some(pattern => pattern.test(name));
}

function isFakeAddress(address) {
  if (!address || typeof address !== 'string') return false;
  return FAKE_PATTERNS.addresses.some(pattern => pattern.test(address));
}

function isFakeSerialNumber(serial) {
  if (!serial || typeof serial !== 'string') return false;
  return FAKE_PATTERNS.serialNumbers.some(pattern => pattern.test(serial));
}

async function cleanupFakeData(tenantId = null, dryRun = true) {
  console.log('🔍 Starting fake data cleanup...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will delete)'}`);
  console.log(`   Tenant Filter: ${tenantId || 'ALL TENANTS'}`);
  console.log('');

  const query = tenantId ? { tenantId } : {};

  // Cleanup Towers
  console.log('📡 Checking Towers...');
  const towers = await UnifiedTower.find(query).lean();
  const fakeTowers = towers.filter(tower => 
    isFakeName(tower.name) || 
    isFakeAddress(tower.address) ||
    isFakeName(tower.siteName)
  );
  
  console.log(`   Found ${towers.length} total towers`);
  console.log(`   Found ${fakeTowers.length} fake towers`);
  if (fakeTowers.length > 0) {
    console.log('   Fake towers:');
    fakeTowers.forEach(t => {
      console.log(`     - ${t.name || t.siteName} (${t._id}) - ${t.address || 'No address'}`);
    });
    
    if (!dryRun) {
      const towerIds = fakeTowers.map(t => t._id);
      await UnifiedTower.deleteMany({ _id: { $in: towerIds } });
      console.log(`   ✅ Deleted ${fakeTowers.length} fake towers`);
    }
  }
  console.log('');

  // Cleanup Sectors
  console.log('📶 Checking Sectors...');
  const sectors = await UnifiedSector.find(query).lean();
  const fakeSectors = sectors.filter(sector => 
    isFakeName(sector.name) ||
    isFakeName(sector.towerName) ||
    (sector.siteId && fakeTowers.some(t => t._id.toString() === sector.siteId.toString()))
  );
  
  console.log(`   Found ${sectors.length} total sectors`);
  console.log(`   Found ${fakeSectors.length} fake sectors`);
  if (fakeSectors.length > 0) {
    console.log('   Fake sectors:');
    fakeSectors.forEach(s => {
      console.log(`     - ${s.name || `Sector ${s.azimuth}°`} (${s._id}) - Tower: ${s.towerName || s.siteId}`);
    });
    
    if (!dryRun) {
      const sectorIds = fakeSectors.map(s => s._id);
      await UnifiedSector.deleteMany({ _id: { $in: sectorIds } });
      console.log(`   ✅ Deleted ${fakeSectors.length} fake sectors`);
    }
  }
  console.log('');

  // Cleanup CPE Devices
  console.log('📱 Checking CPE Devices...');
  const cpeDevices = await UnifiedCPE.find(query).lean();
  const fakeCPE = cpeDevices.filter(cpe => 
    isFakeName(cpe.name) ||
    isFakeSerialNumber(cpe.serialNumber) ||
    isFakeAddress(cpe.address) ||
    (cpe.siteId && fakeTowers.some(t => t._id.toString() === cpe.siteId.toString()))
  );
  
  console.log(`   Found ${cpeDevices.length} total CPE devices`);
  console.log(`   Found ${fakeCPE.length} fake CPE devices`);
  if (fakeCPE.length > 0) {
    console.log('   Fake CPE devices:');
    fakeCPE.forEach(cpe => {
      console.log(`     - ${cpe.name || cpe.serialNumber} (${cpe._id}) - ${cpe.address || 'No address'}`);
    });
    
    if (!dryRun) {
      const cpeIds = fakeCPE.map(c => c._id);
      await UnifiedCPE.deleteMany({ _id: { $in: cpeIds } });
      console.log(`   ✅ Deleted ${fakeCPE.length} fake CPE devices`);
    }
  }
  console.log('');

  // Cleanup Equipment
  console.log('🔧 Checking Network Equipment...');
  const equipment = await NetworkEquipment.find(query).lean();
  const fakeEquipment = equipment.filter(eq => 
    isFakeName(eq.name) ||
    isFakeSerialNumber(eq.serialNumber) ||
    isFakeAddress(eq.address) ||
    (eq.siteId && fakeTowers.some(t => t._id.toString() === eq.siteId.toString()))
  );
  
  console.log(`   Found ${equipment.length} total equipment`);
  console.log(`   Found ${fakeEquipment.length} fake equipment`);
  if (fakeEquipment.length > 0) {
    console.log('   Fake equipment:');
    fakeEquipment.forEach(eq => {
      console.log(`     - ${eq.name || eq.serialNumber} (${eq._id}) - ${eq.address || 'No address'}`);
    });
    
    if (!dryRun) {
      const equipmentIds = fakeEquipment.map(e => e._id);
      await NetworkEquipment.deleteMany({ _id: { $in: equipmentIds } });
      console.log(`   ✅ Deleted ${fakeEquipment.length} fake equipment`);
    }
  }
  console.log('');

  // Summary
  const totalFake = fakeTowers.length + fakeSectors.length + fakeCPE.length + fakeEquipment.length;
  console.log('📊 Summary:');
  console.log(`   Total fake items found: ${totalFake}`);
  console.log(`     - Towers: ${fakeTowers.length}`);
  console.log(`     - Sectors: ${fakeSectors.length}`);
  console.log(`     - CPE Devices: ${fakeCPE.length}`);
  console.log(`     - Equipment: ${fakeEquipment.length}`);
  
  if (dryRun) {
    console.log('');
    console.log('ℹ️  This was a DRY RUN. No data was deleted.');
    console.log('   Run without --dry-run to actually delete the fake data.');
  } else {
    console.log('');
    console.log('✅ Cleanup complete!');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tenantArg = args.find(arg => arg.startsWith('--tenant-id='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : null;

  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(appConfig.mongodb.uri, appConfig.mongodb.options);
    console.log('✅ Connected to MongoDB');
    console.log('');

    await cleanupFakeData(tenantId, dryRun);

    await mongoose.connection.close();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { cleanupFakeData, isFakeName, isFakeAddress, isFakeSerialNumber };

