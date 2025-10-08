// MongoDB-backed Faults Management for GenieACS
// Full CRUD operations with MongoDB Atlas

import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { getGenieACSCollections } from './mongoConnection.js';

const corsHandler = cors({ origin: true });

// Get all faults from MongoDB
export const getMongoFaults = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { severity, status, limit } = req.query;
      
      const { faults } = await getGenieACSCollections();
      
      // Build query filter
      const filter: any = {};
      if (severity) filter.severity = severity;
      if (status) filter.status = status;
      
      // Query faults
      let query = faults.find(filter).sort({ timestamp: -1 });
      
      if (limit) {
        query = query.limit(parseInt(limit as string));
      }
      
      const faultsList = await query.toArray();
      
      return res.json({
        success: true,
        faults: faultsList,
        count: faultsList.length
      });
    } catch (error) {
      console.error('Failed to get faults:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Get fault by ID from MongoDB
export const getMongoFault = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const faultId = req.query.id as string || req.body.id;
      
      if (!faultId) {
        return res.status(400).json({
          success: false,
          error: 'Fault ID is required'
        });
      }
      
      const { faults } = await getGenieACSCollections();
      
      const fault = await faults.findOne({ _id: faultId });
      
      if (!fault) {
        return res.status(404).json({
          success: false,
          error: 'Fault not found'
        });
      }
      
      return res.json({
        success: true,
        fault: fault
      });
    } catch (error) {
      console.error('Failed to get fault:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Acknowledge/Resolve fault in MongoDB
export const acknowledgeMongoFault = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const faultId = req.query.id as string || req.body.id;
      const { resolution, resolvedBy } = req.body;
      
      if (!faultId) {
        return res.status(400).json({
          success: false,
          error: 'Fault ID is required'
        });
      }
      
      const { faults } = await getGenieACSCollections();
      
      // Check if fault exists
      const existing = await faults.findOne({ _id: faultId });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Fault not found'
        });
      }
      
      // Update fault status
      const updateData = {
        status: 'Resolved',
        resolution: resolution || 'Fault acknowledged and resolved',
        resolvedBy: resolvedBy || 'admin',
        resolvedAt: new Date(),
        updatedAt: new Date()
      };
      
      await faults.updateOne(
        { _id: faultId },
        { $set: updateData }
      );
      
      // Get updated fault
      const updated = await faults.findOne({ _id: faultId });
      
      return res.json({
        success: true,
        fault: updated,
        message: 'Fault acknowledged and resolved'
      });
    } catch (error) {
      console.error('Failed to acknowledge fault:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Delete fault from MongoDB
export const deleteMongoFault = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const faultId = req.query.id as string || req.body.id;
      
      if (!faultId) {
        return res.status(400).json({
          success: false,
          error: 'Fault ID is required'
        });
      }
      
      const { faults } = await getGenieACSCollections();
      
      // Check if fault exists
      const existing = await faults.findOne({ _id: faultId });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Fault not found'
        });
      }
      
      // Delete fault
      await faults.deleteOne({ _id: faultId });
      
      return res.json({
        success: true,
        message: `Fault "${existing.message}" deleted successfully`,
        deletedFault: existing
      });
    } catch (error) {
      console.error('Failed to delete fault:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Create new fault in MongoDB
export const createMongoFault = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const faultData = req.body;
      
      if (!faultData.deviceId || !faultData.message) {
        return res.status(400).json({
          success: false,
          error: 'Device ID and message are required'
        });
      }
      
      const { faults } = await getGenieACSCollections();
      
      // Generate fault ID
      const faultId = `FAULT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const fault = {
        _id: faultId,
        deviceId: faultData.deviceId,
        deviceName: faultData.deviceName || 'Unknown Device',
        timestamp: new Date(),
        severity: faultData.severity || 'Info',
        code: faultData.code || '9000',
        message: faultData.message,
        description: faultData.description || '',
        status: faultData.status || 'Open',
        parameters: faultData.parameters || {},
        resolution: '',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await faults.insertOne(fault);
      
      return res.json({
        success: true,
        fault: fault,
        message: 'Fault created successfully'
      });
    } catch (error) {
      console.error('Failed to create fault:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Bulk delete resolved faults (cleanup)
export const deleteResolvedMongoFaults = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { faults } = await getGenieACSCollections();
      
      // Delete all resolved faults
      const result = await faults.deleteMany({ status: 'Resolved' });
      
      return res.json({
        success: true,
        message: `${result.deletedCount} resolved faults deleted`,
        deletedCount: result.deletedCount
      });
    } catch (error) {
      console.error('Failed to delete resolved faults:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

