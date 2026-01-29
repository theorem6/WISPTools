/**
 * Customer Billing Schema (Phase 1)
 * Per-customer billing records for WISP service plans, invoices, and payments.
 * Separate from tenant subscription billing (billing-schema.js).
 * @see docs/CUSTOMER_BILLING_PORTAL_ANALYSIS.md
 */

const mongoose = require('mongoose');

const invoiceLineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true }
}, { _id: false });

const invoicePaymentSchema = new mongoose.Schema({
  paymentId: String,
  amount: { type: Number, required: true },
  method: String,
  transactionId: String,
  paidAt: { type: Date, default: Date.now }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceId: { type: String, required: true },
  invoiceNumber: { type: String, required: true }, // e.g. INV-2025-001
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  dueDate: { type: Date, required: true },
  paidDate: Date,
  lineItems: [invoiceLineItemSchema],
  payments: [invoicePaymentSchema]
}, { _id: false });

const paymentHistoryEntrySchema = new mongoose.Schema({
  paymentId: String,
  invoiceId: String,
  amount: { type: Number, required: true },
  method: String,
  status: String,
  transactionId: String,
  paidAt: { type: Date, default: Date.now }
}, { _id: false });

const customerBillingSchema = new mongoose.Schema({
  customerId: { type: String, required: true, index: true },
  tenantId: { type: String, required: true, index: true },
  servicePlan: {
    planName: String,
    monthlyFee: { type: Number, default: 0 },
    setupFee: { type: Number, default: 0 },
    prorationEnabled: { type: Boolean, default: false }
  },
  billingCycle: {
    type: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    nextBillingDate: Date
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'ach', 'paypal', 'none'],
    default: 'none'
  },
  // Stripe (when used)
  stripeCustomerId: String,
  stripePaymentMethodId: String,
  // Card display (last4, brand, expiry)
  last4: String,
  brand: String,
  expiryMonth: Number,
  expiryYear: Number,
  invoices: [invoiceSchema],
  paymentHistory: [paymentHistoryEntrySchema],
  balance: {
    current: { type: Number, default: 0 },
    overdue: { type: Number, default: 0 },
    lastPaymentDate: Date
  },
  autoPay: {
    enabled: { type: Boolean, default: false },
    paymentMethodId: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

customerBillingSchema.index({ tenantId: 1, customerId: 1 }, { unique: true });

const CustomerBilling = mongoose.model('CustomerBilling', customerBillingSchema);

module.exports = { CustomerBilling, customerBillingSchema };
