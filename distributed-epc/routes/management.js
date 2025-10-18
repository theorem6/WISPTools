// EPC Management Routes (List, Get, Update, Delete)
const express = require('express');
const { RemoteEPC } = require('../models');
const { requireTenant } = require('../middleware/auth');

const router = express.Router();

/**
 * List EPCs for a tenant
 * GET /epc/list
 */
router.get('/list', requireTenant, async (req, res) => {
  try {
    const { status, include_offline } = req.query;
    
    let query = { tenant_id: req.tenantId };
    
    if (status) {
      query.status = status;
    }
    
    if (!include_offline) {
      // Only show EPCs that have checked in within the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      query.last_heartbeat = { $gte: fiveMinutesAgo };
    }
    
    const epcs = await RemoteEPC.find(query)
      .select('-secret_key -api_key -auth_code') // Don't send sensitive data
      .sort({ created_at: -1 });
    
    res.json({
      success: true,
      epcs,
      count: epcs.length
    });
  } catch (error) {
    console.error('[EPC List] Error:', error);
    res.status(500).json({ error: 'Failed to fetch EPCs' });
  }
});

/**
 * Get a specific EPC
 * GET /epc/:epc_id
 */
router.get('/:epc_id', requireTenant, async (req, res) => {
  try {
    const { epc_id } = req.params;
    
    const epc = await RemoteEPC.findOne({ epc_id, tenant_id: req.tenantId })
      .select('-secret_key -api_key -auth_code');
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    res.json({ success: true, epc });
  } catch (error) {
    console.error('[Get EPC] Error:', error);
    res.status(500).json({ error: 'Failed to fetch EPC' });
  }
});

/**
 * Update EPC configuration
 * PUT /epc/:epc_id
 */
router.put('/:epc_id', requireTenant, async (req, res) => {
  try {
    const { epc_id } = req.params;
    const updates = req.body;
    
    // Don't allow updating sensitive fields
    delete updates.epc_id;
    delete updates.tenant_id;
    delete updates.auth_code;
    delete updates.api_key;
    delete updates.secret_key;
    
    const epc = await RemoteEPC.findOneAndUpdate(
      { epc_id, tenant_id: req.tenantId },
      { $set: updates },
      { new: true }
    ).select('-secret_key -api_key -auth_code');
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    res.json({ success: true, epc });
  } catch (error) {
    console.error('[Update EPC] Error:', error);
    res.status(500).json({ error: 'Failed to update EPC' });
  }
});

/**
 * Delete an EPC
 * DELETE /epc/:epc_id
 */
router.delete('/:epc_id', requireTenant, async (req, res) => {
  try {
    const { epc_id } = req.params;
    
    const epc = await RemoteEPC.findOneAndDelete({ epc_id, tenant_id: req.tenantId });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    res.json({ success: true, message: 'EPC deleted successfully' });
  } catch (error) {
    console.error('[Delete EPC] Error:', error);
    res.status(500).json({ error: 'Failed to delete EPC' });
  }
});

module.exports = router;

