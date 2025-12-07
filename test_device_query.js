#!/usr/bin/env node
/**
 * Test query for specific device to see why graphs show no data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { PingMetrics } = require('./models/ping-metrics-schema');
const dbConfig = require('./config/database');

async function testDevice() {
  try {
    await dbConfig.connectDatabase();
    console.log('✅ Connected to MongoDB\n');

    const tenantId = '690abdc14a6f067977986db3';
    const deviceId = '692a454a9d46763f2a45b11e'; // UBNT EdgeSwitch
    
    console.log(`Testing device: ${deviceId} (UBNT EdgeSwitch)`);
    console.log(`Tenant: ${tenantId}\n`);

    // Test 1: Check all metrics for this device (no time filter)
    const allMetrics = await PingMetrics.countDocuments({
      device_id: deviceId,
      tenant_id: tenantId
    });
    console.log(`1. Total metrics for device (all time): ${allMetrics}`);

    // Test 2: Check recent metrics (last 24 hours)
    const hours = 24;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMetrics = await PingMetrics.countDocuments({
      device_id: deviceId,
      tenant_id: tenantId,
      timestamp: { $gte: startTime }
    });
    console.log(`2. Metrics in last ${hours} hours: ${recentMetrics}`);

    // Test 3: Check if device_id is stored as ObjectId vs String
    const sampleMetric = await PingMetrics.findOne({
      device_id: deviceId,
      tenant_id: tenantId
    }).lean();
    
    if (sampleMetric) {
      console.log(`\n3. Sample metric found:`);
      console.log(`   device_id type: ${typeof sampleMetric.device_id}`);
      console.log(`   device_id value: "${sampleMetric.device_id}"`);
      console.log(`   Query device_id: "${deviceId}"`);
      console.log(`   Match: ${sampleMetric.device_id === deviceId}`);
      console.log(`   timestamp: ${sampleMetric.timestamp}`);
      console.log(`   is recent (last 24h): ${sampleMetric.timestamp >= startTime}`);
    }

    // Test 4: Check with different time ranges
    console.log(`\n4. Metrics by time range:`);
    const ranges = [1, 6, 12, 24, 48, 168]; // hours
    for (const h of ranges) {
      const rangeStart = new Date(Date.now() - h * 60 * 60 * 1000);
      const count = await PingMetrics.countDocuments({
        device_id: deviceId,
        tenant_id: tenantId,
        timestamp: { $gte: rangeStart }
      });
      console.log(`   Last ${h} hours: ${count} metrics`);
    }

    // Test 5: Get actual metrics for last 24 hours
    const metrics24h = await PingMetrics.find({
      device_id: deviceId,
      tenant_id: tenantId,
      timestamp: { $gte: startTime }
    })
    .sort({ timestamp: 1 })
    .limit(10)
    .lean();
    
    console.log(`\n5. Sample metrics (last 24h, first 10):`);
    if (metrics24h.length > 0) {
      metrics24h.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.timestamp} - success: ${m.success} - ip: ${m.ip_address}`);
      });
    } else {
      console.log('   No metrics in last 24 hours!');
    }

    // Test 6: Check most recent metric regardless of time
    const mostRecent = await PingMetrics.findOne({
      device_id: deviceId,
      tenant_id: tenantId
    })
    .sort({ timestamp: -1 })
    .lean();
    
    if (mostRecent) {
      const ageHours = (Date.now() - mostRecent.timestamp.getTime()) / (1000 * 60 * 60);
      console.log(`\n6. Most recent metric:`);
      console.log(`   Age: ${ageHours.toFixed(2)} hours ago`);
      console.log(`   Timestamp: ${mostRecent.timestamp}`);
      console.log(`   Success: ${mostRecent.success}`);
      console.log(`   IP: ${mostRecent.ip_address}`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Test complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testDevice();

