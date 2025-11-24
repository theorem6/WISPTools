// Cleanup script to remove device_code: null from existing records
// This fixes the MongoDB unique index error for sparse indexes

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

const { RemoteEPC } = require('../models/distributed-epc-schema');

async function cleanup() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Error: MONGODB_URI not found in environment variables');
      console.error('Tried .env paths:', envPaths);
      process.exit(1);
    }
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    
    // Remove device_code field from records where it's null
    const result = await RemoteEPC.updateMany(
      { device_code: null },
      { $unset: { device_code: '' } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} records (removed device_code: null)`);
    
    // Also remove hardware_id: null for consistency
    const hardwareResult = await RemoteEPC.updateMany(
      { hardware_id: null },
      { $unset: { hardware_id: '' } }
    );
    
    console.log(`✅ Updated ${hardwareResult.modifiedCount} records (removed hardware_id: null)`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanup();

