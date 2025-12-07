#!/usr/bin/env node
/**
 * Comprehensive diagnostic script to check graph data issues
 * Uses backend's actual database connection and models
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load models - use same imports as monitoring-graphs.js route
const { PingMetrics } = require('./models/ping-metrics-schema');
const { SNMPMetrics } = require('./models/snmp-metrics-schema');
const { NetworkEquipment } = require('./models/network');
const { InventoryItem } = require('./models/inventory');

async function diagnose() {
  try {
    // Connect to database using backend config
    const dbConfig = require('./config/database');
    await dbConfig.connectDatabase();
    console.log('✅ Connected to MongoDB\n');

    // Get tenant ID from environment or use a test one
    const tenantId = process.env.TENANT_ID || process.argv[2];
    
    if (!tenantId) {
      console.log('⚠️  No tenant ID provided. Checking all tenants...\n');
    } else {
      console.log(`🔍 Checking tenant: ${tenantId}\n`);
    }

    // 1. Check PingMetrics collection
    console.log('='.repeat(60));
    console.log('1. PING METRICS ANALYSIS');
    console.log('='.repeat(60));
    
    const pingQuery = tenantId ? { tenant_id: tenantId } : {};
    const totalPingMetrics = await PingMetrics.countDocuments(pingQuery);
    console.log(`Total PingMetrics documents: ${totalPingMetrics}`);
    
    if (totalPingMetrics > 0) {
      const deviceIds = await PingMetrics.distinct('device_id', pingQuery);
      console.log(`\nUnique device_ids in PingMetrics: ${deviceIds.length}`);
      console.log('All device_ids:', deviceIds);
      
      // Get recent metrics
      const recentMetrics = await PingMetrics.find(pingQuery)
        .sort({ timestamp: -1 })
        .limit(5)
        .lean();
      
      console.log('\n📊 Recent metrics sample:');
      recentMetrics.forEach((m, i) => {
        console.log(`  ${i + 1}. device_id: "${m.device_id}"`);
        console.log(`     tenant_id: "${m.tenant_id}"`);
        console.log(`     timestamp: ${m.timestamp}`);
        console.log(`     success: ${m.success}`);
        console.log(`     ip_address: ${m.ip_address}`);
        console.log('');
      });
      
      // Count by tenant if no tenant filter
      if (!tenantId) {
        const tenantCounts = await PingMetrics.aggregate([
          { $group: { _id: '$tenant_id', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]);
        console.log('Metrics by tenant:');
        tenantCounts.forEach(t => {
          console.log(`  Tenant ${t._id}: ${t.count} metrics`);
        });
      }
    } else {
      console.log('⚠️  No PingMetrics found in database!');
    }
    
    // 2. Check SNMPMetrics collection
    console.log('\n' + '='.repeat(60));
    console.log('2. SNMP METRICS ANALYSIS');
    console.log('='.repeat(60));
    
    const snmpQuery = tenantId ? { tenant_id: tenantId } : {};
    const totalSNMPMetrics = await SNMPMetrics.countDocuments(snmpQuery);
    console.log(`Total SNMPMetrics documents: ${totalSNMPMetrics}`);
    
    if (totalSNMPMetrics > 0) {
      const snmpDeviceIds = await SNMPMetrics.distinct('device_id', snmpQuery);
      console.log(`\nUnique device_ids in SNMPMetrics: ${snmpDeviceIds.length}`);
      console.log('All device_ids:', snmpDeviceIds);
    } else {
      console.log('⚠️  No SNMPMetrics found in database!');
    }

    // 3. Check devices from NetworkEquipment
    console.log('\n' + '='.repeat(60));
    console.log('3. NETWORK EQUIPMENT ANALYSIS');
    console.log('='.repeat(60));
    
    const networkQuery = tenantId ? { tenantId: tenantId, status: 'active', siteId: { $exists: true, $ne: null } } : { status: 'active', siteId: { $exists: true, $ne: null } };
    const networkEquipment = await NetworkEquipment.find(networkQuery)
      .select('_id name tenantId siteId notes')
      .lean();
    
    console.log(`Total deployed network equipment: ${networkEquipment.length}`);
    
    if (networkEquipment.length > 0) {
      console.log('\n📋 Network Equipment device IDs:');
      networkEquipment.forEach((eq, i) => {
        const deviceId = eq._id.toString();
        const notes = eq.notes ? (typeof eq.notes === 'string' ? JSON.parse(eq.notes) : eq.notes) : {};
        const ipAddress = notes.management_ip || notes.ip_address || notes.ipAddress;
        console.log(`  ${i + 1}. device_id: "${deviceId}"`);
        console.log(`     name: "${eq.name}"`);
        console.log(`     tenant_id: "${eq.tenantId}"`);
        console.log(`     ip: ${ipAddress || 'N/A'}`);
        console.log('');
      });
      
      const networkDeviceIds = networkEquipment.map(eq => eq._id.toString());
      console.log('All NetworkEquipment device IDs:', networkDeviceIds);
    }

    // 4. Check devices from InventoryItem
    console.log('\n' + '='.repeat(60));
    console.log('4. INVENTORY ITEMS ANALYSIS');
    console.log('='.repeat(60));
    
    const inventoryQuery = tenantId 
      ? { tenantId: tenantId, status: 'deployed', $or: [{ ipAddress: { $exists: true, $ne: null, $ne: '' } }, { 'technicalSpecs.ipAddress': { $exists: true, $ne: null, $ne: '' } }] }
      : { status: 'deployed', $or: [{ ipAddress: { $exists: true, $ne: null, $ne: '' } }, { 'technicalSpecs.ipAddress': { $exists: true, $ne: null, $ne: '' } }] };
    
    const inventoryItems = await InventoryItem.find(inventoryQuery)
      .select('_id assetTag tenantId ipAddress technicalSpecs.ipAddress')
      .lean();
    
    console.log(`Total deployed inventory items with IP: ${inventoryItems.length}`);
    
    if (inventoryItems.length > 0) {
      const inventoryDeviceIds = inventoryItems.map(item => item._id.toString());
      console.log('\nAll InventoryItem device IDs:', inventoryDeviceIds);
    }

    // 5. Compare device IDs
    console.log('\n' + '='.repeat(60));
    console.log('5. DEVICE ID COMPARISON');
    console.log('='.repeat(60));
    
    const pingDeviceIds = totalPingMetrics > 0 ? await PingMetrics.distinct('device_id', pingQuery) : [];
    const snmpDeviceIds = totalSNMPMetrics > 0 ? await SNMPMetrics.distinct('device_id', snmpQuery) : [];
    const allMetricDeviceIds = [...new Set([...pingDeviceIds, ...snmpDeviceIds])];
    
    const allEquipmentDeviceIds = [
      ...networkEquipment.map(eq => eq._id.toString()),
      ...inventoryItems.map(item => item._id.toString())
    ];
    
    console.log(`\nDevice IDs in Metrics Database: ${allMetricDeviceIds.length}`);
    console.log(allMetricDeviceIds);
    
    console.log(`\nDevice IDs from Equipment/Inventory: ${allEquipmentDeviceIds.length}`);
    console.log(allEquipmentDeviceIds);
    
    // Find mismatches
    const inMetricsButNotInEquipment = allMetricDeviceIds.filter(id => !allEquipmentDeviceIds.includes(id));
    const inEquipmentButNotInMetrics = allEquipmentDeviceIds.filter(id => !allMetricDeviceIds.includes(id));
    
    if (inMetricsButNotInEquipment.length > 0) {
      console.log(`\n⚠️  Device IDs in metrics but NOT in equipment: ${inMetricsButNotInEquipment.length}`);
      console.log(inMetricsButNotInEquipment);
    }
    
    if (inEquipmentButNotInMetrics.length > 0) {
      console.log(`\n⚠️  Device IDs in equipment but NOT in metrics: ${inEquipmentButNotInMetrics.length}`);
      console.log(inEquipmentButNotInMetrics);
      console.log('\n💡 These devices should have metrics but don\'t. This is why graphs show no data!');
    }
    
    if (inMetricsButNotInEquipment.length === 0 && inEquipmentButNotInMetrics.length === 0 && allEquipmentDeviceIds.length > 0) {
      console.log('\n✅ All device IDs match! But no metrics found - data collection may not be running.');
    }

    await mongoose.disconnect();
    console.log('\n✅ Diagnostic complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

diagnose();

