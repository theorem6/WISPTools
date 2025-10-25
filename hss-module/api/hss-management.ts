/**
 * HSS Management API - Groups, Bandwidth Plans, and Dashboard
 * 
 * Complete CRUD operations for HSS subscriber groups and bandwidth plans
 */

import { Router, Request, Response } from 'express';
import { MongoClient, Db, ObjectId } from 'mongodb';

const router = Router();

// MongoDB connection
let db: Db | null = null;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hss';

// Initialize MongoDB connection
async function getDb(): Promise<Db> {
  if (db) return db;
  
  const client = await MongoClient.connect(MONGODB_URI);
  db = client.db();
  console.log('✅ HSS Management API connected to MongoDB');
  return db;
}

// ============================================================================
// GROUP MANAGEMENT
// ============================================================================

/**
 * GET /groups
 * List all groups for a tenant
 */
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const database = await getDb();
    const groups = await database.collection('subscriber_groups')
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

  } catch (error: any) {
    console.error('Error listing groups:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /groups/:group_id
 * Get a single group by ID
 */
router.get('/groups/:group_id', async (req: Request, res: Response) => {
  try {
    const { group_id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    const database = await getDb();
    const group = await database.collection('subscriber_groups').findOne({
      $or: [
        { group_id: group_id },
        { _id: new ObjectId(group_id) }
      ],
      tenant_id: tenantId
    });

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

  } catch (error: any) {
    console.error('Error getting group:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /groups
 * Create a new group
 */
router.post('/groups', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { name, description, bandwidth_plan_id, default_apn, default_qci } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const database = await getDb();

    // Check for duplicate name
    const existing = await database.collection('subscriber_groups').findOne({
      tenant_id: tenantId,
      name: name
    });

    if (existing) {
      return res.status(400).json({ error: 'Group name already exists' });
    }

    // Get bandwidth plan name if provided
    let bandwidthPlanName = null;
    if (bandwidth_plan_id) {
      const plan = await database.collection('bandwidth_plans').findOne({
        $or: [
          { plan_id: bandwidth_plan_id },
          { _id: new ObjectId(bandwidth_plan_id) }
        ],
        tenant_id: tenantId
      });
      bandwidthPlanName = plan?.name || null;
    }

    const group_id = `group_${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const now = new Date();

    const newGroup = {
      group_id,
      tenant_id: tenantId,
      name: name.trim(),
      description: description?.trim() || '',
      bandwidth_plan_id: bandwidth_plan_id || null,
      bandwidth_plan_name: bandwidthPlanName,
      subscriber_count: 0,
      default_apn: default_apn || 'internet',
      default_qci: default_qci || 9,
      created_at: now,
      updated_at: now
    };

    await database.collection('subscriber_groups').insertOne(newGroup);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group: {
        id: group_id,
        group_id,
        ...newGroup
      }
    });

  } catch (error: any) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /groups/:group_id
 * Update an existing group
 */
router.put('/groups/:group_id', async (req: Request, res: Response) => {
  try {
    const { group_id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    const { name, description, bandwidth_plan_id, default_apn, default_qci } = req.body;

    const database = await getDb();

    // Find the group
    const group = await database.collection('subscriber_groups').findOne({
      $or: [
        { group_id: group_id },
        { _id: new ObjectId(group_id) }
      ],
      tenant_id: tenantId
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check for duplicate name if name is being changed
    if (name && name !== group.name) {
      const existing = await database.collection('subscriber_groups').findOne({
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
        const plan = await database.collection('bandwidth_plans').findOne({
          $or: [
            { plan_id: bandwidth_plan_id },
            { _id: new ObjectId(bandwidth_plan_id) }
          ],
          tenant_id: tenantId
        });
        bandwidthPlanName = plan?.name || null;
      } else {
        bandwidthPlanName = null;
      }
    }

    const updates: any = {
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

    await database.collection('subscriber_groups').updateOne(
      { group_id: group.group_id },
      { $set: updates }
    );

    // Update all subscribers in this group with new bandwidth plan
    if (bandwidth_plan_id !== undefined) {
      await database.collection('subscribers').updateMany(
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

  } catch (error: any) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /groups/:group_id
 * Delete a group (only if it has no subscribers)
 */
router.delete('/groups/:group_id', async (req: Request, res: Response) => {
  try {
    const { group_id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    const database = await getDb();

    // Find the group
    const group = await database.collection('subscriber_groups').findOne({
      $or: [
        { group_id: group_id },
        { _id: new ObjectId(group_id) }
      ],
      tenant_id: tenantId
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if group has subscribers
    const subscriberCount = await database.collection('subscribers').countDocuments({
      group_id: group.group_id
    });

    if (subscriberCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete group with subscribers',
        subscriber_count: subscriberCount
      });
    }

    await database.collection('subscriber_groups').deleteOne({ group_id: group.group_id });

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// BANDWIDTH PLAN MANAGEMENT
// ============================================================================

/**
 * GET /bandwidth-plans
 * List all bandwidth plans for a tenant
 */
router.get('/bandwidth-plans', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const database = await getDb();
    const plans = await database.collection('bandwidth_plans')
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
        download_mbps: p.download_mbps,
        upload_mbps: p.upload_mbps,
        subscriber_count: p.subscriber_count || 0,
        created_at: p.created_at,
        updated_at: p.updated_at
      }))
    });

  } catch (error: any) {
    console.error('Error listing bandwidth plans:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /bandwidth-plans/:plan_id
 * Get a single bandwidth plan by ID
 */
router.get('/bandwidth-plans/:plan_id', async (req: Request, res: Response) => {
  try {
    const { plan_id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    const database = await getDb();
    const plan = await database.collection('bandwidth_plans').findOne({
      $or: [
        { plan_id: plan_id },
        { _id: new ObjectId(plan_id) }
      ],
      tenant_id: tenantId
    });

    if (!plan) {
      return res.status(404).json({ error: 'Bandwidth plan not found' });
    }

    res.json({
      id: plan.plan_id || plan._id.toString(),
      plan_id: plan.plan_id || plan._id.toString(),
      name: plan.name,
      description: plan.description || '',
      download_mbps: plan.download_mbps,
      upload_mbps: plan.upload_mbps,
      subscriber_count: plan.subscriber_count || 0,
      created_at: plan.created_at,
      updated_at: plan.updated_at
    });

  } catch (error: any) {
    console.error('Error getting bandwidth plan:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /bandwidth-plans
 * Create a new bandwidth plan
 */
router.post('/bandwidth-plans', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { name, description, download_mbps, upload_mbps } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Plan name is required' });
    }

    if (!download_mbps || download_mbps <= 0) {
      return res.status(400).json({ error: 'Valid download speed is required' });
    }

    if (!upload_mbps || upload_mbps <= 0) {
      return res.status(400).json({ error: 'Valid upload speed is required' });
    }

    const database = await getDb();

    // Check for duplicate name
    const existing = await database.collection('bandwidth_plans').findOne({
      tenant_id: tenantId,
      name: name
    });

    if (existing) {
      return res.status(400).json({ error: 'Bandwidth plan name already exists' });
    }

    const plan_id = `plan_${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const now = new Date();

    const newPlan = {
      plan_id,
      tenant_id: tenantId,
      name: name.trim(),
      description: description?.trim() || '',
      download_mbps: parseFloat(download_mbps),
      upload_mbps: parseFloat(upload_mbps),
      subscriber_count: 0,
      created_at: now,
      updated_at: now
    };

    await database.collection('bandwidth_plans').insertOne(newPlan);

    res.status(201).json({
      success: true,
      message: 'Bandwidth plan created successfully',
      plan: {
        id: plan_id,
        plan_id,
        ...newPlan
      }
    });

  } catch (error: any) {
    console.error('Error creating bandwidth plan:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /bandwidth-plans/:plan_id
 * Update an existing bandwidth plan
 */
router.put('/bandwidth-plans/:plan_id', async (req: Request, res: Response) => {
  try {
    const { plan_id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    const { name, description, download_mbps, upload_mbps } = req.body;

    const database = await getDb();

    // Find the plan
    const plan = await database.collection('bandwidth_plans').findOne({
      $or: [
        { plan_id: plan_id },
        { _id: new ObjectId(plan_id) }
      ],
      tenant_id: tenantId
    });

    if (!plan) {
      return res.status(404).json({ error: 'Bandwidth plan not found' });
    }

    // Check for duplicate name if name is being changed
    if (name && name !== plan.name) {
      const existing = await database.collection('bandwidth_plans').findOne({
        tenant_id: tenantId,
        name: name,
        plan_id: { $ne: plan.plan_id }
      });

      if (existing) {
        return res.status(400).json({ error: 'Bandwidth plan name already exists' });
      }
    }

    const updates: any = {
      updated_at: new Date()
    };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (download_mbps !== undefined) updates.download_mbps = parseFloat(download_mbps);
    if (upload_mbps !== undefined) updates.upload_mbps = parseFloat(upload_mbps);

    await database.collection('bandwidth_plans').updateOne(
      { plan_id: plan.plan_id },
      { $set: updates }
    );

    // Update all groups and subscribers using this plan with new name
    if (name !== undefined) {
      await database.collection('subscriber_groups').updateMany(
        { bandwidth_plan_id: plan.plan_id },
        { 
          $set: { 
            bandwidth_plan_name: name.trim(),
            updated_at: new Date()
          } 
        }
      );

      await database.collection('subscribers').updateMany(
        { bandwidth_plan_id: plan.plan_id },
        { 
          $set: { 
            bandwidth_plan_name: name.trim(),
            updated_at: new Date()
          } 
        }
      );
    }

    res.json({
      success: true,
      message: 'Bandwidth plan updated successfully',
      plan: {
        id: plan.plan_id,
        plan_id: plan.plan_id,
        ...plan,
        ...updates
      }
    });

  } catch (error: any) {
    console.error('Error updating bandwidth plan:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /bandwidth-plans/:plan_id
 * Delete a bandwidth plan (only if not in use)
 */
router.delete('/bandwidth-plans/:plan_id', async (req: Request, res: Response) => {
  try {
    const { plan_id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    const database = await getDb();

    // Find the plan
    const plan = await database.collection('bandwidth_plans').findOne({
      $or: [
        { plan_id: plan_id },
        { _id: new ObjectId(plan_id) }
      ],
      tenant_id: tenantId
    });

    if (!plan) {
      return res.status(404).json({ error: 'Bandwidth plan not found' });
    }

    // Check if plan is in use by groups
    const groupCount = await database.collection('subscriber_groups').countDocuments({
      bandwidth_plan_id: plan.plan_id
    });

    if (groupCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete bandwidth plan in use by groups',
        group_count: groupCount
      });
    }

    // Check if plan is in use by subscribers
    const subscriberCount = await database.collection('subscribers').countDocuments({
      bandwidth_plan_id: plan.plan_id
    });

    if (subscriberCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete bandwidth plan in use by subscribers',
        subscriber_count: subscriberCount
      });
    }

    await database.collection('bandwidth_plans').deleteOne({ plan_id: plan.plan_id });

    res.json({
      success: true,
      message: 'Bandwidth plan deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting bandwidth plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DASHBOARD & STATISTICS
// ============================================================================

/**
 * GET /dashboard/stats
 * Get dashboard statistics for HSS
 */
router.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const database = await getDb();

    // Get subscriber counts by status
    const subscriberStats = await database.collection('subscribers').aggregate([
      { $match: { tenant_id: tenantId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const stats: any = {
      subscribers: {
        total: 0,
        active: 0,
        suspended: 0,
        disabled: 0
      },
      groups: 0,
      bandwidth_plans: 0,
      online_subscribers: 0
    };

    subscriberStats.forEach(stat => {
      const status = stat._id || 'active';
      stats.subscribers[status] = stat.count;
      stats.subscribers.total += stat.count;
    });

    // Get online subscriber count
    stats.online_subscribers = await database.collection('subscribers').countDocuments({
      tenant_id: tenantId,
      cpe_online: true
    });

    // Get group count
    stats.groups = await database.collection('subscriber_groups').countDocuments({
      tenant_id: tenantId
    });

    // Get bandwidth plan count
    stats.bandwidth_plans = await database.collection('bandwidth_plans').countDocuments({
      tenant_id: tenantId
    });

    res.json(stats);

  } catch (error: any) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

