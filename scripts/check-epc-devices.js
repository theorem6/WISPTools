#!/usr/bin/env node
/**
 * Check EPC devices in database for a tenant
 */

const mongoose = require('mongoose');
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { NetworkEquipment } = require('../models/network');
const { InventoryItem } = require('../models/inventory');

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

async function checkDevices() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!\n');

    const tenantId = process.argv[2] || '690abdc14a6f067977986db3';
    
    console.log(`=== Checking devices for tenant: ${tenantId} ===\n`);

    // Check RemoteEPC devices
    console.log('=== RemoteEPC Devices ===');
    const remoteEPCs = await RemoteEPC.find({ tenant_id: tenantId }).lean();
    console.log(`Found ${remoteEPCs.length} RemoteEPC devices:`);
    remoteEPCs.forEach(epc => {
      console.log(`  - ${epc.epc_id}: ${epc.site_name} (${epc.device_code || 'no device code'})`);
      console.log(`    Status: ${epc.status}, Last seen: ${epc.last_seen || 'never'}`);
    });

    // Check NetworkEquipment
    console.log('\n=== NetworkEquipment ===');
    const networkEquipment = await NetworkEquipment.find({ tenantId: tenantId }).lean();
    console.log(`Found ${networkEquipment.length} NetworkEquipment devices:`);
    networkEquipment.forEach(equip => {
      console.log(`  - ${equip.name} (${equip.type}) - Status: ${equip.status}`);
    });

    // Check InventoryItems
    console.log('\n=== InventoryItems ===');
    const inventoryItems = await InventoryItem.find({ tenantId: tenantId }).lean();
    console.log(`Found ${inventoryItems.length} InventoryItems:`);
    inventoryItems.forEach(item => {
      console.log(`  - ${item.name || item.model || 'Unnamed'} (${item.category || 'unknown'}) - Status: ${item.status}`);
    });

    // Check ALL RemoteEPC devices (not filtered by tenant) to see if there are any orphaned
    console.log('\n=== ALL RemoteEPC Devices (across all tenants) ===');
    const allRemoteEPCs = await RemoteEPC.find({}).lean();
    console.log(`Total RemoteEPC devices: ${allRemoteEPCs.length}`);
    allRemoteEPCs.forEach(epc => {
      console.log(`  - ${epc.epc_id}: ${epc.site_name} (tenant: ${epc.tenant_id || 'none'}, device_code: ${epc.device_code || 'none'})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDevices();

