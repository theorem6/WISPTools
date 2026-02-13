#!/usr/bin/env node

/**
 * Script to check MongoDB database size and collection sizes
 * Helps identify what's taking up space in MongoDB Atlas
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

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

async function checkDatabaseSize() {
  await connectDB();
  
  try {
    const db = mongoose.connection.db;
    const adminDb = db.admin();
    
    // Get database stats
    const dbStats = await db.stats();
    console.log('📊 Database Statistics:');
    console.log(`   Total Size: ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Storage Size: ${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Index Size: ${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Collections: ${dbStats.collections}`);
    console.log(`   Documents: ${dbStats.objects}\n`);
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    
    console.log('📋 Collection Sizes:\n');
    
    const collectionStats = [];
    
    for (const collection of collections) {
      const name = collection.name;
      const stats = await db.collection(name).stats();
      
      const dataSizeMB = (stats.size || 0) / 1024 / 1024;
      const storageSizeMB = (stats.storageSize || 0) / 1024 / 1024;
      const indexSizeMB = (stats.totalIndexSize || 0) / 1024 / 1024;
      const count = stats.count || 0;
      
      collectionStats.push({
        name,
        dataSizeMB,
        storageSizeMB,
        indexSizeMB,
        count
      });
    }
    
    // Sort by storage size (descending)
    collectionStats.sort((a, b) => b.storageSizeMB - a.storageSizeMB);
    
    // Display top collections
    collectionStats.forEach((stat, idx) => {
      if (stat.storageSizeMB > 0.1) { // Only show collections > 0.1 MB
        console.log(`${idx + 1}. ${stat.name}`);
        console.log(`   Storage: ${stat.storageSizeMB.toFixed(2)} MB`);
        console.log(`   Data: ${stat.dataSizeMB.toFixed(2)} MB`);
        console.log(`   Indexes: ${stat.indexSizeMB.toFixed(2)} MB`);
        console.log(`   Documents: ${stat.count.toLocaleString()}`);
        console.log('');
      }
    });
    
    // Check time-series collections specifically
    console.log('⏰ Time-Series Collections (Metrics):\n');
    
    const { PingMetrics } = require('../models/ping-metrics-schema');
    const { SNMPMetrics } = require('../models/snmp-metrics-schema');
    const { EPCServiceStatus } = require('../models/distributed-epc-schema');
    const { EPCLog } = require('../models/distributed-epc-schema');
    const { EPCMetrics } = require('../models/distributed-epc-schema');
    
    const metricsCollections = [
      { name: 'PingMetrics', model: PingMetrics },
      { name: 'SNMPMetrics', model: SNMPMetrics },
      { name: 'EPCServiceStatus', model: EPCServiceStatus },
      { name: 'EPCLog', model: EPCLog },
      { name: 'EPCMetrics', model: EPCMetrics }
    ];
    
    for (const { name, model } of metricsCollections) {
      try {
        const count = await model.countDocuments();
        const oldCount = await model.countDocuments({
          timestamp: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Older than 7 days
        });
        const veryOldCount = await model.countDocuments({
          timestamp: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Older than 30 days
        });
        
        if (count > 0) {
          console.log(`${name}:`);
          console.log(`   Total: ${count.toLocaleString()} documents`);
          console.log(`   Older than 7 days: ${oldCount.toLocaleString()} (${((oldCount / count) * 100).toFixed(1)}%)`);
          console.log(`   Older than 30 days: ${veryOldCount.toLocaleString()} (${((veryOldCount / count) * 100).toFixed(1)}%)`);
          console.log('');
        }
      } catch (e) {
        // Collection might not exist
      }
    }
    
    // Summary
    const totalStorage = collectionStats.reduce((sum, stat) => sum + stat.storageSizeMB, 0);
    const metricsStorage = collectionStats
      .filter(stat => stat.name.includes('Metrics') || stat.name.includes('Status') || stat.name.includes('Log'))
      .reduce((sum, stat) => sum + stat.storageSizeMB, 0);
    
    console.log('📈 Summary:');
    console.log(`   Total Storage Used: ${totalStorage.toFixed(2)} MB`);
    console.log(`   Metrics Collections: ${metricsStorage.toFixed(2)} MB (${((metricsStorage / totalStorage) * 100).toFixed(1)}%)`);
    console.log(`   Free Tier Limit: 512 MB`);
    console.log(`   Available Space: ${(512 - totalStorage).toFixed(2)} MB`);
    
    if (totalStorage > 512) {
      console.log(`\n⚠️  WARNING: Database exceeds free tier limit!`);
      console.log(`   Need to free: ${(totalStorage - 512).toFixed(2)} MB`);
    } else if (totalStorage > 450) {
      console.log(`\n⚠️  WARNING: Database is approaching free tier limit!`);
      console.log(`   Only ${(512 - totalStorage).toFixed(2)} MB remaining`);
    }
    
  } catch (error) {
    console.error('❌ Error checking database size:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkDatabaseSize();

