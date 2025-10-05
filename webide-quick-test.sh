#!/bin/bash
# Firebase Web IDE - Quick GenieACS Test Script
# Run this in Firebase Web IDE terminal to test the integration

echo "🔥 Firebase Web IDE GenieACS Integration Test"
echo ""

# Test MongoDB connection
echo "🗄️ Testing MongoDB Atlas connection..."
node -e "
const { MongoClient } = require('mongodb');
const client = new MongoClient('mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0');
client.connect().then(() => {
  console.log('✅ MongoDB Atlas connected successfully!');
  return client.db('genieacs').collection('devices').countDocuments();
}).then(count => {
  console.log(\`📱 Found \${count} devices in GenieACS database\`);
  client.close();
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});
"

if [ $? -eq 0 ]; then
    echo "✅ MongoDB connection successful!"
else
    echo "❌ MongoDB connection failed"
    exit 1
fi

echo ""

# Test Firebase Functions (if deployed)
echo "🔥 Testing Firebase Functions..."
projectId="your-firebase-project-id"  # Replace with your actual project ID

echo "📋 Available Firebase Functions:"
echo "   - syncCPEDevices: https://us-central1-$projectId.cloudfunctions.net/syncCPEDevices"
echo "   - genieacsCWMP: https://us-central1-$projectId.cloudfunctions.net/genieacsCWMP"
echo "   - getCpePerformanceMetrics: Callable function"

echo ""

# Initialize sample data
echo "📊 Initialize sample CPE data in MongoDB? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "🗄️ Initializing sample CPE data..."
    node init-mongodb-data.js
    if [ $? -eq 0 ]; then
        echo "✅ Sample data initialized successfully!"
    else
        echo "❌ Failed to initialize sample data"
    fi
fi

echo ""

# Run comprehensive test
echo "🧪 Running comprehensive integration test..."
node test-integration.js

echo ""
echo "🎉 Firebase Web IDE GenieACS Test Complete!"
echo ""
echo "📋 Next steps:"
echo "1. Deploy Firebase Functions: firebase deploy --only functions"
echo "2. Open Firebase Web IDE preview"
echo "3. Navigate to PCI Mapper to see CPE devices"
echo "4. Click on CPE devices to see performance data"
echo ""
echo "🔗 Firebase Console: https://console.firebase.google.com"
echo "🗄️ MongoDB Atlas: https://cloud.mongodb.com"
