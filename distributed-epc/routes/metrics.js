// EPC Metrics and Heartbeat Routes
const express = require('express');
const { RemoteEPC, EPCMetrics, SubscriberSession, AttachDetachEvent } = require('../models');
const { authenticateEPC } = require('../middleware/auth');
const { processMetrics, generateAlerts } = require('../services/metrics-service');

const router = express.Router();

/**
 * Heartbeat endpoint - Simple status update
 * POST /metrics/heartbeat
 */
router.post('/heartbeat', authenticateEPC, async (req, res) => {
  try {
    const { metrics } = req.body;
    
    await RemoteEPC.findOneAndUpdate(
      { epc_id: req.epc.epc_id },
      {
        $set: {
          status: 'online',
          last_heartbeat: new Date(),
          current_metrics: metrics
        }
      }
    );
    
    res.json({ success: true, message: 'Heartbeat received' });
  } catch (error) {
    console.error('[Heartbeat] Error:', error);
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

/**
 * Submit comprehensive metrics
 * POST /metrics/submit
 */
router.post('/submit', authenticateEPC, async (req, res) => {
  try {
    const { metrics } = req.body;
    
    const metricsDoc = new EPCMetrics({
      tenant_id: req.epc.tenant_id,
      epc_id: req.epc.epc_id,
      ...metrics
    });
    
    await metricsDoc.save();
    
    // Update EPC status
    await RemoteEPC.findOneAndUpdate(
      { epc_id: req.epc.epc_id },
      {
        $set: {
          status: 'online',
          last_heartbeat: new Date(),
          current_metrics: metrics
        }
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Metrics Submit] Error:', error);
    res.status(500).json({ error: 'Failed to submit metrics' });
  }
});

/**
 * Record attach event
 * POST /metrics/attach
 */
router.post('/attach', authenticateEPC, async (req, res) => {
  try {
    const { imsi, imei, ip_address, apn, attach_type } = req.body;
    
    // Create/update session
    const session = await SubscriberSession.findOneAndUpdate(
      { 
        tenant_id: req.epc.tenant_id,
        epc_id: req.epc.epc_id,
        imsi,
        session_end: null // Find active session
      },
      {
        $set: {
          tenant_id: req.epc.tenant_id,
          epc_id: req.epc.epc_id,
          imsi,
          imei,
          ip_address,
          apn,
          session_start: new Date()
        },
        $inc: { attach_count: 1 }
      },
      { upsert: true, new: true }
    );
    
    // Record event
    const event = new AttachDetachEvent({
      tenant_id: req.epc.tenant_id,
      epc_id: req.epc.epc_id,
      imsi,
      imei,
      event_type: 'attach',
      attach_type,
      ip_address,
      apn
    });
    
    await event.save();
    
    // Update EPC active subscriber count
    const activeCount = await SubscriberSession.countDocuments({
      epc_id: req.epc.epc_id,
      session_end: null
    });
    
    await RemoteEPC.findOneAndUpdate(
      { epc_id: req.epc.epc_id },
      { $set: { active_subscribers: activeCount } }
    );
    
    res.json({ success: true, session_id: session._id });
  } catch (error) {
    console.error('[Attach Event] Error:', error);
    res.status(500).json({ error: 'Failed to record attach event' });
  }
});

/**
 * Record detach event
 * POST /metrics/detach
 */
router.post('/detach', authenticateEPC, async (req, res) => {
  try {
    const { imsi, detach_type, cause } = req.body;
    
    // Find and close the session
    const session = await SubscriberSession.findOneAndUpdate(
      {
        tenant_id: req.epc.tenant_id,
        epc_id: req.epc.epc_id,
        imsi,
        session_end: null
      },
      {
        $set: {
          session_end: new Date(),
          detach_type,
          detach_cause: cause
        }
      },
      { new: true }
    );
    
    if (session) {
      // Calculate session duration
      const duration = (session.session_end - session.session_start) / 1000; // seconds
      session.session_duration = duration;
      await session.save();
    }
    
    // Record event
    const event = new AttachDetachEvent({
      tenant_id: req.epc.tenant_id,
      epc_id: req.epc.epc_id,
      imsi,
      event_type: 'detach',
      detach_type,
      detach_cause: cause
    });
    
    await event.save();
    
    // Update EPC active subscriber count
    const activeCount = await SubscriberSession.countDocuments({
      epc_id: req.epc.epc_id,
      session_end: null
    });
    
    await RemoteEPC.findOneAndUpdate(
      { epc_id: req.epc.epc_id },
      { $set: { active_subscribers: activeCount } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Detach Event] Error:', error);
    res.status(500).json({ error: 'Failed to record detach event' });
  }
});

module.exports = router;

