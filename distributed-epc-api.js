// Distributed EPC Management API
// Handles EPC registration, metrics collection, and monitoring

const express = require('express');
const crypto = require('crypto');
const { RemoteEPC, EPCMetrics, SubscriberSession, AttachDetachEvent, EPCAlert } = require('./distributed-epc-schema');

const router = express.Router();

// Middleware to verify EPC authentication
function authenticateEPC(req, res, next) {
  const authCode = req.headers['x-epc-auth-code'];
  const apiKey = req.headers['x-epc-api-key'];
  const signature = req.headers['x-epc-signature'];
  
  if (!authCode || !apiKey) {
    return res.status(401).json({ error: 'Missing authentication headers' });
  }
  
  RemoteEPC.findOne({ auth_code: authCode, api_key: apiKey, enabled: true })
    .then(epc => {
      if (!epc) {
        return res.status(401).json({ error: 'Invalid authentication' });
      }
      
      // Verify signature if provided
      if (signature) {
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
          .createHmac('sha256', epc.secret_key)
          .update(payload)
          .digest('hex');
        
        if (signature !== expectedSignature) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }
      
      req.epc = epc;
      next();
    })
    .catch(err => {
      console.error('[EPC Auth] Error:', err);
      res.status(500).json({ error: 'Authentication error' });
    });
}

// Middleware for tenant-based access
function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant ID' });
  }
  
  req.tenantId = tenantId;
  next();
}

/**
 * EPC Registration & Management
 */

// Register a new EPC site
router.post('/epc/register', requireTenant, async (req, res) => {
  try {
    const {
      site_name,
      location,
      network_config,
      contact,
      metrics_config
    } = req.body;
    
    // Generate unique identifiers
    const epc_id = `epc_${crypto.randomBytes(8).toString('hex')}`;
    const auth_code = crypto.randomBytes(16).toString('hex');
    const api_key = crypto.randomBytes(32).toString('hex');
    const secret_key = crypto.randomBytes(32).toString('hex');
    
    const epc = new RemoteEPC({
      epc_id,
      site_name,
      tenant_id: req.tenantId,
      auth_code,
      api_key,
      secret_key,
      location,
      network_config,
      contact,
      metrics_config: metrics_config || {},
      status: 'initializing'
    });
    
    await epc.save();
    
    res.json({
      success: true,
      epc_id,
      auth_code,
      api_key,
      secret_key,
      message: 'EPC registered successfully. Keep these credentials secure!'
    });
  } catch (error) {
    console.error('[EPC Register] Error:', error);
    res.status(500).json({ error: 'Failed to register EPC', details: error.message });
  }
});

// List EPCs for a tenant
router.get('/epc/list', requireTenant, async (req, res) => {
  try {
    const { status, include_offline } = req.query;
    
    const query = { tenant_id: req.tenantId };
    if (status) query.status = status;
    
    const epcs = await RemoteEPC.find(query)
      .select('-secret_key') // Don't send secret key
      .sort({ site_name: 1 });
    
    // Calculate uptime and add health indicators
    const now = new Date();
    const enrichedEPCs = epcs.map(epc => {
      const epcObj = epc.toObject();
      
      // Check if offline (no heartbeat in 5 minutes)
      const lastHeartbeat = epc.last_heartbeat;
      if (lastHeartbeat) {
        const minutesSinceHeartbeat = (now - lastHeartbeat) / 1000 / 60;
        if (minutesSinceHeartbeat > 5 && epcObj.status === 'online') {
          epcObj.status = 'offline';
        }
        epcObj.minutes_since_heartbeat = Math.floor(minutesSinceHeartbeat);
      }
      
      return epcObj;
    });
    
    res.json({
      success: true,
      count: enrichedEPCs.length,
      epcs: enrichedEPCs
    });
  } catch (error) {
    console.error('[EPC List] Error:', error);
    res.status(500).json({ error: 'Failed to list EPCs' });
  }
});

// Get EPC details
router.get('/epc/:epc_id', requireTenant, async (req, res) => {
  try {
    const epc = await RemoteEPC.findOne({
      epc_id: req.params.epc_id,
      tenant_id: req.tenantId
    }).select('-secret_key');
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Get latest metrics
    const latestMetrics = await EPCMetrics.findOne({
      epc_id: req.params.epc_id
    }).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      epc: epc.toObject(),
      latest_metrics: latestMetrics
    });
  } catch (error) {
    console.error('[EPC Details] Error:', error);
    res.status(500).json({ error: 'Failed to get EPC details' });
  }
});

// Update EPC configuration
router.put('/epc/:epc_id', requireTenant, async (req, res) => {
  try {
    const { site_name, location, network_config, contact, metrics_config, enabled } = req.body;
    
    const updateData = {};
    if (site_name) updateData.site_name = site_name;
    if (location) updateData.location = location;
    if (network_config) updateData.network_config = network_config;
    if (contact) updateData.contact = contact;
    if (metrics_config) updateData.metrics_config = metrics_config;
    if (typeof enabled !== 'undefined') updateData.enabled = enabled;
    
    const epc = await RemoteEPC.findOneAndUpdate(
      { epc_id: req.params.epc_id, tenant_id: req.tenantId },
      { $set: updateData },
      { new: true }
    ).select('-secret_key');
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    res.json({ success: true, epc });
  } catch (error) {
    console.error('[EPC Update] Error:', error);
    res.status(500).json({ error: 'Failed to update EPC' });
  }
});

// Delete EPC
router.delete('/epc/:epc_id', requireTenant, async (req, res) => {
  try {
    const epc = await RemoteEPC.findOneAndDelete({
      epc_id: req.params.epc_id,
      tenant_id: req.tenantId
    });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // TODO: Consider soft delete or archiving metrics instead
    
    res.json({ success: true, message: 'EPC deleted successfully' });
  } catch (error) {
    console.error('[EPC Delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete EPC' });
  }
});

/**
 * Metrics Collection Endpoints (Called by remote EPC agents)
 */

// Heartbeat endpoint
router.post('/metrics/heartbeat', authenticateEPC, async (req, res) => {
  try {
    const { version, uptime_seconds } = req.body;
    
    await RemoteEPC.findOneAndUpdate(
      { epc_id: req.epc.epc_id },
      {
        $set: {
          status: 'online',
          last_heartbeat: new Date(),
          last_seen: new Date(),
          uptime_seconds: uptime_seconds || 0,
          version: version || {}
        }
      }
    );
    
    res.json({
      success: true,
      epc_id: req.epc.epc_id,
      metrics_config: req.epc.metrics_config
    });
  } catch (error) {
    console.error('[Heartbeat] Error:', error);
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

// Submit metrics
router.post('/metrics/submit', authenticateEPC, async (req, res) => {
  try {
    const metricsData = {
      epc_id: req.epc.epc_id,
      tenant_id: req.epc.tenant_id,
      timestamp: new Date(),
      ...req.body
    };
    
    const metrics = new EPCMetrics(metricsData);
    await metrics.save();
    
    // Update EPC last_seen
    await RemoteEPC.findOneAndUpdate(
      { epc_id: req.epc.epc_id },
      { $set: { last_seen: new Date() } }
    );
    
    // Check for alerts
    await checkMetricsForAlerts(req.epc, metricsData);
    
    res.json({ success: true, message: 'Metrics received' });
  } catch (error) {
    console.error('[Metrics Submit] Error:', error);
    res.status(500).json({ error: 'Failed to submit metrics', details: error.message });
  }
});

// Submit attach event
router.post('/metrics/attach', authenticateEPC, async (req, res) => {
  try {
    const { imsi, apn, cellid, enb_ip, allocated_ip } = req.body;
    
    if (!imsi) {
      return res.status(400).json({ error: 'IMSI required' });
    }
    
    // Create session
    const session = new SubscriberSession({
      imsi,
      tenant_id: req.epc.tenant_id,
      epc_id: req.epc.epc_id,
      session_id: `session_${crypto.randomBytes(8).toString('hex')}`,
      status: 'attached',
      apn,
      cellid,
      enb_ip,
      allocated_ip,
      attached_at: new Date(),
      last_activity: new Date()
    });
    
    await session.save();
    
    // Log event
    const event = new AttachDetachEvent({
      tenant_id: req.epc.tenant_id,
      epc_id: req.epc.epc_id,
      imsi,
      event_type: 'attach',
      apn,
      cellid,
      enb_ip,
      allocated_ip,
      result: 'success'
    });
    
    await event.save();
    
    res.json({ success: true, session_id: session.session_id });
  } catch (error) {
    console.error('[Attach Event] Error:', error);
    res.status(500).json({ error: 'Failed to process attach event' });
  }
});

// Submit detach event
router.post('/metrics/detach', authenticateEPC, async (req, res) => {
  try {
    const { imsi, session_id, data_usage } = req.body;
    
    if (!imsi) {
      return res.status(400).json({ error: 'IMSI required' });
    }
    
    // Find and update session
    const query = { imsi, epc_id: req.epc.epc_id, status: 'attached' };
    if (session_id) query.session_id = session_id;
    
    const session = await SubscriberSession.findOne(query).sort({ attached_at: -1 });
    
    if (session) {
      const now = new Date();
      const sessionDuration = Math.floor((now - session.attached_at) / 1000);
      
      session.status = 'detached';
      session.detached_at = now;
      if (data_usage) session.data_usage = data_usage;
      
      await session.save();
      
      // Log event
      const event = new AttachDetachEvent({
        tenant_id: req.epc.tenant_id,
        epc_id: req.epc.epc_id,
        imsi,
        event_type: 'detach',
        apn: session.apn,
        cellid: session.cellid,
        enb_ip: session.enb_ip,
        result: 'success',
        session_duration_seconds: sessionDuration,
        data_usage_bytes: data_usage?.total_bytes || 0
      });
      
      await event.save();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Detach Event] Error:', error);
    res.status(500).json({ error: 'Failed to process detach event' });
  }
});

/**
 * Dashboard/UI Endpoints
 */

// Get dashboard data for a tenant
router.get('/dashboard', requireTenant, async (req, res) => {
  try {
    const { epc_id } = req.query;
    
    const query = { tenant_id: req.tenantId };
    if (epc_id) query.epc_id = epc_id;
    
    // Get all EPCs
    const epcs = await RemoteEPC.find({ tenant_id: req.tenantId })
      .select('-secret_key');
    
    // Get latest metrics for each EPC
    const latestMetrics = await EPCMetrics.aggregate([
      { $match: query },
      { $sort: { timestamp: -1 } },
      { $group: {
        _id: '$epc_id',
        latest: { $first: '$$ROOT' }
      }}
    ]);
    
    // Get active sessions count
    const activeSessions = await SubscriberSession.countDocuments({
      ...query,
      status: 'attached'
    });
    
    // Get recent attach/detach events (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttaches = await AttachDetachEvent.countDocuments({
      ...query,
      event_type: 'attach',
      timestamp: { $gte: oneHourAgo }
    });
    
    const recentDetaches = await AttachDetachEvent.countDocuments({
      ...query,
      event_type: 'detach',
      timestamp: { $gte: oneHourAgo }
    });
    
    // Get active alerts
    const activeAlerts = await EPCAlert.find({
      tenant_id: req.tenantId,
      resolved: false
    }).sort({ timestamp: -1 }).limit(10);
    
    res.json({
      success: true,
      epcs: epcs.map(epc => {
        const metrics = latestMetrics.find(m => m._id === epc.epc_id);
        return {
          ...epc.toObject(),
          latest_metrics: metrics?.latest || null
        };
      }),
      summary: {
        total_epcs: epcs.length,
        online_epcs: epcs.filter(e => e.status === 'online').length,
        active_sessions: activeSessions,
        recent_attaches: recentAttaches,
        recent_detaches: recentDetaches
      },
      alerts: activeAlerts
    });
  } catch (error) {
    console.error('[Dashboard] Error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Get historical metrics
router.get('/metrics/history', requireTenant, async (req, res) => {
  try {
    const { epc_id, metric_type, start_date, end_date, granularity = 'hour' } = req.query;
    
    if (!epc_id) {
      return res.status(400).json({ error: 'epc_id required' });
    }
    
    const startDate = start_date ? new Date(start_date) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = end_date ? new Date(end_date) : new Date();
    
    const metrics = await EPCMetrics.find({
      epc_id,
      tenant_id: req.tenantId,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 }).select(metric_type ? `timestamp ${metric_type}` : '');
    
    res.json({
      success: true,
      count: metrics.length,
      metrics
    });
  } catch (error) {
    console.error('[Metrics History] Error:', error);
    res.status(500).json({ error: 'Failed to get metrics history' });
  }
});

// Get subscriber roster
router.get('/subscribers/roster', requireTenant, async (req, res) => {
  try {
    const { epc_id, status = 'attached', limit = 100, skip = 0 } = req.query;
    
    const query = { tenant_id: req.tenantId };
    if (epc_id) query.epc_id = epc_id;
    if (status) query.status = status;
    
    const [sessions, total] = await Promise.all([
      SubscriberSession.find(query)
        .sort({ attached_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip)),
      SubscriberSession.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      total,
      sessions
    });
  } catch (error) {
    console.error('[Roster] Error:', error);
    res.status(500).json({ error: 'Failed to get subscriber roster' });
  }
});

// Get attach/detach events
router.get('/events/attach-detach', requireTenant, async (req, res) => {
  try {
    const { epc_id, event_type, hours = 48, limit = 100 } = req.query;
    
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const query = {
      tenant_id: req.tenantId,
      timestamp: { $gte: startTime }
    };
    
    if (epc_id) query.epc_id = epc_id;
    if (event_type) query.event_type = event_type;
    
    const events = await AttachDetachEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    console.error('[Events] Error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

/**
 * Alert Management
 */
async function checkMetricsForAlerts(epc, metrics) {
  const alerts = [];
  
  // Check system resources
  if (metrics.system) {
    if (metrics.system.cpu_percent > 90) {
      alerts.push({
        tenant_id: epc.tenant_id,
        epc_id: epc.epc_id,
        severity: 'warning',
        alert_type: 'high_cpu',
        message: `High CPU usage: ${metrics.system.cpu_percent}%`,
        details: { cpu_percent: metrics.system.cpu_percent }
      });
    }
    
    if (metrics.system.memory_percent > 90) {
      alerts.push({
        tenant_id: epc.tenant_id,
        epc_id: epc.epc_id,
        severity: 'warning',
        alert_type: 'high_memory',
        message: `High memory usage: ${metrics.system.memory_percent}%`,
        details: { memory_percent: metrics.system.memory_percent }
      });
    }
  }
  
  // Check IP pool exhaustion
  if (metrics.ogstun_pool && metrics.ogstun_pool.utilization_percent > 90) {
    alerts.push({
      tenant_id: epc.tenant_id,
      epc_id: epc.epc_id,
      severity: 'critical',
      alert_type: 'pool_exhausted',
      message: `IP pool nearly exhausted: ${metrics.ogstun_pool.utilization_percent}%`,
      details: metrics.ogstun_pool
    });
  }
  
  // Check component status
  if (metrics.components) {
    for (const [component, status] of Object.entries(metrics.components)) {
      if (status === 'stopped' || status === 'error') {
        alerts.push({
          tenant_id: epc.tenant_id,
          epc_id: epc.epc_id,
          severity: 'error',
          alert_type: 'component_down',
          message: `Component ${component} is ${status}`,
          details: { component, status }
        });
      }
    }
  }
  
  // Save new alerts
  if (alerts.length > 0) {
    await EPCAlert.insertMany(alerts);
  }
}

module.exports = router;

