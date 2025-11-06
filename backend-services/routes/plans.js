// Planning System API
// Manages deployment plans and project workflows

const express = require('express');
const router = express.Router();
const { PlanProject } = require('../models/plan');
const { InventoryItem } = require('../models/inventory');
const { UnifiedTower, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../models/network');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Require tenant ID
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(requireTenant);

// ============================================================================
// PLAN MANAGEMENT
// ============================================================================

// GET /plans - Get all plans for tenant
router.get('/', async (req, res) => {
  try {
    const { status, createdBy } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (status) query.status = status;
    if (createdBy) query.createdBy = createdBy;
    
    const plans = await PlanProject.find(query)
      .sort({ updatedAt: -1 })
      .lean();
    
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans', message: error.message });
  }
});

// GET /plans/:id - Get single plan
router.get('/:id', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json(plan);
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ error: 'Failed to fetch plan', message: error.message });
  }
});

// POST /plans - Create new plan
router.post('/', async (req, res) => {
  try {
    // Ensure createdBy is always set (required field)
    // Priority: req.body.createdBy > req.body.email > 'System'
    const createdBy = req.body.createdBy || req.body.email || 'System';
    
    const planData = {
      ...req.body,
      tenantId: req.tenantId,
      createdBy: createdBy, // Always ensure this is set before validation
      createdById: req.body.createdById || req.body.uid || null,
      status: req.body.status || 'draft',
      showOnMap: req.body.showOnMap !== undefined ? req.body.showOnMap : false,
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
    
    const plan = new PlanProject(planData);
    await plan.save();
    
    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: 'Failed to create plan', message: error.message });
  }
});

// PUT /plans/:id - Update plan
router.put('/:id', async (req, res) => {
  try {
    const plan = await PlanProject.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { 
        ...req.body, 
        updatedAt: new Date(),
        updatedBy: req.user?.email || req.user?.name,
        updatedById: req.user?.uid
      },
      { new: true, runValidators: true }
    );
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json(plan);
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan', message: error.message });
  }
});

// PUT /plans/:id/toggle-visibility - Toggle plan visibility on map
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

// POST /plans/:id/approve - Approve plan for deployment
router.post('/:id/approve', async (req, res) => {
  try {
    const { notes } = req.body;
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    if (plan.status !== 'ready') {
      return res.status(400).json({ error: 'Plan must be in "ready" status to approve' });
    }
    
    plan.status = 'approved';
    plan.approval = {
      approvedBy: req.user?.email || req.user?.name || 'System',
      approvedAt: new Date(),
      approvalNotes: notes || ''
    };
    plan.updatedAt = new Date();
    await plan.save();
    
    res.json({ plan, message: 'Plan approved for deployment' });
  } catch (error) {
    console.error('Error approving plan:', error);
    res.status(500).json({ error: 'Failed to approve plan', message: error.message });
  }
});

// POST /plans/:id/reject - Reject plan with reason
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason, notes } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    if (plan.status !== 'ready' && plan.status !== 'approved') {
      return res.status(400).json({ error: 'Plan must be in "ready" or "approved" status to reject' });
    }
    
    plan.status = 'rejected';
    plan.approval = {
      rejectedBy: req.user?.email || req.user?.name || 'System',
      rejectedAt: new Date(),
      rejectionReason: reason,
      approvalNotes: notes || ''
    };
    plan.updatedAt = new Date();
    await plan.save();
    
    res.json({ plan, message: 'Plan rejected' });
  } catch (error) {
    console.error('Error rejecting plan:', error);
    res.status(500).json({ error: 'Failed to reject plan', message: error.message });
  }
});

// GET /plans/:id/sites - Get all sites/equipment associated with a plan
router.get('/:id/sites', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Get all sites/equipment with this planId
    const [towers, sectors, cpe, equipment] = await Promise.all([
      UnifiedTower.find({ tenantId: req.tenantId, planId: req.params.id }).lean(),
      UnifiedSector.find({ tenantId: req.tenantId, planId: req.params.id }).lean(),
      UnifiedCPE.find({ tenantId: req.tenantId, planId: req.params.id }).lean(),
      NetworkEquipment.find({ tenantId: req.tenantId, planId: req.params.id }).lean()
    ]);
    
    res.json({
      plan: {
        id: plan._id,
        name: plan.name,
        status: plan.status,
        showOnMap: plan.showOnMap
      },
      sites: towers,
      sectors,
      cpeDevices: cpe,
      equipment
    });
  } catch (error) {
    console.error('Error fetching plan sites:', error);
    res.status(500).json({ error: 'Failed to fetch plan sites', message: error.message });
  }
});

// ============================================================================
// MOBILE API - Plan Distribution with Role-Based Views
// ============================================================================

// GET /plans/mobile/:userId - Get plans for mobile app user (role-based)
router.get('/mobile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query; // 'engineer', 'tower-crew', 'manager', etc.
    
    // Get all approved/ready plans for the tenant
    const plans = await PlanProject.find({
      tenantId: req.tenantId,
      status: { $in: ['approved', 'ready'] }
    }).lean();
    
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

// GET /plans/mobile/:userId/:planId - Get detailed plan for mobile
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
    }
    
    res.json(planDetails);
  } catch (error) {
    console.error('Error fetching mobile plan details:', error);
    res.status(500).json({ error: 'Failed to fetch plan details', message: error.message });
  }
});

// DELETE /plans/:id - Delete plan
router.delete('/:id', async (req, res) => {
  try {
    const plan = await PlanProject.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json({ message: 'Plan deleted successfully', plan });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ error: 'Failed to delete plan', message: error.message });
  }
});

// ============================================================================
// HARDWARE REQUIREMENTS
// ============================================================================

// POST /plans/:id/requirements - Add hardware requirement
router.post('/:id/requirements', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const costEstimate = await estimateHardwareCost(req.tenantId, req.body);
    
    const requirement = {
      ...req.body,
      estimatedCost: costEstimate.estimatedCost,
      costConfidence: costEstimate.confidence,
      costSource: costEstimate.source
    };
    
    plan.hardwareRequirements.needed.push(requirement);
    await plan.save();
    
    // Re-analyze missing hardware
    await analyzeMissingHardware(plan);
    
    res.json(plan);
  } catch (error) {
    console.error('Error adding requirement:', error);
    res.status(500).json({ error: 'Failed to add requirement', message: error.message });
  }
});

// DELETE /plans/:id/requirements/:requirementIndex - Remove hardware requirement
router.delete('/:id/requirements/:requirementIndex', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const requirementIndex = parseInt(req.params.requirementIndex);
    if (requirementIndex < 0 || requirementIndex >= plan.hardwareRequirements.needed.length) {
      return res.status(400).json({ error: 'Invalid requirement index' });
    }
    
    plan.hardwareRequirements.needed.splice(requirementIndex, 1);
    await plan.save();
    
    // Re-analyze missing hardware
    await analyzeMissingHardware(plan);
    
    res.json(plan);
  } catch (error) {
    console.error('Error removing requirement:', error);
    res.status(500).json({ error: 'Failed to remove requirement', message: error.message });
  }
});

// ============================================================================
// MISSING HARDWARE ANALYSIS
// ============================================================================

// POST /plans/:id/analyze - Analyze missing hardware
router.post('/:id/analyze', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    await analyzeMissingHardware(plan);
    
    res.json(plan);
  } catch (error) {
    console.error('Error analyzing missing hardware:', error);
    res.status(500).json({ error: 'Failed to analyze missing hardware', message: error.message });
  }
});

// GET /plans/:id/missing-hardware - Get missing hardware analysis
router.get('/:id/missing-hardware', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json({
      missingHardware: plan.purchasePlan.missingHardware,
      totalEstimatedCost: plan.purchasePlan.totalEstimatedCost,
      procurementStatus: plan.purchasePlan.procurementStatus
    });
  } catch (error) {
    console.error('Error fetching missing hardware:', error);
    res.status(500).json({ error: 'Failed to fetch missing hardware', message: error.message });
  }
});

// ============================================================================
// PURCHASE ORDERS
// ============================================================================

// POST /plans/:id/purchase-order - Generate purchase order
router.post('/:id/purchase-order', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    if (plan.purchasePlan.missingHardware.length === 0) {
      return res.status(400).json({ error: 'No missing hardware to generate purchase order' });
    }
    
    const purchaseOrderId = `PO_${plan._id}_${Date.now()}`;
    
    const items = plan.purchasePlan.missingHardware.map(item => ({
      equipmentType: `${item.manufacturer || 'Generic'} ${item.model || item.equipmentType}`,
      quantity: item.quantity,
      estimatedCost: item.estimatedCost,
      priority: item.priority,
      specifications: item.specifications,
      alternatives: item.alternatives
    }));
    
    const purchaseOrder = {
      purchaseOrderId,
      planId: plan._id,
      planName: plan.name,
      items,
      totalCost: plan.purchasePlan.totalEstimatedCost,
      generatedAt: new Date(),
      generatedBy: req.user?.email || req.user?.name
    };
    
    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error generating purchase order:', error);
    res.status(500).json({ error: 'Failed to generate purchase order', message: error.message });
  }
});

// ============================================================================
// EXISTING HARDWARE QUERY
// ============================================================================

// GET /plans/hardware/existing - Get all existing hardware from all modules
router.get('/hardware/existing', async (req, res) => {
  try {
    const hardware = [];
    
    // Get towers
    const towers = await UnifiedTower.find({ tenantId: req.tenantId }).lean();
    towers.forEach(tower => {
      hardware.push({
        id: tower._id.toString(),
        type: 'tower',
        name: tower.name,
        location: {
          latitude: tower.location.latitude,
          longitude: tower.location.longitude,
          address: tower.location.address
        },
        status: tower.status,
        module: 'manual',
        lastUpdated: tower.updatedAt,
        isReadOnly: true,
        inventoryId: tower.inventoryId
      });
    });
    
    // Get sectors
    const sectors = await UnifiedSector.find({ tenantId: req.tenantId }).lean();
    sectors.forEach(sector => {
      hardware.push({
        id: sector._id.toString(),
        type: 'sector',
        name: `${sector.name} - Sector ${sector.azimuth}?`,
        location: {
          latitude: sector.location.latitude,
          longitude: sector.location.longitude
        },
        status: sector.status,
        module: sector.modules?.pci ? 'pci' : 'manual',
        lastUpdated: sector.updatedAt,
        isReadOnly: true,
        inventoryId: sector.inventoryId
      });
    });
    
    // Get CPE devices
    const cpeDevices = await UnifiedCPE.find({ tenantId: req.tenantId }).lean();
    cpeDevices.forEach(cpe => {
      hardware.push({
        id: cpe._id.toString(),
        type: 'cpe',
        name: `${cpe.manufacturer} ${cpe.model} - ${cpe.serialNumber}`,
        location: {
          latitude: cpe.location.latitude,
          longitude: cpe.location.longitude,
          address: cpe.location.address
        },
        status: cpe.status,
        module: cpe.modules?.acs ? 'acs' : cpe.modules?.hss ? 'hss' : 'manual',
        lastUpdated: cpe.updatedAt,
        isReadOnly: true,
        inventoryId: cpe.inventoryId
      });
    });
    
    // Get inventory items
    const inventoryItems = await InventoryItem.find({ tenantId: req.tenantId }).lean();
    inventoryItems.forEach(item => {
      // Only include items that aren't already mapped to coverage map
      const alreadyMapped = hardware.some(h => h.inventoryId === item._id.toString());
      if (!alreadyMapped) {
        hardware.push({
          id: item._id.toString(),
          type: 'equipment',
          name: `${item.manufacturer || 'Unknown'} ${item.model || 'Unknown'} - ${item.serialNumber}`,
          location: {
            latitude: item.currentLocation?.latitude || 0,
            longitude: item.currentLocation?.longitude || 0,
            address: item.currentLocation?.address
          },
          status: item.status,
          module: item.modules?.acs ? 'acs' : item.modules?.hss ? 'hss' : 'inventory',
          lastUpdated: item.updatedAt,
          isReadOnly: true,
          inventoryId: item._id.toString()
        });
      }
    });
    
    res.json(hardware);
  } catch (error) {
    console.error('Error fetching existing hardware:', error);
    res.status(500).json({ error: 'Failed to fetch existing hardware', message: error.message });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function analyzeMissingHardware(plan) {
  try {
    const existingInventory = await InventoryItem.find({ tenantId: plan.tenantId }).lean();
    
    // Clear existing missing hardware analysis
    plan.purchasePlan.missingHardware = [];
    plan.purchasePlan.totalEstimatedCost = 0;
    
    // Analyze each hardware requirement
    for (const requirement of plan.hardwareRequirements.needed) {
      const available = existingInventory.filter(item => 
        item.category === requirement.category &&
        item.equipmentType === requirement.equipmentType &&
        (item.status === 'available' || item.status === 'reserved')
      );
      
      const availableQuantity = available.length;
      const neededQuantity = requirement.quantity;
      
      if (availableQuantity < neededQuantity) {
        const missingQuantity = neededQuantity - availableQuantity;
        const costEstimate = await estimateHardwareCost(plan.tenantId, requirement);
        const estimatedCost = costEstimate.estimatedCost;
        
        plan.purchasePlan.missingHardware.push({
          id: `missing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          category: requirement.category,
          equipmentType: requirement.equipmentType,
          manufacturer: requirement.manufacturer,
          model: requirement.model,
          quantity: missingQuantity,
          estimatedCost: estimatedCost * missingQuantity,
          priority: requirement.priority,
          specifications: requirement.specifications,
          reason: generateMissingHardwareReason(requirement, missingQuantity, availableQuantity),
          alternatives: generateAlternatives(requirement),
          costConfidence: costEstimate.confidence,
          costSource: costEstimate.source
        });
        
        plan.purchasePlan.totalEstimatedCost += estimatedCost * missingQuantity;
      }
    }
    
    plan.updatedAt = new Date();
    await plan.save();
  } catch (error) {
    console.error('Error analyzing missing hardware:', error);
    throw error;
  }
}

/**
 * Estimate hardware cost using pricing database
 * Falls back to inventory averages, then hardcoded defaults
 */
async function estimateHardwareCost(tenantId, requirement) {
  try {
    // Try to get price from pricing database
    const axios = require('axios');
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    
    const params = new URLSearchParams({
      category: requirement.category || '',
      equipmentType: requirement.equipmentType || '',
      manufacturer: requirement.manufacturer || '',
      model: requirement.model || ''
    });
    
    try {
      const response = await axios.get(`${baseUrl}/api/equipment-pricing/price?${params}`, {
        headers: {
          'x-tenant-id': tenantId
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.data?.price) {
        return {
          estimatedCost: response.data.price * (requirement.quantity || 1),
          confidence: response.data.confidence || 'high',
          source: response.data.source || 'pricing_database'
        };
      }
    } catch (apiError) {
      console.warn('Pricing API not available, using fallback:', apiError.message);
    }
    
    // Fallback to hardcoded estimates (last resort)
    const costEstimates = {
      'tower': 50000,
      'sector-antenna': 2000,
      'cpe-device': 500,
      'router': 300,
      'switch': 200,
      'power-supply': 150,
      'cable': 5,
      'connector': 10,
      'mounting-hardware': 100,
      'backhaul-radio': 3000,
      'fiber-optic': 2,
      'ups': 800,
      'generator': 5000,
      // Add more defaults
      'Base Station (eNodeB/gNodeB)': 15000,
      'Remote Radio Head (RRH)': 3000,
      'Radio Unit (RU)': 2500,
      'Baseband Unit (BBU)': 8000,
      'Sector Antenna': 2000,
      'Panel Antenna': 1500,
      'Parabolic Dish': 2500,
      'LTE CPE': 500,
      'CBRS CPE': 600,
      'Rectifier': 800,
      'Battery Bank': 1500,
      'UPS': 800,
      'Generator': 5000
    };
    
    const basePrice = costEstimates[requirement.equipmentType] || 1000;
    
    return {
      estimatedCost: basePrice * (requirement.quantity || 1),
      confidence: 'low',
      source: 'fallback_default'
    };
  } catch (error) {
    console.error('Error estimating cost:', error);
    // Ultimate fallback
    return {
      estimatedCost: 1000 * (requirement.quantity || 1),
      confidence: 'low',
      source: 'error_fallback'
    };
  }
}

function generateMissingHardwareReason(requirement, missingQuantity, availableQuantity) {
  if (availableQuantity === 0) {
    return `No ${requirement.equipmentType} equipment available in inventory`;
  } else {
    return `Only ${availableQuantity} ${requirement.equipmentType} available, need ${missingQuantity} more`;
  }
}

function generateAlternatives(requirement) {
  const alternatives = [];
  
  // Add some generic alternatives based on equipment type
  switch (requirement.equipmentType) {
    case 'cpe-device':
      alternatives.push(
        { manufacturer: 'Ubiquiti', model: 'NanoStation M5', estimatedCost: 450, availability: 'in-stock' },
        { manufacturer: 'MikroTik', model: 'SXT Lite5', estimatedCost: 380, availability: 'in-stock' },
        { manufacturer: 'Cambium', model: 'ePMP 1000', estimatedCost: 520, availability: 'backorder' }
      );
      break;
    case 'sector-antenna':
      alternatives.push(
        { manufacturer: 'RFS', model: 'Sector Antenna 120?', estimatedCost: 1800, availability: 'in-stock' },
        { manufacturer: 'CommScope', model: 'Sector Antenna 90?', estimatedCost: 2200, availability: 'in-stock' }
      );
      break;
    case 'router':
      alternatives.push(
        { manufacturer: 'Cisco', model: 'ISR 4331', estimatedCost: 2500, availability: 'in-stock' },
        { manufacturer: 'Juniper', model: 'MX104', estimatedCost: 3000, availability: 'backorder' }
      );
      break;
  }
  
  return alternatives;
}

module.exports = router;
