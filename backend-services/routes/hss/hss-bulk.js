/**
 * HSS Bulk Import Routes
 * Bulk import functionality for HSS data
 */

const express = require('express');
const router = express.Router();
const { ensureDB } = require('./hss-middleware');

// Apply middleware to all routes
router.use(ensureDB);

// Bulk Import endpoint
// POST /api/hss/bulk-import - Bulk import subscribers, groups, plans, or EPCs
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
                      type === 'groups' ? 'subscriber_groups' :
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
    res.status(500).json({ error: 'Failed to bulk import data', message: error.message });
  }
});

module.exports = router;
