#!/usr/bin/env node
/**
 * Cleanup script to remove fake/demo data from the database
 */

const mongoose = require('mongoose');
const { HardwareDeployment } = require('../models/network');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

async function cleanup() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!');

    // Delete fake CPE deployment records
    const fakeDeployments = await HardwareDeployment.deleteMany({
      hardware_type: 'epc',
      $or: [
        { name: /Customer.*CPE/i },
        { name: /fake/i },
        { name: /demo/i },
        { name: /test/i }
      ]
    });
    console.log(`Deleted ${fakeDeployments.deletedCount} fake hardware deployments`);

    // List remaining hardware deployments
    const remaining = await HardwareDeployment.find({ hardware_type: 'epc' }).lean();
    console.log(`Remaining EPC hardware deployments: ${remaining.length}`);
    remaining.forEach(d => console.log(`  - ${d.name} (${d._id})`));

    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
}

cleanup();
