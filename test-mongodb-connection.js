// Test MongoDB Atlas Connection
// Run this script to verify the MongoDB connection is working

const { MongoClient } = require('mongodb');

// MongoDB Atlas connection string (replace with your actual connection string)
const connectionUrl = 'mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testConnection() {
  let client;
  
  try {
    console.log('🔌 Testing MongoDB Atlas connection...');
    console.log('Connection URL:', connectionUrl.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
    
    client = new MongoClient(connectionUrl);
    
    // Test connection
    await client.connect();
    console.log('✅ Successfully connected to MongoDB Atlas!');
    
    // Test database access
    const db = client.db('genieacs');
    console.log('✅ Successfully accessed genieacs database');
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log('📋 Available collections:', collections.map(c => c.name));
    
    // Test devices collection
    const devicesCollection = db.collection('devices');
    const deviceCount = await devicesCollection.countDocuments();
    console.log(`📱 Found ${deviceCount} devices in the devices collection`);
    
    // Test presets collection
    const presetsCollection = db.collection('presets');
    const presetCount = await presetsCollection.countDocuments();
    console.log(`⚙️ Found ${presetCount} presets in the presets collection`);
    
    // Test faults collection
    const faultsCollection = db.collection('faults');
    const faultCount = await faultsCollection.countDocuments();
    console.log(`⚠️ Found ${faultCount} faults in the faults collection`);
    
    console.log('\n🎉 MongoDB Atlas connection test completed successfully!');
    console.log('💡 The GenieACS integration should work with this connection.');
    
  } catch (error) {
    console.error('❌ MongoDB connection test failed:');
    console.error('Error:', error.message);
    
    if (error.message.includes('authentication')) {
      console.log('\n🔐 Authentication Error - Check your username and password');
    } else if (error.message.includes('network')) {
      console.log('\n🌐 Network Error - Check your internet connection and IP whitelist');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('\n🔍 DNS Error - Check your connection string format');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Connection closed');
    }
  }
}

// Run the test
testConnection();
