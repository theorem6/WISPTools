/**
 * Device Assignment API Routes
 * Handles assignment of deployed hardware to SNMP discovered devices
 */

const express = require('express');
const router = express.Router();
const { InventoryItem } = require('../models/inventory');
const { NetworkEquipment } = require('../models/network');
const mongoose = require('mongoose');

// Middleware to extract tenant ID
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(requireTenant);

/**
 * POST /api/device-assignment/assign
 * Assign a deployed hardware item to an SNMP discovered device
 */
router.post('/assign', async (req, res) => {
  try {
    const { hardwareId, snmpDeviceId, ipAddress } = req.body;

    if (!hardwareId) {
      return res.status(400).json({ error: 'hardwareId is required' });
    }

    if (!snmpDeviceId && !ipAddress) {
      return res.status(400).json({ error: 'Either snmpDeviceId or ipAddress is required' });
    }

    console.log(`🔗 [Device Assignment] Assigning hardware ${hardwareId} to SNMP device ${snmpDeviceId || ipAddress}`);

    // Get the hardware item
    const hardware = await InventoryItem.findOne({
      _id: hardwareId,
      tenantId: req.tenantId
    });

    if (!hardware) {
      return res.status(404).json({ error: 'Hardware item not found' });
    }

    // Find SNMP device if deviceId provided
    let snmpDevice = null;
    if (snmpDeviceId) {
      snmpDevice = await NetworkEquipment.findOne({
        _id: snmpDeviceId,
        tenantId: req.tenantId
      });
    }

    // Or find by IP address if provided
    if (!snmpDevice && ipAddress) {
      // Search through NetworkEquipment notes for IP address
      const allDevices = await NetworkEquipment.find({ tenantId: req.tenantId }).lean();
      for (const device of allDevices) {
        try {
          const notes = device.notes ? (typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes) : {};
          const deviceIP = notes.management_ip || notes.ip_address || notes.ipAddress;
          if (deviceIP === ipAddress) {
            snmpDevice = device;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    // Update hardware with IP address and SNMP device link
    const ipToUse = ipAddress || (snmpDevice ? 
      (() => {
        try {
          const notes = snmpDevice.notes ? (typeof snmpDevice.notes === 'string' ? JSON.parse(snmpDevice.notes) : snmpDevice.notes) : {};
          return notes.management_ip || notes.ip_address || notes.ipAddress || null;
        } catch (e) {
          return null;
        }
      })() : null);

    if (ipToUse) {
      hardware.ipAddress = ipToUse; // Top-level IP address for ping monitoring
      
      // Also update technicalSpecs for backward compatibility
      if (!hardware.technicalSpecs) {
        hardware.technicalSpecs = {};
      }
      hardware.technicalSpecs.ipAddress = ipToUse;
    }

    // Link to SNMP device in modules
    if (snmpDevice) {
      if (!hardware.modules) {
        hardware.modules = {};
      }
      if (!hardware.modules.snmp) {
        hardware.modules.snmp = {};
      }
      hardware.modules.snmp.deviceId = snmpDevice._id.toString();
      hardware.modules.snmp.lastSync = new Date();
      
      // Also set inventoryId on NetworkEquipment if not already set
      if (!snmpDevice.inventoryId || snmpDevice.inventoryId.toString() !== hardwareId) {
        await NetworkEquipment.updateOne(
          { _id: snmpDevice._id },
          { $set: { inventoryId: hardwareId } }
        );
      }
    }

    hardware.updatedAt = new Date();
    await hardware.save();

    console.log(`✅ [Device Assignment] Hardware ${hardwareId} assigned to SNMP device ${snmpDevice?._id || ipAddress}`);

    res.json({
      success: true,
      hardwareId,
      snmpDeviceId: snmpDevice?._id?.toString() || null,
      ipAddress: ipToUse,
      message: 'Device assignment successful'
    });
  } catch (error) {
    console.error('[Device Assignment] Error assigning device:', error);
    res.status(500).json({
      error: 'Failed to assign device',
      message: error.message
    });
  }
});

/**
 * POST /api/device-assignment/manual-ip
 * Manually assign an IP address to a deployed hardware item
 */
router.post('/manual-ip', async (req, res) => {
  try {
    const { hardwareId, ipAddress } = req.body;

    if (!hardwareId || !ipAddress) {
      return res.status(400).json({ error: 'hardwareId and ipAddress are required' });
    }

    console.log(`🔧 [Device Assignment] Manually assigning IP ${ipAddress} to hardware ${hardwareId}`);

    const hardware = await InventoryItem.findOne({
      _id: hardwareId,
      tenantId: req.tenantId
    });

    if (!hardware) {
      return res.status(404).json({ error: 'Hardware item not found' });
    }

    hardware.ipAddress = ipAddress; // Top-level IP address
    if (!hardware.technicalSpecs) {
      hardware.technicalSpecs = {};
    }
    hardware.technicalSpecs.ipAddress = ipAddress;
    hardware.updatedAt = new Date();

    await hardware.save();

    console.log(`✅ [Device Assignment] IP ${ipAddress} assigned to hardware ${hardwareId}`);

    res.json({
      success: true,
      hardwareId,
      ipAddress,
      message: 'IP address assigned successfully'
    });
  } catch (error) {
    console.error('[Device Assignment] Error assigning IP:', error);
    res.status(500).json({
      error: 'Failed to assign IP address',
      message: error.message
    });
  }
});

/**
 * GET /api/device-assignment/unassigned
 * Get list of deployed hardware without IP addresses or SNMP assignments
 */
router.get('/unassigned', async (req, res) => {
  try {
    const hardwareItems = await InventoryItem.find({
      tenantId: req.tenantId,
      status: 'deployed',
      $or: [
        { ipAddress: { $exists: false } },
        { ipAddress: null },
        { ipAddress: '' },
        { 'technicalSpecs.ipAddress': { $exists: false } },
        { 'technicalSpecs.ipAddress': null },
        { 'technicalSpecs.ipAddress': '' }
      ]
    })
    .select('_id assetTag equipmentType manufacturer model status currentLocation')
    .lean();

    res.json({
      success: true,
      hardware: hardwareItems,
      count: hardwareItems.length
    });
  } catch (error) {
    console.error('[Device Assignment] Error getting unassigned devices:', error);
    res.status(500).json({
      error: 'Failed to get unassigned devices',
      message: error.message
    });
  }
});

module.exports = router;

