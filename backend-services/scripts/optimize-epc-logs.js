#!/usr/bin/env node
/**
 * Optimize EPCLog Collection
 * 
 * This script:
 * 1. Truncates long log messages (max 500 chars)
 * 2. Removes redundant fields from details
 * 3. Removes old INFO/DEBUG logs (keep only ERROR/WARNING)
 * 
 * Usage:
 *   node optimize-epc-logs.js [--dry-run] [--keep-days=7]
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { EPCLog } = require('../models/distributed-epc-schema');

const MAX_MESSAGE_LENGTH = 500;
const DEFAULT_KEEP_DAYS = 7;

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

function truncateMessage(message) {
  if (!message || typeof message !== 'string') {
    return message;
  }
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return message;
  }
  return message.substring(0, MAX_MESSAGE_LENGTH - 3) + '...';
}

function optimizeDetails(details) {
  if (!details || typeof details !== 'object') {
    return details;
  }
  
  // Keep only essential fields
  const optimized = {};
  if (details.ip_address) optimized.ip_address = details.ip_address;
  if (details.device_code) optimized.device_code = details.device_code;
  // Remove redundant timestamp (already in document timestamp field)
  // Remove other verbose fields
  
  return Object.keys(optimized).length > 0 ? optimized : undefined;
}

async function optimizeEPCLogs(dryRun = false, keepDays = DEFAULT_KEEP_DAYS) {
  console.log('🔧 EPCLog Optimization Script\n');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify data)'}`);
  console.log(`   Max message length: ${MAX_MESSAGE_LENGTH} chars`);
  console.log(`   Keep logs for: ${keepDays} days\n`);
  
  await connectDB();
  
  try {
    const cutoffDate = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
    
    // Step 1: Remove old INFO/DEBUG logs (keep only ERROR/WARNING)
    console.log('1. Removing old INFO/DEBUG logs (keeping only ERROR/WARNING)...');
    const infoDebugQuery = {
      timestamp: { $lt: cutoffDate },
      level: { $in: ['info', 'debug'] }
    };
    
    const infoDebugCount = await EPCLog.countDocuments(infoDebugQuery);
    console.log(`   Found ${infoDebugCount} old INFO/DEBUG logs to remove`);
    
    if (!dryRun && infoDebugCount > 0) {
      const result = await EPCLog.deleteMany(infoDebugQuery);
      console.log(`   ✅ Removed ${result.deletedCount} old INFO/DEBUG logs`);
    }
    
    // Step 2: Optimize remaining logs
    console.log('\n2. Optimizing remaining log messages...');
    const logsToOptimize = await EPCLog.find({
      $or: [
        { message: { $exists: true, $type: 'string', $regex: /.{501,}/ } }, // Messages > 500 chars
        { details: { $exists: true, $ne: null } } // Has details field
      ]
    }).limit(10000); // Process in batches
    
    console.log(`   Found ${logsToOptimize.length} logs to optimize`);
    
    let optimizedCount = 0;
    let truncatedCount = 0;
    let detailsOptimizedCount = 0;
    
    for (const log of logsToOptimize) {
      let needsUpdate = false;
      const update = {};
      
      // Truncate long messages
      if (log.message && typeof log.message === 'string' && log.message.length > MAX_MESSAGE_LENGTH) {
        update.message = truncateMessage(log.message);
        needsUpdate = true;
        truncatedCount++;
      }
      
      // Optimize details
      if (log.details) {
        const optimizedDetails = optimizeDetails(log.details);
        if (JSON.stringify(optimizedDetails) !== JSON.stringify(log.details)) {
          if (optimizedDetails) {
            update.details = optimizedDetails;
          } else {
            update.$unset = { details: '' };
          }
          needsUpdate = true;
          detailsOptimizedCount++;
        }
      }
      
      if (needsUpdate && !dryRun) {
        await EPCLog.updateOne({ _id: log._id }, update);
        optimizedCount++;
      } else if (needsUpdate) {
        optimizedCount++;
      }
    }
    
    console.log(`   ✅ Optimized ${optimizedCount} logs`);
    console.log(`      - Truncated messages: ${truncatedCount}`);
    console.log(`      - Optimized details: ${detailsOptimizedCount}`);
    
    // Step 3: Summary
    console.log('\n📊 Summary:');
    const totalLogs = await EPCLog.countDocuments();
    const errorLogs = await EPCLog.countDocuments({ level: 'error' });
    const warningLogs = await EPCLog.countDocuments({ level: 'warning' });
    const infoLogs = await EPCLog.countDocuments({ level: 'info' });
    const debugLogs = await EPCLog.countDocuments({ level: 'debug' });
    
    console.log(`   Total logs: ${totalLogs}`);
    console.log(`   ERROR: ${errorLogs}`);
    console.log(`   WARNING: ${warningLogs}`);
    console.log(`   INFO: ${infoLogs}`);
    console.log(`   DEBUG: ${debugLogs}`);
    
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
const keepDaysArg = args.find(arg => arg.startsWith('--keep-days='));
const keepDays = keepDaysArg ? parseInt(keepDaysArg.split('=')[1], 10) : DEFAULT_KEEP_DAYS;

optimizeEPCLogs(dryRun, keepDays);

