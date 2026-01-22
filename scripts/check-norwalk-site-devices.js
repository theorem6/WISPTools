#!/usr/bin/env node

/**
 * Diagnostic script to check devices deployed at Norwalk sites
 * Helps identify why sites are showing blue instead of uptime status
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { UnifiedSite } = require('../models/network');
const { NetworkEquipment } = require('../models/network');
const { HardwareDeployment } = require('../models/network');
const { InventoryItem } = require('../models/inventory');

async function connectDB() {
  try {
    let mongoUri;
    try {
      const appConfig = require('../config/app');
      mongoUri = appConfig.mongodb.uri || process.env.MONGODB_URI;
    } catch (e) {
      mongoUri = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';
    }
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in config or environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function checkNorwalkSites(tenantId) {
  if (!tenantId) {
    console.error('❌ Tenant ID is required');
    console.log('Usage: node check-norwalk-site-devices.js <tenantId>');
    process.exit(1);
  }

  await connectDB();

  try {
    console.log(`🔍 Checking Norwalk sites for tenant: ${tenantId}\n`);

    // Find sites in Norwalk
    const norwalkSites = await UnifiedSite.find({
      tenantId: tenantId,
      $or: [
        { 'location.city': /norwalk/i },
        { 'location.address': /norwalk/i },
        { name: /norwalk/i }
      ]
    }).lean();

    if (norwalkSites.length === 0) {
      console.log('⚠️  No Norwalk sites found');
      await mongoose.disconnect();
      return;
    }

    console.log(`📋 Found ${norwalkSites.length} Norwalk site(s):\n`);

    for (const site of norwalkSites) {
      console.log(`📍 Site: ${site.name}`);
      console.log(`   ID: ${site._id}`);
      console.log(`   Location: ${site.location?.address || 'N/A'}\n`);

      // Check network equipment at this site
      const networkEquipment = await NetworkEquipment.find({
        tenantId: tenantId,
        $or: [
          { siteId: site._id.toString() },
          { siteId: site._id }
        ]
      }).lean();

      console.log(`   📡 Network Equipment: ${networkEquipment.length} device(s)`);
      networkEquipment.forEach((device, idx) => {
        console.log(`      ${idx + 1}. ${device.name || 'Unnamed'} (${device._id})`);
        console.log(`         Status: ${device.status || 'unknown'}`);
        console.log(`         SiteId: ${device.siteId}`);
        if (device.notes) {
          try {
            const notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
            if (notes.management_ip) {
              console.log(`         IP: ${notes.management_ip}`);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });
      console.log();

      // Check hardware deployments at this site
      const hardwareDeployments = await HardwareDeployment.find({
        tenantId: tenantId,
        siteId: site._id
      }).lean();

      console.log(`   🔧 Hardware Deployments: ${hardwareDeployments.length} deployment(s)`);
      hardwareDeployments.forEach((deployment, idx) => {
        console.log(`      ${idx + 1}. ${deployment.name} (${deployment.hardware_type})`);
        console.log(`         Status: ${deployment.status || 'unknown'}`);
        if (deployment.inventory_item_id) {
          console.log(`         Inventory ID: ${deployment.inventory_item_id}`);
        }
      });
      console.log();

      // Check inventory items at this site
      const inventoryItems = await InventoryItem.find({
        tenantId: tenantId,
        'currentLocation.siteId': site._id.toString()
      }).lean();

      console.log(`   📦 Inventory Items: ${inventoryItems.length} item(s)`);
      inventoryItems.forEach((item, idx) => {
        console.log(`      ${idx + 1}. ${item.assetTag || item.equipmentType || 'Unnamed'} (${item._id})`);
        console.log(`         Status: ${item.status || 'unknown'}`);
        console.log(`         Location SiteId: ${item.currentLocation?.siteId}`);
        if (item.ipAddress || item.technicalSpecs?.ipAddress) {
          console.log(`         IP: ${item.ipAddress || item.technicalSpecs?.ipAddress}`);
        }
      });
      console.log();

      console.log('   ────────────────────────────────────────────────────\n');
    }

  } catch (error) {
    console.error('❌ Error checking Norwalk sites:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Get tenant ID from command line argument
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('❌ Tenant ID is required');
  console.log('\nUsage: node check-norwalk-site-devices.js <tenantId>');
  console.log('\nExample: node check-norwalk-site-devices.js tenant-123');
  process.exit(1);
}

checkNorwalkSites(tenantId).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

