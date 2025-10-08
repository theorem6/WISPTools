// MongoDB Database Initialization
// Creates collections and seeds initial data for GenieACS

import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { getGenieACSCollections, getConnectionStats } from './mongoConnection.js';

const corsHandler = cors({ origin: true });

// Check MongoDB health and database status
export const checkMongoHealth = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const stats = await getConnectionStats();
      
      if (!stats.connected) {
        return res.status(500).json({
          success: false,
          error: 'MongoDB not connected',
          details: stats.error
        });
      }
      
      const { presets, faults } = await getGenieACSCollections();
      
      // Count documents in each collection
      const presetsCount = await presets.countDocuments();
      const faultsCount = await faults.countDocuments();
      
      return res.json({
        success: true,
        connected: true,
        database: stats.databaseName,
        serverVersion: stats.serverVersion,
        collections: {
          presets: presetsCount,
          faults: faultsCount
        },
        stats: {
          totalCollections: stats.collections,
          dataSize: stats.dataSize,
          storageSize: stats.storageSize,
          indexes: stats.indexes
        }
      });
      
    } catch (error) {
      console.error('MongoDB health check failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        hint: 'Check MongoDB connection string in environment variables'
      });
    }
  });
});

// Initialize MongoDB with sample presets
export const initializeMongoPresets = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { presets } = await getGenieACSCollections();
      
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
              path: 'InternetGatewayDevice.ManagementServer.Username',
              value: 'acs-user'
            },
            {
              type: 'value',
              path: 'InternetGatewayDevice.ManagementServer.PeriodicInformEnable',
              value: true
            },
            {
              type: 'value',
              path: 'InternetGatewayDevice.ManagementServer.PeriodicInformInterval',
              value: 86400
            }
          ],
          preCondition: '',
          events: ['0 BOOTSTRAP', '1 BOOT', '2 PERIODIC'],
          tags: ['default', 'provisioning', 'required'],
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
            },
            {
              type: 'value',
              path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
              value: 'nokia-lte-user'
            },
            {
              type: 'value',
              path: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable',
              value: true
            },
            {
              type: 'value',
              path: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
              value: 'Nokia-LTE-Network'
            }
          ],
          preCondition: 'InternetGatewayDevice.DeviceInfo.Manufacturer = "Nokia"',
          events: ['0 BOOTSTRAP', '1 BOOT'],
          tags: ['nokia', 'lte', 'wan', 'wlan'],
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
            },
            {
              type: 'value',
              path: 'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress',
              value: '192.168.1.1'
            },
            {
              type: 'value',
              path: 'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceSubnetMask',
              value: '255.255.255.0'
            },
            {
              type: 'value',
              path: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Standard',
              value: '802.11ax'
            }
          ],
          preCondition: 'InternetGatewayDevice.DeviceInfo.Manufacturer = "Huawei"',
          events: ['0 BOOTSTRAP', '1 BOOT', '2 PERIODIC'],
          tags: ['huawei', '5g', 'lan', 'wifi6'],
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: 'firmware-upgrade',
          name: 'Automated Firmware Upgrade',
          description: 'Automatic firmware update for devices with old versions',
          weight: 500,
          configurations: [
            {
              type: 'download',
              path: 'InternetGatewayDevice.ManagementServer.Download',
              value: {
                FileType: '1 Firmware Upgrade Image',
                URL: 'http://firmware.example.com/latest.bin',
                Username: 'firmware-user',
                Password: 'firmware-pass'
              }
            }
          ],
          preCondition: 'InternetGatewayDevice.DeviceInfo.SoftwareVersion < "2.0"',
          events: ['2 PERIODIC'],
          tags: ['firmware', 'upgrade', 'automated'],
          enabled: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      let created = 0;
      let skipped = 0;
      let updated = 0;
      
      for (const preset of samplePresets) {
        const existing = await presets.findOne({ _id: preset._id });
        
        if (!existing) {
          await presets.insertOne(preset);
          created++;
        } else if (req.query.overwrite === 'true') {
          await presets.replaceOne({ _id: preset._id }, preset);
          updated++;
        } else {
          skipped++;
        }
      }
      
      return res.json({
        success: true,
        message: `Presets initialized: ${created} created, ${updated} updated, ${skipped} skipped`,
        created,
        updated,
        skipped,
        total: samplePresets.length
      });
      
    } catch (error) {
      console.error('Failed to initialize presets:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Initialize MongoDB with sample faults
export const initializeMongoFaults = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { faults } = await getGenieACSCollections();
      
      const sampleFaults = [
        {
          _id: 'FAULT-001',
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
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: 'FAULT-002',
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
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: 'FAULT-003',
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
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      let created = 0;
      let skipped = 0;
      let updated = 0;
      
      for (const fault of sampleFaults) {
        const existing = await faults.findOne({ _id: fault._id });
        
        if (!existing) {
          await faults.insertOne(fault);
          created++;
        } else if (req.query.overwrite === 'true') {
          await faults.replaceOne({ _id: fault._id }, fault);
          updated++;
        } else {
          skipped++;
        }
      }
      
      return res.json({
        success: true,
        message: `Faults initialized: ${created} created, ${updated} updated, ${skipped} skipped`,
        created,
        updated,
        skipped,
        total: sampleFaults.length
      });
      
    } catch (error) {
      console.error('Failed to initialize faults:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Initialize all MongoDB collections at once
export const initializeMongoDatabase = onRequest({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      console.log('Starting MongoDB database initialization...');
      
      // Check connection first
      const stats = await getConnectionStats();
      if (!stats.connected) {
        return res.status(500).json({
          success: false,
          error: 'MongoDB not connected. Please check MONGODB_URI environment variable.'
        });
      }
      
      const { presets, faults } = await getGenieACSCollections();
      
      // Initialize presets
      const presetsSample = [
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
        }
      ];
      
      const faultsSample = [
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
        }
      ];
      
      let presetsCreated = 0;
      let presetsSkipped = 0;
      
      for (const preset of presetsSample) {
        const existing = await presets.findOne({ _id: preset._id });
        if (!existing) {
          await presets.insertOne(preset);
          presetsCreated++;
        } else {
          presetsSkipped++;
        }
      }
      
      let faultsCreated = 0;
      let faultsSkipped = 0;
      
      for (const fault of faultsSample) {
        const existing = await faults.findOne({ _id: fault._id });
        if (!existing) {
          await faults.insertOne(fault);
          faultsCreated++;
        } else {
          faultsSkipped++;
        }
      }
      
      // Get final counts
      const finalPresetsCount = await presets.countDocuments();
      const finalFaultsCount = await faults.countDocuments();
      
      return res.json({
        success: true,
        message: 'MongoDB database initialized successfully',
        database: stats.databaseName,
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
      });
      
    } catch (error) {
      console.error('Failed to initialize MongoDB database:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

