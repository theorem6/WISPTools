# Firebase Web IDE - Quick GenieACS Test Script
# Run this in Firebase Web IDE terminal to test the integration

Write-Host "🔥 Firebase Web IDE GenieACS Integration Test" -ForegroundColor Green
Write-Host ""

# Test MongoDB connection
Write-Host "🗄️ Testing MongoDB Atlas connection..." -ForegroundColor Blue
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

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ MongoDB connection successful!" -ForegroundColor Green
} else {
    Write-Host "❌ MongoDB connection failed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test Firebase Functions (if deployed)
Write-Host "🔥 Testing Firebase Functions..." -ForegroundColor Blue
$projectId = "your-firebase-project-id"  # Replace with your actual project ID

Write-Host "📋 Available Firebase Functions:" -ForegroundColor Cyan
Write-Host "   - syncCPEDevices: https://us-central1-$projectId.cloudfunctions.net/syncCPEDevices" -ForegroundColor White
Write-Host "   - genieacsCWMP: https://us-central1-$projectId.cloudfunctions.net/genieacsCWMP" -ForegroundColor White
Write-Host "   - getCpePerformanceMetrics: Callable function" -ForegroundColor White

Write-Host ""

# Initialize sample data
Write-Host "📊 Initialize sample CPE data in MongoDB? (y/n)" -ForegroundColor Yellow
$response = Read-Host
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "🗄️ Initializing sample CPE data..." -ForegroundColor Blue
    node init-mongodb-data.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Sample data initialized successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to initialize sample data" -ForegroundColor Red
    }
}

Write-Host ""

# Run comprehensive test
Write-Host "🧪 Running comprehensive integration test..." -ForegroundColor Blue
node test-integration.js

Write-Host ""
Write-Host "🎉 Firebase Web IDE GenieACS Test Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Deploy Firebase Functions: firebase deploy --only functions" -ForegroundColor White
Write-Host "2. Open Firebase Web IDE preview" -ForegroundColor White
Write-Host "3. Navigate to PCI Mapper to see CPE devices" -ForegroundColor White
Write-Host "4. Click on CPE devices to see performance data" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Firebase Console: https://console.firebase.google.com" -ForegroundColor Cyan
Write-Host "🗄️ MongoDB Atlas: https://cloud.mongodb.com" -ForegroundColor Cyan
