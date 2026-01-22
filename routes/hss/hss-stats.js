/**
 * HSS Stats Routes
 * Statistics and dashboard endpoints
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ensureDB } = require('./hss-middleware');

// Apply middleware to all routes
router.use(ensureDB);

/**
 * GET /stats
 * Get HSS statistics for dashboard
 */
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

module.exports = router;
