#!/usr/bin/env node
/**
 * Optimize SNMPMetrics Collection
 * 
 * This script:
 * 1. Removes raw_oids field from documents older than 24 hours
 * 2. Keeps only processed metric values
 * 
 * Usage:
 *   node optimize-snmp-metrics.js [--dry-run] [--keep-raw-hours=24]
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { SNMPMetrics } = require('../models/snmp-metrics-schema');

const DEFAULT_KEEP_RAW_HOURS = 24;

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

async function optimizeSNMPMetrics(dryRun = false, keepRawHours = DEFAULT_KEEP_RAW_HOURS) {
  console.log('🔧 SNMPMetrics Optimization Script\n');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify data)'}`);
  console.log(`   Keep raw_oids for: ${keepRawHours} hours\n`);
  
  await connectDB();
  
  try {
    const cutoffDate = new Date(Date.now() - keepRawHours * 60 * 60 * 1000);
    
    // Find documents with raw_oids older than cutoff
    console.log('1. Finding SNMPMetrics with old raw_oids...');
    const metricsWithRawOids = await SNMPMetrics.find({
      raw_oids: { $exists: true, $ne: null },
      timestamp: { $lt: cutoffDate }
    }).select('_id timestamp').limit(10000);
    
    console.log(`   Found ${metricsWithRawOids.length} documents with raw_oids older than ${keepRawHours} hours`);
    
    if (metricsWithRawOids.length === 0) {
      console.log('   ✅ No documents to optimize');
    } else {
      if (!dryRun) {
        const result = await SNMPMetrics.updateMany(
          {
            _id: { $in: metricsWithRawOids.map(m => m._id) }
          },
          {
            $unset: { raw_oids: '' }
          }
        );
        console.log(`   ✅ Removed raw_oids from ${result.modifiedCount} documents`);
      } else {
        console.log(`   Would remove raw_oids from ${metricsWithRawOids.length} documents`);
      }
    }
    
    // Summary
    console.log('\n📊 Summary:');
    const totalMetrics = await SNMPMetrics.countDocuments();
    const withRawOids = await SNMPMetrics.countDocuments({ raw_oids: { $exists: true, $ne: null } });
    const recentWithRawOids = await SNMPMetrics.countDocuments({
      raw_oids: { $exists: true, $ne: null },
      timestamp: { $gte: cutoffDate }
    });
    
    console.log(`   Total SNMPMetrics: ${totalMetrics}`);
    console.log(`   With raw_oids: ${withRawOids}`);
    console.log(`   Recent (keeping raw_oids): ${recentWithRawOids}`);
    console.log(`   Old (can remove raw_oids): ${withRawOids - recentWithRawOids}`);
    
    if (dryRun) {
      console.log('\n⚠️  DRY RUN - No changes were made. Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Optimization complete!');
    }
    
  } catch (error) {
    console.error('❌ Error during optimization:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keepRawHoursArg = args.find(arg => arg.startsWith('--keep-raw-hours='));
const keepRawHours = keepRawHoursArg ? parseInt(keepRawHoursArg.split('=')[1], 10) : DEFAULT_KEEP_RAW_HOURS;

optimizeSNMPMetrics(dryRun, keepRawHours);

