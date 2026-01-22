/**
 * Billing Schema
 * 
 * Defines the database schema for billing-related collections
 */

const mongoose = require('mongoose');

/**
 * Subscription Plan Schema
 */
const subscriptionPlanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  interval: { 
    type: String, 
    enum: ['monthly', 'yearly'], 
    required: true 
  },
  features: [{ type: String }],
  maxUsers: { type: Number, required: true },
  maxTenants: { type: Number },
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/**
 * Subscription Schema
 */
const subscriptionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  planId: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['active', 'cancelled', 'past_due', 'trialing', 'incomplete'],
    required: true 
  },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  paypalSubscriptionId: { type: String },
  paypalPlanId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/**
 * Invoice Schema
 */
const invoiceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  subscriptionId: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { 
    type: String, 
    enum: ['paid', 'pending', 'failed', 'cancelled'],
    required: true 
  },
  invoiceUrl: { type: String },
  paypalInvoiceId: { type: String },
  paidAt: { type: Date },
  dueDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/**
 * Payment Method Schema
 */
const paymentMethodSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['paypal'], 
    required: true 
  },
  paypalEmail: { type: String, required: true },
  paypalPayerId: { type: String },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/**
 * Billing Analytics Schema
 */
const billingAnalyticsSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  totalRevenue: { type: Number, default: 0 },
  monthlyRecurringRevenue: { type: Number, default: 0 },
  activeSubscriptions: { type: Number, default: 0 },
  churnRate: { type: Number, default: 0 },
  averageRevenuePerUser: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

// Create models
const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const Invoice = mongoose.model('Invoice', invoiceSchema);
const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);
const BillingAnalytics = mongoose.model('BillingAnalytics', billingAnalyticsSchema);

module.exports = {
  SubscriptionPlan,
  Subscription,
  Invoice,
  PaymentMethod,
  BillingAnalytics
};
