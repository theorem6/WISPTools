/**
 * EPC Logs API Routes
 * Retrieve logs from remote EPCs
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC, EPCLog } = require('../models/distributed-epc-schema');

/**
 * GET /api/epc/:epc_id/logs
 * Get logs for a specific EPC
 */
router.get('/:epc_id/logs', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header is required' });
    }

    const { epc_id } = req.params;
    const { limit = 100, since, log_type, level } = req.query;

    // Verify EPC exists and belongs to tenant
    const epc = await RemoteEPC.findOne({
      $or: [{ epc_id: epc_id }, { _id: epc_id }],
      tenant_id: tenantId
    }).lean();

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    // Build query
    const query = {
      epc_id: epc.epc_id,
      tenant_id: tenantId
    };

    if (since) {
      query.timestamp = { $gte: new Date(since) };
    }

    if (log_type) {
      query.log_type = log_type;
    }

    if (level) {
      query.level = level;
    }

    // Fetch logs
    const logs = await EPCLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      epc_id: epc.epc_id,
      total: logs.length,
      logs: logs.map(log => ({
        id: log._id.toString(),
        timestamp: log.timestamp,
        log_type: log.log_type,
        source: log.source,
        level: log.level,
        message: log.message,
        details: log.details
      }))
    });

  } catch (error) {
    console.error('[EPC Logs] Error:', error);
    res.status(500).json({
      error: 'Failed to retrieve logs',
      message: error.message
    });
  }
});

module.exports = router;

