// MongoDB Atlas Data Initialization Script
// Run this script to initialize GenieACS collections with sample data

const { MongoClient } = require('mongodb');

const connectionUrl = 'mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0';

async function initializeGenieACSData() {
  console.log('🗄️ Connecting to MongoDB Atlas...');
  
  const client = new MongoClient(connectionUrl);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db('genieacs');
    
    // Initialize collections
    console.log('📋 Initializing GenieACS collections...');
    
    // Create devices collection with sample data
    const devicesCollection = db.collection('devices');
    
    // Sample CPE devices with GPS coordinates
    const sampleDevices = [
      {
        _id: 'nokia-lte-router-001',
        _deviceId: {
          Manufacturer: 'Nokia',
          OUI: '001E58',
          ProductClass: 'LTE Router',
          SerialNumber: 'NOKIA001'
        },
        _lastInform: new Date(),
        _registered: new Date(),
        _tags: ['lte', 'router', 'production'],
        'Device.DeviceInfo.Manufacturer': 'Nokia',
        'Device.DeviceInfo.ProductClass': 'LTE Router',
        'Device.DeviceInfo.SerialNumber': 'NOKIA001',
        'Device.DeviceInfo.SoftwareVersion': '1.2.3',
        'Device.DeviceInfo.HardwareVersion': 'HW-2.1',
        'Device.GPS.Latitude': '40.7128',
        'Device.GPS.Longitude': '-74.0060',
        'Device.GPS.Accuracy': '5',
        'Device.GPS.LastUpdate': Date.now(),
        'Device.IP.Interface.1.IPAddress': '192.168.1.100',
        'Device.Ethernet.Interface.1.MACAddress': '00:1E:58:12:34:56',
        'Device.WiFi.Radio.1.SSID': 'Nokia-LTE-001',
        'Device.WiFi.Radio.1.Channel': '6',
        'Device.WiFi.Radio.1.Frequency': '2437',
        'Device.WiFi.Radio.1.SignalStrength': '-45',
        'Device.ManagementServer.ConnectionRequestURL': 'https://us-central1-your-project.cloudfunctions.net/genieacsCWMP',
        'Device.DeviceInfo.Uptime': '86400'
      },
      {
        _id: 'huawei-lte-cpe-002',
        _deviceId: {
          Manufacturer: 'Huawei',
          OUI: '00E0FC',
          ProductClass: 'LTE CPE',
          SerialNumber: 'HUAWEI002'
        },
        _lastInform: new Date(),
        _registered: new Date(),
        _tags: ['lte', 'cpe', 'production'],
        'Device.DeviceInfo.Manufacturer': 'Huawei',
        'Device.DeviceInfo.ProductClass': 'LTE CPE',
        'Device.DeviceInfo.SerialNumber': 'HUAWEI002',
        'Device.DeviceInfo.SoftwareVersion': '2.1.0',
        'Device.DeviceInfo.HardwareVersion': 'HW-3.0',
        'Device.GPS.Latitude': '40.7589',
        'Device.GPS.Longitude': '-73.9851',
        'Device.GPS.Accuracy': '3',
        'Device.GPS.LastUpdate': Date.now(),
        'Device.IP.Interface.1.IPAddress': '192.168.1.101',
        'Device.Ethernet.Interface.1.MACAddress': '00:E0:FC:56:78:90',
        'Device.WiFi.Radio.1.SSID': 'Huawei-LTE-002',
        'Device.WiFi.Radio.1.Channel': '11',
        'Device.WiFi.Radio.1.Frequency': '2462',
        'Device.WiFi.Radio.1.SignalStrength': '-52',
        'Device.ManagementServer.ConnectionRequestURL': 'https://us-central1-your-project.cloudfunctions.net/genieacsCWMP',
        'Device.DeviceInfo.Uptime': '172800'
      },
      {
        _id: 'zte-lte-modem-003',
        _deviceId: {
          Manufacturer: 'ZTE',
          OUI: '0019C6',
          ProductClass: 'LTE Modem',
          SerialNumber: 'ZTE003'
        },
        _lastInform: new Date(Date.now() - 300000), // 5 minutes ago (offline)
        _registered: new Date(),
        _tags: ['lte', 'modem', 'testing'],
        'Device.DeviceInfo.Manufacturer': 'ZTE',
        'Device.DeviceInfo.ProductClass': 'LTE Modem',
        'Device.DeviceInfo.SerialNumber': 'ZTE003',
        'Device.DeviceInfo.SoftwareVersion': '1.8.2',
        'Device.DeviceInfo.HardwareVersion': 'HW-1.5',
        'Device.GPS.Latitude': '40.6892',
        'Device.GPS.Longitude': '-74.0445',
        'Device.GPS.Accuracy': '8',
        'Device.GPS.LastUpdate': Date.now() - 300000,
        'Device.IP.Interface.1.IPAddress': '192.168.1.102',
        'Device.Ethernet.Interface.1.MACAddress': '00:19:C6:90:12:34',
        'Device.WiFi.Radio.1.SSID': 'ZTE-LTE-003',
        'Device.WiFi.Radio.1.Channel': '1',
        'Device.WiFi.Radio.1.Frequency': '2412',
        'Device.WiFi.Radio.1.SignalStrength': '-68',
        'Device.ManagementServer.ConnectionRequestURL': 'https://us-central1-your-project.cloudfunctions.net/genieacsCWMP',
        'Device.DeviceInfo.Uptime': '43200'
      }
    ];
    
    // Insert sample devices
    console.log('📱 Inserting sample CPE devices...');
    await devicesCollection.insertMany(sampleDevices);
    console.log(`✅ Inserted ${sampleDevices.length} sample devices`);
    
    // Create presets collection
    const presetsCollection = db.collection('presets');
    const samplePresets = [
      {
        _id: 'initial-provisioning',
        name: 'Initial Provisioning',
        channel: 'initial-provisioning',
        events: {
          '1 BOOTSTRAP': true
        },
        provisions: [
          ['SET_PARAMETER_VALUES', 'Device.ManagementServer.PeriodicInformInterval', 3600],
          ['SET_PARAMETER_VALUES', 'Device.ManagementServer.ConnectionRequestURL', 'https://us-central1-your-project.cloudfunctions.net/genieacsCWMP']
        ]
      },
      {
        _id: 'gps-configuration',
        name: 'GPS Configuration',
        channel: 'gps-config',
        events: {
          '1 BOOTSTRAP': true,
          '2 PERIODIC': true
        },
        provisions: [
          ['GET_PARAMETER_VALUES', 'Device.GPS.Latitude'],
          ['GET_PARAMETER_VALUES', 'Device.GPS.Longitude'],
          ['GET_PARAMETER_VALUES', 'Device.GPS.Accuracy']
        ]
      }
    ];
    
    await presetsCollection.insertMany(samplePresets);
    console.log('✅ Inserted sample presets');
    
    // Create tasks collection
    const tasksCollection = db.collection('tasks');
    const sampleTasks = [
      {
        _id: 'gps-data-collection',
        device: 'nokia-lte-router-001',
        timestamp: new Date(),
        name: 'Get GPS Data',
        parameterNames: [
          'Device.GPS.Latitude',
          'Device.GPS.Longitude',
          'Device.GPS.Accuracy'
        ]
      }
    ];
    
    await tasksCollection.insertMany(sampleTasks);
    console.log('✅ Inserted sample tasks');
    
    // Create indexes for better performance
    console.log('🔍 Creating database indexes...');
    
    await devicesCollection.createIndex({ '_lastInform': 1 });
    await devicesCollection.createIndex({ '_deviceId.Manufacturer': 1 });
    await devicesCollection.createIndex({ '_deviceId.SerialNumber': 1 });
    await devicesCollection.createIndex({ 'Device.GPS.Latitude': 1, 'Device.GPS.Longitude': 1 });
    
    await tasksCollection.createIndex({ 'device': 1, 'timestamp': 1 });
    await presetsCollection.createIndex({ '_id': 1 });
    
    console.log('✅ Created database indexes');
    
    console.log('');
    console.log('🎉 GenieACS data initialization completed successfully!');
    console.log('');
    console.log('📊 Sample data created:');
    console.log(`   - ${sampleDevices.length} CPE devices with GPS coordinates`);
    console.log(`   - ${samplePresets.length} provisioning presets`);
    console.log(`   - ${sampleTasks.length} management tasks`);
    console.log('');
    console.log('🔗 Next steps:');
    console.log('   1. Deploy Firebase Functions: firebase deploy --only functions');
    console.log('   2. Test sync: curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/syncCPEDevices');
    console.log('   3. Check Firestore for synced CPE devices');
    
  } catch (error) {
    console.error('❌ Error initializing GenieACS data:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB Atlas');
  }
}

// Run the initialization
initializeGenieACSData().catch(console.error);
