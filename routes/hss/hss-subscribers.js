/**
 * HSS Subscriber Routes
 * Subscriber CRUD operations
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ensureDB } = require('./hss-middleware');

// Apply middleware to all routes
router.use(ensureDB);

/**
 * GET /subscribers
 * List all subscribers for a tenant
 */
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

/**
 * POST /subscribers
 * Create a new subscriber
 */
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

/**
 * PUT /subscribers/:id
 * Update an existing subscriber
 */
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

/**
 * DELETE /subscribers/:id
 * Delete a subscriber
 */
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

module.exports = router;
