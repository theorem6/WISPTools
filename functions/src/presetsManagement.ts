// Firebase Functions for Presets Management
// Handles CRUD operations for device provisioning presets

import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as cors from 'cors';

const corsHandler = cors({ origin: true });
const db = getFirestore();

// Get all presets
export const getPresets = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { enabled, limit } = req.query;
      
      let query = db.collection('presets').orderBy('weight', 'asc');
      
      // Apply filters
      if (enabled !== undefined) {
        query = query.where('enabled', '==', enabled === 'true');
      }
      
      if (limit) {
        query = query.limit(parseInt(limit as string));
      }
      
      const snapshot = await query.get();
      const presets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      res.json({
        success: true,
        presets,
        count: presets.length
      });
      
    } catch (error) {
      console.error('Failed to get presets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

// Get preset by ID
export const getPreset = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { presetId } = req.params;
      
      if (!presetId) {
        return res.status(400).json({
          success: false,
          error: 'Preset ID is required'
        });
      }
      
      const doc = await db.collection('presets').doc(presetId).get();
      
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }
      
      res.json({
        success: true,
        preset: {
          id: doc.id,
          ...doc.data()
        }
      });
      
    } catch (error) {
      console.error('Failed to get preset:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

// Create new preset
export const createPreset = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const presetData = req.body;
      
      if (!presetData.name || !presetData.description) {
        return res.status(400).json({
          success: false,
          error: 'Name and description are required'
        });
      }
      
      // Generate ID from name (URL-friendly)
      const presetId = presetData.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Check if preset already exists
      const existingDoc = await db.collection('presets').doc(presetId).get();
      if (existingDoc.exists) {
        return res.status(409).json({
          success: false,
          error: 'Preset with this name already exists'
        });
      }
      
      // Create preset document
      const preset = {
        name: presetData.name,
        description: presetData.description,
        weight: presetData.weight || 0,
        configurations: presetData.configurations || [],
        preCondition: presetData.preCondition || '',
        events: presetData.events || ['0 BOOTSTRAP', '1 BOOT'],
        tags: presetData.tags || [],
        enabled: presetData.enabled !== undefined ? presetData.enabled : true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'system' // TODO: Get from auth context
      };
      
      await db.collection('presets').doc(presetId).set(preset);
      
      res.json({
        success: true,
        preset: {
          id: presetId,
          ...preset
        }
      });
      
    } catch (error) {
      console.error('Failed to create preset:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

// Update preset
export const updatePreset = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { presetId } = req.params;
      const updateData = req.body;
      
      if (!presetId) {
        return res.status(400).json({
          success: false,
          error: 'Preset ID is required'
        });
      }
      
      // Check if preset exists
      const doc = await db.collection('presets').doc(presetId).get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }
      
      // Prepare update data
      const updateFields = {
        ...updateData,
        updatedAt: FieldValue.serverTimestamp()
      };
      
      await db.collection('presets').doc(presetId).update(updateFields);
      
      // Get updated document
      const updatedDoc = await db.collection('presets').doc(presetId).get();
      
      res.json({
        success: true,
        preset: {
          id: updatedDoc.id,
          ...updatedDoc.data()
        }
      });
      
    } catch (error) {
      console.error('Failed to update preset:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

// Delete preset
export const deletePreset = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { presetId } = req.params;
      
      if (!presetId) {
        return res.status(400).json({
          success: false,
          error: 'Preset ID is required'
        });
      }
      
      // Check if preset exists
      const doc = await db.collection('presets').doc(presetId).get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }
      
      // Delete the preset
      await db.collection('presets').doc(presetId).delete();
      
      res.json({
        success: true,
        message: 'Preset deleted successfully'
      });
      
    } catch (error) {
      console.error('Failed to delete preset:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

// Initialize sample presets
export const initializeSamplePresets = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
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
      
      res.json({
        success: true,
        message: `Sample presets initialized: ${createdCount} created, ${skippedCount} already existed`,
        created: createdCount,
        skipped: skippedCount,
        total: samplePresets.length
      });
      
    } catch (error) {
      console.error('Failed to initialize sample presets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});
