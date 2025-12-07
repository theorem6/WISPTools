#!/usr/bin/env node
/**
 * Diagnostic script to check graph data issues
 */

const mongoose = require('mongoose');
const path = require('path');

async function diagnose() {
  try {
    // Load environment variables from .env file if it exists
    const envPath = path.join(__dirname, '.env');
    try {
      require('fs').readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
          process.env[match[1].trim()] = match[2].trim();
        }
      });
    } catch (e) {
      // .env file doesn't exist, use defaults
    }
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lte-pci-mapper';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected!\n');

    // Check PingMetrics collection
    const PingMetrics = mongoose.model('PingMetrics', new mongoose.Schema({}, { strict: false }), 'pingmetrics');
    
    const totalPingMetrics = await PingMetrics.countDocuments();
    console.log(`Total PingMetrics documents: ${totalPingMetrics}`);
    
    if (totalPingMetrics > 0) {
      // Get sample device_ids
      const deviceIds = await PingMetrics.distinct('device_id');
      console.log(`\nUnique device_ids in PingMetrics: ${deviceIds.length}`);
      console.log('Sample device_ids:', deviceIds.slice(0, 10));
      
      // Get recent metrics
      const recentMetrics = await PingMetrics.find().sort({ timestamp: -1 }).limit(5).lean();
      console.log('\nRecent metrics sample:');
      recentMetrics.forEach((m, i) => {
        console.log(`  ${i + 1}. device_id: "${m.device_id}", tenant_id: "${m.tenant_id}", timestamp: ${m.timestamp}, success: ${m.success}`);
      });
      
      // Count by tenant
      const tenantCounts = await PingMetrics.aggregate([
        { $group: { _id: '$tenant_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      console.log('\nMetrics by tenant:');
      tenantCounts.forEach(t => {
        console.log(`  Tenant ${t._id}: ${t.count} metrics`);
      });
    } else {
      console.log('⚠️  No PingMetrics found in database!');
    }
    
    // Check SNMPMetrics collection
    const SNMPMetrics = mongoose.model('SNMPMetrics', new mongoose.Schema({}, { strict: false }), 'snmpmetrics');
    const totalSNMPMetrics = await SNMPMetrics.countDocuments();
    console.log(`\nTotal SNMPMetrics documents: ${totalSNMPMetrics}`);
    
    if (totalSNMPMetrics > 0) {
      const snmpDeviceIds = await SNMPMetrics.distinct('device_id');
      console.log(`Unique device_ids in SNMPMetrics: ${snmpDeviceIds.length}`);
      console.log('Sample device_ids:', snmpDeviceIds.slice(0, 10));
    }
    
    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

diagnose();

