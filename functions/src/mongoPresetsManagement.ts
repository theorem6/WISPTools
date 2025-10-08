// MongoDB-backed Presets Management for GenieACS
// Full CRUD operations with MongoDB Atlas

import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { getGenieACSCollections } from './mongoConnection.js';

const corsHandler = cors({ origin: true });

// Get all presets from MongoDB
export const getMongoPresets = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { presets } = await getGenieACSCollections();
      
      const presetsList = await presets
        .find({})
        .sort({ weight: 1 })
        .toArray();
      
      return res.json({
        success: true,
        presets: presetsList,
        count: presetsList.length
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

// Create new preset in MongoDB
export const createMongoPreset = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const presetData = req.body;
      
      if (!presetData.name) {
        return res.status(400).json({
          success: false,
          error: 'Preset name is required'
        });
      }
      
      const { presets } = await getGenieACSCollections();
      
      // Generate preset ID from name
      const presetId = presetData.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Check if preset already exists
      const existing = await presets.findOne({ _id: presetId });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Preset with this name already exists'
        });
      }
      
      const preset = {
        _id: presetId,
        name: presetData.name,
        description: presetData.description || '',
        weight: presetData.weight || 0,
        configurations: presetData.configurations || [],
        preCondition: presetData.preCondition || '',
        events: presetData.events || ['0 BOOTSTRAP', '1 BOOT'],
        tags: presetData.tags || [],
        enabled: presetData.enabled !== undefined ? presetData.enabled : true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await presets.insertOne(preset);
      
      return res.json({
        success: true,
        preset: preset,
        message: 'Preset created successfully'
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

// Update existing preset in MongoDB
export const updateMongoPreset = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const presetId = req.query.id as string || req.body.id;
      const updates = req.body;
      
      if (!presetId) {
        return res.status(400).json({
          success: false,
          error: 'Preset ID is required'
        });
      }
      
      const { presets } = await getGenieACSCollections();
      
      // Check if preset exists
      const existing = await presets.findOne({ _id: presetId });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }
      
      // Build update object (exclude _id from updates)
      const { id, _id, createdAt, ...updateData } = updates;
      updateData.updatedAt = new Date();
      
      // Update preset
      await presets.updateOne(
        { _id: presetId },
        { $set: updateData }
      );
      
      // Get updated preset
      const updated = await presets.findOne({ _id: presetId });
      
      return res.json({
        success: true,
        preset: updated,
        message: 'Preset updated successfully'
      });
    } catch (error) {
      console.error('Failed to update preset:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Delete preset from MongoDB
export const deleteMongoPreset = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const presetId = req.query.id as string || req.body.id;
      
      if (!presetId) {
        return res.status(400).json({
          success: false,
          error: 'Preset ID is required'
        });
      }
      
      const { presets } = await getGenieACSCollections();
      
      // Check if preset exists
      const existing = await presets.findOne({ _id: presetId });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }
      
      // Delete preset
      await presets.deleteOne({ _id: presetId });
      
      return res.json({
        success: true,
        message: `Preset "${existing.name}" deleted successfully`,
        deletedPreset: existing
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

// Toggle preset enabled status
export const toggleMongoPreset = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const presetId = req.query.id as string || req.body.id;
      
      if (!presetId) {
        return res.status(400).json({
          success: false,
          error: 'Preset ID is required'
        });
      }
      
      const { presets } = await getGenieACSCollections();
      
      // Get current preset
      const existing = await presets.findOne({ _id: presetId });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }
      
      // Toggle enabled status
      const newStatus = !existing.enabled;
      await presets.updateOne(
        { _id: presetId },
        { $set: { enabled: newStatus, updatedAt: new Date() } }
      );
      
      return res.json({
        success: true,
        message: `Preset "${existing.name}" ${newStatus ? 'enabled' : 'disabled'}`,
        enabled: newStatus
      });
    } catch (error) {
      console.error('Failed to toggle preset:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

