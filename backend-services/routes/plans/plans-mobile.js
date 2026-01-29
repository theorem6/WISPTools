/**
 * Plans Mobile Routes
 * Handles mobile API endpoints for plan distribution with role-based views
 */

const express = require('express');
const router = express.Router();
const { PlanProject } = require('../../models/plan');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../../models/network');

const UnifiedTower = UnifiedSite; // Backwards compatibility alias

/**
 * GET /plans/mobile/:userId - Get plans for mobile app user (role-based)
 * Query: role, filter=assigned-to-me (return only plans assigned to this user)
 */
router.get('/mobile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, filter } = req.query; // role: 'engineer', 'tower-crew', etc.; filter: 'assigned-to-me'
    
    const query = {
      tenantId: req.tenantId,
      status: { $in: ['approved', 'ready'] }
    };
    if (filter === 'assigned-to-me') {
      query.$or = [
        { 'deployment.assignedTo': userId },
        { 'deployment.assignedTeam': userId },
        { 'deployment.fieldTechs.userId': userId }
      ];
    }
    const plans = await PlanProject.find(query).lean();
    
    // Filter and format plans based on user role
    const roleBasedPlans = plans.map(plan => {
      const planData = {
        id: plan._id.toString(),
        name: plan.name,
        description: plan.description,
        status: plan.status,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      };
      
      // Role-based filtering - different roles see different portions
      switch (role) {
        case 'engineer':
          // Engineers see full technical details
          planData.scope = plan.scope;
          planData.hardwareRequirements = plan.hardwareRequirements;
          planData.deployment = plan.deployment;
          break;
          
        case 'tower-crew':
        case 'installer':
          // Tower crew sees installation-specific info
          planData.scope = {
            towers: plan.scope.towers,
            sectors: plan.scope.sectors,
            equipment: plan.scope.equipment
          };
          planData.deployment = {
            estimatedStartDate: plan.deployment?.estimatedStartDate,
            estimatedEndDate: plan.deployment?.estimatedEndDate,
            assignedTo: plan.deployment?.assignedTo,
            notes: plan.deployment?.notes
          };
          // Get actual site locations for installation
          planData.sites = []; // Will be populated below
          break;
          
        case 'manager':
        case 'supervisor':
          // Managers see overview and financials
          planData.scope = plan.scope;
          planData.purchasePlan = {
            totalEstimatedCost: plan.purchasePlan?.totalEstimatedCost,
            procurementStatus: plan.purchasePlan?.procurementStatus
          };
          planData.deployment = plan.deployment;
          break;
          
        default:
          // Default: minimal info
          planData.scope = {
            towers: plan.scope.towers?.length || 0,
            sectors: plan.scope.sectors?.length || 0,
            cpeDevices: plan.scope.cpeDevices?.length || 0,
            equipment: plan.scope.equipment?.length || 0
          };
      }
      
      return planData;
    });
    
    // For tower crew, fetch actual site details
    if (role === 'tower-crew' || role === 'installer') {
      for (const planData of roleBasedPlans) {
        if (planData.sites && planData.scope) {
          const [towers, sectors] = await Promise.all([
            UnifiedTower.find({ 
              tenantId: req.tenantId, 
              _id: { $in: planData.scope.towers } 
            }).select('name location address towerContact siteContact accessInstructions gateCode').lean(),
            UnifiedSector.find({ 
              tenantId: req.tenantId, 
              _id: { $in: planData.scope.sectors } 
            }).select('name location azimuth beamwidth').lean()
          ]);
          
          planData.sites = towers.map(t => ({
            id: t._id.toString(),
            name: t.name,
            location: t.location,
            address: t.address,
            contact: t.siteContact || t.towerContact,
            accessInstructions: t.accessInstructions,
            gateCode: t.gateCode
          }));
          
          planData.sectors = sectors.map(s => ({
            id: s._id.toString(),
            name: s.name,
            location: s.location,
            azimuth: s.azimuth,
            beamwidth: s.beamwidth
          }));
        }
      }
    }
    
    res.json({
      plans: roleBasedPlans,
      userRole: role,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching mobile plans:', error);
    res.status(500).json({ error: 'Failed to fetch mobile plans', message: error.message });
  }
});

/**
 * GET /plans/mobile/:userId/:planId - Get detailed plan for mobile
 */
router.get('/mobile/:userId/:planId', async (req, res) => {
  try {
    const { userId, planId } = req.params;
    const { role } = req.query;
    
    const plan = await PlanProject.findOne({
      _id: planId,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Return role-appropriate details
    const planDetails = {
      id: plan._id.toString(),
      name: plan.name,
      description: plan.description,
      status: plan.status
    };
    
    // Role-based data filtering
    if (role === 'engineer' || role === 'manager') {
      planDetails.fullDetails = plan;
    } else if (role === 'tower-crew' || role === 'installer') {
      // Get site-specific installation details
      const [towers, sectors, equipment] = await Promise.all([
        UnifiedTower.find({ tenantId: req.tenantId, planId }).lean(),
        UnifiedSector.find({ tenantId: req.tenantId, planId }).lean(),
        NetworkEquipment.find({ tenantId: req.tenantId, planId }).lean()
      ]);
      
      planDetails.installationSites = towers.map(t => ({
        id: t._id.toString(),
        name: t.name,
        location: t.location,
        address: t.address,
        contact: t.siteContact || t.towerContact,
        accessInstructions: t.accessInstructions,
        gateCode: t.gateCode,
        safetyNotes: t.safetyNotes,
        accessHours: t.accessHours
      }));
      
      planDetails.sectors = sectors;
      planDetails.equipment = equipment.filter(eq => 
        ['antenna', 'radio', 'mounting-hardware', 'cable'].includes(eq.type)
      );
      planDetails.deployment = {
        deploymentStage: plan.deployment?.deploymentStage || 'planning',
        notes: plan.deployment?.notes,
        documentation: plan.deployment?.documentation ? {
          notes: plan.deployment.documentation.notes,
          installationPhotos: plan.deployment.documentation.installationPhotos || []
        } : { notes: undefined, installationPhotos: [] }
      };
    }
    
    res.json(planDetails);
  } catch (error) {
    console.error('Error fetching mobile plan details:', error);
    res.status(500).json({ error: 'Failed to fetch plan details', message: error.message });
  }
});

/**
 * PATCH /plans/mobile/:userId/:planId/deployment - Update deployment progress/docs (field app)
 * Body: { deploymentStage?, notes?, documentation?: { notes? } }
 * Allowed only if userId is in deployment.assignedTo, assignedTeam, or fieldTechs[].userId
 */
router.patch('/mobile/:userId/:planId/deployment', async (req, res) => {
  try {
    const { userId, planId } = req.params;
    const { deploymentStage, notes, documentation } = req.body;

    const plan = await PlanProject.findOne({
      _id: planId,
      tenantId: req.tenantId
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const isAssigned =
      plan.deployment?.assignedTo === userId ||
      (Array.isArray(plan.deployment?.assignedTeam) && plan.deployment.assignedTeam.includes(userId)) ||
      (Array.isArray(plan.deployment?.fieldTechs) && plan.deployment.fieldTechs.some((ft) => ft.userId === userId));
    if (!isAssigned) {
      return res.status(403).json({ error: 'Only assigned techs can update deployment progress' });
    }

    if (!plan.deployment) plan.deployment = {};
    if (deploymentStage != null) {
      const allowed = ['planning', 'procurement', 'preparation', 'in_progress', 'testing', 'completed', 'on_hold', 'cancelled'];
      if (allowed.includes(deploymentStage)) {
        plan.deployment.deploymentStage = deploymentStage;
        if (deploymentStage === 'in_progress' && !plan.deployment.actualStartDate) {
          plan.deployment.actualStartDate = new Date();
        }
        if (deploymentStage === 'completed') {
          plan.deployment.actualEndDate = new Date();
        }
      }
    }
    if (notes !== undefined) plan.deployment.notes = notes;
    if (documentation && typeof documentation === 'object') {
      if (!plan.deployment.documentation) plan.deployment.documentation = {};
      if (documentation.notes !== undefined) plan.deployment.documentation.notes = documentation.notes;
      if (Array.isArray(documentation.installationPhotos)) {
        plan.deployment.documentation.installationPhotos = documentation.installationPhotos;
      }
    }
    plan.updatedAt = new Date();
    await plan.save();

    res.json({
      plan: plan.toObject ? plan.toObject() : plan,
      message: 'Deployment updated'
    });
  } catch (error) {
    console.error('Error updating plan deployment:', error);
    res.status(500).json({ error: 'Failed to update deployment', message: error.message });
  }
});

module.exports = router;

