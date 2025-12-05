/**
 * Plans Core Routes
 * Basic CRUD operations for plans
 */

const express = require('express');
const router = express.Router();
const { PlanProject } = require('../../models/plan');
const { parseLocation, parseMarketing } = require('./plans-helpers');

/**
 * GET /plans - Get all plans for tenant
 */
router.get('/', async (req, res) => {
  try {
    const { status, createdBy } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (status) query.status = status;
    if (createdBy) query.createdBy = createdBy;
    
    const plans = await PlanProject.find(query)
      .sort({ updatedAt: -1 })
      .lean();
    
    plans.forEach(plan => {
      if (!plan.stagedFeatureCounts) {
        plan.stagedFeatureCounts = { total: 0, byType: {}, byStatus: {} };
      }
    });

    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans', message: error.message });
  }
});

/**
 * GET /plans/:id - Get single plan
 */
router.get('/:id', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    if (!plan.stagedFeatureCounts) {
      plan.stagedFeatureCounts = { total: 0, byType: {}, byStatus: {} };
    }
    
    res.json(plan);
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ error: 'Failed to fetch plan', message: error.message });
  }
});

/**
 * POST /plans - Create new plan
 */
router.post('/', async (req, res) => {
  try {
    // Ensure createdBy is always set (required field)
    // Priority: req.body.createdBy (if truthy) > req.body.email > 'System'
    let createdBy = 'System'; // Default fallback
    
    if (req.body.createdBy && typeof req.body.createdBy === 'string' && req.body.createdBy.trim()) {
      createdBy = req.body.createdBy.trim();
    } else if (req.body.email && typeof req.body.email === 'string' && req.body.email.trim()) {
      createdBy = req.body.email.trim();
    }
    
    // Log for debugging
    console.log('[plans] Creating plan with createdBy:', createdBy, 'from req.body:', JSON.stringify({
      createdBy: req.body.createdBy,
      email: req.body.email,
      name: req.body.name
    }));
    
    const location = parseLocation(req.body.location);
    const marketing = parseMarketing(req.body.marketing);

    // Build planData WITHOUT spreading req.body first (to avoid overwriting createdBy)
    const planData = {
      name: req.body.name || 'New Plan',
      description: req.body.description || '',
      status: req.body.status || 'draft',
      showOnMap: req.body.showOnMap !== undefined ? req.body.showOnMap : false,
      tenantId: req.tenantId,
      createdBy: createdBy, // ALWAYS set this explicitly - never overwritten
      createdById: req.body.createdById || req.body.uid || null,
      scope: req.body.scope || {
        towers: [],
        sectors: [],
        cpeDevices: [],
        equipment: [],
        backhauls: []
      },
      hardwareRequirements: req.body.hardwareRequirements || {
        existing: [],
        needed: []
      },
      purchasePlan: req.body.purchasePlan || {
        totalEstimatedCost: 0,
        missingHardware: [],
        procurementStatus: 'pending'
      },
      deployment: req.body.deployment || {}
    };

    if (location === null) {
      planData.location = null;
    } else if (location !== undefined) {
      planData.location = location;
    }

    if (marketing === null) {
      planData.marketing = null;
    } else if (marketing !== undefined) {
      planData.marketing = {
        targetRadiusMiles: marketing.targetRadiusMiles ?? 5,
        ...marketing
      };
    }
    
    // Verify createdBy is set before validation
    if (!planData.createdBy || planData.createdBy.trim() === '') {
      planData.createdBy = 'System';
    }
    
    console.log('[plans] Final planData.createdBy:', planData.createdBy);
    
    const plan = new PlanProject(planData);
    await plan.save();
    
    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: 'Failed to create plan', message: error.message });
  }
});

/**
 * PUT /plans/:id - Update plan
 */
router.put('/:id', async (req, res) => {
  try {
    // Find the plan first to check authorization
    const existingPlan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!existingPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Authorization check: Only allow updates if user created the plan or is admin
    // Get user email from request headers or body
    const userEmail = (req.user?.email || req.body.email || req.headers['x-user-email'] || '').trim();
    const normalizedCreator = (existingPlan.createdBy || '').trim();
    const isOwner = normalizedCreator && userEmail && normalizedCreator.toLowerCase() === userEmail.toLowerCase();
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'owner';

    const adoptableOwner = !normalizedCreator || ['system', 'auto', 'automated', 'unknown'].includes(normalizedCreator.toLowerCase());

    if (!isOwner && !isAdmin && !adoptableOwner) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You can only edit plans you created' 
      });
    }
     
    const parsedLocation = req.body.location !== undefined ? parseLocation(req.body.location) : undefined;
    const parsedMarketing = req.body.marketing !== undefined ? parseMarketing(req.body.marketing) : undefined;

    const locationUpdate =
      req.body.location !== undefined
        ? (parsedLocation === undefined ? existingPlan.location : parsedLocation)
        : existingPlan.location;

    const marketingUpdateRaw =
      req.body.marketing !== undefined
        ? (parsedMarketing === undefined ? existingPlan.marketing : parsedMarketing)
        : existingPlan.marketing;

    const marketingUpdate =
      marketingUpdateRaw && marketingUpdateRaw !== null
        ? {
            targetRadiusMiles: marketingUpdateRaw.targetRadiusMiles ?? existingPlan.marketing?.targetRadiusMiles ?? 5,
            ...marketingUpdateRaw
          }
        : marketingUpdateRaw;

    // Check if status is changing to 'deployed' - addresses should become permanent
    const statusChangingToDeployed = req.body.status === 'deployed' && existingPlan.status !== 'deployed';
    
    // Update only provided fields
    if (req.body.name !== undefined) existingPlan.name = req.body.name;
    if (req.body.description !== undefined) existingPlan.description = req.body.description;
    if (req.body.status !== undefined) existingPlan.status = req.body.status;
    if (req.body.showOnMap !== undefined) existingPlan.showOnMap = req.body.showOnMap;
    if (req.body.scope !== undefined) existingPlan.scope = req.body.scope;
    if (req.body.hardwareRequirements !== undefined) existingPlan.hardwareRequirements = req.body.hardwareRequirements;
    if (req.body.purchasePlan !== undefined) existingPlan.purchasePlan = req.body.purchasePlan;
    if (req.body.deployment !== undefined) existingPlan.deployment = req.body.deployment;
    
    if (req.body.location !== undefined) {
      existingPlan.location = locationUpdate;
    }
    
    if (req.body.marketing !== undefined) {
      existingPlan.marketing = marketingUpdate;
    }
    
    // When project is deployed, ensure addresses are converted to permanent leads
    // and clear them from plan (they're now in customer leads as permanent addresses)
    if (statusChangingToDeployed) {
      const planMarketingLeadService = require('../../services/planMarketingLeadService');
      
      // Ensure all addresses are converted to permanent customer leads
      try {
        await planMarketingLeadService.createMarketingLeadsForPlan(
          existingPlan,
          req.tenantId,
          req.user?.email || req.user?.name || 'System'
        );
        console.log('Marketing leads synced for plan deployment:', {
          planId: existingPlan._id?.toString?.() ?? existingPlan.id
        });
        
        // Clear addresses from plan since they're now permanent (in customer leads)
        if (existingPlan.marketing && existingPlan.marketing.addresses) {
          const addressCount = existingPlan.marketing.addresses.length;
          existingPlan.marketing.addresses = [];
          existingPlan.marketing.totalUniqueAddresses = 0;
          console.log(`Cleared ${addressCount} addresses from plan - now in permanent address layer`);
        }
      } catch (leadError) {
        console.error('Failed to sync marketing leads during plan deployment:', leadError);
        // Don't fail the deployment if lead sync fails - addresses may already be synced
      }
    }
    
    existingPlan.updatedAt = new Date();
    await existingPlan.save();
    
    res.json(existingPlan);
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan', message: error.message });
  }
});

/**
 * PUT /plans/:id/toggle-visibility - Toggle plan visibility on map
 */
router.put('/:id/toggle-visibility', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    plan.showOnMap = !plan.showOnMap;
    plan.updatedAt = new Date();
    await plan.save();
    
    res.json({ 
      plan,
      message: plan.showOnMap ? 'Plan is now visible on map' : 'Plan is now hidden on map'
    });
  } catch (error) {
    console.error('Error toggling plan visibility:', error);
    res.status(500).json({ error: 'Failed to toggle plan visibility', message: error.message });
  }
});

/**
 * DELETE /plans/:id - Delete plan
 */
router.delete('/:id', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Delete associated plan layer features
    const { PlanLayerFeature } = require('../../models/plan-layer-feature');
    await PlanLayerFeature.deleteMany({ planId: req.params.id, tenantId: req.tenantId });
    
    // Delete associated marketing leads
    const { Customer } = require('../../models/customer');
    const planMarketingLeadService = require('../../services/planMarketingLeadService');
    const normalizedPlanName = planMarketingLeadService.normalizePlanNameForLead(plan.name);
    const customerResult = await Customer.deleteMany({
      tenantId: req.tenantId,
      'metadata.source': 'marketing_lead',
      'metadata.planName': normalizedPlanName
    });
    
    // Delete the plan
    await plan.deleteOne();
    
    res.json({
      success: true,
      message: 'Plan deleted successfully',
      deleted: {
        plan: plan._id.toString(),
        features: 'multiple',
        customers: customerResult.deletedCount || 0
      }
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ error: 'Failed to delete plan', message: error.message });
  }
});

module.exports = router;

