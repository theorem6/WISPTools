// ACS Database Initialization Script for Firebase Web IDE
// Run this script to populate Firestore with sample data for testing

// Instructions:
// 1. Open Firebase Web IDE
// 2. Go to Functions tab
// 3. Create a new function or use existing one
// 4. Copy and paste this code
// 5. Deploy and run the initialization

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

async function initializeACSDatabase() {
  console.log('🚀 Starting ACS Database Initialization...');
  
  try {
    // 1. Initialize Sample Presets
    console.log('📋 Initializing sample presets...');
    await initializePresets();
    
    // 2. Initialize Sample Provisions
    console.log('📜 Initializing sample provisions...');
    await initializeProvisions();
    
    // 3. Initialize Sample Faults
    console.log('⚠️ Initializing sample faults...');
    await initializeFaults();
    
    // 4. Initialize Sample CPE Devices
    console.log('📱 Initializing sample CPE devices...');
    await initializeCPEDevices();
    
    console.log('✅ ACS Database initialization completed successfully!');
    console.log('🎯 You can now test all CRUD operations in the ACS module');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    throw error;
  }
}

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
        },
        {
          type: 'value',
          path: 'InternetGatewayDevice.ManagementServer.Username',
          value: 'acs-username'
        },
        {
          type: 'value',
          path: 'InternetGatewayDevice.ManagementServer.Password',
          value: 'acs-password'
        }
      ],
      preCondition: '',
      events: ['0 BOOTSTRAP', '1 BOOT', '2 PERIODIC'],
      tags: ['default', 'provisioning'],
      enabled: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
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
        },
        {
          type: 'value',
          path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
          value: 'nokia-lte-user'
        }
      ],
      preCondition: 'InternetGatewayDevice.DeviceInfo.Manufacturer = "Nokia"',
      events: ['0 BOOTSTRAP', '1 BOOT'],
      tags: ['nokia', 'lte', 'wan'],
      enabled: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    {
      id: 'huawei-5g',
      name: 'Huawei 5G CPE Configuration',
      description: 'Advanced configuration for Huawei 5G CPE devices',
      weight: 200,
      configurations: [
        {
          type: 'value',
          path: 'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.DHCPEnabled',
          value: true
        },
        {
          type: 'value',
          path: 'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress',
          value: '192.168.1.1'
        }
      ],
      preCondition: 'InternetGatewayDevice.DeviceInfo.Manufacturer = "Huawei"',
      events: ['0 BOOTSTRAP', '1 BOOT', '2 PERIODIC'],
      tags: ['huawei', '5g', 'lan'],
      enabled: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    {
      id: 'zte-lte',
      name: 'ZTE LTE Modem Configuration',
      description: 'Configuration for ZTE LTE modem devices',
      weight: 150,
      configurations: [
        {
          type: 'value',
          path: 'InternetGatewayDevice.DeviceInfo.ProvisioningCode',
          value: 'ZTE-LTE-001'
        },
        {
          type: 'value',
          path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Enable',
          value: true
        }
      ],
      preCondition: 'InternetGatewayDevice.DeviceInfo.Manufacturer = "ZTE"',
      events: ['0 BOOTSTRAP', '1 BOOT'],
      tags: ['zte', 'lte', 'modem'],
      enabled: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    {
      id: 'firmware-upgrade',
      name: 'Automated Firmware Upgrade',
      description: 'Automatic firmware update for compatible devices',
      weight: 300,
      configurations: [
        {
          type: 'value',
          path: 'InternetGatewayDevice.ManagementServer.Download',
          value: {
            'CommandKey': 'firmware-upgrade',
            'FileType': '1 Firmware Upgrade Image',
            'URL': 'http://files.example.com/firmware/v2.0.bin',
            'Username': 'firmware-user',
            'Password': 'firmware-pass',
            'TargetFileName': 'firmware-upgrade.bin'
          }
        }
      ],
      preCondition: 'InternetGatewayDevice.DeviceInfo.SoftwareVersion < "2.0"',
      events: ['0 BOOTSTRAP'],
      tags: ['firmware', 'upgrade', 'automation'],
      enabled: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
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
}

async function initializeProvisions() {
  const sampleProvisions = [
    {
      id: 'default-provision',
      name: 'Default Device Provisioning',
      description: 'Basic device configuration and parameter setup',
      script: `// Default device provisioning script
declare("InternetGatewayDevice.ManagementServer.URL", [], "https://acs.example.com/cwmp");
declare("InternetGatewayDevice.ManagementServer.Username", [], "acs-user");
declare("InternetGatewayDevice.ManagementServer.Password", [], "acs-pass");
declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", [], 86400);

// Enable periodic inform
declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", [], true);`,
      enabled: true,
      tags: ['default', 'provisioning'],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    {
      id: 'firmware-upgrade',
      name: 'Automated Firmware Upgrade',
      description: 'Automatic firmware update for compatible devices',
      script: `// Automated firmware upgrade script
if (device["InternetGatewayDevice.DeviceInfo.SoftwareVersion"] < "2.0") {
  declare("InternetGatewayDevice.ManagementServer.Download", [], {
    "CommandKey": "firmware-upgrade",
    "FileType": "1 Firmware Upgrade Image",
    "URL": "http://files.example.com/firmware/v2.0.bin",
    "Username": "firmware-user",
    "Password": "firmware-pass",
    "TargetFileName": "firmware-upgrade.bin"
  });
}`,
      enabled: true,
      tags: ['firmware', 'upgrade', 'automation'],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    {
      id: 'wifi-configuration',
      name: 'WiFi Configuration Setup',
      description: 'Configure WiFi settings for CPE devices',
      script: `// WiFi configuration script
declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable", [], true);
declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", [], "ACSWiFi");
declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SecurityMode", [], "WPA2-PSK");
declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey", [], "ACSPassword123");`,
      enabled: true,
      tags: ['wifi', 'configuration', 'security'],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
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
}

async function initializeFaults() {
  const sampleFaults = [
    {
      id: 'FAULT-001',
      deviceId: 'CPE-003',
      deviceName: 'ZTE MF920U 4G LTE',
      timestamp: new Date('2025-01-04T14:20:00Z'),
      severity: 'Critical',
      code: '9001',
      message: 'Device connection timeout',
      description: 'Device failed to respond to TR-069 requests within timeout period',
      status: 'Open',
      parameters: {
        'InternetGatewayDevice.ManagementServer.PeriodicInformInterval': '86400',
        'InternetGatewayDevice.ManagementServer.ConnectionRequestURL': 'http://device.example.com:7547'
      },
      resolution: '',
      resolvedBy: null,
      resolvedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    {
      id: 'FAULT-002',
      deviceId: 'CPE-001',
      deviceName: 'Nokia FastMile 4G Gateway',
      timestamp: new Date('2025-01-03T09:15:00Z'),
      severity: 'Warning',
      code: '9002',
      message: 'Firmware update failed',
      description: 'Attempted firmware update failed due to insufficient storage space',
      status: 'Resolved',
      parameters: {
        'InternetGatewayDevice.DeviceInfo.SoftwareVersion': '2.1.2',
        'InternetGatewayDevice.DeviceInfo.HardwareVersion': '1.0'
      },
      resolution: 'Cleared device storage and retried firmware update successfully',
      resolvedBy: 'admin@example.com',
      resolvedAt: new Date('2025-01-03T11:30:00Z'),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    {
      id: 'FAULT-003',
      deviceId: 'CPE-002',
      deviceName: 'Huawei 5G CPE Pro 2',
      timestamp: new Date('2025-01-02T16:45:00Z'),
      severity: 'Info',
      code: '9003',
      message: 'Configuration parameter mismatch',
      description: 'Device reported different parameter value than expected',
      status: 'Open',
      parameters: {
        'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress': '192.168.1.101',
        'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceSubnetMask': '255.255.255.0'
      },
      resolution: '',
      resolvedBy: null,
      resolvedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
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
      lastContact: new Date(),
      parameters: {
        SoftwareVersion: '1.2.3',
        HardwareVersion: 'HW-2.1'
      },
      tags: ['nokia', '4g', 'gateway'],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    {
      id: 'huawei-lte-cpe-002',
      manufacturer: 'Huawei',
      model: '5G CPE Pro 2',
      status: 'Online',
      location: {
        latitude: 40.7589,
        longitude: -73.9851,
        address: 'Times Square, NY'
      },
      lastContact: new Date(),
      parameters: {
        SoftwareVersion: '2.1.0',
        HardwareVersion: 'HW-3.0'
      },
      tags: ['huawei', '5g', 'pro'],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    {
      id: 'zte-lte-modem-003',
      manufacturer: 'ZTE',
      model: 'MF920U 4G LTE',
      status: 'Offline',
      location: {
        latitude: 40.6892,
        longitude: -74.0445,
        address: 'Brooklyn, NY'
      },
      lastContact: new Date(Date.now() - 300000), // 5 minutes ago
      parameters: {
        SoftwareVersion: '1.8.2',
        HardwareVersion: 'HW-1.5'
      },
      tags: ['zte', '4g', 'lte'],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
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
}

// Export the initialization function
module.exports = { initializeACSDatabase };

// If running directly, execute the initialization
if (require.main === module) {
  initializeACSDatabase()
    .then(() => {
      console.log('🎉 Database initialization completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database initialization failed:', error);
      process.exit(1);
    });
}
