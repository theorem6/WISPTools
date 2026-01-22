#!/usr/bin/env node
/**
 * Restore EPC device that was deleted by cleanup script
 * This will create a new RemoteEPC record for a device code that was checking in
 */

const mongoose = require('mongoose');
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { InventoryItem } = require('../models/inventory');
const crypto = require('crypto');

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

async function restoreDevice() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!\n');

    const deviceCode = process.argv[2];
    const tenantId = process.argv[3] || '690abdc14a6f067977986db3';
    const siteName = process.argv[4] || 'Restored EPC Device';

    if (!deviceCode) {
      console.error('Usage: node restore-epc-device.js <device_code> [tenant_id] [site_name]');
      console.error('Example: node restore-epc-device.js YALNTFQC 690abdc14a6f067977986db3 "My EPC Site"');
      process.exit(1);
    }

    console.log(`=== Restoring EPC device ===`);
    console.log(`Device Code: ${deviceCode}`);
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Site Name: ${siteName}\n`);

    // Check if device code already exists
    const existing = await RemoteEPC.findOne({ device_code: deviceCode.toUpperCase() }).lean();
    if (existing) {
      console.log(`⚠️  Device code ${deviceCode} already exists!`);
      console.log(`   EPC ID: ${existing.epc_id}`);
      console.log(`   Site: ${existing.site_name}`);
      console.log(`   Tenant: ${existing.tenant_id}`);
      
      // Update tenant ID if wrong
      if (existing.tenant_id !== tenantId) {
        console.log(`\n🔧 Updating tenant ID from ${existing.tenant_id} to ${tenantId}...`);
        await RemoteEPC.updateOne(
          { device_code: deviceCode.toUpperCase() },
          { tenant_id: tenantId }
        );
        console.log('✅ Tenant ID updated!');
      }
      
      process.exit(0);
    }

    // Generate new EPC ID and credentials
    const epc_id = `EPC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const checkin_token = crypto.randomBytes(32).toString('hex');
    const auth_code = crypto.randomBytes(8).toString('hex').toUpperCase();
    const api_key = crypto.randomBytes(16).toString('hex');
    const secret_key = crypto.randomBytes(32).toString('hex');

    // Create new EPC record
    const newEPC = new RemoteEPC({
      epc_id,
      tenant_id: tenantId,
      device_code: deviceCode.toUpperCase(),
      site_name: siteName,
      status: 'registered', // Will become 'online' when device checks in
      deployment_type: 'both',
      checkin_token,
      auth_code,
      api_key,
      secret_key,
      hss_config: {
        hss_host: 'hss.wisptools.io',
        hss_port: 3868,
        diameter_realm: 'wisptools.io'
      },
      snmp_config: {
        enabled: true,
        version: '2c',
        community: 'public',
        port: 161
      },
      network_config: {},
      location: {},
      apt_config: { enabled: true },
      created_at: new Date(),
      updated_at: new Date()
    });

    await newEPC.save();
    console.log(`✅ Created EPC: ${epc_id}`);

    // Create inventory item
    const inventoryItem = new InventoryItem({
      tenantId: tenantId,
      name: siteName,
      category: 'epc',
      type: 'EPC Server',
      manufacturer: 'WISPTools',
      model: 'Remote EPC',
      status: 'deployed',
      serialNumber: deviceCode.toUpperCase(),
      physicalDescription: `Remote EPC device with device code ${deviceCode}`,
      location: {
        coordinates: { latitude: 0, longitude: 0 },
        address: 'Unknown Location'
      },
      metadata: {
        epc_id: epc_id,
        device_code: deviceCode.toUpperCase()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await inventoryItem.save();
    console.log(`✅ Created inventory item: ${inventoryItem._id}`);

    console.log('\n✅ Device restored successfully!');
    console.log(`   The device will appear when it checks in next (within 60 seconds)`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

restoreDevice();

