/**
 * HSS Group Routes
 * Group management operations
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { ensureDB } = require('./hss-middleware');

// Apply middleware to all routes
router.use(ensureDB);

/**
 * GET /groups
 * List all groups for a tenant with full details
 */
router.get('/groups', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const groups = await req.db.collection('subscriber_groups')
      .find({ tenant_id: tenantId })
      .sort({ created_at: -1 })
      .toArray();

    res.json({
      count: groups.length,
      groups: groups.map(g => ({
        id: g.group_id || g._id.toString(),
        group_id: g.group_id || g._id.toString(),
        name: g.name,
        description: g.description || '',
        bandwidth_plan_id: g.bandwidth_plan_id || null,
        bandwidth_plan_name: g.bandwidth_plan_name || null,
        subscriber_count: g.subscriber_count || 0,
        default_apn: g.default_apn || 'internet',
        default_qci: g.default_qci || 9,
        created_at: g.created_at,
        updated_at: g.updated_at
      }))
    });

  } catch (error) {
    console.error('Error listing groups:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /groups/:group_id
 * Get a single group by ID
 */
router.get('/groups/:group_id', async (req, res) => {
  try {
    const { group_id } = req.params;
    const tenantId = req.headers['x-tenant-id'];

    let query = { tenant_id: tenantId };
    
    // Try to find by group_id or ObjectId
    if (ObjectId.isValid(group_id)) {
      query = {
        $or: [
          { group_id: group_id },
          { _id: new ObjectId(group_id) }
        ],
        tenant_id: tenantId
      };
    } else {
      query.group_id = group_id;
    }

    const group = await req.db.collection('subscriber_groups').findOne(query);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({
      id: group.group_id || group._id.toString(),
      group_id: group.group_id || group._id.toString(),
      name: group.name,
      description: group.description || '',
      bandwidth_plan_id: group.bandwidth_plan_id || null,
      bandwidth_plan_name: group.bandwidth_plan_name || null,
      subscriber_count: group.subscriber_count || 0,
      default_apn: group.default_apn || 'internet',
      default_qci: group.default_qci || 9,
      created_at: group.created_at,
      updated_at: group.updated_at
    });

  } catch (error) {
    console.error('Error getting group:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /groups
 * Create a new group with validation
 */
router.post('/groups', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { name, description, bandwidth_plan_id, default_apn, default_qci } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Group name is required' });
    }

    // Check for duplicate name
    const existing = await req.db.collection('subscriber_groups').findOne({
      tenant_id: tenantId,
      name: name
    });

    if (existing) {
      return res.status(400).json({ error: 'Group name already exists' });
    }

    // Get bandwidth plan name if provided
    let bandwidthPlanName = null;
    if (bandwidth_plan_id) {
      let planQuery = { tenant_id: tenantId };
      if (ObjectId.isValid(bandwidth_plan_id)) {
        planQuery = {
          $or: [
            { plan_id: bandwidth_plan_id },
            { _id: new ObjectId(bandwidth_plan_id) }
          ],
          tenant_id: tenantId
        };
      } else {
        planQuery.plan_id = bandwidth_plan_id;
      }
      
      const plan = await req.db.collection('bandwidth_plans').findOne(planQuery);
      bandwidthPlanName = plan ? plan.name : null;
    }

    const group_id = `group_${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const now = new Date();

    const newGroup = {
      group_id,
      tenant_id: tenantId,
      name: name.trim(),
      description: description ? description.trim() : '',
      bandwidth_plan_id: bandwidth_plan_id || null,
      bandwidth_plan_name: bandwidthPlanName,
      subscriber_count: 0,
      default_apn: default_apn || 'internet',
      default_qci: default_qci || 9,
      created_at: now,
      updated_at: now
    };

    await req.db.collection('subscriber_groups').insertOne(newGroup);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group: {
        id: group_id,
        group_id,
        ...newGroup
      }
    });

  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /groups/:group_id
 * Update an existing group
 */
router.put('/groups/:group_id', async (req, res) => {
  try {
    const { group_id } = req.params;
    const tenantId = req.headers['x-tenant-id'];
    const { name, description, bandwidth_plan_id, default_apn, default_qci } = req.body;

    // Find the group
    let query = { tenant_id: tenantId };
    if (ObjectId.isValid(group_id)) {
      query = {
        $or: [
          { group_id: group_id },
          { _id: new ObjectId(group_id) }
        ],
        tenant_id: tenantId
      };
    } else {
      query.group_id = group_id;
    }

    const group = await req.db.collection('subscriber_groups').findOne(query);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check for duplicate name if name is being changed
    if (name && name !== group.name) {
      const existing = await req.db.collection('subscriber_groups').findOne({
        tenant_id: tenantId,
        name: name,
        group_id: { $ne: group.group_id }
      });

      if (existing) {
        return res.status(400).json({ error: 'Group name already exists' });
      }
    }

    // Get bandwidth plan name if provided
    let bandwidthPlanName = group.bandwidth_plan_name;
    if (bandwidth_plan_id !== undefined) {
      if (bandwidth_plan_id) {
        let planQuery = { tenant_id: tenantId };
        if (ObjectId.isValid(bandwidth_plan_id)) {
          planQuery = {
            $or: [
              { plan_id: bandwidth_plan_id },
              { _id: new ObjectId(bandwidth_plan_id) }
            ],
            tenant_id: tenantId
          };
        } else {
          planQuery.plan_id = bandwidth_plan_id;
        }
        
        const plan = await req.db.collection('bandwidth_plans').findOne(planQuery);
        bandwidthPlanName = plan ? plan.name : null;
      } else {
        bandwidthPlanName = null;
      }
    }

    const updates = {
      updated_at: new Date()
    };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (bandwidth_plan_id !== undefined) {
      updates.bandwidth_plan_id = bandwidth_plan_id || null;
      updates.bandwidth_plan_name = bandwidthPlanName;
    }
    if (default_apn !== undefined) updates.default_apn = default_apn;
    if (default_qci !== undefined) updates.default_qci = default_qci;

    await req.db.collection('subscriber_groups').updateOne(
      { group_id: group.group_id },
      { $set: updates }
    );

    // Update all subscribers in this group with new bandwidth plan
    if (bandwidth_plan_id !== undefined) {
      await req.db.collection('subscribers').updateMany(
        { group_id: group.group_id },
        { 
          $set: { 
            bandwidth_plan_id: bandwidth_plan_id || null,
            bandwidth_plan_name: bandwidthPlanName,
            updated_at: new Date()
          } 
        }
      );
    }

    res.json({
      success: true,
      message: 'Group updated successfully',
      group: {
        id: group.group_id,
        group_id: group.group_id,
        ...group,
        ...updates
      }
    });

  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /groups/:group_id
 * Delete a group (only if it has no subscribers)
 */
router.delete('/groups/:group_id', async (req, res) => {
  try {
    const { group_id } = req.params;
    const tenantId = req.headers['x-tenant-id'];

    // Find the group
    let query = { tenant_id: tenantId };
    if (ObjectId.isValid(group_id)) {
      query = {
        $or: [
          { group_id: group_id },
          { _id: new ObjectId(group_id) }
        ],
        tenant_id: tenantId
      };
    } else {
      query.group_id = group_id;
    }

    const group = await req.db.collection('subscriber_groups').findOne(query);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if group has subscribers
    const subscriberCount = await req.db.collection('subscribers').countDocuments({
      group_id: group.group_id
    });

    if (subscriberCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete group with subscribers',
        subscriber_count: subscriberCount
      });
    }

    await req.db.collection('subscriber_groups').deleteOne({ group_id: group.group_id });

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
