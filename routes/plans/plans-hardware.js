/**
 * Plans Hardware Routes
 * Handles hardware requirements, analysis, and purchase orders
 */

const express = require('express');
const router = express.Router();
const { PlanProject } = require('../../models/plan');
const { InventoryItem } = require('../../models/inventory');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../../models/network');
const planHardwareService = require('../../services/planHardwareService');

const UnifiedTower = UnifiedSite; // Backwards compatibility alias

/**
 * POST /plans/:id/requirements - Add hardware requirement
 */
router.post('/:id/requirements', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const costEstimate = await planHardwareService.estimateHardwareCost(req.tenantId, req.body);
    
    const requirement = {
      ...req.body,
      estimatedCost: costEstimate.estimatedCost,
      costConfidence: costEstimate.confidence,
      costSource: costEstimate.source
    };
    
    plan.hardwareRequirements.needed.push(requirement);
    await plan.save();
    
    // Re-analyze missing hardware
    await planHardwareService.analyzeMissingHardware(plan);
    
    res.json(plan);
  } catch (error) {
    console.error('Error adding requirement:', error);
    res.status(500).json({ error: 'Failed to add requirement', message: error.message });
  }
});

/**
 * DELETE /plans/:id/requirements/:requirementIndex - Remove hardware requirement
 */
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
    await planHardwareService.analyzeMissingHardware(plan);
    
    res.json(plan);
  } catch (error) {
    console.error('Error removing requirement:', error);
    res.status(500).json({ error: 'Failed to remove requirement', message: error.message });
  }
});

/**
 * POST /plans/:id/analyze - Analyze missing hardware
 */
router.post('/:id/analyze', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    await planHardwareService.analyzeMissingHardware(plan);
    
    res.json(plan);
  } catch (error) {
    console.error('Error analyzing missing hardware:', error);
    res.status(500).json({ error: 'Failed to analyze missing hardware', message: error.message });
  }
});

/**
 * GET /plans/:id/missing-hardware - Get missing hardware analysis
 */
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

/**
 * POST /plans/:id/purchase-order - Generate purchase order
 */
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

/**
 * GET /plans/hardware/existing - Get all existing hardware from all modules
 */
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

module.exports = router;

