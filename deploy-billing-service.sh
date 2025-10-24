#!/bin/bash

# Deploy Billing Service to Google Cloud Functions
# This script deploys the PayPal billing integration to Firebase Cloud Functions

echo "🚀 Deploying WispTools.io Billing Service..."

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

# Deploy to Firebase Cloud Functions
echo "☁️ Deploying to Firebase Cloud Functions..."
firebase deploy --only functions:billingApi

echo "✅ Billing service deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure PayPal webhook URL in PayPal Developer Dashboard"
echo "2. Set up MongoDB connection string"
echo "3. Test subscription creation flow"
echo "4. Verify webhook handling"
echo ""
echo "🔗 PayPal Webhook URL: https://wisptools.io/api/billing/webhook/paypal"
