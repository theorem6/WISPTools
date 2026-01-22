#!/usr/bin/env node

/**
 * Script to delete a tenant by email or subdomain
 * Usage: node delete-tenant.js <email|subdomain>
 * Example: node delete-tenant.js david@4gengineer.com
 * Example: node delete-tenant.js peterson-consulting
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Tenant } = require('../models/tenant');
const { UserTenant } = require('../routes/users/user-schema');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment, HardwareDeployment } = require('../models/network');
const { PlanProject } = require('../models/plan');
const { PlanLayerFeature } = require('../models/plan-layer-feature');
const { InventoryItem } = require('../models/inventory');

// Additional models that might need cleanup
const WorkOrder = mongoose.models.WorkOrder || mongoose.model('WorkOrder', new mongoose.Schema({}, { strict: false }));
const Customer = mongoose.models.Customer || mongoose.model('Customer', new mongoose.Schema({}, { strict: false }));
const InstallationDocumentation = mongoose.models.InstallationDocumentation || mongoose.model('InstallationDocumentation', new mongoose.Schema({}, { strict: false }));

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
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

async function deleteTenant(identifier) {
  await connectDB();

  try {
    console.log(`🔍 Looking for tenant: ${identifier}\n`);

    // Try to find tenant by email or subdomain
    const tenant = await Tenant.findOne({
      $or: [
        { contactEmail: identifier },
        { subdomain: identifier },
        { 'owner.email': identifier }
      ]
    });

    if (!tenant) {
      console.error(`❌ Tenant not found for: ${identifier}`);
      console.log('💡 Try searching by:');
      console.log('   - Email address (e.g., david@4gengineer.com)');
      console.log('   - Subdomain (e.g., peterson-consulting)');
      process.exit(1);
    }

    const tenantId = tenant._id.toString();
    const tenantName = tenant.displayName || tenant.name || 'Unnamed Tenant';
    const tenantEmail = tenant.contactEmail || 'N/A';
    const tenantSubdomain = tenant.subdomain || 'N/A';

    console.log(`📋 Found tenant:`);
    console.log(`   ID: ${tenantId}`);
    console.log(`   Name: ${tenantName}`);
    console.log(`   Email: ${tenantEmail}`);
    console.log(`   Subdomain: ${tenantSubdomain}\n`);

    console.log('⚠️  WARNING: This will delete the tenant and ALL associated data!\n');
    console.log('🗑️  Starting deletion process...\n');

    // Get counts before deletion
    const userTenantCount = await UserTenant.countDocuments({ tenantId });
    const siteCount = await UnifiedSite.countDocuments({ tenantId });
    const sectorCount = await UnifiedSector.countDocuments({ tenantId });
    const cpeCount = await UnifiedCPE.countDocuments({ tenantId });
    const equipmentCount = await NetworkEquipment.countDocuments({ tenantId });
    const deploymentCount = await HardwareDeployment.countDocuments({ tenantId });
    const planCount = await PlanProject.countDocuments({ tenantId });
    const planFeatureCount = await PlanLayerFeature.countDocuments({ tenantId });
    const inventoryCount = await InventoryItem.countDocuments({ tenantId });

    console.log('📊 Data to be deleted:');
    console.log(`   - User-Tenant associations: ${userTenantCount}`);
    console.log(`   - Sites: ${siteCount}`);
    console.log(`   - Sectors: ${sectorCount}`);
    console.log(`   - CPE Devices: ${cpeCount}`);
    console.log(`   - Network Equipment: ${equipmentCount}`);
    console.log(`   - Hardware Deployments: ${deploymentCount}`);
    console.log(`   - Plans: ${planCount}`);
    console.log(`   - Plan Features: ${planFeatureCount}`);
    console.log(`   - Inventory Items: ${inventoryCount}\n`);

    // Delete in order to respect dependencies
    console.log('🗑️  Deleting data...\n');

    // 1. Delete plan features first (they reference plans)
    const planFeatureResult = await PlanLayerFeature.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${planFeatureResult.deletedCount} plan features`);

    // 2. Delete plans
    const planResult = await PlanProject.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${planResult.deletedCount} plans`);

    // 3. Delete hardware deployments
    const deploymentResult = await HardwareDeployment.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${deploymentResult.deletedCount} hardware deployments`);

    // 4. Delete CPE devices
    const cpeResult = await UnifiedCPE.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${cpeResult.deletedCount} CPE devices`);

    // 5. Delete sectors (they reference sites)
    const sectorResult = await UnifiedSector.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${sectorResult.deletedCount} sectors`);

    // 6. Delete network equipment
    const equipmentResult = await NetworkEquipment.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${equipmentResult.deletedCount} network equipment`);

    // 7. Delete sites last (other things may reference them)
    const siteResult = await UnifiedSite.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${siteResult.deletedCount} sites`);

    // 8. Delete inventory items
    const inventoryResult = await InventoryItem.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${inventoryResult.deletedCount} inventory items`);

    // 9. Delete user-tenant associations
    const userTenantResult = await UserTenant.deleteMany({ tenantId });
    console.log(`   ✅ Deleted ${userTenantResult.deletedCount} user-tenant associations`);

    // 11. Try to delete other collections (may not exist, so use try-catch)
    try {
      const workOrderResult = await WorkOrder.deleteMany({ tenantId });
      console.log(`   ✅ Deleted ${workOrderResult.deletedCount} work orders`);
    } catch (e) {
      console.log(`   ⚠️  Work orders collection not found or error: ${e.message}`);
    }

    try {
      const customerResult = await Customer.deleteMany({ tenantId });
      console.log(`   ✅ Deleted ${customerResult.deletedCount} customers`);
    } catch (e) {
      console.log(`   ⚠️  Customers collection not found or error: ${e.message}`);
    }

    try {
      const docResult = await InstallationDocumentation.deleteMany({ tenantId });
      console.log(`   ✅ Deleted ${docResult.deletedCount} installation documents`);
    } catch (e) {
      console.log(`   ⚠️  Installation documents collection not found or error: ${e.message}`);
    }

    // 12. Finally, delete the tenant itself
    await Tenant.findByIdAndDelete(tenantId);
    console.log(`   ✅ Deleted tenant: ${tenantName}\n`);

    console.log('✅ Tenant deletion completed successfully!\n');
    console.log('📊 Deletion summary:');
    console.log(`   - Tenant: ${tenantName} (${tenantId})`);
    console.log(`   - User-Tenant associations: ${userTenantResult.deletedCount}`);
    console.log(`   - Sites: ${siteResult.deletedCount}`);
    console.log(`   - Sectors: ${sectorResult.deletedCount}`);
    console.log(`   - CPE Devices: ${cpeResult.deletedCount}`);
    console.log(`   - Network Equipment: ${equipmentResult.deletedCount}`);
    console.log(`   - Hardware Deployments: ${deploymentResult.deletedCount}`);
    console.log(`   - Plans: ${planResult.deletedCount}`);
    console.log(`   - Plan Features: ${planFeatureResult.deletedCount}`);
    console.log(`   - Inventory Items: ${inventoryResult.deletedCount}\n`);

  } catch (error) {
    console.error('❌ Error during deletion:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Get identifier from command line
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Usage: node delete-tenant.js <email|subdomain>');
  console.error('\nExamples:');
  console.error('   node delete-tenant.js david@4gengineer.com');
  console.error('   node delete-tenant.js peterson-consulting');
  process.exit(1);
}

deleteTenant(identifier).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

