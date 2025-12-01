/**
 * Plans Approval Routes
 * Handles plan approval, rejection, and authorization workflows
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { PlanProject } = require('../../models/plan');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../../models/network');
const { PlanLayerFeature } = require('../../models/plan-layer-feature');
const { createProjectApprovalNotification } = require('../notifications');
const planMarketingLeadService = require('../../services/planMarketingLeadService');
const planPromotionService = require('../../services/planPromotionService');

const UnifiedTower = UnifiedSite; // Backwards compatibility alias

/**
 * POST /plans/:id/approve - Approve plan for deployment
 */
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

    let marketingLeadSummary = { created: 0, updated: 0, skipped: 0 };
    try {
      marketingLeadSummary = await planMarketingLeadService.createMarketingLeadsForPlan(
        plan,
        req.tenantId,
        req.user?.email || req.user?.name || 'System'
      );
      console.log('Marketing leads synced for plan approval:', {
        planId: plan._id?.toString?.() ?? plan.id,
        ...marketingLeadSummary
      });
    } catch (leadError) {
      console.error('Failed to sync marketing leads during plan approval:', leadError);
    }
    
    // Create notifications for field techs
    try {
      await createProjectApprovalNotification(
        plan._id.toString(),
        plan.name,
        req.tenantId,
        plan.approval.approvedBy
      );
    } catch (notifError) {
      console.error('Failed to create notifications (non-blocking):', notifError);
    }
    
    res.json({ plan, message: 'Plan approved for deployment', marketingLeads: marketingLeadSummary });
  } catch (error) {
    console.error('Error approving plan:', error);
    res.status(500).json({ error: 'Failed to approve plan', message: error.message });
  }
});

/**
 * POST /plans/:id/reject - Reject plan with reason
 */
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

/**
 * POST /plans/:id/authorize - Promote plan-layer assets to production
 */
router.post('/:id/authorize', async (req, res) => {
  const session = await mongoose.startSession();
  let updatedPlan;
  let promotionResults = [];

  try {
    const { notes } = req.body;
    const existingPlan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();

    if (!existingPlan) {
      await session.endSession();
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (existingPlan.status !== 'approved') {
      await session.endSession();
      return res.status(400).json({ error: 'Plan must be approved before authorization' });
    }

    await session.withTransaction(async () => {
      const planDoc = await PlanProject.findOne({
        _id: req.params.id,
        tenantId: req.tenantId
      }).session(session);

      if (!planDoc) {
        throw new Error('plan_missing');
      }

      const planId = planDoc._id.toString();
      const timestamp = new Date();

      promotionResults = await planPromotionService.promotePlanLayerFeatures(planDoc, req.tenantId, req.user, session);

      const updatePayload = {
        planId: null,
        status: 'active',
        originPlanId: planId,
        updatedAt: timestamp
      };

      await Promise.all([
        UnifiedTower.updateMany({ tenantId: req.tenantId, planId }, { $set: updatePayload }).session(session),
        UnifiedSector.updateMany({ tenantId: req.tenantId, planId }, { $set: updatePayload }).session(session),
        UnifiedCPE.updateMany({ tenantId: req.tenantId, planId }, { $set: updatePayload }).session(session),
        NetworkEquipment.updateMany({ tenantId: req.tenantId, planId }, { $set: updatePayload }).session(session)
      ]);

      planDoc.status = 'authorized';
      planDoc.authorization = {
        authorizedBy: req.user?.email || req.user?.name || 'System',
        authorizedAt: timestamp,
        notes: notes || ''
      };
      planDoc.showOnMap = false;
      planDoc.updatedAt = timestamp;
      planDoc.stagedFeatureCounts = await PlanLayerFeature.countByPlan(req.tenantId, planId);
      await planDoc.save({ session });

      updatedPlan = planDoc.toObject();
    });

    await session.endSession();

    if (!updatedPlan) {
      return res.status(500).json({ error: 'Failed to authorize plan', message: 'Authorization transaction did not complete' });
    }

    res.json({
      plan: updatedPlan,
      promotionResults,
      message: 'Plan authorized and promoted to production'
    });
  } catch (error) {
    await session.endSession();
    if (error.message === 'plan_missing') {
      return res.status(404).json({ error: 'Plan not found' });
    }
    console.error('Error authorizing plan:', error);
    res.status(500).json({ error: 'Failed to authorize plan', message: error.message });
  }
});

module.exports = router;

