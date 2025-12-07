#!/usr/bin/env node

/**
 * Script to delete fake/test New York sites from the database
 * These sites were created by create-test-network-devices.js for testing
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '../../.env' });

const { UnifiedSite } = require('../models/network');

// New York coordinates from test script
const FAKE_NY_COORDINATES = [
  { lat: 40.7128, lon: -74.0060 }, // Main Tower Site
  { lat: 40.7589, lon: -73.9851 }, // Secondary Tower
  { lat: 40.7505, lon: -73.9934 }, // NOC Facility
  { lat: 40.7282, lon: -73.9942 }, // Customer Site A
  { lat: 40.7614, lon: -73.9776 }  // Customer Site B
];

const FAKE_SITE_NAMES = [
  'Main Tower Site',
  'Secondary Tower',
  'NOC Facility',
  'Customer Site A',
  'Customer Site B'
];

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wisptools';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function deleteFakeSites(tenantId) {
  if (!tenantId) {
    console.error('❌ Tenant ID is required');
    console.log('Usage: node delete-fake-new-york-sites.js <tenantId>');
    process.exit(1);
  }

  await connectDB();

  try {
    console.log(`\n🔍 Searching for fake New York sites for tenant: ${tenantId}\n`);

    // Find sites matching fake coordinates or names
    const fakeSites = await UnifiedSite.find({
      tenantId: tenantId,
      $or: [
        // Match by coordinates (within 0.001 degree tolerance)
        ...FAKE_NY_COORDINATES.map(coords => ({
          'location.latitude': { $gte: coords.lat - 0.001, $lte: coords.lat + 0.001 },
          'location.longitude': { $gte: coords.lon - 0.001, $lte: coords.lon + 0.001 }
        })),
        // Match by name
        { name: { $in: FAKE_SITE_NAMES } },
        // Match by address containing "New York"
        { 'location.address': /New York/i }
      ]
    }).lean();

    if (fakeSites.length === 0) {
      console.log('✅ No fake New York sites found');
      await mongoose.disconnect();
      return;
    }

    console.log(`📋 Found ${fakeSites.length} fake site(s) to delete:\n`);
    fakeSites.forEach((site, idx) => {
      console.log(`  ${idx + 1}. ${site.name}`);
      console.log(`     Location: ${site.location?.latitude}, ${site.location?.longitude}`);
      console.log(`     Address: ${site.location?.address || 'N/A'}\n`);
    });

    // Delete all fake sites
    const siteIds = fakeSites.map(s => s._id);
    const result = await UnifiedSite.deleteMany({ _id: { $in: siteIds }, tenantId: tenantId });

    console.log(`✅ Deleted ${result.deletedCount} fake site(s)\n`);

  } catch (error) {
    console.error('❌ Error deleting fake sites:', error);
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
  console.log('\nUsage: node delete-fake-new-york-sites.js <tenantId>');
  console.log('\nExample: node delete-fake-new-york-sites.js tenant-123');
  process.exit(1);
}

deleteFakeSites(tenantId).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

