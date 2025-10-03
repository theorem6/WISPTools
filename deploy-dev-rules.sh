#!/bin/bash
# Deploy development Firestore rules (more permissive for testing)

echo "🔄 Deploying DEVELOPMENT Firestore Rules..."
echo "⚠️  These rules are MORE PERMISSIVE - use for testing only!"
echo ""

# Backup current rules
if [ ! -f firestore.rules.backup ]; then
  cp firestore.rules firestore.rules.backup
  echo "✅ Backed up production rules to firestore.rules.backup"
fi

# Use development rules
cp firestore.rules.dev firestore.rules
echo "✅ Copied development rules to firestore.rules"
echo ""

# Deploy
echo "📤 Deploying to Firebase..."
firebase deploy --only firestore:rules

echo ""
echo "✅ Development rules deployed!"
echo ""
echo "📋 Next steps:"
echo "1. Try accessing your app - permissions should work now"
echo "2. Check Firebase Console: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore/rules"
echo "3. When ready for production, run: ./deploy-prod-rules.sh"
echo ""
echo "⚠️  Remember: Development rules allow ANY authenticated user to read/write"
echo "    Switch to production rules before going live!"
echo ""

