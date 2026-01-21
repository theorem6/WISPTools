/**
 * MME Status Routes
 * Endpoints for remote HSS/MME to report subscriber online/offline status
 */

const express = require('express');
const router = express.Router();
const { 
  reportSubscriberStatus, 
  reportBatchSubscriberStatus,
  getEPCCustomerCount,
  getOnlineSubscribers
} = require('../services/mme-status-service');
const { RemoteEPC } = require('../models/distributed-epc-schema');

/**
 * Middleware to authenticate EPC requests
 */
async function authenticateEPC(req, res, next) {
  try {
    const epcId = req.headers['x-epc-id'];
    const authCode = req.headers['x-epc-auth'];
    const apiKey = req.headers['x-api-key'];

    if (!epcId || (!authCode && !apiKey)) {
      return res.status(401).json({ error: 'EPC authentication required' });
    }

    const epc = await RemoteEPC.findOne({
      epc_id: epcId,
      $or: [
        { auth_code: authCode },
        { api_key: apiKey }
      ]
    });

    if (!epc) {
      return res.status(401).json({ error: 'Invalid EPC credentials' });
    }

    req.epc = epc;
    req.tenantId = epc.tenant_id;
    next();
  } catch (error) {
    console.error('[MME Status] Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

router.use(authenticateEPC);

/**
 * POST /api/mme/status
 * Report single subscriber online/offline status
 */
router.post('/status', async (req, res) => {
  try {
    const { imsi, status, mme_id, cell_id, ip_address } = req.body;
    const epcId = req.epc.epc_id;
    const tenantId = req.tenantId;

    if (!imsi || !status) {
      return res.status(400).json({ error: 'imsi and status are required' });
    }

    if (!['online', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'status must be "online" or "offline"' });
    }

    const result = await reportSubscriberStatus(epcId, tenantId, {
      imsi,
      status,
      mme_id,
      cell_id,
      ip_address
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[MME Status] Error reporting status:', error);
    res.status(500).json({ error: 'Failed to report status', message: error.message });
  }
});

/**
 * POST /api/mme/status/batch
 * Report multiple subscriber statuses at once
 */
router.post('/status/batch', async (req, res) => {
  try {
    const { statuses } = req.body;
    const epcId = req.epc.epc_id;
    const tenantId = req.tenantId;

    if (!Array.isArray(statuses) || statuses.length === 0) {
      return res.status(400).json({ error: 'statuses array is required' });
    }

    const result = await reportBatchSubscriberStatus(epcId, tenantId, statuses);
    res.json(result);
  } catch (error) {
    console.error('[MME Status] Error reporting batch status:', error);
    res.status(500).json({ error: 'Failed to report batch status', message: error.message });
  }
});

/**
 * GET /api/mme/customer-count
 * Get current customer count for EPC
 */
router.get('/customer-count', async (req, res) => {
  try {
    const epcId = req.epc.epc_id;
    const tenantId = req.tenantId;

    const counts = await getEPCCustomerCount(epcId, tenantId);
    res.json({ success: true, ...counts, epc_id: epcId });
  } catch (error) {
    console.error('[MME Status] Error getting customer count:', error);
    res.status(500).json({ error: 'Failed to get customer count', message: error.message });
  }
});

/**
 * GET /api/mme/online-subscribers
 * Get list of currently online subscribers
 */
router.get('/online-subscribers', async (req, res) => {
  try {
    const epcId = req.epc.epc_id;
    const tenantId = req.tenantId;

    const subscribers = await getOnlineSubscribers(epcId, tenantId);
    res.json({ success: true, subscribers, count: subscribers.length, epc_id: epcId });
  } catch (error) {
    console.error('[MME Status] Error getting online subscribers:', error);
    res.status(500).json({ error: 'Failed to get online subscribers', message: error.message });
  }
});

module.exports = router;
