// Firebase Functions for Provisions Management
// Handles CRUD operations for JavaScript provisioning scripts

import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import cors from 'cors';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

const corsHandler = cors({ origin: true });
const db = getFirestore();

// Get all provisions
export const getProvisions = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { enabled, limit } = req.query;
      
      let query = db.collection('provisions').orderBy('name', 'asc');
      
      // Apply filters
      if (enabled !== undefined) {
        query = query.where('enabled', '==', enabled === 'true');
      }
      
      if (limit) {
        query = query.limit(parseInt(limit as string));
      }
      
      const snapshot = await query.get();
      const provisions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return res.json({
        success: true,
        provisions,
        count: provisions.length
      });
      
    } catch (error) {
      console.error('Failed to get provisions:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Create new provision
export const createProvision = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const provisionData = req.body;
      
      if (!provisionData.name || !provisionData.description || !provisionData.script) {
        return res.status(400).json({
          success: false,
          error: 'Name, description, and script are required'
        });
      }
      
      // Generate ID from name (URL-friendly)
      const provisionId = provisionData.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Check if provision already exists
      const existingDoc = await db.collection('provisions').doc(provisionId).get();
      if (existingDoc.exists) {
        return res.status(409).json({
          success: false,
          error: 'Provision with this name already exists'
        });
      }
      
      // Create provision document
      const provision = {
        name: provisionData.name,
        description: provisionData.description,
        script: provisionData.script,
        enabled: provisionData.enabled !== undefined ? provisionData.enabled : true,
        tags: provisionData.tags || [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'system' // TODO: Get from auth context
      };
      
      await db.collection('provisions').doc(provisionId).set(provision);
      
      return res.json({
        success: true,
        provision: {
          id: provisionId,
          ...provision
        }
      });
      
    } catch (error) {
      console.error('Failed to create provision:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Update provision
export const updateProvision = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { provisionId } = req.params;
      const updateData = req.body;
      
      if (!provisionId) {
        return res.status(400).json({
          success: false,
          error: 'Provision ID is required'
        });
      }
      
      // Check if provision exists
      const doc = await db.collection('provisions').doc(provisionId).get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Provision not found'
        });
      }
      
      // Prepare update data
      const updateFields = {
        ...updateData,
        updatedAt: FieldValue.serverTimestamp()
      };
      
      await db.collection('provisions').doc(provisionId).update(updateFields);
      
      // Get updated document
      const updatedDoc = await db.collection('provisions').doc(provisionId).get();
      
      return res.json({
        success: true,
        provision: {
          id: updatedDoc.id,
          ...updatedDoc.data()
        }
      });
      
    } catch (error) {
      console.error('Failed to update provision:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Delete provision
export const deleteProvision = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { provisionId } = req.params;
      
      if (!provisionId) {
        return res.status(400).json({
          success: false,
          error: 'Provision ID is required'
        });
      }
      
      // Check if provision exists
      const doc = await db.collection('provisions').doc(provisionId).get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Provision not found'
        });
      }
      
      // Delete the provision
      await db.collection('provisions').doc(provisionId).delete();
      
      return res.json({
        success: true,
        message: 'Provision deleted successfully'
      });
      
    } catch (error) {
      console.error('Failed to delete provision:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Initialize sample provisions
export const initializeSampleProvisions = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
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
      
      return res.json({
        success: true,
        message: `Sample provisions initialized: ${createdCount} created, ${skippedCount} already existed`,
        created: createdCount,
        skipped: skippedCount,
        total: sampleProvisions.length
      });
      
    } catch (error) {
      console.error('Failed to initialize sample provisions:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});
