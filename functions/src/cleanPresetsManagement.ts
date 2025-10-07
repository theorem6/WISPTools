// Clean Firebase Functions for Presets Management
// Import shared Firebase initialization (must be first)
import { db } from './firebaseInit.js';

import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import cors from 'cors';

const corsHandler = cors({ origin: true });

// Get all presets
export const getPresets = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const snapshot = await db.collection('presets').orderBy('weight', 'asc').get();
      const presets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return res.json({
        success: true,
        presets,
        count: presets.length
      });
    } catch (error) {
      console.error('Failed to get presets:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
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
      
      const presetId = presetData.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
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
        updatedAt: FieldValue.serverTimestamp()
      };
      
      await db.collection('presets').doc(presetId).set(preset);
      
      return res.json({
        success: true,
        preset: {
          id: presetId,
          ...preset
        }
      });
    } catch (error) {
      console.error('Failed to create preset:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
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
      
      await db.collection('presets').doc(presetId).delete();
      
      return res.json({
        success: true,
        message: 'Preset deleted successfully'
      });
    } catch (error) {
      console.error('Failed to delete preset:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
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
            }
          ],
          preCondition: 'InternetGatewayDevice.DeviceInfo.Manufacturer = "Nokia"',
          events: ['0 BOOTSTRAP', '1 BOOT'],
          tags: ['nokia', 'lte', 'wan'],
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
      
      return res.json({
        success: true,
        message: `Sample presets initialized: ${createdCount} created, ${skippedCount} already existed`,
        created: createdCount,
        skipped: skippedCount,
        total: samplePresets.length
      });
    } catch (error) {
      console.error('Failed to initialize sample presets:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});
