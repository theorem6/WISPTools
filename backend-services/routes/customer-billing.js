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

function markOverdueInvoices(doc) {
  if (!doc.invoices || !doc.invoices.length) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let changed = false;
  for (const inv of doc.invoices) {
    if (inv.status === 'pending' && inv.dueDate && new Date(inv.dueDate) < today) {
      inv.status = 'overdue';
      changed = true;
    }
  }
  return changed;
}

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
    if (markOverdueInvoices(doc)) {
      doc.updatedAt = new Date();
      await doc.save();
    }
    res.json(doc);
  } catch (error) {
    console.error('Error fetching customer billing:', error);
    res.status(500).json({ error: 'Failed to fetch customer billing' });
  }
});

/**
 * POST /api/customer-billing
 * Create or get billing record for a customer. Body: { customerId, servicePlan?, billingCycle?, sla? }
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { customerId, servicePlan, billingCycle, sla } = req.body || {};
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
        if (doc.billingCycle.dayOfMonth && !doc.billingCycle.nextBillingDate) {
          const now = new Date();
          let next = new Date(now.getFullYear(), now.getMonth(), Math.min(doc.billingCycle.dayOfMonth, 28));
          if (next <= now) next = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(doc.billingCycle.dayOfMonth, 28));
          doc.billingCycle.nextBillingDate = next;
        }
      }
      if (sla && typeof sla === 'object') {
        doc.sla = { ...doc.sla?.toObject?.() || doc.sla || {}, ...sla };
      }
      doc.updatedAt = new Date();
      await doc.save();
      return res.json(doc);
    }
    doc = await CustomerBilling.create({
      tenantId,
      customerId,
      servicePlan: servicePlan || {},
      billingCycle: billingCycle || {},
      sla: sla && typeof sla === 'object' ? sla : undefined
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
    const allowed = ['servicePlan', 'billingCycle', 'paymentMethod', 'balance', 'autoPay', 'invoices', 'paymentHistory', 'sla'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        doc[key] = req.body[key];
      }
    }
    if (req.body.billingCycle && doc.billingCycle && doc.billingCycle.dayOfMonth && !doc.billingCycle.nextBillingDate) {
      const now = new Date();
      let next = new Date(now.getFullYear(), now.getMonth(), Math.min(doc.billingCycle.dayOfMonth, 28));
      if (next <= now) next = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(doc.billingCycle.dayOfMonth, 28));
      doc.billingCycle.nextBillingDate = next;
    }
    doc.updatedAt = new Date();
    await doc.save();
    res.json(doc);
  } catch (error) {
    console.error('Error updating customer billing:', error);
    res.status(500).json({ error: 'Failed to update customer billing' });
  }
});

/**
 * POST /api/customer-billing/:customerId/invoices
 * Add an invoice. Body: { invoiceNumber, amount, dueDate, lineItems?, status? }
 */
router.post('/:customerId/invoices', async (req, res) => {
  try {
    const { customerId } = req.params;
    const doc = await CustomerBilling.findOne({
      tenantId: req.tenantId,
      customerId
    });
    if (!doc) {
      return res.status(404).json({ error: 'Customer billing not found', customerId });
    }
    const { invoiceNumber, amount, dueDate, lineItems, status } = req.body || {};
    if (!invoiceNumber || amount == null || !dueDate) {
      return res.status(400).json({ error: 'invoiceNumber, amount, and dueDate are required' });
    }
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const invoice = {
      invoiceId,
      invoiceNumber: String(invoiceNumber),
      amount: Number(amount),
      status: status || 'pending',
      dueDate: new Date(dueDate),
      lineItems: Array.isArray(lineItems) ? lineItems : [{ description: 'Service', quantity: 1, unitPrice: Number(amount), total: Number(amount) }]
    };
    if (!doc.invoices) doc.invoices = [];
    doc.invoices.push(invoice);
    doc.balance = doc.balance || { current: 0, overdue: 0 };
    doc.balance.current = (doc.balance.current || 0) + Number(amount);
    doc.updatedAt = new Date();
    await doc.save();
    res.status(201).json(doc);
  } catch (error) {
    console.error('Error adding invoice:', error);
    res.status(500).json({ error: 'Failed to add invoice' });
  }
});

/**
 * POST /api/customer-billing/:customerId/payments
 * Record a payment. Body: { amount, method, invoiceId?, transactionId? }
 */
router.post('/:customerId/payments', async (req, res) => {
  try {
    const { customerId } = req.params;
    const doc = await CustomerBilling.findOne({
      tenantId: req.tenantId,
      customerId
    });
    if (!doc) {
      return res.status(404).json({ error: 'Customer billing not found', customerId });
    }
    const { amount, method, invoiceId, transactionId } = req.body || {};
    if (amount == null || Number(amount) <= 0) {
      return res.status(400).json({ error: 'amount (positive number) is required' });
    }
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const payment = {
      paymentId,
      amount: Number(amount),
      method: method || 'other',
      transactionId: transactionId || '',
      paidAt: new Date()
    };
    if (!doc.paymentHistory) doc.paymentHistory = [];
    doc.paymentHistory.push({
      ...payment,
      invoiceId: invoiceId || undefined
    });
    doc.balance = doc.balance || { current: 0, overdue: 0 };
    doc.balance.current = Math.max(0, (doc.balance.current || 0) - Number(amount));
    doc.balance.lastPaymentDate = new Date();
    if (invoiceId && doc.invoices && doc.invoices.length) {
      const inv = doc.invoices.find((i) => i.invoiceId === invoiceId);
      if (inv) {
        inv.status = 'paid';
        inv.paidDate = new Date();
        if (!inv.payments) inv.payments = [];
        inv.payments.push({ ...payment, amount: Number(amount) });
      }
    }
    doc.updatedAt = new Date();
    await doc.save();
    res.status(201).json(doc);
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

module.exports = router;
