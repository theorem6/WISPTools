// SvelteKit API Route - Initialize MongoDB Database
// Deploys automatically with App Hosting rollouts

import type { RequestHandler } from '@sveltejs/kit';
import { MongoClient } from 'mongodb';
// Use process.env instead of $env/static/private for compatibility
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'genieacs';

export const POST: RequestHandler = async () => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    
    // Sample presets
    const samplePresets = [
      {
        _id: 'default-provisioning',
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
            path: 'InternetGatewayDevice.ManagementServer.PeriodicInformEnable',
            value: true
          }
        ],
        preCondition: '',
        events: ['0 BOOTSTRAP', '1 BOOT', '2 PERIODIC'],
        tags: ['default', 'provisioning'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: 'nokia-lte-config',
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
        tags: ['nokia', 'lte'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: 'huawei-5g-config',
        name: 'Huawei 5G CPE Configuration',
        description: 'Advanced configuration for Huawei 5G CPE devices',
        weight: 200,
        configurations: [
          {
            type: 'value',
            path: 'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.DHCPEnabled',
            value: true
          }
        ],
        preCondition: 'InternetGatewayDevice.DeviceInfo.Manufacturer = "Huawei"',
        events: ['0 BOOTSTRAP', '1 BOOT', '2 PERIODIC'],
        tags: ['huawei', '5g'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: 'firmware-upgrade',
        name: 'Automated Firmware Upgrade',
        description: 'Automatic firmware update for devices with old versions',
        weight: 500,
        configurations: [],
        preCondition: 'InternetGatewayDevice.DeviceInfo.SoftwareVersion < "2.0"',
        events: ['2 PERIODIC'],
        tags: ['firmware', 'upgrade'],
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Sample faults
    const sampleFaults = [
      {
        _id: 'FAULT-001',
        deviceId: 'CPE-003',
        deviceName: 'ZTE MF920U 4G LTE',
        timestamp: new Date(),
        severity: 'Critical',
        code: '9001',
        message: 'Device connection timeout',
        description: 'Device failed to respond to TR-069 requests',
        status: 'Open',
        parameters: {},
        resolution: '',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: 'FAULT-002',
        deviceId: 'CPE-001',
        deviceName: 'Nokia FastMile 4G Gateway',
        timestamp: new Date(),
        severity: 'Warning',
        code: '9002',
        message: 'Firmware update failed',
        description: 'Attempted firmware update failed',
        status: 'Resolved',
        parameters: {},
        resolution: 'Cleared device storage and retried',
        resolvedBy: 'admin@example.com',
        resolvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: 'FAULT-003',
        deviceId: 'CPE-002',
        deviceName: 'Huawei 5G CPE Pro 2',
        timestamp: new Date(),
        severity: 'Info',
        code: '9003',
        message: 'Configuration parameter mismatch',
        description: 'Device reported different parameter value',
        status: 'Open',
        parameters: {},
        resolution: '',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Initialize database
    const presetsCollection = db.collection('presets');
    const faultsCollection = db.collection('faults');
    
    let presetsCreated = 0;
    let presetsSkipped = 0;
    
    for (const preset of samplePresets) {
      const existing = await presetsCollection.findOne({ _id: preset._id });
      if (!existing) {
        await presetsCollection.insertOne(preset);
        presetsCreated++;
      } else {
        presetsSkipped++;
      }
    }
    
    let faultsCreated = 0;
    let faultsSkipped = 0;
    
    for (const fault of sampleFaults) {
      const existing = await faultsCollection.findOne({ _id: fault._id });
      if (!existing) {
        await faultsCollection.insertOne(fault);
        faultsCreated++;
      } else {
        faultsSkipped++;
      }
    }
    
    const finalPresetsCount = await presetsCollection.countDocuments();
    const finalFaultsCount = await faultsCollection.countDocuments();
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'MongoDB database initialized successfully',
      database: db.databaseName,
      presets: {
        created: presetsCreated,
        skipped: presetsSkipped,
        total: finalPresetsCount
      },
      faults: {
        created: faultsCreated,
        skipped: faultsSkipped,
        total: finalFaultsCount
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Failed to initialize MongoDB:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

