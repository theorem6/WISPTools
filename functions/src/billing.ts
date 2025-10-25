/**
 * Firebase Cloud Function for Billing API
 * 
 * Wraps the Express billing API for deployment to Firebase Cloud Functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const billingApi = require('./backend-services/billing-api');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export the billing API as a Cloud Function
exports.billingApi = functions.https.onRequest(billingApi);

// Export webhook handler for custom domain routing
exports.billingWebhook = functions.https.onRequest((req: any, res: any) => {
  // Handle PayPal webhooks at custom domain
  if (req.method === 'POST' && req.path === '/api/billing/webhook/paypal') {
    return billingApi(req, res);
  }
  
  res.status(404).json({ error: 'Not found' });
});

// Scheduled function to update billing analytics daily
exports.updateBillingAnalytics = functions.pubsub.schedule('0 2 * * *').onRun(async (context: any) => {
  try {
    console.log('Updating billing analytics...');
    
    // Calculate and update analytics
    const { BillingAnalytics, Subscription, Invoice } = require('./backend-services/billing-schema');
    
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
    
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
      id: 'daily_analytics',
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRecurringRevenue: monthlyRecurringRevenue[0]?.total || 0,
      activeSubscriptions,
      churnRate: 0, // Calculate churn rate
      averageRevenuePerUser: activeSubscriptions > 0 ? (monthlyRecurringRevenue[0]?.total || 0) / activeSubscriptions : 0,
      lastUpdated: new Date()
    };
    
    await BillingAnalytics.findOneAndUpdate(
      { id: 'daily_analytics' },
      analytics,
      { upsert: true }
    );
    
    console.log('Billing analytics updated successfully');
  } catch (error) {
    console.error('Error updating billing analytics:', error);
  }
});

// Function to handle subscription renewals
exports.processSubscriptionRenewals = functions.pubsub.schedule('0 0 * * *').onRun(async (context: any) => {
  try {
    console.log('Processing subscription renewals...');
    
    const { Subscription } = require('./backend-services/billing-schema');
    
    // Find subscriptions that need renewal
    const expiringSubscriptions = await Subscription.find({
      status: 'active',
      currentPeriodEnd: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // Expiring in 7 days
    });
    
    for (const subscription of expiringSubscriptions) {
      console.log(`Processing renewal for subscription ${subscription.id}`);
      
      // Extend subscription period
      const plan = await require('./backend-services/billing-schema').SubscriptionPlan.findById(subscription.planId);
      if (plan) {
        const newEndDate = new Date(subscription.currentPeriodEnd);
        if (plan.interval === 'monthly') {
          newEndDate.setMonth(newEndDate.getMonth() + 1);
        } else {
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        }
        
        subscription.currentPeriodEnd = newEndDate;
        subscription.updatedAt = new Date();
        await subscription.save();
        
        console.log(`Renewed subscription ${subscription.id} until ${newEndDate}`);
      }
    }
    
    console.log('Subscription renewals processed successfully');
  } catch (error) {
    console.error('Error processing subscription renewals:', error);
  }
});
