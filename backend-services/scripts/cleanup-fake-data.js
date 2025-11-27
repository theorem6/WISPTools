#!/usr/bin/env node
/**
 * Cleanup script to remove fake/demo data from the database
 */

const mongoose = require('mongoose');
const { HardwareDeployment, NetworkEquipment, UnifiedSite, UnifiedSector, UnifiedCPE } = require('../models/network');
const { InventoryItem } = require('../models/inventory');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

// Patterns that indicate fake/demo data
const FAKE_PATTERNS = [
  /Customer.*CPE/i,
  /fake/i,
  /demo/i,
  /sample/i,
  /^test$/i,
  /mock/i
];

function isFake(name) {
  return FAKE_PATTERNS.some(pattern => pattern.test(name));
}

async function cleanup() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!\n');

    // Delete fake hardware deployments
    console.log('=== Hardware Deployments ===');
    const fakeDeployments = await HardwareDeployment.deleteMany({
      $or: FAKE_PATTERNS.map(p => ({ name: p }))
    });
    console.log(`Deleted ${fakeDeployments.deletedCount} fake hardware deployments`);

    // Check network equipment
    console.log('\n=== Network Equipment ===');
    const allEquipment = await NetworkEquipment.find({}).lean();
    const fakeEquipment = allEquipment.filter(e => isFake(e.name));
    console.log(`Found ${fakeEquipment.length} fake equipment items`);
    if (fakeEquipment.length > 0) {
      fakeEquipment.forEach(e => console.log(`  - ${e.name} (${e._id})`));
      const deleteEquip = await NetworkEquipment.deleteMany({
        _id: { $in: fakeEquipment.map(e => e._id) }
      });
      console.log(`Deleted ${deleteEquip.deletedCount} fake equipment`);
    }

    // Check inventory items
    console.log('\n=== Inventory Items ===');
    const allInventory = await InventoryItem.find({}).lean();
    const fakeInventory = allInventory.filter(i => i.model && isFake(i.model));
    console.log(`Found ${fakeInventory.length} fake inventory items`);
    if (fakeInventory.length > 0) {
      fakeInventory.forEach(i => console.log(`  - ${i.model} (${i._id})`));
    }

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Hardware Deployments: ${await HardwareDeployment.countDocuments()}`);
    console.log(`Network Equipment: ${await NetworkEquipment.countDocuments()}`);
    console.log(`Inventory Items: ${await InventoryItem.countDocuments()}`);
    console.log(`Sites: ${await UnifiedSite.countDocuments()}`);
    console.log(`Sectors: ${await UnifiedSector.countDocuments()}`);
    console.log(`CPE: ${await UnifiedCPE.countDocuments()}`);

    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
}

cleanup();
