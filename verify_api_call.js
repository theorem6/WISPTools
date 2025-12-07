#!/usr/bin/env node
/**
 * Simulate the exact API call the frontend is making
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { PingMetrics } = require('./models/ping-metrics-schema');
const dbConfig = require('./config/database');

async function verify() {
  try {
    await dbConfig.connectDatabase();
    
    // Exact values from frontend console
    const tenantId = '690abdc14a6f067977986db3';
    const deviceIds = [
      '692a454a9d46763f2a45b11e', // UBNT EdgeSwitch
      '692a454a9d46763f2a45b12a', // generic
      '692a454a9d46763f2a45b1be', // MikroTik
      '692a454a9d46763f2a45b1c2'  // BRW30C9AB0B71AE
    ];
    
    console.log('Testing all 4 devices with 168 hours (7 days):\n');
    
    for (const deviceId of deviceIds) {
      const hours = 168;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const metrics = await PingMetrics.find({
        device_id: deviceId,
        tenant_id: tenantId,
        timestamp: { $gte: startTime }
      })
      .sort({ timestamp: 1 })
      .lean();
      
      const labels = metrics.length > 0 
        ? metrics.map(m => new Date(m.timestamp).toISOString())
        : [];
      
      console.log(`Device: ${deviceId}`);
      console.log(`  Metrics found: ${metrics.length}`);
      console.log(`  Labels count: ${labels.length}`);
      if (metrics.length > 0) {
        console.log(`  First metric: ${metrics[0].timestamp}`);
        console.log(`  Last metric: ${metrics[metrics.length - 1].timestamp}`);
      }
      console.log('');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verify();

