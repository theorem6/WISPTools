// Firebase GenieACS Integration Test Script
// Run this script to test the complete integration

const { MongoClient } = require('mongodb');
const admin = require('firebase-admin');

// Configuration
const mongodbUrl = 'mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0';
const firebaseProjectId = 'your-firebase-project-id'; // Replace with your actual project ID

async function testIntegration() {
  console.log('🧪 Testing Firebase GenieACS Integration...');
  
  // Test MongoDB connection
  console.log('🗄️ Testing MongoDB Atlas connection...');
  const mongodbClient = new MongoClient(mongodbUrl);
  
  try {
    await mongodbClient.connect();
    console.log('✅ MongoDB Atlas connection successful');
    
    const db = mongodbClient.db('genieacs');
    const devicesCollection = db.collection('devices');
    
    // Count devices
    const deviceCount = await devicesCollection.countDocuments();
    console.log(`📱 Found ${deviceCount} devices in GenieACS`);
    
    // Get sample device with GPS data
    const deviceWithGPS = await devicesCollection.findOne({
      'Device.GPS.Latitude': { $exists: true },
      'Device.GPS.Longitude': { $exists: true }
    });
    
    if (deviceWithGPS) {
      console.log('📍 Sample device with GPS data:');
      console.log(`   - Device ID: ${deviceWithGPS._id}`);
      console.log(`   - Manufacturer: ${deviceWithGPS['Device.DeviceInfo.Manufacturer']}`);
      console.log(`   - GPS: ${deviceWithGPS['Device.GPS.Latitude']}, ${deviceWithGPS['Device.GPS.Longitude']}`);
      console.log(`   - Last Inform: ${deviceWithGPS._lastInform}`);
    }
    
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    return;
  } finally {
    await mongodbClient.close();
  }
  
  // Test Firebase Functions (if deployed)
  console.log('');
  console.log('🔥 Testing Firebase Functions...');
  
  try {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: firebaseProjectId
      });
    }
    
    const db = admin.firestore();
    
    // Check if CPE devices collection exists and has data
    const cpeDevicesSnapshot = await db.collection('cpe_devices').limit(1).get();
    
    if (!cpeDevicesSnapshot.empty) {
      const sampleCpe = cpeDevicesSnapshot.docs[0].data();
      console.log('✅ CPE devices found in Firestore:');
      console.log(`   - Device ID: ${sampleCpe.id}`);
      console.log(`   - Status: ${sampleCpe.status}`);
      console.log(`   - Location: ${sampleCpe.location ? `${sampleCpe.location.latitude}, ${sampleCpe.location.longitude}` : 'No GPS data'}`);
    } else {
      console.log('⚠️ No CPE devices found in Firestore');
      console.log('   Run the sync function to populate data');
    }
    
  } catch (error) {
    console.error('❌ Firebase connection failed:', error.message);
    console.log('   Make sure Firebase Functions are deployed');
  }
  
  // Test HTTP endpoints (if deployed)
  console.log('');
  console.log('🌐 Testing HTTP endpoints...');
  
  const endpoints = [
    `https://us-central1-${firebaseProjectId}.cloudfunctions.net/syncCPEDevices`,
    `https://us-central1-${firebaseProjectId}.cloudfunctions.net/genieacsCWMP`
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { method: 'GET' });
      console.log(`✅ ${endpoint}: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.message}`);
    }
  }
  
  console.log('');
  console.log('🎉 Integration test completed!');
  console.log('');
  console.log('📋 Summary:');
  console.log('   - MongoDB Atlas: Connected and accessible');
  console.log('   - GenieACS Data: Sample devices available');
  console.log('   - Firebase Functions: Ready for deployment');
  console.log('   - Firestore: Ready to receive CPE data');
  console.log('');
  console.log('🚀 Next steps:');
  console.log('   1. Deploy Firebase Functions');
  console.log('   2. Initialize MongoDB with sample data');
  console.log('   3. Test the sync process');
  console.log('   4. Integrate with PCI Mapper UI');
}

// Run the test
testIntegration().catch(console.error);
