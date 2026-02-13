/**
 * Script to assign siteId to devices that don't have one
 * Matches devices to the nearest site based on location coordinates
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { UnifiedSite, NetworkEquipment, UnifiedCPE } = require('../models/network');

// Calculate distance between two coordinates using Haversine formula
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

async function connectDB() {
  try {
    let mongoUri;
    try {
      const appConfig = require('../config/app');
      mongoUri = appConfig.mongodb.uri || process.env.MONGODB_URI;
    } catch (e) {
      mongoUri = process.env.MONGODB_URI || '';
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

async function assignSiteIds() {
  try {
    await connectDB();

    // Get all sites
    const sites = await UnifiedSite.find({
      location: {
        $exists: true,
        $ne: null
      },
      'location.latitude': { $exists: true, $ne: null },
      'location.longitude': { $exists: true, $ne: null }
    }).lean();

    console.log(`📍 Found ${sites.length} sites with valid locations`);

    if (sites.length === 0) {
      console.log('⚠️  No sites found with valid locations. Cannot assign siteIds.');
      await mongoose.disconnect();
      return;
    }

    // Process NetworkEquipment - find devices without valid siteId
    const allEquipment = await NetworkEquipment.find({
      location: {
        $exists: true,
        $ne: null
      },
      'location.latitude': { $exists: true, $ne: null, $ne: 0 },
      'location.longitude': { $exists: true, $ne: null, $ne: 0 }
    }).lean();
    
    // Filter to only devices without valid siteId
    const equipmentWithoutSiteId = allEquipment.filter(device => {
      const siteId = device.siteId;
      return !siteId || siteId === '' || siteId === null || (typeof siteId === 'string' && siteId.trim() === '');
    });

    console.log(`\n📡 Found ${equipmentWithoutSiteId.length} NetworkEquipment devices without siteId`);

    let equipmentUpdated = 0;
    for (const device of equipmentWithoutSiteId) {
      const deviceLat = device.location?.latitude || device.location?.coordinates?.latitude;
      const deviceLon = device.location?.longitude || device.location?.coordinates?.longitude;

      if (!deviceLat || !deviceLon || deviceLat === 0 || deviceLon === 0) {
        continue;
      }

      // Find nearest site
      let nearestSite = null;
      let minDistance = Infinity;

      for (const site of sites) {
        const siteLat = site.location?.latitude;
        const siteLon = site.location?.longitude;

        if (!siteLat || !siteLon) continue;

        const distance = getDistance(deviceLat, deviceLon, siteLat, siteLon);

        // Only consider sites within 5km (5000 meters)
        if (distance < 5000 && distance < minDistance) {
          minDistance = distance;
          nearestSite = site;
        }
      }

      if (nearestSite) {
        await NetworkEquipment.updateOne(
          { _id: device._id },
          { $set: { siteId: nearestSite._id } }
        );
        equipmentUpdated++;
        console.log(`  ✅ Assigned siteId ${nearestSite._id} (${nearestSite.name}) to device ${device.name || device._id} (distance: ${Math.round(minDistance)}m)`);
      } else {
        console.log(`  ⚠️  No site within 5km for device ${device.name || device._id} at (${deviceLat}, ${deviceLon})`);
      }
    }

    // Process UnifiedCPE - find devices without valid siteId
    const allCPE = await UnifiedCPE.find({
      location: {
        $exists: true,
        $ne: null
      },
      'location.latitude': { $exists: true, $ne: null, $ne: 0 },
      'location.longitude': { $exists: true, $ne: null, $ne: 0 }
    }).lean();
    
    // Filter to only devices without valid siteId
    const cpeWithoutSiteId = allCPE.filter(device => {
      const siteId = device.siteId;
      return !siteId || siteId === '' || siteId === null || (typeof siteId === 'string' && siteId.trim() === '');
    });

    console.log(`\n📱 Found ${cpeWithoutSiteId.length} UnifiedCPE devices without siteId`);

    let cpeUpdated = 0;
    for (const device of cpeWithoutSiteId) {
      const deviceLat = device.location?.latitude || device.location?.coordinates?.latitude;
      const deviceLon = device.location?.longitude || device.location?.coordinates?.longitude;

      if (!deviceLat || !deviceLon || deviceLat === 0 || deviceLon === 0) {
        continue;
      }

      // Find nearest site
      let nearestSite = null;
      let minDistance = Infinity;

      for (const site of sites) {
        const siteLat = site.location?.latitude;
        const siteLon = site.location?.longitude;

        if (!siteLat || !siteLon) continue;

        const distance = getDistance(deviceLat, deviceLon, siteLat, siteLon);

        // Only consider sites within 5km (5000 meters)
        if (distance < 5000 && distance < minDistance) {
          minDistance = distance;
          nearestSite = site;
        }
      }

      if (nearestSite) {
        await UnifiedCPE.updateOne(
          { _id: device._id },
          { $set: { siteId: nearestSite._id } }
        );
        cpeUpdated++;
        console.log(`  ✅ Assigned siteId ${nearestSite._id} (${nearestSite.name}) to CPE ${device.name || device._id} (distance: ${Math.round(minDistance)}m)`);
      } else {
        console.log(`  ⚠️  No site within 5km for CPE ${device.name || device._id} at (${deviceLat}, ${deviceLon})`);
      }
    }

    console.log(`\n✅ Summary:`);
    console.log(`   NetworkEquipment: ${equipmentUpdated} devices updated`);
    console.log(`   UnifiedCPE: ${cpeUpdated} devices updated`);
    console.log(`   Total: ${equipmentUpdated + cpeUpdated} devices assigned siteId`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
assignSiteIds();

