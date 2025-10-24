#!/bin/bash

# Deploy Billing Service to wisptools.io Custom Domain
# This script deploys the PayPal billing integration to your custom domain

echo "🚀 Deploying WispTools.io Billing Service to wisptools.io..."

# Set environment variables
export PAYPAL_CLIENT_ID="ARcw63HPgW_YB1FdF3kH2..."
export PAYPAL_CLIENT_SECRET="EK3CMbxefpxzA4We4tQMDO_FwLHw5cGIeXn0nhBppezAVsTnTPw0d1RN5ifRThxZb1qMmyrwN5GU1I7P"
export MONGODB_URI="mongodb+srv://your-connection-string"
export NODE_ENV="production"

# Install dependencies
echo "📦 Installing dependencies..."
cd backend-services
npm install

# Initialize default subscription plans
echo "🏗️ Initializing default subscription plans..."
npm run init-plans

# Deploy Firebase Functions
echo "☁️ Deploying Firebase Functions..."
firebase deploy --only functions:billingApi

# Deploy Firebase Hosting with custom domain routing
echo "🌐 Deploying Firebase Hosting with custom domain routing..."
firebase deploy --only hosting

echo "✅ Billing service deployed successfully to wisptools.io!"
echo ""
echo "📋 Next steps:"
echo "1. Configure PayPal webhook URL in PayPal Developer Dashboard:"
echo "   https://wisptools.io/api/billing/webhook/paypal"
echo "2. Set up MongoDB connection string"
echo "3. Test subscription creation flow"
echo "4. Verify webhook handling"
echo ""
echo "🔗 PayPal Webhook URL: https://wisptools.io/api/billing/webhook/paypal"
echo "🌐 Frontend URL: https://wisptools.io"
echo "📊 Admin Billing Dashboard: https://wisptools.io/admin/billing"
echo "💳 Tenant Billing: https://wisptools.io/modules/billing"
