/**
 * Reset All Tenant Data Script
 * Deletes ALL tenants and all tenant-related data from the database
 * WARNING: This is a destructive operation that cannot be undone!
 */

const mongoose = require('mongoose');

// Import all models (relative to backend-services directory)
const { Tenant } = require('../models/tenant');
const { UserTenant } = require('../models/user');
const { PlanProject } = require('../models/plan');
const { PlanLayerFeature } = require('../models/plan-layer-feature');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../models/network');
const { InventoryItem } = require('../models/inventory');
const { WorkOrder } = require('../models/work-order');
const { Customer } = require('../models/customer');
const InstallationDocumentation = require('../models/installation-documentation');
const { Subcontractor } = require('../models/subcontractor');
const { Permission } = require('../models/permission');
const { TenantEmail } = require('../models/tenant-email');
const { HardwareBundle } = require('../models/hardwareBundle');
const { EquipmentPricing } = require('../models/equipment-pricing');

async function connectDB() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const MONGODB_URI = process.env.MONGODB_URI || 
      '';
    
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      retryWrites: true,
      w: 'majority'
    };
    
    await mongoose.connect(MONGODB_URI, options);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function resetAllTenantData() {
  await connectDB();

  try {
    console.log('\n⚠️  WARNING: This will delete ALL tenants and ALL tenant-related data!');
    console.log('⚠️  This operation CANNOT be undone!\n');

    // Get counts before deletion
    console.log('📊 Counting existing data...');
    const tenantCount = await Tenant.countDocuments({});
    const userTenantCount = await UserTenant.countDocuments({});
    const planCount = await PlanProject.countDocuments({});
    const planFeatureCount = await PlanLayerFeature.countDocuments({});
    const siteCount = await UnifiedSite.countDocuments({});
    const sectorCount = await UnifiedSector.countDocuments({});
    const cpeCount = await UnifiedCPE.countDocuments({});
    const equipmentCount = await NetworkEquipment.countDocuments({});
    const inventoryCount = await InventoryItem.countDocuments({});
    const workOrderCount = await WorkOrder.countDocuments({});
    const customerCount = await Customer.countDocuments({});
    
    // Some models might not exist - try/catch for optional ones
    let installationCount = 0;
    let subcontractorCount = 0;
    let permissionCount = 0;
    let tenantEmailCount = 0;
    let hardwareBundleCount = 0;
    let equipmentPricingCount = 0;
    
    try { installationCount = await InstallationDocumentation.countDocuments({}); } catch (e) {}
    try { subcontractorCount = await Subcontractor.countDocuments({}); } catch (e) {}
    try { permissionCount = await Permission.countDocuments({}); } catch (e) {}
    try { tenantEmailCount = await TenantEmail.countDocuments({}); } catch (e) {}
    try { hardwareBundleCount = await HardwareBundle.countDocuments({}); } catch (e) {}
    try { equipmentPricingCount = await EquipmentPricing.countDocuments({}); } catch (e) {}

    console.log('📊 Current data counts:');
    console.log(`  - Tenants: ${tenantCount}`);
    console.log(`  - User-Tenant Associations: ${userTenantCount}`);
    console.log(`  - Plans: ${planCount}`);
    console.log(`  - Plan Features: ${planFeatureCount}`);
    console.log(`  - Sites: ${siteCount}`);
    console.log(`  - Sectors: ${sectorCount}`);
    console.log(`  - CPE Devices: ${cpeCount}`);
    console.log(`  - Network Equipment: ${equipmentCount}`);
    console.log(`  - Inventory Items: ${inventoryCount}`);
    console.log(`  - Work Orders: ${workOrderCount}`);
    console.log(`  - Customers: ${customerCount}`);
    console.log(`  - Installation Docs: ${installationCount}`);
    console.log(`  - Subcontractors: ${subcontractorCount}`);
    console.log(`  - Permissions: ${permissionCount}`);
    console.log(`  - Tenant Emails: ${tenantEmailCount}`);
    console.log(`  - Hardware Bundles: ${hardwareBundleCount}`);
    console.log(`  - Equipment Pricing: ${equipmentPricingCount}\n`);

    if (tenantCount === 0 && userTenantCount === 0 && planCount === 0 && planFeatureCount === 0 &&
        siteCount === 0 && sectorCount === 0 && cpeCount === 0 && equipmentCount === 0 &&
        inventoryCount === 0 && workOrderCount === 0 && customerCount === 0 &&
        installationCount === 0 && subcontractorCount === 0 && permissionCount === 0 &&
        tenantEmailCount === 0 && hardwareBundleCount === 0 && equipmentPricingCount === 0) {
      console.log('✅ Database is already clean - no tenant data found!');
      await mongoose.disconnect();
      return;
    }

    console.log('🗑️  Starting deletion process...\n');

    // Delete in order to respect dependencies
    // Start with child collections that reference tenants

    console.log('1. Deleting plan features...');
    const planFeatureResult = await PlanLayerFeature.deleteMany({});
    console.log(`   ✅ Deleted ${planFeatureResult.deletedCount} plan features`);

    console.log('2. Deleting plans...');
    const planResult = await PlanProject.deleteMany({});
    console.log(`   ✅ Deleted ${planResult.deletedCount} plans`);

    console.log('3. Deleting CPE devices...');
    const cpeResult = await UnifiedCPE.deleteMany({});
    console.log(`   ✅ Deleted ${cpeResult.deletedCount} CPE devices`);

    console.log('4. Deleting sectors...');
    const sectorResult = await UnifiedSector.deleteMany({});
    console.log(`   ✅ Deleted ${sectorResult.deletedCount} sectors`);

    console.log('5. Deleting network equipment...');
    const equipmentResult = await NetworkEquipment.deleteMany({});
    console.log(`   ✅ Deleted ${equipmentResult.deletedCount} network equipment`);

    console.log('6. Deleting sites...');
    const siteResult = await UnifiedSite.deleteMany({});
    console.log(`   ✅ Deleted ${siteResult.deletedCount} sites`);

    console.log('7. Deleting inventory items...');
    const inventoryResult = await InventoryItem.deleteMany({});
    console.log(`   ✅ Deleted ${inventoryResult.deletedCount} inventory items`);

    console.log('8. Deleting work orders...');
    const workOrderResult = await WorkOrder.deleteMany({});
    console.log(`   ✅ Deleted ${workOrderResult.deletedCount} work orders`);

    console.log('9. Deleting customers...');
    const customerResult = await Customer.deleteMany({});
    console.log(`   ✅ Deleted ${customerResult.deletedCount} customers`);

    console.log('10. Deleting installation documentation...');
    let installationResult = { deletedCount: 0 };
    try {
      installationResult = await InstallationDocumentation.deleteMany({});
      console.log(`   ✅ Deleted ${installationResult.deletedCount} installation docs`);
    } catch (e) {
      console.log(`   ⚠️  Skipped installation docs (model not available)`);
    }

    console.log('11. Deleting subcontractors...');
    let subcontractorResult = { deletedCount: 0 };
    try {
      subcontractorResult = await Subcontractor.deleteMany({});
      console.log(`   ✅ Deleted ${subcontractorResult.deletedCount} subcontractors`);
    } catch (e) {
      console.log(`   ⚠️  Skipped subcontractors (model not available)`);
    }

    console.log('12. Deleting permissions...');
    let permissionResult = { deletedCount: 0 };
    try {
      permissionResult = await Permission.deleteMany({});
      console.log(`   ✅ Deleted ${permissionResult.deletedCount} permissions`);
    } catch (e) {
      console.log(`   ⚠️  Skipped permissions (model not available)`);
    }

    console.log('13. Deleting tenant emails...');
    let tenantEmailResult = { deletedCount: 0 };
    try {
      tenantEmailResult = await TenantEmail.deleteMany({});
      console.log(`   ✅ Deleted ${tenantEmailResult.deletedCount} tenant emails`);
    } catch (e) {
      console.log(`   ⚠️  Skipped tenant emails (model not available)`);
    }

    console.log('14. Deleting hardware bundles...');
    let hardwareBundleResult = { deletedCount: 0 };
    try {
      hardwareBundleResult = await HardwareBundle.deleteMany({});
      console.log(`   ✅ Deleted ${hardwareBundleResult.deletedCount} hardware bundles`);
    } catch (e) {
      console.log(`   ⚠️  Skipped hardware bundles (model not available)`);
    }

    console.log('15. Deleting equipment pricing...');
    let equipmentPricingResult = { deletedCount: 0 };
    try {
      equipmentPricingResult = await EquipmentPricing.deleteMany({});
      console.log(`   ✅ Deleted ${equipmentPricingResult.deletedCount} equipment pricing records`);
    } catch (e) {
      console.log(`   ⚠️  Skipped equipment pricing (model not available)`);
    }

    console.log('16. Deleting user-tenant associations...');
    const userTenantResult = await UserTenant.deleteMany({});
    console.log(`   ✅ Deleted ${userTenantResult.deletedCount} user-tenant associations`);

    console.log('17. Deleting tenants...');
    const tenantResult = await Tenant.deleteMany({});
    console.log(`   ✅ Deleted ${tenantResult.deletedCount} tenants`);

    console.log('\n✅ Complete database reset finished!\n');
    console.log('📊 Deletion summary:');
    console.log(`  - Tenants: ${tenantResult.deletedCount}`);
    console.log(`  - User-Tenant Associations: ${userTenantResult.deletedCount}`);
    console.log(`  - Plans: ${planResult.deletedCount}`);
    console.log(`  - Plan Features: ${planFeatureResult.deletedCount}`);
    console.log(`  - Sites: ${siteResult.deletedCount}`);
    console.log(`  - Sectors: ${sectorResult.deletedCount}`);
    console.log(`  - CPE Devices: ${cpeResult.deletedCount}`);
    console.log(`  - Network Equipment: ${equipmentResult.deletedCount}`);
    console.log(`  - Inventory Items: ${inventoryResult.deletedCount}`);
    console.log(`  - Work Orders: ${workOrderResult.deletedCount}`);
    console.log(`  - Customers: ${customerResult.deletedCount}`);
    console.log(`  - Installation Docs: ${installationResult.deletedCount}`);
    console.log(`  - Subcontractors: ${subcontractorResult.deletedCount}`);
    console.log(`  - Permissions: ${permissionResult.deletedCount}`);
    console.log(`  - Tenant Emails: ${tenantEmailResult.deletedCount}`);
    console.log(`  - Hardware Bundles: ${hardwareBundleResult.deletedCount}`);
    console.log(`  - Equipment Pricing: ${equipmentPricingResult.deletedCount}\n`);

    console.log('✨ Database has been reset to a fresh state!\n');

  } catch (error) {
    console.error('❌ Error during database reset:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  resetAllTenantData()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { resetAllTenantData };
