#!/usr/bin/env node

/**
 * Script to delete ACS/TR-069 devices from GenieACS MongoDB for a specific tenant
 * This deletes devices that have fake/test data or were created during discovery
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Tenant ID for Peterson Consulting
const TENANT_ID = '690abdc14a6f067977986db3';
const TENANT_NAME = 'Peterson Consulting';

// GenieACS typically uses a database named "genieacs" or similar
// The MongoDB URI might point to the same cluster but different database
const GENIEACS_DB_NAME = process.env.GENIEACS_DB_NAME || 'genieacs';

let client = null;

async function connectGenieACSDB() {
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
    
    // Parse the URI to change the database name
    const uriObj = new URL(mongoUri);
    uriObj.pathname = `/${GENIEACS_DB_NAME}`;
    const genieacsUri = uriObj.toString();
    
    console.log(`📡 Connecting to GenieACS database: ${GENIEACS_DB_NAME}...`);
    client = new MongoClient(genieacsUri);
    await client.connect();
    console.log('✅ Connected to GenieACS MongoDB');
    return client.db(GENIEACS_DB_NAME);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function deleteTenantACSDevices(tenantId) {
  if (!tenantId) {
    console.error('❌ Tenant ID is required');
    process.exit(1);
  }

  const db = await connectGenieACSDB();

  try {
    console.log(`\n🔍 Starting ACS device cleanup for tenant: ${tenantId} (${TENANT_NAME})\n`);
    console.log('⚠️  WARNING: This will delete ALL ACS/TR-069 devices for this tenant!\n');

    // Get the devices collection from GenieACS
    const devicesCollection = db.collection('devices');
    
    // Count devices for this tenant
    // GenieACS devices may have _tenantId or tenantId field
    const query = {
      $or: [
        { _tenantId: tenantId },
        { tenantId: tenantId }
      ]
    };
    
    const deviceCount = await devicesCollection.countDocuments(query);
    console.log(`📊 Found ${deviceCount} ACS/TR-069 devices for tenant ${tenantId}\n`);

    if (deviceCount === 0) {
      console.log('✅ No ACS devices found for this tenant - already clean!');
      await mongoose.disconnect();
      return;
    }

    // Show some sample devices before deletion
    console.log('📋 Sample devices to be deleted:');
    const sampleDevices = await devicesCollection.find(query).limit(5).toArray();
    sampleDevices.forEach((device, index) => {
      console.log(`  ${index + 1}. Device ID: ${device._id}`);
      console.log(`     Manufacturer: ${device.manufacturer || device._deviceId?.Manufacturer || 'Unknown'}`);
      console.log(`     Model: ${device._deviceId?.ModelName || 'Unknown'}`);
      console.log(`     Serial: ${device._deviceId?.SerialNumber || 'Unknown'}`);
      console.log(`     Last Inform: ${device._lastInform ? new Date(device._lastInform).toISOString() : 'Never'}`);
      console.log('');
    });

    if (deviceCount > 5) {
      console.log(`     ... and ${deviceCount - 5} more devices\n`);
    }

    // Confirm deletion
    console.log('🗑️  Deleting devices...\n');
    
    // Delete devices
    const deleteResult = await devicesCollection.deleteMany(query);
    
    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} ACS/TR-069 devices\n`);

    // Also check and delete related tasks, presets, and files if they exist
    const tasksCollection = db.collection('tasks');
    const presetsCollection = db.collection('presets');
    const filesCollection = db.collection('files');
    
    // Delete tasks for these devices
    const deviceIds = sampleDevices.map(d => d._id);
    if (deviceIds.length > 0) {
      const taskQuery = { device: { $in: deviceIds } };
      const taskCount = await tasksCollection.countDocuments(taskQuery);
      if (taskCount > 0) {
        const taskResult = await tasksCollection.deleteMany(taskQuery);
        console.log(`✅ Deleted ${taskResult.deletedCount} related tasks`);
      }
    }

    // Verify deletion
    const remainingDevices = await devicesCollection.countDocuments(query);
    if (remainingDevices > 0) {
      console.log(`⚠️  Warning: ${remainingDevices} devices still remain for this tenant`);
    } else {
      console.log('✅ Verified: All ACS devices deleted successfully');
    }

    console.log('\n📊 Deletion summary:');
    console.log(`  - ACS/TR-069 Devices: ${deleteResult.deletedCount}`);
    console.log(`  - Related Tasks: ${taskCount || 0}\n`);

  } catch (error) {
    console.error('❌ Error during deletion:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('✅ Disconnected from MongoDB');
    }
  }
}

// Run the cleanup
deleteTenantACSDevices(TENANT_ID).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
