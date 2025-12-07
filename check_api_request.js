#!/usr/bin/env node
/**
 * Check what the API is actually returning for a specific device/time range
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { PingMetrics } = require('./models/ping-metrics-schema');
const dbConfig = require('./config/database');

async function check() {
  try {
    await dbConfig.connectDatabase();
    console.log('✅ Connected\n');

    const tenantId = '690abdc14a6f067977986db3';
    const deviceId = '692a454a9d46763f2a45b11e'; // UBNT EdgeSwitch
    
    // Test with 7 days (168 hours) - what frontend should be sending
    const hours = 168;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    console.log(`Testing query:`);
    console.log(`  device_id: "${deviceId}"`);
    console.log(`  tenant_id: "${tenantId}"`);
    console.log(`  hours: ${hours} (7 days)`);
    console.log(`  startTime: ${startTime.toISOString()}`);
    console.log(`  currentTime: ${new Date().toISOString()}\n`);

    const metrics = await PingMetrics.find({
      device_id: deviceId,
      tenant_id: tenantId,
      timestamp: { $gte: startTime }
    })
    .sort({ timestamp: 1 })
    .lean();

    console.log(`Results: ${metrics.length} metrics found\n`);
    
    if (metrics.length > 0) {
      console.log(`First metric: ${metrics[0].timestamp}`);
      console.log(`Last metric: ${metrics[metrics.length - 1].timestamp}`);
      
      // Check if labels array would be created
      const labels = metrics.map(m => new Date(m.timestamp).toISOString());
      console.log(`\nLabels array length: ${labels.length}`);
      console.log(`First 3 labels:`, labels.slice(0, 3));
    } else {
      console.log('❌ NO METRICS FOUND!');
      
      // Check if metrics exist at all for this device
      const anyMetrics = await PingMetrics.findOne({
        device_id: deviceId,
        tenant_id: tenantId
      }).lean();
      
      if (anyMetrics) {
        const ageHours = (Date.now() - anyMetrics.timestamp.getTime()) / (1000 * 60 * 60);
        console.log(`\nBut metrics DO exist - most recent is ${ageHours.toFixed(2)} hours old`);
        console.log(`Last metric timestamp: ${anyMetrics.timestamp}`);
        console.log(`Query startTime: ${startTime}`);
        console.log(`Is metric within range? ${anyMetrics.timestamp >= startTime}`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();

