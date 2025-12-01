/**
 * Plans Features Routes
 * Handles plan layer features (staged features for plans)
 */

const express = require('express');
const router = express.Router();
const { PlanProject } = require('../../models/plan');
const { PlanLayerFeature } = require('../../models/plan-layer-feature');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../../models/network');
const planPromotionService = require('../../services/planPromotionService');

const UnifiedTower = UnifiedSite; // Backwards compatibility alias

/**
 * GET /plans/:id/features - List staged features for plan
 */
router.get('/:id/features', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const features = await PlanLayerFeature.find({
      tenantId: req.tenantId,
      planId: req.params.id
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      features,
      summary: plan.stagedFeatureCounts || { total: 0, byType: {}, byStatus: {} }
    });
  } catch (error) {
    console.error('Error fetching plan features:', error);
    res.status(500).json({ error: 'Failed to fetch plan features', message: error.message });
  }
});

/**
 * POST /plans/:id/features - Create staged feature
 */
router.post('/:id/features', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const { featureType, geometry, properties, status, metadata } = req.body;

    if (!featureType) {
      return res.status(400).json({ error: 'featureType is required' });
    }

    if (!geometry || !geometry.type || geometry.coordinates === undefined) {
      return res.status(400).json({ error: 'geometry with type and coordinates is required' });
    }

    const feature = new PlanLayerFeature({
      tenantId: req.tenantId,
      planId: req.params.id,
      featureType,
      geometry,
      properties: properties || {},
      status: status || 'draft',
      metadata: metadata || {},
      createdBy: req.user?.email || req.body.createdBy || 'System',
      createdById: req.user?.uid || req.body.createdById || null,
      updatedBy: req.user?.email || req.body.createdBy || 'System',
      updatedById: req.user?.uid || req.body.createdById || null
    });

    await feature.save();

    const summary = await planPromotionService.updatePlanFeatureSummary(req.tenantId, req.params.id);

    res.status(201).json({
      feature: feature.toObject(),
      summary
    });
  } catch (error) {
    console.error('Error creating plan feature:', error);
    res.status(500).json({ error: 'Failed to create feature', message: error.message });
  }
});

/**
 * PATCH /plans/:id/features/:featureId - Update staged feature
 */
router.patch('/:id/features/:featureId', async (req, res) => {
  try {
    const updates = {};

    if (req.body.featureType) {
      updates.featureType = req.body.featureType;
    }

    if (req.body.geometry) {
      const { geometry } = req.body;
      if (!geometry.type || geometry.coordinates === undefined) {
        return res.status(400).json({ error: 'geometry must include type and coordinates' });
      }
      updates.geometry = geometry;
    }

    if (req.body.properties !== undefined) {
      updates.properties = req.body.properties;
    }

    if (req.body.status) {
      updates.status = req.body.status;
    }

    if (req.body.metadata !== undefined) {
      updates.metadata = req.body.metadata;
    }

    updates.updatedBy = req.user?.email || req.body.updatedBy || 'System';
    updates.updatedById = req.user?.uid || req.body.updatedById || null;

    const feature = await PlanLayerFeature.findOneAndUpdate(
      {
        _id: req.params.featureId,
        tenantId: req.tenantId,
        planId: req.params.id
      },
      { $set: updates },
      { new: true }
    ).lean();

    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    const summary = await planPromotionService.updatePlanFeatureSummary(req.tenantId, req.params.id);

    res.json({ feature, summary });
  } catch (error) {
    console.error('Error updating plan feature:', error);
    res.status(500).json({ error: 'Failed to update feature', message: error.message });
  }
});

/**
 * DELETE /plans/:id/features/:featureId - Remove staged feature
 */
router.delete('/:id/features/:featureId', async (req, res) => {
  try {
    const feature = await PlanLayerFeature.findOneAndDelete({
      _id: req.params.featureId,
      tenantId: req.tenantId,
      planId: req.params.id
    }).lean();

    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    const summary = await planPromotionService.updatePlanFeatureSummary(req.tenantId, req.params.id);

    res.json({
      message: 'Feature deleted',
      summary
    });
  } catch (error) {
    console.error('Error deleting plan feature:', error);
    res.status(500).json({ error: 'Failed to delete feature', message: error.message });
  }
});

/**
 * GET /plans/:id/sites - Get all sites/equipment associated with a plan
 */
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

module.exports = router;

