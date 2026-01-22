/**
 * EPC Management Routes
 * Handles EPC device management operations
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { InventoryItem } = require('../models/inventory');

/**
 * POST /api/epc-management/delete
 * Delete an EPC device and associated inventory items
 * Uses POST instead of DELETE due to routing issues
 */
router.post('/delete', async (req, res) => {
  try {
    console.log('[Delete EPC] Request body:', req.body);
    console.log('[Delete EPC] Request body type:', typeof req.body);

    const { epc_id } = req.body || {};
    const tenant_id = req.headers['x-tenant-id'] || 'unknown';

    if (!epc_id) {
      return res.status(400).json({ error: 'epc_id is required in body', received: req.body });
    }

    console.log(`[Delete EPC] Deleting EPC ${epc_id} for tenant ${tenant_id}`);

    // Try to find by epc_id first (string match)
    let epc = await RemoteEPC.findOneAndDelete({
      epc_id: epc_id,
      tenant_id: tenant_id
    });

    // If not found and epc_id looks like a valid ObjectId, try matching by _id
    if (!epc && /^[a-f\d]{24}$/i.test(epc_id)) {
      epc = await RemoteEPC.findOneAndDelete({
        _id: epc_id,
        tenant_id: tenant_id
      });
    }

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    // Delete associated inventory items
    await InventoryItem.deleteMany({
      $or: [
        { 'epcConfig.epc_id': epc_id },
        { 'epcConfig.device_code': epc.device_code },
        { serialNumber: epc_id }
      ],
      tenantId: tenant_id
    });

    console.log(`[Delete EPC] Successfully deleted EPC ${epc_id} (${epc.site_name})`);

    res.json({
      success: true,
      message: `EPC "${epc.site_name || epc_id}" deleted successfully`,
      deleted_epc_id: epc_id
    });
  } catch (error) {
    console.error('[Delete EPC] Error:', error);
    res.status(500).json({ error: 'Failed to delete EPC', message: error.message });
  }
});

module.exports = router;

