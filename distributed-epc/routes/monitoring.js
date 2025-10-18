// EPC Monitoring and Dashboard Routes
const express = require('express');
const { RemoteEPC, EPCMetrics, SubscriberSession, AttachDetachEvent, EPCAlert } = require('../models');
const { requireTenant } = require('../middleware/auth');

const router = express.Router();

/**
 * Get dashboard data for all EPCs
 * GET /dashboard
 */
router.get('/dashboard', requireTenant, async (req, res) => {
  try {
    const epcs = await RemoteEPC.find({ tenant_id: req.tenantId });
    
    const dashboardData = await Promise.all(epcs.map(async (epc) => {
      const latestMetrics = await EPCMetrics.findOne({
        epc_id: epc.epc_id
      }).sort({ timestamp: -1 });
      
      const activeSessions = await SubscriberSession.countDocuments({
        epc_id: epc.epc_id,
        session_end: null
      });
      
      const alerts = await EPCAlert.find({
        epc_id: epc.epc_id,
        acknowledged: false
      }).sort({ timestamp: -1 }).limit(5);
      
      return {
        epc_id: epc.epc_id,
        site_name: epc.site_name,
        status: epc.status,
        location: epc.location,
        last_heartbeat: epc.last_heartbeat,
        metrics: latestMetrics,
        active_subscribers: activeSessions,
        recent_alerts: alerts
      };
    }));
    
    res.json({
      success: true,
      epcs: dashboardData,
      total_epcs: epcs.length,
      online_epcs: epcs.filter(e => e.status === 'online').length
    });
  } catch (error) {
    console.error('[Dashboard] Error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * Get historical metrics for an EPC
 * GET /metrics/history
 */
router.get('/metrics/history', requireTenant, async (req, res) => {
  try {
    const { epc_id, start_date, end_date, limit = 100 } = req.query;
    
    if (!epc_id) {
      return res.status(400).json({ error: 'epc_id is required' });
    }
    
    let query = { 
      tenant_id: req.tenantId,
      epc_id 
    };
    
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }
    
    const metrics = await EPCMetrics.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, metrics, count: metrics.length });
  } catch (error) {
    console.error('[Metrics History] Error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics history' });
  }
});

/**
 * Get subscriber roster for an EPC
 * GET /subscribers/roster
 */
router.get('/subscribers/roster', requireTenant, async (req, res) => {
  try {
    const { epc_id } = req.query;
    
    if (!epc_id) {
      return res.status(400).json({ error: 'epc_id is required' });
    }
    
    const sessions = await SubscriberSession.find({
      tenant_id: req.tenantId,
      epc_id,
      session_end: null // Active sessions only
    }).sort({ session_start: -1 });
    
    res.json({ success: true, active_subscribers: sessions });
  } catch (error) {
    console.error('[Subscriber Roster] Error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriber roster' });
  }
});

/**
 * Get attach/detach events
 * GET /events/attach-detach
 */
router.get('/events/attach-detach', requireTenant, async (req, res) => {
  try {
    const { epc_id, event_type, start_date, end_date, limit = 100 } = req.query;
    
    let query = { tenant_id: req.tenantId };
    
    if (epc_id) query.epc_id = epc_id;
    if (event_type) query.event_type = event_type;
    
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }
    
    const events = await AttachDetachEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, events, count: events.length });
  } catch (error) {
    console.error('[Events] Error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

module.exports = router;

