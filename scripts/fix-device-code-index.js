// Fix device_code index to be sparse and clean up null values
// This script drops the existing index and recreates it as sparse

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Try multiple .env file locations
const envPaths = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
  '/opt/lte-pci-mapper/backend-services/.env',
  '/opt/lte-pci-mapper/.env'
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    envLoaded = true;
    console.log(`Loaded .env from: ${envPath}`);
    break;
  }
}

if (!envLoaded) {
  console.warn('Warning: No .env file found, using environment variables from system');
}

// Load config the same way server.js does
const appConfig = require('../config/app');
const { RemoteEPC } = require('../models/distributed-epc-schema');

async function fixIndex() {
  try {
    // Use the same MongoDB URI loading logic as server.js
    const mongoUri = appConfig.mongodb.uri || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Error: MONGODB_URI not found in config or environment variables');
      process.exit(1);
    }
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    
    const collection = mongoose.connection.db.collection('remoteepcs');
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Drop the existing device_code index if it exists
    try {
      await collection.dropIndex('device_code_1');
      console.log('✅ Dropped existing device_code_1 index');
    } catch (err) {
      if (err.code === 27 || err.message.includes('index not found')) {
        console.log('ℹ️  device_code_1 index does not exist, skipping drop');
      } else {
        throw err;
      }
    }
    
    // Remove device_code: null from all existing records
    const nullResult = await collection.updateMany(
      { device_code: null },
      { $unset: { device_code: '' } }
    );
    console.log(`✅ Removed device_code field from ${nullResult.modifiedCount} records where it was null`);
    
    // Create a new sparse unique index on device_code
    await collection.createIndex(
      { device_code: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'device_code_1'
      }
    );
    console.log('✅ Created sparse unique index on device_code');
    
    // Also fix hardware_id if needed
    const hardwareNullResult = await collection.updateMany(
      { hardware_id: null },
      { $unset: { hardware_id: '' } }
    );
    console.log(`✅ Removed hardware_id field from ${hardwareNullResult.modifiedCount} records where it was null`);
    
    console.log('✅ Index fix complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixIndex();

