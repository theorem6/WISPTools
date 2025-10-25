/**
 * Initialize Default Subscription Plans
 * 
 * Creates default subscription plans for the billing system
 */

const mongoose = require('mongoose');
const { SubscriptionPlan } = require('./billing-schema');

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔗 Billing Plans: Connecting to MongoDB Atlas...');
console.log('📍 MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs

async function initializePlans() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Default subscription plans
    const defaultPlans = [
      {
        id: 'starter',
        name: 'Starter Plan',
        description: 'Perfect for small WISPs getting started',
        price: 29.99,
        currency: 'USD',
        interval: 'monthly',
        features: [
          'Up to 5 users',
          'Basic coverage mapping',
          'CPE device management',
          'Email support',
          'Standard reporting'
        ],
        maxUsers: 5,
        isPopular: false,
        isActive: true
      },
      {
        id: 'professional',
        name: 'Professional Plan',
        description: 'Ideal for growing WISPs with multiple sites',
        price: 99.99,
        currency: 'USD',
        interval: 'monthly',
        features: [
          'Up to 25 users',
          'Advanced coverage mapping',
          'Full CPE management suite',
          'Network monitoring',
          'Priority support',
          'Advanced reporting',
          'API access'
        ],
        maxUsers: 25,
        isPopular: true,
        isActive: true
      },
      {
        id: 'enterprise',
        name: 'Enterprise Plan',
        description: 'Complete solution for large WISPs and MSPs',
        price: 299.99,
        currency: 'USD',
        interval: 'monthly',
        features: [
          'Unlimited users',
          'Multi-tenant management',
          'Advanced analytics',
          'Custom integrations',
          '24/7 phone support',
          'White-label options',
          'Dedicated account manager',
          'Custom reporting'
        ],
        maxUsers: -1, // Unlimited
        isPopular: false,
        isActive: true
      },
      {
        id: 'starter-yearly',
        name: 'Starter Plan (Yearly)',
        description: 'Perfect for small WISPs - Save 20% with yearly billing',
        price: 287.99, // 20% discount
        currency: 'USD',
        interval: 'yearly',
        features: [
          'Up to 5 users',
          'Basic coverage mapping',
          'CPE device management',
          'Email support',
          'Standard reporting',
          '20% savings'
        ],
        maxUsers: 5,
        isPopular: false,
        isActive: true
      },
      {
        id: 'professional-yearly',
        name: 'Professional Plan (Yearly)',
        description: 'Ideal for growing WISPs - Save 20% with yearly billing',
        price: 959.99, // 20% discount
        currency: 'USD',
        interval: 'yearly',
        features: [
          'Up to 25 users',
          'Advanced coverage mapping',
          'Full CPE management suite',
          'Network monitoring',
          'Priority support',
          'Advanced reporting',
          'API access',
          '20% savings'
        ],
        maxUsers: 25,
        isPopular: true,
        isActive: true
      },
      {
        id: 'enterprise-yearly',
        name: 'Enterprise Plan (Yearly)',
        description: 'Complete solution - Save 20% with yearly billing',
        price: 2879.99, // 20% discount
        currency: 'USD',
        interval: 'yearly',
        features: [
          'Unlimited users',
          'Multi-tenant management',
          'Advanced analytics',
          'Custom integrations',
          '24/7 phone support',
          'White-label options',
          'Dedicated account manager',
          'Custom reporting',
          '20% savings'
        ],
        maxUsers: -1, // Unlimited
        isPopular: false,
        isActive: true
      }
    ];

    // Clear existing plans
    await SubscriptionPlan.deleteMany({});
    console.log('Cleared existing subscription plans');

    // Insert default plans
    for (const planData of defaultPlans) {
      const plan = new SubscriptionPlan(planData);
      await plan.save();
      console.log(`Created plan: ${plan.name}`);
    }

    console.log('Successfully initialized default subscription plans');
    
    // Display created plans
    const plans = await SubscriptionPlan.find({});
    console.log('\nCreated plans:');
    plans.forEach(plan => {
      console.log(`- ${plan.name}: $${plan.price}/${plan.interval} (${plan.maxUsers} users)`);
    });

  } catch (error) {
    console.error('Error initializing plans:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  initializePlans();
}

module.exports = { initializePlans };
