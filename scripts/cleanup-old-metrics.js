#!/usr/bin/env node

/**
 * Script to clean up old metrics data from MongoDB
 * Reduces retention period to free up space on free tier
 * 
 * Usage: node cleanup-old-metrics.js [days] [tenantId]
 *   days: Number of days to keep (default: 7)
 *   tenantId: Optional - only clean up for specific tenant
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { PingMetrics } = require('../models/ping-metrics-schema');
const { SNMPMetrics } = require('../models/snmp-metrics-schema');
const { EPCServiceStatus } = require('../models/distributed-epc-schema');
const { EPCLog } = require('../models/distributed-epc-schema');
const { EPCMetrics } = require('../models/distributed-epc-schema');

async function connectDB() {
  try {
    let mongoUri;
    try {
      const appConfig = require('../config/app');
      mongoUri = appConfig.mongodb.uri || process.env.MONGODB_URI;
    } catch (e) {
      mongoUri = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';
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

async function cleanupOldMetrics(daysToKeep = 7, tenantId = null) {
  await connectDB();
  
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    console.log(`🗑️  Cleaning up metrics older than ${daysToKeep} days (before ${cutoffDate.toISOString()})\n`);
    
    const query = { timestamp: { $lt: cutoffDate } };
    if (tenantId) {
      query.tenant_id = tenantId;
      console.log(`   Filtering for tenant: ${tenantId}\n`);
    }
    
    // Clean up PingMetrics
    console.log('1. Cleaning PingMetrics...');
    const pingCount = await PingMetrics.countDocuments(query);
    if (pingCount > 0) {
      const pingResult = await PingMetrics.deleteMany(query);
      console.log(`   ✅ Deleted ${pingResult.deletedCount.toLocaleString()} ping metrics`);
    } else {
      console.log(`   ℹ️  No old ping metrics to delete`);
    }
    
    // Clean up SNMPMetrics
    console.log('2. Cleaning SNMPMetrics...');
    const snmpCount = await SNMPMetrics.countDocuments(query);
    if (snmpCount > 0) {
      const snmpResult = await SNMPMetrics.deleteMany(query);
      console.log(`   ✅ Deleted ${snmpResult.deletedCount.toLocaleString()} SNMP metrics`);
    } else {
      console.log(`   ℹ️  No old SNMP metrics to delete`);
    }
    
    // Clean up EPCServiceStatus (keep only 3 days)
    console.log('3. Cleaning EPCServiceStatus (keeping 3 days)...');
    const epcStatusCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const epcStatusQuery = { timestamp: { $lt: epcStatusCutoff } };
    if (tenantId) epcStatusQuery.tenant_id = tenantId;
    
    const epcStatusCount = await EPCServiceStatus.countDocuments(epcStatusQuery);
    if (epcStatusCount > 0) {
      const epcStatusResult = await EPCServiceStatus.deleteMany(epcStatusQuery);
      console.log(`   ✅ Deleted ${epcStatusResult.deletedCount.toLocaleString()} EPC service status records`);
    } else {
      console.log(`   ℹ️  No old EPC service status to delete`);
    }
    
    // Clean up EPCLog (keep only 7 days)
    console.log('4. Cleaning EPCLog (keeping 7 days)...');
    const epcLogQuery = { timestamp: { $lt: cutoffDate } };
    if (tenantId) epcLogQuery.tenant_id = tenantId;
    
    const epcLogCount = await EPCLog.countDocuments(epcLogQuery);
    if (epcLogCount > 0) {
      const epcLogResult = await EPCLog.deleteMany(epcLogQuery);
      console.log(`   ✅ Deleted ${epcLogResult.deletedCount.toLocaleString()} EPC log entries`);
    } else {
      console.log(`   ℹ️  No old EPC logs to delete`);
    }
    
    // Clean up EPCMetrics
    console.log('5. Cleaning EPCMetrics...');
    const epcMetricsCount = await EPCMetrics.countDocuments(query);
    if (epcMetricsCount > 0) {
      const epcMetricsResult = await EPCMetrics.deleteMany(query);
      console.log(`   ✅ Deleted ${epcMetricsResult.deletedCount.toLocaleString()} EPC metrics`);
    } else {
      console.log(`   ℹ️  No old EPC metrics to delete`);
    }
    
    console.log('\n✅ Cleanup complete!\n');
    
    // Show remaining counts
    console.log('📊 Remaining metrics:');
    const remainingQuery = tenantId ? { tenant_id: tenantId } : {};
    console.log(`   PingMetrics: ${(await PingMetrics.countDocuments(remainingQuery)).toLocaleString()}`);
    console.log(`   SNMPMetrics: ${(await SNMPMetrics.countDocuments(remainingQuery)).toLocaleString()}`);
    console.log(`   EPCServiceStatus: ${(await EPCServiceStatus.countDocuments(remainingQuery)).toLocaleString()}`);
    console.log(`   EPCLog: ${(await EPCLog.countDocuments(remainingQuery)).toLocaleString()}`);
    console.log(`   EPCMetrics: ${(await EPCMetrics.countDocuments(remainingQuery)).toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Get command line arguments
const daysToKeep = parseInt(process.argv[2]) || 7;
const tenantId = process.argv[3] || null;

console.log(`🧹 MongoDB Metrics Cleanup Script\n`);
console.log(`   Keeping data for: ${daysToKeep} days`);
if (tenantId) {
  console.log(`   Tenant filter: ${tenantId}`);
} else {
  console.log(`   Tenant filter: All tenants`);
}
console.log('');

cleanupOldMetrics(daysToKeep, tenantId);

