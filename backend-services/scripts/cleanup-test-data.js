/**
 * Cleanup Test Data Script
 * Removes all objects created by deploy, plan, and find addresses operations
 * This is for non-production environments only
 */

const mongoose = require('mongoose');
const appConfig = require('../config/app');

// Import models
const { PlanProject } = require('../models/plan');
const { PlanLayerFeature } = require('../models/plan-layer-feature');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../models/network');
const { Customer } = require('../models/customer');
const { WorkOrder } = require('../models/work-order');
const InstallationDocumentation = require('../models/installation-documentation');

async function cleanupTestData() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(appConfig.mongodb.uri, appConfig.mongodb.options);
    console.log('✓ Connected to MongoDB');

    // Get all tenants (we'll clean up for all tenants)
    const plans = await PlanProject.find({}).select('tenantId').lean();
    const tenantIds = [...new Set(plans.map(p => p.tenantId))];
    
    console.log(`\nFound ${tenantIds.length} tenant(s) with plan data`);
    console.log(`Found ${plans.length} plan(s) total`);

    let totalDeleted = {
      plans: 0,
      planFeatures: 0,
      sites: 0,
      sectors: 0,
      cpe: 0,
      equipment: 0,
      customers: 0,
      workOrders: 0,
      installationDocs: 0
    };

    // Delete all plans and related data for each tenant
    for (const tenantId of tenantIds) {
      console.log(`\n--- Cleaning up tenant: ${tenantId} ---`);

      // 1. Get all plan IDs for this tenant
      const tenantPlans = await PlanProject.find({ tenantId }).select('_id').lean();
      const planIds = tenantPlans.map(p => p._id.toString());

      console.log(`  Found ${planIds.length} plan(s)`);

      // 2. Delete PlanLayerFeatures (plan features)
      const featuresResult = await PlanLayerFeature.deleteMany({ tenantId });
      totalDeleted.planFeatures += featuresResult.deletedCount;
      console.log(`  ✓ Deleted ${featuresResult.deletedCount} plan features`);

      // 3. Delete network objects with planId
      const sitesResult = await UnifiedSite.deleteMany({ tenantId, planId: { $exists: true, $ne: null } });
      totalDeleted.sites += sitesResult.deletedCount;
      console.log(`  ✓ Deleted ${sitesResult.deletedCount} sites with planId`);

      const sectorsResult = await UnifiedSector.deleteMany({ tenantId, planId: { $exists: true, $ne: null } });
      totalDeleted.sectors += sectorsResult.deletedCount;
      console.log(`  ✓ Deleted ${sectorsResult.deletedCount} sectors with planId`);

      const cpeResult = await UnifiedCPE.deleteMany({ tenantId, planId: { $exists: true, $ne: null } });
      totalDeleted.cpe += cpeResult.deletedCount;
      console.log(`  ✓ Deleted ${cpeResult.deletedCount} CPE devices with planId`);

      const equipmentResult = await NetworkEquipment.deleteMany({ tenantId, planId: { $exists: true, $ne: null } });
      totalDeleted.equipment += equipmentResult.deletedCount;
      console.log(`  ✓ Deleted ${equipmentResult.deletedCount} equipment with planId`);

      // 4. Delete customer prospects created from marketing leads
      const customersResult = await Customer.deleteMany({
        tenantId,
        $or: [
          { serviceStatus: 'prospect' },
          { leadSource: 'plan-marketing' },
          { leadSource: 'marketing-lead' },
          { associatedPlanId: { $in: planIds } }
        ]
      });
      totalDeleted.customers += customersResult.deletedCount;
      console.log(`  ✓ Deleted ${customersResult.deletedCount} customer prospects`);

      // 5. Delete work orders related to plans
      const workOrdersResult = await WorkOrder.deleteMany({
        tenantId,
        $or: [
          { 'metadata.planId': { $in: planIds } },
          { description: { $regex: /plan|project/i } }
        ]
      });
      totalDeleted.workOrders += workOrdersResult.deletedCount;
      console.log(`  ✓ Deleted ${workOrdersResult.deletedCount} work orders related to plans`);

      // 6. Delete installation documentation related to plans
      const installationDocsResult = await InstallationDocumentation.deleteMany({
        tenantId,
        $or: [
          { 'metadata.planId': { $in: planIds } },
          { notes: { $regex: /plan|project/i } }
        ]
      });
      totalDeleted.installationDocs += installationDocsResult.deletedCount;
      console.log(`  ✓ Deleted ${installationDocsResult.deletedCount} installation docs related to plans`);

      // 7. Delete all plans (this will also remove marketing.addresses embedded in plans)
      const plansResult = await PlanProject.deleteMany({ tenantId });
      totalDeleted.plans += plansResult.deletedCount;
      console.log(`  ✓ Deleted ${plansResult.deletedCount} plans`);
    }

    // Summary
    console.log('\n=== CLEANUP SUMMARY ===');
    console.log(`Plans deleted: ${totalDeleted.plans}`);
    console.log(`Plan features deleted: ${totalDeleted.planFeatures}`);
    console.log(`Sites deleted: ${totalDeleted.sites}`);
    console.log(`Sectors deleted: ${totalDeleted.sectors}`);
    console.log(`CPE devices deleted: ${totalDeleted.cpe}`);
    console.log(`Equipment deleted: ${totalDeleted.equipment}`);
    console.log(`Customer prospects deleted: ${totalDeleted.customers}`);
    console.log(`Work orders deleted: ${totalDeleted.workOrders}`);
    console.log(`Installation docs deleted: ${totalDeleted.installationDocs}`);
    console.log(`\nTotal objects deleted: ${Object.values(totalDeleted).reduce((a, b) => a + b, 0)}`);

    console.log('\n✓ Cleanup completed successfully!');

  } catch (error) {
    console.error('✗ Cleanup failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

// Run cleanup
if (require.main === module) {
  cleanupTestData()
    .then(() => {
      console.log('\n✓ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupTestData };

