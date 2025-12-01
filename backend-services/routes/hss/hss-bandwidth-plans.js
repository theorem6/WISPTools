/**
 * HSS Bandwidth Plans Routes
 * Bandwidth plan management operations
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { ensureDB } = require('./hss-middleware');

// Apply middleware to all routes
router.use(ensureDB);

/**
 * GET /bandwidth-plans
 * List all bandwidth plans for a tenant
 */
router.get('/bandwidth-plans', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const plans = await req.db.collection('bandwidth_plans')
      .find({ tenant_id: tenantId })
      .sort({ created_at: -1 })
      .toArray();

    res.json({
      count: plans.length,
      plans: plans.map(p => ({
        id: p.plan_id || p._id.toString(),
        plan_id: p.plan_id || p._id.toString(),
        name: p.name,
        description: p.description || '',
        // Support both old and new field names
        download_mbps: p.download_mbps || p.max_bandwidth_dl || 0,
        upload_mbps: p.upload_mbps || p.max_bandwidth_ul || 0,
        max_bandwidth_mbps: p.max_bandwidth_mbps || 0,
        max_bandwidth_dl: p.max_bandwidth_dl || p.download_mbps || 0,
        max_bandwidth_ul: p.max_bandwidth_ul || p.upload_mbps || 0,
        created_at: p.created_at,
        updated_at: p.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching bandwidth plans:', error);
    res.status(500).json({ error: 'Failed to fetch bandwidth plans' });
  }
});

/**
 * POST /bandwidth-plans
 * Create a new bandwidth plan
 */
router.post('/bandwidth-plans', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const plan = {
      ...req.body,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await req.db.collection('bandwidth_plans').insertOne(plan);
    res.status(201).json({ id: result.insertedId, ...plan });
  } catch (error) {
    console.error('Error creating bandwidth plan:', error);
    res.status(500).json({ error: 'Failed to create bandwidth plan' });
  }
});

/**
 * PUT /bandwidth-plans/:id
 * Update an existing bandwidth plan
 */
router.put('/bandwidth-plans/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };

    // Find by plan_id or _id (ObjectId)
    let query = { tenant_id: tenantId };
    if (ObjectId.isValid(id)) {
      query = {
        $or: [
          { plan_id: id },
          { _id: new ObjectId(id) }
        ],
        tenant_id: tenantId
      };
    } else {
      query.plan_id = id;
    }

    const result = await req.db.collection('bandwidth_plans').updateOne(
      query,
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Bandwidth plan not found' });
    }

    res.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('Error updating bandwidth plan:', error);
    res.status(500).json({ error: 'Failed to update bandwidth plan' });
  }
});

/**
 * DELETE /bandwidth-plans/:id
 * Delete a bandwidth plan (only if not in use)
 */
router.delete('/bandwidth-plans/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;

    // Find by plan_id or _id (ObjectId)
    let query = { tenant_id: tenantId };
    if (ObjectId.isValid(id)) {
      query = {
        $or: [
          { plan_id: id },
          { _id: new ObjectId(id) }
        ],
        tenant_id: tenantId
      };
    } else {
      query.plan_id = id;
    }

    const plan = await req.db.collection('bandwidth_plans').findOne(query);

    if (!plan) {
      return res.status(404).json({ error: 'Bandwidth plan not found' });
    }

    // Check if any groups are using this plan
    const groupsUsingPlan = await req.db.collection('subscriber_groups').countDocuments({
      bandwidth_plan_id: plan.plan_id || plan._id.toString()
    });

    if (groupsUsingPlan > 0) {
      return res.status(400).json({
        error: 'Cannot delete bandwidth plan that is in use by groups',
        groups_using: groupsUsingPlan
      });
    }

    // Delete by plan_id
    await req.db.collection('bandwidth_plans').deleteOne({ 
      plan_id: plan.plan_id || plan._id.toString() 
    });

    res.json({ 
      success: true, 
      message: 'Bandwidth plan deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting bandwidth plan:', error);
    res.status(500).json({ error: 'Failed to delete bandwidth plan' });
  }
});

module.exports = router;
