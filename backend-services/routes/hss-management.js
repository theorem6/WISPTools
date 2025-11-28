/**
 * HSS Management Routes - Complete Implementation
 * Home Subscriber Server management endpoints with full CRUD operations
 * Groups, Bandwidth Plans, Dashboard, Subscribers, EPCs
 * Uses MongoDB Atlas connection via mongoose
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { RemoteEPC } = require('../models/distributed-epc-schema');

console.log('🔗 HSS Management: Using MongoDB Atlas connection via mongoose');

// Middleware to ensure database connection
const ensureDB = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  req.db = mongoose.connection.db;
  next();
};

// Apply middleware to all routes
router.use(ensureDB);

// HSS Stats endpoint
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const stats = {
      total_subscribers: await req.db.collection('subscribers').countDocuments({ tenant_id: tenantId }),
      active_subscribers: await req.db.collection('subscribers').countDocuments({ 
        tenant_id: tenantId, 
        enabled: true 
      }),
      total_groups: await req.db.collection('groups').countDocuments({ tenant_id: tenantId }),
      total_bandwidth_plans: await req.db.collection('bandwidth_plans').countDocuments({ tenant_id: tenantId }),
      total_epcs: await req.db.collection('epcs').countDocuments({ tenant_id: tenantId }),
      recent_authentications: await req.db.collection('subscriber_sessions').countDocuments({
        tenant_id: tenantId,
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      })
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching HSS stats:', error);
    res.status(500).json({ error: 'Failed to fetch HSS stats' });
  }
});

// Subscribers endpoints
router.get('/subscribers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const subscribers = await req.db.collection('subscribers')
      .find({ tenant_id: tenantId })
      .toArray();

    res.json(subscribers);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

router.post('/subscribers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const subscriber = {
      ...req.body,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await req.db.collection('subscribers').insertOne(subscriber);
    res.status(201).json({ id: result.insertedId, ...subscriber });
  } catch (error) {
    console.error('Error creating subscriber:', error);
    res.status(500).json({ error: 'Failed to create subscriber' });
  }
});

router.put('/subscribers/:id', async (req, res) => {
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

    const result = await req.db.collection('subscribers').updateOne(
      { _id: id, tenant_id: tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    res.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('Error updating subscriber:', error);
    res.status(500).json({ error: 'Failed to update subscriber' });
  }
});

router.delete('/subscribers/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const result = await req.db.collection('subscribers').deleteOne({
      _id: id,
      tenant_id: tenantId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Error deleting subscriber:', error);
    res.status(500).json({ error: 'Failed to delete subscriber' });
  }
});

// ============================================================================
// GROUP MANAGEMENT - Complete Implementation
// ============================================================================

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

// Bandwidth Plans endpoints
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

// Helper function to format uptime
function formatUptime(seconds) {
  if (!seconds || seconds === 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// Remote EPC devices endpoint (for Hardware page)
// GET /api/hss/epc/remote/list - Lists EPCs linked via device code
router.get('/epc/remote/list', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    console.log(`[HSS/EPC] Fetching remote EPCs for tenant: ${tenantId}`);

    // Get EPCs from RemoteEPC collection (devices linked via device code)
    const remoteEPCs = await RemoteEPC.find({ tenant_id: tenantId }).lean();
    
    console.log(`[HSS/EPC] Found ${remoteEPCs.length} remote EPCs`);

    // Get latest service status for each EPC to include metrics
    const { EPCServiceStatus } = require('../models/distributed-epc-schema');
    const epcIds = remoteEPCs.map(e => e.epc_id);
    
    console.log(`[HSS/EPC] Looking up service status for EPCs:`, epcIds);
    
    const latestStatuses = await EPCServiceStatus.aggregate([
      { $match: { epc_id: { $in: epcIds }, tenant_id: tenantId } },
      { $sort: { timestamp: -1 } },
      { $group: {
          _id: '$epc_id',
          latest: { $first: '$$ROOT' }
        }
      }
    ]).allowDiskUse(true);

    console.log(`[HSS/EPC] Found ${latestStatuses.length} service status records`);

    // Create a map of epc_id to latest status
    const statusMap = new Map();
    latestStatuses.forEach(item => {
      statusMap.set(item._id, item.latest);
      console.log(`[HSS/EPC] Service status for ${item._id}:`, {
        timestamp: item.latest.timestamp,
        hasSystem: !!item.latest.system,
        cpuPercent: item.latest.system?.cpu_percent,
        memoryPercent: item.latest.system?.memory_percent,
        uptimeSeconds: item.latest.system?.uptime_seconds
      });
    });

    // Format for frontend
    const epcs = remoteEPCs.map(epc => {
      const lastSeen = epc.last_seen || epc.last_heartbeat || epc.updated_at;
      const isOnline = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
      const latestStatus = statusMap.get(epc.epc_id);
      
      // Format metrics for frontend - always return metrics object, even if null
      let metrics = {
        cpuUsage: null,
        memoryUsage: null,
        uptime: null
      };
      
      // Try to get from latest service status first
      if (latestStatus?.system) {
        metrics.cpuUsage = latestStatus.system.cpu_percent ?? null;
        metrics.memoryUsage = latestStatus.system.memory_percent ?? null;
        if (latestStatus.system.uptime_seconds) {
          metrics.uptime = formatUptime(latestStatus.system.uptime_seconds);
        } else if (epc.metrics?.system_uptime_seconds) {
          metrics.uptime = formatUptime(epc.metrics.system_uptime_seconds);
        }
      } else if (epc.metrics?.system_uptime_seconds) {
        // Fallback to RemoteEPC.metrics
        metrics.uptime = formatUptime(epc.metrics.system_uptime_seconds);
      }
      
      // Debug log for metrics
      if (epc.epc_id === 'EPC-CB4C5042' || epc.device_code === 'YALNTFQC') {
        console.log(`[HSS/EPC] Metrics for ${epc.epc_id}:`, {
          hasLatestStatus: !!latestStatus,
          hasSystem: !!latestStatus?.system,
          cpuPercent: latestStatus?.system?.cpu_percent,
          memoryPercent: latestStatus?.system?.memory_percent,
          uptimeSeconds: latestStatus?.system?.uptime_seconds,
          formattedMetrics: metrics
        });
      }
      
      return {
        id: epc._id?.toString() || epc.epc_id,
        epcId: epc.epc_id,
        name: epc.site_name,
        site_name: epc.site_name,
        type: 'epc',
        status: epc.status === 'online' || isOnline ? 'online' : 
                epc.status === 'registered' ? 'pending' : 'offline',
        device_code: epc.device_code,
        hardware_id: epc.hardware_id,
        ipAddress: epc.ip_address || latestStatus?.network?.ip_address || null,
        ip_address: epc.ip_address || latestStatus?.network?.ip_address || null, // Support both formats
        deployment_type: epc.deployment_type,
        location: {
          coordinates: {
            latitude: epc.location?.coordinates?.latitude || epc.location?.latitude || 0,
            longitude: epc.location?.coordinates?.longitude || epc.location?.longitude || 0
          },
          address: epc.location?.address || 'Unknown Location'
        },
        network_config: epc.network_config || {},
        snmp_config: epc.snmp_config || {},
        last_seen: lastSeen,
        last_heartbeat: epc.last_heartbeat,
        createdAt: epc.created_at,
        updatedAt: epc.updated_at,
        created_at: epc.created_at, // Support both formats
        updated_at: epc.updated_at, // Support both formats
        metrics: metrics
      };
    });

    res.json({ epcs, total: epcs.length, tenant: tenantId });
  } catch (error) {
    console.error('[HSS/EPC] Error fetching remote EPCs:', error);
    res.status(500).json({ error: 'Failed to fetch remote EPCs', message: error.message });
  }
});

// Update a RemoteEPC device
// PUT /api/hss/epc/:epc_id
router.put('/epc/:epc_id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { epc_id } = req.params;
    const { epc_id: new_epc_id_from_body, new_epc_id, site_id, site_name, deployment_type, hss_config, snmp_config, network_config, device_code, status } = req.body;
    
    // Support both 'epc_id' and 'new_epc_id' in body for backward compatibility
    const new_epc_id_value = new_epc_id || new_epc_id_from_body;
    
    console.log(`[HSS/EPC] Updating EPC ${epc_id} for tenant ${tenantId}`);
    console.log(`[HSS/EPC] Request body:`, {
      site_id: site_id !== undefined ? site_id : 'undefined',
      site_name: site_name !== undefined ? site_name : 'undefined',
      has_hss_config: !!hss_config,
      has_snmp_config: !!snmp_config,
      deployment_type
    });

    // Find the EPC
    const epc = await RemoteEPC.findOne({
      $or: [
        { epc_id: epc_id },
        { _id: epc_id }
      ],
      tenant_id: tenantId
    });

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    // Build update object
    const updateFields = {
      updated_at: new Date()
    };

    // Allow updating epc_id (requires validation for uniqueness)
    if (new_epc_id_value && new_epc_id_value !== epc_id) {
      // Check if new EPC ID already exists
      const existingEPCWithNewId = await RemoteEPC.findOne({
        epc_id: new_epc_id_value,
        tenant_id: tenantId
      });
      
      // Only error if it's a different EPC (not the current one)
      if (existingEPCWithNewId && existingEPCWithNewId._id.toString() !== epc._id.toString()) {
        return res.status(400).json({ 
          error: 'EPC ID already exists', 
          message: `EPC ID ${new_epc_id_value} is already in use by another device` 
        });
      }
      
      // Also need to update related collections (EPCCommand, EPCServiceStatus, etc.)
      const { EPCCommand, EPCServiceStatus } = require('../models/distributed-epc-schema');
      const { InventoryItem } = require('../models/inventory');
      
      // Update related records
      await EPCCommand.updateMany({ epc_id: epc.epc_id }, { $set: { epc_id: new_epc_id } });
      await EPCServiceStatus.updateMany({ epc_id: epc.epc_id }, { $set: { epc_id: new_epc_id } });
      
      // Update inventory items that reference this EPC
      await InventoryItem.updateMany(
        { 'epcConfig.epc_id': epc.epc_id },
        { $set: { 'epcConfig.epc_id': new_epc_id } }
      );
      
      updateFields.epc_id = new_epc_id_value;
    }

    // Allow updating site_id (explicitly check for null or string value)
    if (site_id !== undefined) {
      const newSiteId = (site_id === null || site_id === '') ? null : site_id;
      updateFields.site_id = newSiteId;
      
      // If site_id is set, regenerate site_name with proper suffix
      if (newSiteId) {
        const { generateSiteNameWithSuffix } = require('../utils/site-naming');
        const newSiteName = await generateSiteNameWithSuffix(newSiteId, tenantId);
        updateFields.site_name = newSiteName;
      } else if (site_id === null || site_id === '') {
        // If site_id is being cleared, also clear site_name
        updateFields.site_name = null;
      }
    }
    
    // Allow updating site_name (only if site_id not provided, otherwise it's auto-generated)
    if (site_name !== undefined && site_id === undefined) {
      updateFields.site_name = site_name;
    }
    
    // Allow updating device_code (for linking)
    if (device_code !== undefined && device_code) {
      updateFields.device_code = device_code;
      
      // If device_code is being set, ensure status is at least 'registered' (linked)
      // Don't downgrade if already online
      if (!status && (!epc.status || epc.status === 'offline' || epc.status === 'error')) {
        updateFields.status = 'registered';
      }
    }
    
    // Allow updating status explicitly (e.g., set to 'registered' when linked)
    if (status !== undefined && ['registered', 'online', 'offline', 'error'].includes(status)) {
      updateFields.status = status;
    }

    if (deployment_type) {
      if (!['epc', 'snmp', 'both'].includes(deployment_type)) {
        return res.status(400).json({ error: 'Invalid deployment_type. Must be epc, snmp, or both' });
      }
      updateFields.deployment_type = deployment_type;
    }

    if (hss_config) {
      updateFields.hss_config = {
        ...epc.hss_config,
        ...hss_config
      };
    }

    if (snmp_config) {
      updateFields.snmp_config = {
        ...epc.snmp_config,
        ...snmp_config
      };
    }

    if (network_config) {
      updateFields.network_config = {
        ...epc.network_config,
        ...network_config
      };
    }

    // Check if any configuration actually changed by comparing old vs new values
    const configChanged = (
      (site_id !== undefined && JSON.stringify(epc.site_id) !== JSON.stringify(site_id !== null && site_id !== undefined ? site_id : null)) ||
      (site_name !== undefined && epc.site_name !== site_name) ||
      (deployment_type !== undefined && epc.deployment_type !== deployment_type) ||
      (hss_config !== undefined && JSON.stringify(epc.hss_config) !== JSON.stringify(hss_config)) ||
      (snmp_config !== undefined && JSON.stringify(epc.snmp_config) !== JSON.stringify(snmp_config)) ||
      (network_config !== undefined && JSON.stringify(epc.network_config) !== JSON.stringify(network_config)) ||
      (status !== undefined && epc.status !== status) ||
      (device_code !== undefined && epc.device_code !== device_code)
    );
    
    console.log(`[HSS/EPC] Config change detection: ${configChanged ? 'CHANGED' : 'NO CHANGE'}`);
    
    // Update the EPC
    await RemoteEPC.updateOne(
      { $or: [{ epc_id: epc_id }, { _id: epc_id }], tenant_id: tenantId },
      { $set: updateFields }
    );

    // Fetch updated record (use new_epc_id if it was changed)
    const final_epc_id = new_epc_id_value || epc_id;
    const updatedEPC = await RemoteEPC.findOne({
      $or: [{ epc_id: final_epc_id }, { _id: final_epc_id }],
      tenant_id: tenantId
    }).lean();
    
    // If configuration changed, queue a config_update command so EPC applies changes on next check-in
    if (configChanged && updatedEPC) {
      try {
        const { EPCCommand } = require('../models/distributed-epc-schema');
        
        console.log(`[HSS/EPC] Configuration changed detected, queuing config_update command for EPC ${final_epc_id}`);
        
        // Delete any existing pending config_update commands (replace with new one)
        const deletedCount = await EPCCommand.deleteMany({
          epc_id: final_epc_id,
          command_type: 'config_update',
          status: { $in: ['pending', 'sent'] }
        });
        if (deletedCount.deletedCount > 0) {
          console.log(`[HSS/EPC] Deleted ${deletedCount.deletedCount} existing pending config_update command(s)`);
        }
        
        // Queue new config_update command with full configuration
        const configUpdateCmd = new EPCCommand({
          epc_id: final_epc_id,
          tenant_id: tenantId,
          command_type: 'config_update',
          config_data: {
            site_name: updatedEPC.site_name,
            site_id: updatedEPC.site_id,
            deployment_type: updatedEPC.deployment_type,
            hss_config: updatedEPC.hss_config,
            snmp_config: updatedEPC.snmp_config,
            network_config: updatedEPC.network_config
          },
          status: 'pending',
          priority: 3, // Higher priority than script updates
          created_at: new Date(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          description: 'Configuration update from management portal'
        });
        
        await configUpdateCmd.save();
        console.log(`[HSS/EPC] ✅ Queued config_update command ${configUpdateCmd._id} for EPC ${final_epc_id}`);
      } catch (cmdError) {
        console.warn(`[HSS/EPC] Failed to queue config_update command:`, cmdError.message);
        // Don't fail the update if command queueing fails
      }
    }

    console.log(`[HSS/EPC] Successfully updated EPC ${epc_id}${new_epc_id_value && new_epc_id_value !== epc_id ? ` to ${new_epc_id_value}` : ''}`);
    res.json({
      success: true,
      epc_id: updatedEPC?.epc_id || final_epc_id,
      message: 'EPC configuration updated successfully',
      epc: updatedEPC,
      config_update_queued: configChanged
    });
  } catch (error) {
    console.error('[HSS/EPC] Error updating EPC:', error);
    res.status(500).json({ error: 'Failed to update EPC', message: error.message });
  }
});

// Install/Uninstall Component on Remote EPC
// POST /api/hss/epc/:epc_id/install-component
router.post('/epc/:epc_id/install-component', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { epc_id } = req.params;
    const { component } = req.body; // 'nodejs_npm', 'snmp_discovery_enhanced', etc.

    if (!component) {
      return res.status(400).json({ error: 'Component name is required' });
    }

    console.log(`[HSS/EPC] Installing component ${component} on EPC ${epc_id}`);

    const epc = await RemoteEPC.findOne({
      $or: [{ epc_id: epc_id }, { _id: epc_id }],
      tenant_id: tenantId
    });

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    // Queue install command
    const { EPCCommand } = require('../models/distributed-epc-schema');
    const crypto = require('crypto');
    
    // Determine script URL based on component
    let scriptUrl = '';
    if (component === 'nodejs_npm') {
      scriptUrl = 'https://hss.wisptools.io/downloads/scripts/install-nodejs-npm.sh';
    } else {
      return res.status(400).json({ error: `Unknown component: ${component}` });
    }

    // Create install command
    const installCmd = new EPCCommand({
      epc_id: epc.epc_id,
      tenant_id: tenantId,
      command_type: 'script_execution',
      action: 'install_component',
      target_services: [],
      script_url: scriptUrl,
      config_data: { component },
      description: `Install ${component}`,
      status: 'pending',
      priority: 5,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      created_at: new Date()
    });

    await installCmd.save();

    // Update installed_components flag
    if (!epc.installed_components) {
      epc.installed_components = {};
    }
    epc.installed_components[component] = true;
    await epc.save();

    console.log(`[HSS/EPC] Queued install command for ${component} on EPC ${epc_id}`);
    res.json({
      success: true,
      message: `Install command queued for ${component}`,
      command_id: installCmd._id
    });
  } catch (error) {
    console.error('[HSS/EPC] Error queuing install command:', error);
    res.status(500).json({ error: 'Failed to queue install command', message: error.message });
  }
});

// POST /api/hss/epc/:epc_id/uninstall-component
router.post('/epc/:epc_id/uninstall-component', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { epc_id } = req.params;
    const { component } = req.body;

    if (!component) {
      return res.status(400).json({ error: 'Component name is required' });
    }

    console.log(`[HSS/EPC] Uninstalling component ${component} on EPC ${epc_id}`);

    const epc = await RemoteEPC.findOne({
      $or: [{ epc_id: epc_id }, { _id: epc_id }],
      tenant_id: tenantId
    });

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    // Queue uninstall command
    const { EPCCommand } = require('../models/distributed-epc-schema');
    
    let scriptUrl = '';
    if (component === 'nodejs_npm') {
      scriptUrl = 'https://hss.wisptools.io/downloads/scripts/uninstall-nodejs-npm.sh';
    } else {
      return res.status(400).json({ error: `Unknown component: ${component}` });
    }

    const uninstallCmd = new EPCCommand({
      epc_id: epc.epc_id,
      tenant_id: tenantId,
      command_type: 'script_execution',
      action: 'uninstall_component',
      target_services: [],
      script_url: scriptUrl,
      config_data: { component },
      description: `Uninstall ${component}`,
      status: 'pending',
      priority: 5,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date()
    });

    await uninstallCmd.save();

    // Update installed_components flag
    if (!epc.installed_components) {
      epc.installed_components = {};
    }
    epc.installed_components[component] = false;
    await epc.save();

    console.log(`[HSS/EPC] Queued uninstall command for ${component} on EPC ${epc_id}`);
    res.json({
      success: true,
      message: `Uninstall command queued for ${component}`,
      command_id: uninstallCmd._id
    });
  } catch (error) {
    console.error('[HSS/EPC] Error queuing uninstall command:', error);
    res.status(500).json({ error: 'Failed to queue uninstall command', message: error.message });
  }
});

// Delete a RemoteEPC device
// DELETE /api/hss/epc/:epc_id
router.delete('/epc/:epc_id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { epc_id } = req.params;
    console.log(`[HSS/EPC] Deleting EPC ${epc_id} for tenant ${tenantId}`);

    // Find and delete the RemoteEPC
    const epc = await RemoteEPC.findOneAndDelete({
      $or: [
        { epc_id: epc_id },
        { _id: epc_id }
      ],
      tenant_id: tenantId
    });

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    // Also delete associated inventory item if exists
    const { InventoryItem } = require('../models/inventory');
    await InventoryItem.deleteMany({
      $or: [
        { 'epcConfig.epc_id': epc_id },
        { serialNumber: epc_id }
      ],
      tenantId: tenantId
    });

    console.log(`[HSS/EPC] Successfully deleted EPC ${epc_id}`);
    res.json({ 
      success: true, 
      message: `EPC ${epc.site_name || epc_id} deleted successfully`,
      deleted_epc_id: epc_id
    });
  } catch (error) {
    console.error('[HSS/EPC] Error deleting EPC:', error);
    res.status(500).json({ error: 'Failed to delete EPC', message: error.message });
  }
});

// EPCs endpoints (legacy - uses epcs collection)
router.get('/epcs', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const epcs = await req.db.collection('epcs')
      .find({ tenant_id: tenantId })
      .toArray();

    res.json(epcs);
  } catch (error) {
    console.error('Error fetching EPCs:', error);
    res.status(500).json({ error: 'Failed to fetch EPCs' });
  }
});

router.post('/epcs', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const epc = {
      ...req.body,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await req.db.collection('epcs').insertOne(epc);
    res.status(201).json({ id: result.insertedId, ...epc });
  } catch (error) {
    console.error('Error creating EPC:', error);
    res.status(500).json({ error: 'Failed to create EPC' });
  }
});

router.put('/epcs/:id', async (req, res) => {
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

    const result = await req.db.collection('epcs').updateOne(
      { _id: id, tenant_id: tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    res.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('Error updating EPC:', error);
    res.status(500).json({ error: 'Failed to update EPC' });
  }
});

router.delete('/epcs/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const result = await req.db.collection('epcs').deleteOne({
      _id: id,
      tenant_id: tenantId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Error deleting EPC:', error);
    res.status(500).json({ error: 'Failed to delete EPC' });
  }
});

// MME Connections endpoint
router.get('/mme-connections', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    // Query RemoteEPC for active EPC connections (MMEs connect via EPCs)
    const { RemoteEPC } = require('../models/distributed-epc-schema');
    
    const epcs = await RemoteEPC.find({
      tenant_id: tenantId,
      status: { $in: ['online', 'registered'] }
    })
      .select('epc_id site_name status last_heartbeat last_seen network_config location')
      .lean();
    
    // Map EPCs to MME connection format
    const connections = epcs.map(epc => {
      // Extract IP from network_config or use location-based IP
      const mmeIp = epc.network_config?.mme_address || 
                    epc.location?.coordinates || 
                    'N/A';
      
      return {
        mme_id: epc.epc_id,
        epc_id: epc.epc_id,
        site_name: epc.site_name,
        ip_address: typeof mmeIp === 'object' ? 'auto-detected' : mmeIp,
        status: epc.status === 'online' ? 'active' : 'inactive',
        last_seen: epc.last_seen || epc.last_heartbeat || epc.updated_at,
        tenant_id: tenantId,
        location: epc.location
      };
    });

    res.json(connections);
  } catch (error) {
    console.error('Error fetching MME connections:', error);
    res.status(500).json({ error: 'Failed to fetch MME connections', message: error.message });
  }
});

// Bulk Import endpoint
router.post('/bulk-import', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { type, data } = req.body; // type: 'subscribers', 'groups', 'plans', 'epcs'
    
    if (!type || !data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid bulk import data' });
    }

    const collection = type === 'subscribers' ? 'subscribers' :
                      type === 'groups' ? 'groups' :
                      type === 'plans' ? 'bandwidth_plans' :
                      type === 'epcs' ? 'epcs' : null;

    if (!collection) {
      return res.status(400).json({ error: 'Invalid import type' });
    }

    // Add tenant_id and timestamps to all items
    const itemsToInsert = data.map(item => ({
      ...item,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date()
    }));

    const result = await req.db.collection(collection).insertMany(itemsToInsert);
    
    res.json({
      success: true,
      imported: result.insertedCount,
      type: type
    });
  } catch (error) {
    console.error('Error bulk importing:', error);
    res.status(500).json({ error: 'Failed to bulk import data' });
  }
});

module.exports = router;
