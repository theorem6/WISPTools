/**
 * Customer Billing API (Phase 1)
 * CRUD for per-customer billing records (service plan, invoices, balance).
 * Uses CustomerBilling model; tenant from X-Tenant-ID.
 * @see models/customer-billing.js, docs/CUSTOMER_BILLING_PORTAL_ANALYSIS.md
 */

const express = require('express');
const router = express.Router();
const { CustomerBilling } = require('../models/customer-billing');
const { Customer } = require('../models/customer');

const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(requireTenant);

/**
 * GET /api/customer-billing
 * List billing records for tenant. Optional ?customerId= to filter by one customer.
 */
router.get('/', async (req, res) => {
  try {
    const { customerId } = req.query;
    const query = { tenantId: req.tenantId };
    if (customerId) query.customerId = customerId;
    const list = await CustomerBilling.find(query).sort({ updatedAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Error listing customer billing:', error);
    res.status(500).json({ error: 'Failed to list customer billing' });
  }
});

/**
 * GET /api/customer-billing/:customerId
 * Get one customer's billing record.
 */
router.get('/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const doc = await CustomerBilling.findOne({
      tenantId: req.tenantId,
      customerId
    });
    if (!doc) {
      return res.status(404).json({ error: 'Customer billing not found', customerId });
    }
    res.json(doc);
  } catch (error) {
    console.error('Error fetching customer billing:', error);
    res.status(500).json({ error: 'Failed to fetch customer billing' });
  }
});

/**
 * POST /api/customer-billing
 * Create or get billing record for a customer. Body: { customerId, servicePlan?, billingCycle? }
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { customerId, servicePlan, billingCycle } = req.body || {};
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }
    const customer = await Customer.findOne({ tenantId, customerId });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found', customerId });
    }
    let doc = await CustomerBilling.findOne({ tenantId, customerId });
    if (doc) {
      if (servicePlan && Object.keys(servicePlan).length) {
        doc.servicePlan = { ...doc.servicePlan.toObject?.() || doc.servicePlan, ...servicePlan };
      }
      if (billingCycle && Object.keys(billingCycle).length) {
        doc.billingCycle = { ...doc.billingCycle.toObject?.() || doc.billingCycle, ...billingCycle };
      }
      doc.updatedAt = new Date();
      await doc.save();
      return res.json(doc);
    }
    doc = await CustomerBilling.create({
      tenantId,
      customerId,
      servicePlan: servicePlan || {},
      billingCycle: billingCycle || {}
    });
    res.status(201).json(doc);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Customer billing already exists for this customer' });
    }
    console.error('Error creating customer billing:', error);
    res.status(500).json({ error: 'Failed to create customer billing' });
  }
});

/**
 * PUT /api/customer-billing/:customerId
 * Update customer billing (partial). Body can include servicePlan, billingCycle, balance, autoPay, etc.
 */
router.put('/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const doc = await CustomerBilling.findOne({
      tenantId: req.tenantId,
      customerId
    });
    if (!doc) {
      return res.status(404).json({ error: 'Customer billing not found', customerId });
    }
    const allowed = ['servicePlan', 'billingCycle', 'paymentMethod', 'balance', 'autoPay', 'invoices', 'paymentHistory'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        doc[key] = req.body[key];
      }
    }
    doc.updatedAt = new Date();
    await doc.save();
    res.json(doc);
  } catch (error) {
    console.error('Error updating customer billing:', error);
    res.status(500).json({ error: 'Failed to update customer billing' });
  }
});

module.exports = router;
