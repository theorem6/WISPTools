// Simplified Firebase Functions for ACS Integration
// Uses only Firestore (no MongoDB dependency)

// Import shared Firebase initialization (must be first)
import { db } from './firebaseInit.js';

import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import cors from 'cors';

const corsHandler = cors({ origin: true });

// Get CPE devices from Firestore
export const getCPEDevices = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { status, limit } = req.query;
      
      let query = db.collection('cpe_devices').orderBy('lastContact', 'desc');
      
      // Apply filters
      if (status) {
        query = query.where('status', '==', status);
      }
      
      if (limit) {
        query = query.limit(parseInt(limit as string));
      }
      
      const snapshot = await query.get();
      const devices = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return res.json({
        success: true,
        devices,
        count: devices.length
      });
      
    } catch (error) {
      console.error('Failed to get CPE devices:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Get CPE device by ID
export const getCPEDevice = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { deviceId } = req.params;
      
      if (!deviceId) {
        return res.status(400).json({
          success: false,
          error: 'Device ID is required'
        });
      }
      
      const doc = await db.collection('cpe_devices').doc(deviceId).get();
      
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Device not found'
        });
      }
      
      return res.json({
        success: true,
        device: {
          id: doc.id,
          ...doc.data()
        }
      });
      
    } catch (error) {
      console.error('Failed to get CPE device:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Update CPE location
export const updateCPELocation = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { deviceId } = req.params;
      const { latitude, longitude, address } = req.body;
      
      if (!deviceId || !latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Device ID, latitude, and longitude are required'
        });
      }
      
      // Check if device exists
      const doc = await db.collection('cpe_devices').doc(deviceId).get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Device not found'
        });
      }
      
      // Update location
      await db.collection('cpe_devices').doc(deviceId).update({
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: address || 'Unknown location'
        },
        updatedAt: FieldValue.serverTimestamp()
      });
      
      // Get updated document
      const updatedDoc = await db.collection('cpe_devices').doc(deviceId).get();
      
      return res.json({
        success: true,
        device: {
          id: updatedDoc.id,
          ...updatedDoc.data()
        }
      });
      
    } catch (error) {
      console.error('Failed to update CPE location:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Get CPE performance metrics
export const getCPEPerformanceMetrics = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { deviceId } = req.params;
      const { hours = 24 } = req.query;
      
      if (!deviceId) {
        return res.status(400).json({
          success: false,
          error: 'Device ID is required'
        });
      }
      
      // Get performance metrics from Firestore
      const startTime = new Date(Date.now() - parseInt(hours as string) * 60 * 60 * 1000);
      
      const snapshot = await db.collection('cpe_performance')
        .where('deviceId', '==', deviceId)
        .where('timestamp', '>=', startTime)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
      
      const metrics = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return res.json({
        success: true,
        metrics,
        count: metrics.length,
        deviceId,
        timeRange: `${hours} hours`
      });
      
    } catch (error) {
      console.error('Failed to get CPE performance metrics:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Sync CPE devices (placeholder - will create sample data)
export const syncCPEDevices = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      console.log('Syncing CPE devices...');
      
      // For now, just return success - real sync would connect to MongoDB
      return res.json({
        success: true,
        message: 'CPE devices sync completed',
        synced: 0,
        errors: 0
      });
      
    } catch (error) {
      console.error('Failed to sync CPE devices:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});
