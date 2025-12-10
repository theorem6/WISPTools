/**
 * Check EPC Status and Recent Discoveries
 * Shows if EPCs are sending data and recent device discoveries
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { NetworkEquipment } = require('../models/network');

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

async function checkEPCStatus() {
  try {
    await connectDB();

    // Get all EPCs
    const epcs = await RemoteEPC.find({})
      .select('epc_id device_code last_seen last_heartbeat site_id tenant_id updated_at')
      .lean();
    
    console.log('=== EPC Status ===');
    console.log(`Found ${epcs.length} EPC(s):\n`);
    
    epcs.forEach(epc => {
      const lastSeen = epc.last_seen || epc.last_heartbeat || epc.updated_at;
      const age = lastSeen 
        ? Math.round((Date.now() - new Date(lastSeen).getTime()) / 1000 / 60) 
        : 'never';
      const isOnline = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
      const status = isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';
      
      console.log(`${status} EPC: ${epc.epc_id}`);
      console.log(`   Device Code: ${epc.device_code || 'N/A'}`);
      console.log(`   Last Seen: ${age} minutes ago`);
      if (epc.site_id) {
        console.log(`   Site ID: ${epc.site_id}`);
      }
      if (epc.tenant_id) {
        console.log(`   Tenant ID: ${epc.tenant_id}`);
      }
      console.log();
    });

    // Get recent discovered devices
    const recentDevices = await NetworkEquipment.find({ 
      'notes.discovered_by_epc': { $exists: true } 
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('name ip_address notes updatedAt createdAt')
      .lean();
    
    console.log(`=== Recent Discovered Devices (last 20) ===`);
    if (recentDevices.length === 0) {
      console.log('No devices found with discovered_by_epc in notes.\n');
    } else {
      recentDevices.forEach((d, idx) => {
        const notes = typeof d.notes === 'string' ? JSON.parse(d.notes) : (d.notes || {});
        const epc = notes.discovered_by_epc || 'unknown';
        const updated = new Date(d.updatedAt || d.createdAt).toISOString();
        const age = Math.round((Date.now() - new Date(d.updatedAt || d.createdAt).getTime()) / 1000 / 60);
        console.log(`${idx + 1}. Device: ${d.name || d.ip_address || 'Unknown'}`);
        console.log(`   IP: ${d.ip_address || 'N/A'}`);
        console.log(`   Discovered by EPC: ${epc}`);
        console.log(`   Last Updated: ${updated} (${age} minutes ago)`);
        console.log();
      });
    }

    // Count devices per EPC
    console.log('=== Device Count by EPC ===');
    const deviceCounts = {};
    recentDevices.forEach(d => {
      const notes = typeof d.notes === 'string' ? JSON.parse(d.notes) : (d.notes || {});
      const epc = notes.discovered_by_epc || 'unknown';
      deviceCounts[epc] = (deviceCounts[epc] || 0) + 1;
    });
    
    if (Object.keys(deviceCounts).length === 0) {
      console.log('No devices found.\n');
    } else {
      Object.entries(deviceCounts).forEach(([epc, count]) => {
        console.log(`EPC ${epc}: ${count} device(s)`);
      });
    }

    // Check for devices discovered in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDiscoveries = await NetworkEquipment.countDocuments({
      'notes.discovered_by_epc': { $exists: true },
      updatedAt: { $gte: oneDayAgo }
    });
    
    console.log(`\n=== Summary ===`);
    console.log(`Total discovered devices: ${recentDevices.length}`);
    console.log(`Devices discovered in last 24 hours: ${recentDiscoveries}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkEPCStatus();
