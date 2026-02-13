#!/usr/bin/env node
/**
 * Diagnostic script to check ping data collection
 * Helps identify why graphs aren't showing data
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { PingMetrics } = require('../models/ping-metrics-schema');
const { NetworkEquipment } = require('../models/network');
const { RemoteEPC } = require('../models/distributed-epc-schema');

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
      console.error('❌ MONGODB_URI not found');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function diagnosePingData() {
  await connectDB();
  
  try {
    const tenantId = process.argv[2] || process.env.TENANT_ID;
    
    if (!tenantId) {
      // List all available tenants
      console.log('📋 Available Tenants:\n');
      const tenants = await PingMetrics.distinct('tenant_id');
      if (tenants.length === 0) {
        console.log('   No tenants found in PingMetrics');
        // Try NetworkEquipment
        const { NetworkEquipment } = require('../models/network');
        const equipmentTenants = await NetworkEquipment.distinct('tenantId');
        if (equipmentTenants.length > 0) {
          console.log('\n   Tenants from NetworkEquipment:');
          equipmentTenants.forEach(t => console.log(`     - ${t}`));
          console.log('\n   Usage: node diagnose-ping-data.js <TENANT_ID>');
        } else {
          console.log('   No tenants found in NetworkEquipment either');
        }
      } else {
        tenants.forEach(t => console.log(`   - ${t}`));
        console.log('\n   Usage: node diagnose-ping-data.js <TENANT_ID>');
        console.log(`   Example: node diagnose-ping-data.js ${tenants[0]}`);
      }
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log(`🔍 Diagnosing ping data for tenant: ${tenantId}\n`);
    
    // 1. Check total ping metrics
    const totalMetrics = await PingMetrics.countDocuments({ tenant_id: tenantId });
    console.log(`📊 Total PingMetrics: ${totalMetrics}`);
    
    // 2. Check recent metrics (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMetrics = await PingMetrics.countDocuments({
      tenant_id: tenantId,
      timestamp: { $gte: oneDayAgo }
    });
    console.log(`📊 Recent metrics (last 24h): ${recentMetrics}`);
    
    // 3. Get unique device_ids from ping metrics
    const deviceIdsFromMetrics = await PingMetrics.distinct('device_id', {
      tenant_id: tenantId,
      timestamp: { $gte: oneDayAgo }
    });
    console.log(`\n📱 Device IDs in PingMetrics (last 24h): ${deviceIdsFromMetrics.length}`);
    if (deviceIdsFromMetrics.length > 0) {
      console.log(`   Sample IDs: ${deviceIdsFromMetrics.slice(0, 5).join(', ')}`);
    }
    
    // 4. Get NetworkEquipment devices with IP addresses
    const networkEquipment = await NetworkEquipment.find({
      tenantId: tenantId
    }).select('_id name notes siteId').lean();
    
    console.log(`\n📡 NetworkEquipment devices: ${networkEquipment.length}`);
    
    const devicesWithIPs = [];
    for (const device of networkEquipment) {
      let notes = {};
      try {
        notes = device.notes ? (typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes) : {};
      } catch (e) {
        // Ignore parse errors
      }
      
      const ipAddress = notes.management_ip || notes.ip_address || notes.ipAddress;
      if (ipAddress) {
        devicesWithIPs.push({
          id: device._id.toString(),
          name: device.name || 'Unknown',
          ipAddress: ipAddress,
          siteId: device.siteId ? (typeof device.siteId === 'object' ? device.siteId.toString() : device.siteId) : null
        });
      }
    }
    
    console.log(`   Devices with IP addresses: ${devicesWithIPs.length}`);
    if (devicesWithIPs.length > 0) {
      console.log(`   Sample devices:`);
      devicesWithIPs.slice(0, 5).forEach(d => {
        console.log(`     - ${d.name} (ID: ${d.id}, IP: ${d.ipAddress})`);
      });
    }
    
    // 5. Check for matching device IDs
    console.log(`\n🔗 Matching device IDs:`);
    let matchedCount = 0;
    let unmatchedCount = 0;
    
    for (const device of devicesWithIPs) {
      const deviceIdStr = device.id;
      const hasMetrics = deviceIdsFromMetrics.some(metricId => {
        return metricId === deviceIdStr || 
               metricId.toString() === deviceIdStr ||
               (mongoose.Types.ObjectId.isValid(deviceIdStr) && 
                mongoose.Types.ObjectId.isValid(metricId) &&
                metricId.toString() === deviceIdStr);
      });
      
      if (hasMetrics) {
        matchedCount++;
        const metricCount = await PingMetrics.countDocuments({
          tenant_id: tenantId,
          device_id: { $in: [deviceIdStr, new mongoose.Types.ObjectId(deviceIdStr)] },
          timestamp: { $gte: oneDayAgo }
        });
        console.log(`   ✅ ${device.name} (${device.ipAddress}): ${metricCount} metrics`);
      } else {
        unmatchedCount++;
        console.log(`   ❌ ${device.name} (${device.ipAddress}): No metrics found`);
      }
    }
    
    // 6. Check EPCs and their ping activity
    console.log(`\n📡 EPC Activity:`);
    const epcs = await RemoteEPC.find({ tenant_id: tenantId }).select('epc_id device_code site_name last_seen').lean();
    console.log(`   Total EPCs: ${epcs.length}`);
    
    for (const epc of epcs) {
      const epcMetrics = await PingMetrics.countDocuments({
        tenant_id: tenantId,
        epc_id: epc.epc_id,
        timestamp: { $gte: oneDayAgo }
      });
      const lastSeen = epc.last_seen ? new Date(epc.last_seen) : null;
      const isOnline = lastSeen && (Date.now() - lastSeen.getTime()) < 10 * 60 * 1000; // 10 minutes
      
      console.log(`   ${epc.epc_id} (${epc.device_code}): ${epcMetrics} metrics, ${isOnline ? 'ONLINE' : 'OFFLINE'}, last seen: ${lastSeen ? lastSeen.toISOString() : 'Never'}`);
    }
    
    // 7. Summary
    console.log(`\n📋 Summary:`);
    console.log(`   Total metrics: ${totalMetrics}`);
    console.log(`   Recent metrics (24h): ${recentMetrics}`);
    console.log(`   Devices with IPs: ${devicesWithIPs.length}`);
    console.log(`   Devices with metrics: ${matchedCount}`);
    console.log(`   Devices without metrics: ${unmatchedCount}`);
    
    if (recentMetrics === 0) {
      console.log(`\n⚠️  WARNING: No recent ping metrics found!`);
      console.log(`   - Check if EPC agents are running`);
      console.log(`   - Check if ping monitor script is executing`);
      console.log(`   - Check EPC logs for errors`);
    }
    
    if (unmatchedCount > 0) {
      console.log(`\n⚠️  WARNING: ${unmatchedCount} devices have IPs but no metrics!`);
      console.log(`   - Verify device IDs match between NetworkEquipment and PingMetrics`);
      console.log(`   - Check if devices are in the monitoring list on EPC`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB\n');
  }
}

diagnosePingData();

