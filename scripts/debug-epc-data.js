#!/usr/bin/env node
/**
 * Debug EPC Data Flow
 * Checks if check-in data is being stored and retrieved correctly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { RemoteEPC, EPCServiceStatus, EPCLog } = require('../models/distributed-epc-schema');
const appConfig = require('../config/app');

const DEVICE_CODE = process.argv[2] || 'YALNTFQC';
const TENANT_ID = process.argv[3] || '690abdc14a6f067977986db3';

async function main() {
  try {
    await mongoose.connect(appConfig.mongodb.uri, appConfig.mongodb.options);
    console.log('✅ Connected to MongoDB\n');

    // Find EPC
    const epc = await RemoteEPC.findOne({
      $or: [
        { device_code: DEVICE_CODE.toUpperCase() },
        { epc_id: DEVICE_CODE }
      ],
      tenant_id: TENANT_ID
    }).lean();

    if (!epc) {
      console.error(`❌ EPC not found: ${DEVICE_CODE}`);
      process.exit(1);
    }

    console.log('=== EPC Device ===');
    console.log(`EPC ID: ${epc.epc_id}`);
    console.log(`Device Code: ${epc.device_code}`);
    console.log(`Site Name: ${epc.site_name || 'N/A'}`);
    console.log(`Status: ${epc.status || 'unknown'}`);
    console.log(`IP Address: ${epc.ip_address || 'Unknown'}`);
    console.log(`Last Seen: ${epc.last_seen || 'Never'}`);
    console.log(`Metrics stored:`, JSON.stringify(epc.metrics || {}, null, 2));
    console.log('');

    // Get latest service status
    const latestStatus = await EPCServiceStatus.findOne({
      epc_id: epc.epc_id,
      tenant_id: TENANT_ID
    }).sort({ timestamp: -1 }).lean();

    if (latestStatus) {
      console.log('=== Latest Service Status ===');
      console.log(`Timestamp: ${latestStatus.timestamp}`);
      console.log(`System metrics:`, JSON.stringify(latestStatus.system || {}, null, 2));
      console.log(`Services:`, Object.keys(latestStatus.services || {}).length, 'services');
      console.log(`Network:`, JSON.stringify(latestStatus.network || {}, null, 2));
      console.log(`Versions:`, JSON.stringify(latestStatus.versions || {}, null, 2));
      console.log('');
    } else {
      console.log('⚠️  No service status found');
      console.log('');
    }

    // Get all service statuses
    const allStatuses = await EPCServiceStatus.find({
      epc_id: epc.epc_id,
      tenant_id: TENANT_ID
    }).sort({ timestamp: -1 }).limit(5).lean();

    console.log(`=== Recent Service Statuses (${allStatuses.length}) ===`);
    allStatuses.forEach((status, idx) => {
      console.log(`${idx + 1}. ${status.timestamp} - CPU: ${status.system?.cpu_percent || 'N/A'}%, Memory: ${status.system?.memory_percent || 'N/A'}%, Uptime: ${status.system?.uptime_seconds || 'N/A'}s`);
    });
    console.log('');

    // Get logs
    const logs = await EPCLog.find({
      epc_id: epc.epc_id,
      tenant_id: TENANT_ID
    }).sort({ timestamp: -1 }).limit(10).lean();

    console.log(`=== Recent Logs (${logs.length}) ===`);
    logs.forEach((log, idx) => {
      console.log(`${idx + 1}. [${log.level}] ${log.timestamp}: ${log.message.substring(0, 80)}`);
    });
    console.log('');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();

