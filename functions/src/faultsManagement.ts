// Firebase Functions for Faults Management
// Handles CRUD operations for device faults and errors

import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import cors from 'cors';

const corsHandler = cors({ origin: true });
const db = getFirestore();

// Get all faults
export const getFaults = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { severity, status, limit } = req.query;
      
      let query = db.collection('faults').orderBy('timestamp', 'desc');
      
      // Apply filters
      if (severity) {
        query = query.where('severity', '==', severity);
      }
      
      if (status) {
        query = query.where('status', '==', status);
      }
      
      if (limit) {
        query = query.limit(parseInt(limit as string));
      }
      
      const snapshot = await query.get();
      const faults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      res.json({
        success: true,
        faults,
        count: faults.length
      });
      
    } catch (error) {
      console.error('Failed to get faults:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Get fault by ID
export const getFault = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { faultId } = req.params;
      
      if (!faultId) {
        return res.status(400).json({
          success: false,
          error: 'Fault ID is required'
        });
      }
      
      const doc = await db.collection('faults').doc(faultId).get();
      
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Fault not found'
        });
      }
      
      res.json({
        success: true,
        fault: {
          id: doc.id,
          ...doc.data()
        }
      });
      
    } catch (error) {
      console.error('Failed to get fault:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Resolve fault
export const resolveFault = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { faultId } = req.params;
      const { resolution, resolvedBy } = req.body;
      
      if (!faultId) {
        return res.status(400).json({
          success: false,
          error: 'Fault ID is required'
        });
      }
      
      // Check if fault exists
      const doc = await db.collection('faults').doc(faultId).get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Fault not found'
        });
      }
      
      // Update fault status
      const updateData = {
        status: 'Resolved',
        resolution: resolution || 'Fault resolved',
        resolvedBy: resolvedBy || 'system',
        resolvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      
      await db.collection('faults').doc(faultId).update(updateData);
      
      // Get updated document
      const updatedDoc = await db.collection('faults').doc(faultId).get();
      
      res.json({
        success: true,
        fault: {
          id: updatedDoc.id,
          ...updatedDoc.data()
        }
      });
      
    } catch (error) {
      console.error('Failed to resolve fault:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Create new fault
export const createFault = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const faultData = req.body;
      
      if (!faultData.deviceId || !faultData.message || !faultData.severity) {
        return res.status(400).json({
          success: false,
          error: 'Device ID, message, and severity are required'
        });
      }
      
      // Generate fault ID
      const faultId = `FAULT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create fault document
      const fault = {
        deviceId: faultData.deviceId,
        deviceName: faultData.deviceName || 'Unknown Device',
        timestamp: FieldValue.serverTimestamp(),
        severity: faultData.severity,
        code: faultData.code || '9000',
        message: faultData.message,
        description: faultData.description || '',
        status: faultData.status || 'Open',
        parameters: faultData.parameters || {},
        resolution: '',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      
      await db.collection('faults').doc(faultId).set(fault);
      
      res.json({
        success: true,
        fault: {
          id: faultId,
          ...fault
        }
      });
      
    } catch (error) {
      console.error('Failed to create fault:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Initialize sample faults
export const initializeSampleFaults = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
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
      
      res.json({
        success: true,
        message: `Sample faults initialized: ${createdCount} created, ${skippedCount} already existed`,
        created: createdCount,
        skipped: skippedCount,
        total: sampleFaults.length
      });
      
    } catch (error) {
      console.error('Failed to initialize sample faults:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});
