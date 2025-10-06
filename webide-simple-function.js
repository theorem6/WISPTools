// Simple Firebase Function for Web IDE
// Copy and paste this entire code into Firebase Web IDE Functions tab

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Main function to initialize ACS database
exports.initializeACSDatabase = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  console.log('🚀 Starting ACS Database Initialization...');
  
  try {
    // 1. Initialize Sample Presets
    console.log('📋 Initializing sample presets...');
    const presets = await initializePresets();
    
    // 2. Initialize Sample Provisions
    console.log('📜 Initializing sample provisions...');
    const provisions = await initializeProvisions();
    
    // 3. Initialize Sample Faults
    console.log('⚠️ Initializing sample faults...');
    const faults = await initializeFaults();
    
    // 4. Initialize Sample CPE Devices
    console.log('📱 Initializing sample CPE devices...');
    const devices = await initializeCPEDevices();
    
    const totalCreated = presets.created + provisions.created + faults.created + devices.created;
    const totalSkipped = presets.skipped + provisions.skipped + faults.skipped + devices.skipped;
    
    console.log('✅ ACS Database initialization completed successfully!');
    
    res.status(200).json({
      success: true,
      message: 'ACS Database initialized successfully',
      results: {
        presets: presets,
        provisions: provisions,
        faults: faults,
        devices: devices,
        totals: {
          created: totalCreated,
          skipped: totalSkipped,
          total: totalCreated + totalSkipped
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Database initialization failed'
    });
  }
});

async function initializePresets() {
  const samplePresets = [
    {
      id: 'default',
      name: 'Default Provisioning',
      description: 'Basic configuration for all CPE devices',
      weight: 0,
      configurations: [
        {
          type: 'value',
          path: 'InternetGatewayDevice.ManagementServer.URL',
          value: 'https://acs.example.com/cwmp'
        }
      ],
      events: ['0 BOOTSTRAP', '1 BOOT', '2 PERIODIC'],
      tags: ['default', 'provisioning'],
      enabled: true
    },
    {
      id: 'nokia-lte',
      name: 'Nokia LTE CPE Configuration',
      description: 'Specific configuration for Nokia LTE CPE devices',
      weight: 100,
      configurations: [
        {
          type: 'value',
          path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Enable',
          value: true
        }
      ],
      preCondition: 'InternetGatewayDevice.DeviceInfo.Manufacturer = "Nokia"',
      events: ['0 BOOTSTRAP', '1 BOOT'],
      tags: ['nokia', 'lte', 'wan'],
      enabled: true
    }
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const preset of samplePresets) {
    const doc = await db.collection('presets').doc(preset.id).get();
    
    if (!doc.exists) {
      await db.collection('presets').doc(preset.id).set(preset);
      createdCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`📋 Presets: ${createdCount} created, ${skippedCount} already existed`);
  return { created: createdCount, skipped: skippedCount };
}

async function initializeProvisions() {
  const sampleProvisions = [
    {
      id: 'default-provision',
      name: 'Default Device Provisioning',
      description: 'Basic device configuration and parameter setup',
      script: `declare("InternetGatewayDevice.ManagementServer.URL", [], "https://acs.example.com/cwmp");`,
      enabled: true,
      tags: ['default', 'provisioning']
    }
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const provision of sampleProvisions) {
    const doc = await db.collection('provisions').doc(provision.id).get();
    
    if (!doc.exists) {
      await db.collection('provisions').doc(provision.id).set(provision);
      createdCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`📜 Provisions: ${createdCount} created, ${skippedCount} already existed`);
  return { created: createdCount, skipped: skippedCount };
}

async function initializeFaults() {
  const sampleFaults = [
    {
      id: 'FAULT-001',
      deviceId: 'CPE-003',
      deviceName: 'ZTE MF920U 4G LTE',
      severity: 'Critical',
      code: '9001',
      message: 'Device connection timeout',
      description: 'Device failed to respond to TR-069 requests',
      status: 'Open',
      timestamp: new Date().toISOString()
    }
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const fault of sampleFaults) {
    const doc = await db.collection('faults').doc(fault.id).get();
    
    if (!doc.exists) {
      await db.collection('faults').doc(fault.id).set(fault);
      createdCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`⚠️ Faults: ${createdCount} created, ${skippedCount} already existed`);
  return { created: createdCount, skipped: skippedCount };
}

async function initializeCPEDevices() {
  const sampleDevices = [
    {
      id: 'nokia-lte-router-001',
      manufacturer: 'Nokia',
      model: 'FastMile 4G Gateway',
      status: 'Online',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        address: 'New York, NY'
      },
      lastContact: new Date().toISOString(),
      parameters: {
        SoftwareVersion: '1.2.3',
        HardwareVersion: 'HW-2.1'
      },
      tags: ['nokia', '4g', 'gateway']
    }
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const device of sampleDevices) {
    const doc = await db.collection('cpe_devices').doc(device.id).get();
    
    if (!doc.exists) {
      await db.collection('cpe_devices').doc(device.id).set(device);
      createdCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`📱 CPE Devices: ${createdCount} created, ${skippedCount} already existed`);
  return { created: createdCount, skipped: skippedCount };
}
