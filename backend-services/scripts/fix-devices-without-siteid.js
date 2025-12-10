/**
 * Fix Devices Without siteId
 * 
 * This script:
 * 1. Finds all NetworkEquipment devices without a siteId
 * 2. Attempts to assign siteId based on:
 *    - EPC that discovered them (via discovered_by_epc in notes)
 *    - Nearest site by location (if device has coordinates)
 * 3. Deletes devices that cannot be assigned a siteId and are invalid/duplicate
 */

const mongoose = require('mongoose');
const { NetworkEquipment, UnifiedSite } = require('../models/network');
const { RemoteEPC } = require('../models/distributed-epc-schema');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wisptools';

// Distance calculation (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function fixDevicesWithoutSiteId() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all NetworkEquipment without siteId
    const devicesWithoutSiteId = await NetworkEquipment.find({
      $or: [
        { siteId: { $exists: false } },
        { siteId: null },
        { siteId: '' }
      ]
    }).lean();

    console.log(`\n📡 Found ${devicesWithoutSiteId.length} NetworkEquipment devices without siteId`);

    // Get all EPCs to map discovered_by_epc to siteId
    const allEPCs = await RemoteEPC.find({}).lean();
    console.log(`📡 Found ${allEPCs.length} EPCs to check for site associations`);

    // Build EPC to siteId map
    const epcToSiteMap = new Map();
    for (const epc of allEPCs) {
      if (epc.site_id) {
        // Try to find site by ID or name
        let siteId = null;
        try {
          if (mongoose.Types.ObjectId.isValid(epc.site_id)) {
            const site = await UnifiedSite.findOne({ 
              _id: new mongoose.Types.ObjectId(epc.site_id),
              tenantId: epc.tenant_id 
            }).lean();
            if (site) {
              siteId = site._id;
            }
          }
          
          if (!siteId && epc.site_name) {
            const site = await UnifiedSite.findOne({ 
              name: epc.site_name,
              tenantId: epc.tenant_id 
            }).lean();
            if (site) {
              siteId = site._id;
            }
          }
        } catch (e) {
          console.warn(`⚠️ Error looking up site for EPC ${epc.epc_id}:`, e.message);
        }
        
        if (siteId) {
          epcToSiteMap.set(epc.epc_id, { siteId, tenantId: epc.tenant_id });
          console.log(`  ✅ Mapped EPC ${epc.epc_id} to site ${siteId}`);
        }
      }
    }

    let fixedCount = 0;
    let deletedCount = 0;
    let skippedCount = 0;

    for (const device of devicesWithoutSiteId) {
      let assignedSiteId = null;
      let assignmentMethod = null;

      // Method 1: Try to get siteId from EPC that discovered it
      if (device.notes) {
        try {
          const notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
          const discoveredByEPC = notes.discovered_by_epc;
          
          if (discoveredByEPC && epcToSiteMap.has(discoveredByEPC)) {
            const epcInfo = epcToSiteMap.get(discoveredByEPC);
            // Only assign if tenant matches
            if (epcInfo.tenantId === device.tenantId) {
              assignedSiteId = epcInfo.siteId;
              assignmentMethod = 'EPC discovery';
            }
          }
        } catch (e) {
          // Notes parsing failed, continue
        }
      }

      // Method 2: Find nearest site by location (if device has coordinates)
      if (!assignedSiteId) {
        const deviceLat = device.location?.latitude || device.location?.coordinates?.latitude;
        const deviceLon = device.location?.longitude || device.location?.coordinates?.longitude;

        if (deviceLat && deviceLon && deviceLat !== 0 && deviceLon !== 0) {
          // Get all sites for this tenant
          const sites = await UnifiedSite.find({ tenantId: device.tenantId }).lean();
          
          let nearestSite = null;
          let minDistance = Infinity;

          for (const site of sites) {
            const siteLat = site.location?.latitude || site.location?.coordinates?.latitude;
            const siteLon = site.location?.longitude || site.location?.coordinates?.longitude;

            if (!siteLat || !siteLon) continue;

            const distance = getDistance(deviceLat, deviceLon, siteLat, siteLon);

            // Only consider sites within 10km (10000 meters) - more lenient than 5km
            if (distance < 10000 && distance < minDistance) {
              minDistance = distance;
              nearestSite = site;
            }
          }

          if (nearestSite) {
            assignedSiteId = nearestSite._id;
            assignmentMethod = `Nearest site (${Math.round(minDistance)}m)`;
          }
        }
      }

      // If we found a siteId, assign it
      if (assignedSiteId) {
        await NetworkEquipment.updateOne(
          { _id: device._id },
          { $set: { siteId: assignedSiteId } }
        );
        fixedCount++;
        console.log(`  ✅ Fixed device ${device.name || device._id} (${device.serialNumber || 'no serial'}) - assigned siteId ${assignedSiteId} via ${assignmentMethod}`);
      } else {
        // Check if device is invalid/duplicate and should be deleted
        const deviceName = device.name || '';
        const isFakeDevice = /fake|test|demo|sample|mock|customer.*cpe|customer.*lte/i.test(deviceName);
        const hasNoIP = !device.notes || (typeof device.notes === 'string' && !device.notes.includes('management_ip') && !device.notes.includes('ip_address'));
        
        // Check for duplicate devices (same IP or serial)
        let isDuplicate = false;
        if (device.serialNumber) {
          const duplicates = await NetworkEquipment.countDocuments({
            _id: { $ne: device._id },
            tenantId: device.tenantId,
            serialNumber: device.serialNumber,
            siteId: { $exists: true, $ne: null }
          });
          if (duplicates > 0) {
            isDuplicate = true;
          }
        }

        if (isFakeDevice || (hasNoIP && isDuplicate)) {
          await NetworkEquipment.deleteOne({ _id: device._id });
          deletedCount++;
          console.log(`  🗑️  Deleted device ${device.name || device._id} - ${isFakeDevice ? 'fake/test device' : 'duplicate without IP'}`);
        } else {
          skippedCount++;
          console.log(`  ⚠️  Skipped device ${device.name || device._id} (${device.serialNumber || 'no serial'}) - no siteId assignment method found and not marked for deletion`);
        }
      }
    }

    console.log(`\n✅ Summary:`);
    console.log(`   Fixed: ${fixedCount} devices assigned siteId`);
    console.log(`   Deleted: ${deletedCount} invalid/duplicate devices`);
    console.log(`   Skipped: ${skippedCount} devices (could not assign siteId, but not invalid)`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixDevicesWithoutSiteId().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { fixDevicesWithoutSiteId };

