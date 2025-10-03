#!/bin/bash

# Deploy Production Firestore Security Rules
# This script deploys the secure production rules (firestore.rules)
# 
# WARNING: This will replace any existing rules in Firebase Console!

echo "=========================================="
echo "  Deploy Production Security Rules"
echo "=========================================="
echo ""

echo "⚠️  WARNING: This will deploy PRODUCTION security rules!"
echo "   - Users will ONLY see their own networks"
echo "   - File: firestore.rules (NOT firestore.rules.dev)"
echo ""

read -p "Deploy production rules? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

echo ""
echo "📋 Deploying firestore.rules..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI not installed"
    echo "   Install with: npm install -g firebase-tools"
    exit 1
fi

# Deploy Firestore rules
echo "   Running: firebase deploy --only firestore:rules"
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Production rules deployed successfully!"
    echo ""
    echo "🔒 Security is now active:"
    echo "   - Users can ONLY see their own networks"
    echo "   - Users can ONLY modify their own networks"
    echo "   - Users CANNOT access other users' data"
    echo ""
    echo "🧪 Test by signing in with different accounts"
else
    echo ""
    echo "❌ Deployment failed!"
    echo "   Check Firebase CLI login: firebase login"
    echo "   Check project: firebase use"
    exit 1
fi

