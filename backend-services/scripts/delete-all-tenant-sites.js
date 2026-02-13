#!/usr/bin/env node

/**
 * Script to delete ALL sites and related data for a tenant
 * This is a complete cleanup script - use with caution!
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment, HardwareDeployment } = require('../models/network');
const { PlanProject } = require('../models/plan');
const { PlanLayerFeature } = require('../models/plan-layer-feature');

const TENANT_ID = '690abdc14a6f067977986db3'; // Peterson Consulting

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
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function deleteAllTenantData(tenantId) {
  if (!tenantId) {
    console.error('❌ Tenant ID is required');
    process.exit(1);
  }

  await connectDB();

  try {
    console.log(`\n🔍 Starting complete cleanup for tenant: ${tenantId}\n`);
    console.log('⚠️  WARNING: This will delete ALL sites and related data for this tenant!\n');

    // Get counts before deletion
    const siteCount = await UnifiedSite.countDocuments({ tenantId });
    const sectorCount = await UnifiedSector.countDocuments({ tenantId });
    const cpeCount = await UnifiedCPE.countDocuments({ tenantId });
    const equipmentCount = await NetworkEquipment.countDocuments({ tenantId });
    const deploymentCount = await HardwareDeployment.countDocuments({ tenantId });
    const planCount = await PlanProject.countDocuments({ tenantId });
    const planFeatureCount = await PlanLayerFeature.countDocuments({ tenantId });

    console.log('📊 Current data counts:');
    console.log(`  - Sites: ${siteCount}`);
    console.log(`  - Sectors: ${sectorCount}`);
    console.log(`  - CPE Devices: ${cpeCount}`);
    console.log(`  - Network Equipment: ${equipmentCount}`);
    console.log(`  - Hardware Deployments: ${deploymentCount}`);
    console.log(`  - Plans: ${planCount}`);
    console.log(`  - Plan Features: ${planFeatureCount}\n`);

    if (siteCount === 0 && sectorCount === 0 && cpeCount === 0 && equipmentCount === 0 && 
        deploymentCount === 0 && planCount === 0 && planFeatureCount === 0) {
      console.log('✅ No data found for this tenant - already clean!');
      await mongoose.disconnect();
      return;
    }

    // Delete in order to respect dependencies
    console.log('🗑️  Starting deletion process...\n');

    // 1. Delete plan features first (they reference plans)
    console.log('1. Deleting plan features...');
    const planFeatureResult = await PlanLayerFeature.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${planFeatureResult.deletedCount} plan features`);

    // 2. Delete plans
    console.log('2. Deleting plans...');
    const planResult = await PlanProject.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${planResult.deletedCount} plans`);

    // 3. Delete hardware deployments
    console.log('3. Deleting hardware deployments...');
    const deploymentResult = await HardwareDeployment.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${deploymentResult.deletedCount} hardware deployments`);

    // 4. Delete CPE devices
    console.log('4. Deleting CPE devices...');
    const cpeResult = await UnifiedCPE.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${cpeResult.deletedCount} CPE devices`);

    // 5. Delete sectors (they reference sites)
    console.log('5. Deleting sectors...');
    const sectorResult = await UnifiedSector.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${sectorResult.deletedCount} sectors`);

    // 6. Delete network equipment
    console.log('6. Deleting network equipment...');
    const equipmentResult = await NetworkEquipment.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${equipmentResult.deletedCount} network equipment`);

    // 7. Delete sites last (other things may reference them)
    console.log('7. Deleting sites...');
    const siteResult = await UnifiedSite.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${siteResult.deletedCount} sites`);

    console.log('\n✅ Complete cleanup finished!\n');
    console.log('📊 Deletion summary:');
    console.log(`  - Sites: ${siteResult.deletedCount}`);
    console.log(`  - Sectors: ${sectorResult.deletedCount}`);
    console.log(`  - CPE Devices: ${cpeResult.deletedCount}`);
    console.log(`  - Network Equipment: ${equipmentResult.deletedCount}`);
    console.log(`  - Hardware Deployments: ${deploymentResult.deletedCount}`);
    console.log(`  - Plans: ${planResult.deletedCount}`);
    console.log(`  - Plan Features: ${planFeatureResult.deletedCount}\n`);

    // Verify deletion
    const remainingSites = await UnifiedSite.countDocuments({ tenantId });
    if (remainingSites > 0) {
      console.log(`⚠️  Warning: ${remainingSites} sites still remain for this tenant`);
    } else {
      console.log('✅ Verified: All sites deleted successfully');
    }

  } catch (error) {
    console.error('❌ Error during deletion:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the cleanup
deleteAllTenantData(TENANT_ID).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

