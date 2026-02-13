#!/usr/bin/env node
/**
 * Cleanup script to remove fake/demo data from the database
 */

const mongoose = require('mongoose');
const { HardwareDeployment, NetworkEquipment, UnifiedSite, UnifiedSector, UnifiedCPE } = require('../models/network');
const { InventoryItem } = require('../models/inventory');
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { SNMPMetrics } = require('../models/snmp-metrics-schema');

const MONGO_URI = process.env.MONGODB_URI || '';

// Patterns that indicate fake/demo data
const FAKE_PATTERNS = [
  /Customer.*CPE/i,
  /Customer.*LTE/i,
  /Customer A/i,
  /Customer B/i,
  /Core Router MT-RB5009/i,
  /Core Switch CRS328/i,
  /EPC Core Server/i,
  /Backhaul Router RB4011/i,
  /fake/i,
  /demo/i,
  /sample/i,
  /^test$/i,
  /mock/i
];

// Specific fake device names from test scripts
const FAKE_DEVICE_NAMES = [
  'Core Router MT-RB5009',
  'Core Switch CRS328',
  'EPC Core Server',
  'Backhaul Router RB4011',
  'Customer A CPE',
  'Customer B CPE',
  'Customer A LTE CPE',
  'Customer B LTE CPE'
];

function isFake(name) {
  if (!name) return false;
  // Check specific names first
  if (FAKE_DEVICE_NAMES.some(fake => name.includes(fake))) return true;
  // Then check patterns
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
    
    // Check UnifiedCPE for fake devices
    console.log('\n=== Unified CPE Devices ===');
    const allCPE = await UnifiedCPE.find({}).lean();
    const fakeCPE = allCPE.filter(cpe => isFake(cpe.name));
    console.log(`Found ${fakeCPE.length} fake CPE devices`);
    if (fakeCPE.length > 0) {
      fakeCPE.forEach(cpe => console.log(`  - ${cpe.name} (${cpe._id})`));
      const deleteCPE = await UnifiedCPE.deleteMany({
        _id: { $in: fakeCPE.map(cpe => cpe._id) }
      });
      console.log(`Deleted ${deleteCPE.deletedCount} fake CPE devices`);
    }

    // Check inventory items
    console.log('\n=== Inventory Items ===');
    const allInventory = await InventoryItem.find({}).lean();
    const fakeInventory = allInventory.filter(i => 
      (i.name && isFake(i.name)) || 
      (i.model && isFake(i.model)) || 
      (i.manufacturer && isFake(i.manufacturer)) ||
      (i.physicalDescription && isFake(i.physicalDescription))
    );
    console.log(`Found ${fakeInventory.length} fake inventory items`);
    if (fakeInventory.length > 0) {
      fakeInventory.forEach(i => console.log(`  - ${i.name || i.model || 'Unknown'} (${i._id})`));
      const deleteInv = await InventoryItem.deleteMany({
        _id: { $in: fakeInventory.map(i => i._id) }
      });
      console.log(`Deleted ${deleteInv.deletedCount} fake inventory items`);
    }

    // Check RemoteEPC devices
    console.log('\n=== Remote EPC Devices ===');
    const allRemoteEPCs = await RemoteEPC.find({}).lean();
    const fakeRemoteEPCs = allRemoteEPCs.filter(epc => 
      (epc.site_name && isFake(epc.site_name)) || 
      (epc.epc_id && isFake(epc.epc_id))
    );
    console.log(`Found ${fakeRemoteEPCs.length} fake RemoteEPC devices`);
    if (fakeRemoteEPCs.length > 0) {
      fakeRemoteEPCs.forEach(epc => console.log(`  - ${epc.site_name || epc.epc_id} (${epc._id})`));
      const deleteEPC = await RemoteEPC.deleteMany({
        _id: { $in: fakeRemoteEPCs.map(epc => epc._id) }
      });
      console.log(`Deleted ${deleteEPC.deletedCount} fake RemoteEPC devices`);
    }

    // Clean up SNMP metrics for fake devices
    console.log('\n=== SNMP Metrics ===');
    const fakeDeviceIds = [
      ...fakeEquipment.map(e => e._id.toString()),
      ...fakeCPE.map(cpe => cpe._id.toString())
    ];
    
    if (fakeDeviceIds.length > 0) {
      const deleteMetrics = await SNMPMetrics.deleteMany({
        device_id: { $in: fakeDeviceIds }
      });
      console.log(`Deleted ${deleteMetrics.deletedCount} SNMP metrics for fake devices`);
    }
    
    // Also check for any metrics where device_id matches fake device names
    const fakeDeviceNamesForMetrics = FAKE_DEVICE_NAMES.map(name => name.toLowerCase());
    const metricsWithFakeNames = await SNMPMetrics.find({
      $or: [
        { 'system.hostname': { $in: FAKE_DEVICE_NAMES } },
        { device_id: { $regex: /Customer.*CPE|Core Router|Core Switch|EPC Core|Backhaul Router/i } }
      ]
    }).lean();
    
    if (metricsWithFakeNames.length > 0) {
      console.log(`Found ${metricsWithFakeNames.length} SNMP metrics with fake device names/IDs`);
      const deleteMetricsByName = await SNMPMetrics.deleteMany({
        _id: { $in: metricsWithFakeNames.map(m => m._id) }
      });
      console.log(`Deleted ${deleteMetricsByName.deletedCount} SNMP metrics by name pattern`);
    }

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Hardware Deployments: ${await HardwareDeployment.countDocuments()}`);
    console.log(`Network Equipment: ${await NetworkEquipment.countDocuments()}`);
    console.log(`Inventory Items: ${await InventoryItem.countDocuments()}`);
    console.log(`RemoteEPC Devices: ${await RemoteEPC.countDocuments()}`);
    console.log(`UnifiedCPE Devices: ${await UnifiedCPE.countDocuments()}`);
    console.log(`SNMP Metrics: ${await SNMPMetrics.countDocuments()}`);
    console.log(`Sites: ${await UnifiedSite.countDocuments()}`);
    console.log(`Sectors: ${await UnifiedSector.countDocuments()}`);

    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
}

cleanup();
