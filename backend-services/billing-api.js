/**
 * PayPal Billing API
 * 
 * Handles PayPal subscription management, payment processing,
 * and billing operations using PayPal REST API
 */

const express = require('express');
const mongoose = require('mongoose');
const paypal = require('@paypal/checkout-server-sdk');
const { 
  SubscriptionPlan, 
  Subscription, 
  Invoice, 
  PaymentMethod, 
  BillingAnalytics 
} = require('./billing-schema');

const router = express.Router();

// PayPal Configuration - LIVE PRODUCTION
const environment = new paypal.core.LiveEnvironment(
  'ARcw63HPgW_YB1FdF3kH2...', // Your PayPal Live Client ID
  'EK3CMbxefpxzA4We4tQMDO_FwLHw5cGIeXn0nhBppezAVsTnTPw0d1RN5ifRThxZb1qMmyrwN5GU1I7P' // Your PayPal Live Client Secret
);

const client = new paypal.core.PayPalHttpClient(environment);

/**
 * Authentication middleware
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    // Verify Firebase token here (implement Firebase Admin SDK verification)
    // For now, we'll assume the token is valid
    
    req.user = { token }; // Add user info from token verification
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Admin middleware
 */
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is admin (implement admin check logic)
    // For now, we'll allow all authenticated users
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(403).json({ error: 'Admin access required' });
  }
};

/**
 * Get all subscription plans
 */
router.get('/plans', authenticateUser, async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

/**
 * Get tenant's current subscription
 */
router.get('/subscription/:tenantId', authenticateUser, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const subscription = await Subscription.findOne({ 
      tenantId, 
      status: { $in: ['active', 'trialing', 'past_due'] } 
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    
    res.json(subscription);
  } catch (error) {
    console.error('Error fetching tenant subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * Create PayPal subscription
 */
router.post('/subscription/create', authenticateUser, async (req, res) => {
  try {
    const { tenantId, planId, successUrl, cancelUrl } = req.body;
    
    // Get the plan details
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Create PayPal subscription request
    const request = new paypal.subscriptions.SubscriptionsCreateRequest();
    request.prefer('return=representation');
    
    request.requestBody({
      plan_id: plan.paypalPlanId || `plan_${planId}`, // PayPal plan ID
      subscriber: {
        email_address: req.user.email || 'user@example.com' // Get from auth
      },
      application_context: {
        brand_name: 'WispTools.io',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
        },
        return_url: successUrl,
        cancel_url: cancelUrl
      }
    });

    const response = await client.execute(request);
    
    // Create subscription record in database
    const subscription = new Subscription({
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      planId,
      status: 'incomplete',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + (plan.interval === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000),
      paypalSubscriptionId: response.result.id,
      paypalPlanId: plan.paypalPlanId || `plan_${planId}`
    });
    
    await subscription.save();

    res.json({
      subscriptionId: subscription.id,
      approvalUrl: response.result.links.find(link => link.rel === 'approve').href
    });
  } catch (error) {
    console.error('Error creating PayPal subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * Handle PayPal webhook for subscription updates
 * Webhook URL: https://wisptools.io/api/billing/webhook/paypal
 */
router.post('/webhook/paypal', async (req, res) => {
  try {
    const event = req.body;
    
    // Verify webhook signature (implement PayPal webhook verification)
    
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event);
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(event);
        break;
      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(event);
        break;
      case 'PAYMENT.SALE.DENIED':
        await handlePaymentDenied(event);
        break;
    }
    
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error processing PayPal webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Cancel subscription
 */
router.post('/subscription/:subscriptionId/cancel', authenticateUser, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { tenantId } = req.body;
    
    const subscription = await Subscription.findOne({ 
      id: subscriptionId, 
      tenantId 
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Cancel PayPal subscription
    if (subscription.paypalSubscriptionId) {
      const request = new paypal.subscriptions.SubscriptionsCancelRequest(subscription.paypalSubscriptionId);
      request.requestBody({
        reason: 'User requested cancellation'
      });
      
      await client.execute(request);
    }

    // Update subscription status
    subscription.status = 'cancelled';
    subscription.cancelAtPeriodEnd = true;
    subscription.updatedAt = new Date();
    
    await subscription.save();

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * Get tenant's invoices
 */
router.get('/invoices/:tenantId', authenticateUser, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const invoices = await Invoice.find({ tenantId }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching tenant invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * Get tenant's payment methods
 */
router.get('/payment-methods/:tenantId', authenticateUser, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const paymentMethods = await PaymentMethod.find({ tenantId });
    res.json(paymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * Update payment method
 */
router.put('/payment-methods/:paymentMethodId', authenticateUser, async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const { tenantId, paypalEmail } = req.body;
    
    const paymentMethod = await PaymentMethod.findOne({ 
      id: paymentMethodId, 
      tenantId 
    });
    
    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    paymentMethod.paypalEmail = paypalEmail;
    paymentMethod.updatedAt = new Date();
    
    await paymentMethod.save();

    res.json({ message: 'Payment method updated successfully' });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
});

/**
 * Get billing analytics (admin only)
 */
router.get('/analytics', authenticateUser, requireAdmin, async (req, res) => {
  try {
    // Calculate analytics from database
    const activeSubscriptions = await Subscription.countDocuments({ 
      status: 'active' 
    });
    
    const totalRevenue = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const monthlyRecurringRevenue = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $lookup: { from: 'subscriptionplans', localField: 'planId', foreignField: 'id', as: 'plan' } },
      { $unwind: '$plan' },
      { $group: { _id: null, total: { $sum: '$plan.price' } } }
    ]);
    
    const analytics = {
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRecurringRevenue: monthlyRecurringRevenue[0]?.total || 0,
      activeSubscriptions,
      churnRate: 0, // Calculate churn rate
      averageRevenuePerUser: activeSubscriptions > 0 ? (monthlyRecurringRevenue[0]?.total || 0) / activeSubscriptions : 0
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching billing analytics:', error);
    res.status(500).json({ error: 'Failed to fetch billing analytics' });
  }
});

/**
 * Get all subscriptions (admin only)
 */
router.get('/subscriptions', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const subscriptions = await Subscription.find().sort({ createdAt: -1 });
    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching all subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Webhook handlers
async function handleSubscriptionActivated(event) {
  try {
    const subscriptionId = event.resource.id;
    const subscription = await Subscription.findOne({ 
      paypalSubscriptionId: subscriptionId 
    });
    
    if (subscription) {
      subscription.status = 'active';
      subscription.updatedAt = new Date();
      await subscription.save();
    }
  } catch (error) {
    console.error('Error handling subscription activation:', error);
  }
}

async function handleSubscriptionCancelled(event) {
  try {
    const subscriptionId = event.resource.id;
    const subscription = await Subscription.findOne({ 
      paypalSubscriptionId: subscriptionId 
    });
    
    if (subscription) {
      subscription.status = 'cancelled';
      subscription.updatedAt = new Date();
      await subscription.save();
    }
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

async function handleSubscriptionSuspended(event) {
  try {
    const subscriptionId = event.resource.id;
    const subscription = await Subscription.findOne({ 
      paypalSubscriptionId: subscriptionId 
    });
    
    if (subscription) {
      subscription.status = 'past_due';
      subscription.updatedAt = new Date();
      await subscription.save();
    }
  } catch (error) {
    console.error('Error handling subscription suspension:', error);
  }
}

async function handlePaymentCompleted(event) {
  try {
    const payment = event.resource;
    const subscription = await Subscription.findOne({ 
      paypalSubscriptionId: payment.billing_agreement_id 
    });
    
    if (subscription) {
      // Create invoice record
      const invoice = new Invoice({
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        amount: parseFloat(payment.amount.total),
        currency: payment.amount.currency,
        status: 'paid',
        paypalInvoiceId: payment.id,
        paidAt: new Date(payment.create_time),
        dueDate: new Date(payment.create_time)
      });
      
      await invoice.save();
    }
  } catch (error) {
    console.error('Error handling payment completion:', error);
  }
}

async function handlePaymentDenied(event) {
  try {
    const payment = event.resource;
    const subscription = await Subscription.findOne({ 
      paypalSubscriptionId: payment.billing_agreement_id 
    });
    
    if (subscription) {
      subscription.status = 'past_due';
      subscription.updatedAt = new Date();
      await subscription.save();
    }
  } catch (error) {
    console.error('Error handling payment denial:', error);
  }
}

module.exports = router;
