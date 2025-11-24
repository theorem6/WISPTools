// Cleanup script to remove device_code: null from existing records
// This fixes the MongoDB unique index error for sparse indexes

const mongoose = require('mongoose');
require('dotenv').config();
const { RemoteEPC } = require('../models/distributed-epc-schema');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
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

