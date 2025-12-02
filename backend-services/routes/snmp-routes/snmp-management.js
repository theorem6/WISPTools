const express = require('express');
const router = express.Router();
const path = require('path');
const { UnifiedSite, UnifiedCPE, NetworkEquipment } = require('../../models/network');
// Use absolute path to avoid resolution issues - resolve from backend-services root
const inventoryPath = path.join(__dirname, '../../models/inventory');
const { InventoryItem } = require(inventoryPath);
const { SNMPMetrics } = require('../../models/snmp-metrics-schema');
const { formatSNMPDevice, isFakeDevice } = require('./snmp-helpers');

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

// PUT /api/snmp/devices/:id/graphs - Toggle graph generation for a device
router.put('/devices/:id/graphs', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const { enabled } = req.body;
    
    if (!req.tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header is required' });
    }
    
    // Find device
    const device = await NetworkEquipment.findOne({ 
      _id: deviceId,
      tenantId: req.tenantId
    });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Parse notes
    let notes = {};
    if (typeof device.notes === 'string') {
      try {
        notes = JSON.parse(device.notes);
      } catch (e) {
        notes = {};
      }
    } else if (typeof device.notes === 'object') {
      notes = device.notes;
    }
    
    // Update enable_graphs flag
    notes.enable_graphs = enabled !== false;
    
    // Update device
    await NetworkEquipment.updateOne(
      { _id: deviceId },
      { 
        $set: { 
          notes: JSON.stringify(notes),
          updatedAt: new Date()
        }
      }
    );
    
    res.json({ 
      success: true, 
      device_id: deviceId,
      enable_graphs: notes.enable_graphs
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error toggling graphs:', error);
    res.status(500).json({ 
      error: 'Failed to toggle graphs', 
      message: error.message 
    });
  }
});

// POST /api/snmp/discovered/:deviceId/pair - Pair discovered device with existing hardware
router.post('/discovered/:deviceId/pair', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hardwareId } = req.body;
    
    if (!hardwareId) {
      return res.status(400).json({ error: 'hardwareId is required' });
    }
    
    console.log(`🔗 [SNMP API] Pairing discovered device ${deviceId} with hardware ${hardwareId}`);
    
    // Get the discovered device
    const device = await NetworkEquipment.findOne({
      _id: deviceId,
      tenantId: req.tenantId
    });
    
    if (!device) {
      return res.status(404).json({ error: 'Discovered device not found' });
    }
    
    // Get the inventory item to pair with
    // InventoryItem already imported at top level
    const hardware = await InventoryItem.findOne({
      _id: hardwareId,
      tenantId: req.tenantId
    });
    
    if (!hardware) {
      return res.status(404).json({ error: 'Hardware item not found' });
    }
    
    // Parse device notes
    let notes = {};
    if (device.notes) {
      try {
        notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
      } catch (e) {
        notes = {};
      }
    }
    
    // Update NetworkEquipment to link to inventory
    device.inventoryId = hardwareId.toString();
    if (typeof device.notes === 'string') {
      notes.inventory_id = hardwareId.toString();
      notes.paired_at = new Date().toISOString();
      device.notes = JSON.stringify(notes);
    } else {
      device.notes = { ...notes, inventory_id: hardwareId.toString(), paired_at: new Date().toISOString() };
    }
    await device.save();
    
    // Update InventoryItem to link to NetworkEquipment
    hardware.serialNumber = notes.management_ip || device.serialNumber || hardware.serialNumber;
    if (!hardware.networkConfig) hardware.networkConfig = {};
    hardware.networkConfig.management_ip = notes.management_ip || device.serialNumber || null;
    hardware.networkConfig.snmp_enabled = true;
    hardware.networkConfig.snmp_community = notes.snmp_community || 'public';
    hardware.networkConfig.snmp_version = notes.snmp_version || '2c';
    
    // Update modules to link to SNMP device
    if (!hardware.modules) hardware.modules = {};
    if (!hardware.modules.snmp) hardware.modules.snmp = {};
    hardware.modules.snmp.deviceId = deviceId.toString();
    hardware.modules.snmp.lastSync = new Date();
    
    await hardware.save();
    
    console.log(`✅ [SNMP API] Paired device ${deviceId} with hardware ${hardwareId}`);
    
    res.json({
      success: true,
      deviceId,
      hardwareId,
      message: 'Device paired successfully with hardware'
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error pairing device:', error);
    res.status(500).json({
      error: 'Failed to pair device',
      message: error.message
    });
  }
});

// POST /api/snmp/discovered/:deviceId/create-hardware - Create new hardware from discovered device
router.post('/discovered/:deviceId/create-hardware', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { assetTag, category, siteId, siteName, location } = req.body;
    
    console.log(`➕ [SNMP API] Creating hardware from discovered device ${deviceId}`);
    
    // Get the discovered device
    const device = await NetworkEquipment.findOne({
      _id: deviceId,
      tenantId: req.tenantId
    });
    
    if (!device) {
      return res.status(404).json({ error: 'Discovered device not found' });
    }
    
    // Parse device notes
    let notes = {};
    if (device.notes) {
      try {
        notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
      } catch (e) {
        notes = {};
      }
    }
    
    // Check if device already has inventory item (already deployed)
    // InventoryItem already imported at top level
    let inventoryItem = null;
    if (device.inventoryId) {
      inventoryItem = await InventoryItem.findOne({ 
        _id: device.inventoryId, 
        tenantId: req.tenantId 
      });
      if (inventoryItem) {
        console.log(`ℹ️ [SNMP API] Device ${deviceId} already has inventory item ${inventoryItem._id}, will update it`);
      }
    }
    
    // Helper to check if site is fake
    function isFakeSite(site) {
      if (!site || !site.name) return false;
      const name = String(site.name).toLowerCase();
      const fakePatterns = [
        /customer.*cpe/i,
        /customer.*lte/i,
        /customer a/i,
        /customer b/i,
        /fake/i,
        /demo/i,
        /sample/i,
        /^test$/i,
        /mock/i,
        /core router/i,
        /core switch/i,
        /epc core server/i,
        /backhaul router/i
      ];
      return fakePatterns.some(pattern => pattern.test(name));
    }
    
    // Find site by siteId or siteName
    let site = null;
    // UnifiedSite already imported at top level
    const mongoose = require('mongoose');
    
    console.log(`🔍 [SNMP API] Looking up site - siteId: ${siteId}, siteName: ${siteName}, tenantId: ${req.tenantId}`);
    
    if (siteId) {
      // Convert siteId to ObjectId if it's a string
      let siteQueryId = siteId;
      if (typeof siteId === 'string' && mongoose.Types.ObjectId.isValid(siteId)) {
        siteQueryId = new mongoose.Types.ObjectId(siteId);
      }
      
      site = await UnifiedSite.findOne({ _id: siteQueryId, tenantId: req.tenantId }).lean();
      if (site) {
        if (isFakeSite(site)) {
          console.warn(`⚠️ [SNMP API] Site found by ID is FAKE: ${site._id?.toString()}, name: ${site.name} - rejecting`);
          site = null; // Reject fake sites
        } else {
          console.log(`✅ [SNMP API] Found REAL site by ID: ${site._id?.toString()}, name: ${site.name}`);
        }
      } else {
        // Try string match as fallback
        const allSites = await UnifiedSite.find({ tenantId: req.tenantId }).lean();
        console.warn(`⚠️ [SNMP API] Site not found by ID: ${siteId}, tenantId: ${req.tenantId}`);
        console.warn(`⚠️ [SNMP API] Available sites in tenant: ${allSites.map(s => `${s._id?.toString()} (${s.name})`).join(', ')}`);
      }
    } else if (siteName) {
      site = await UnifiedSite.findOne({ name: siteName, tenantId: req.tenantId }).lean();
      if (site) {
        if (isFakeSite(site)) {
          console.warn(`⚠️ [SNMP API] Site found by name is FAKE: ${site._id?.toString()}, name: ${site.name} - rejecting`);
          site = null; // Reject fake sites
        } else {
          console.log(`✅ [SNMP API] Found REAL site by name: ${site._id?.toString()}, name: ${site.name}`);
        }
      } else {
        console.warn(`⚠️ [SNMP API] Site not found by name: ${siteName}, tenantId: ${req.tenantId}`);
      }
    } else {
      console.warn(`⚠️ [SNMP API] No siteId or siteName provided in request body`);
    }
    
    // If no existing inventory item, check if assetTag already exists to avoid duplicates
    if (!inventoryItem) {
      const proposedAssetTag = assetTag || `SNMP-${notes.management_ip || device.serialNumber || deviceId.substring(0, 8)}`;
      const existingByTag = await InventoryItem.findOne({ 
        assetTag: proposedAssetTag, 
        tenantId: req.tenantId 
      });
      
      if (existingByTag) {
        // Asset tag exists - use the existing item
        console.log(`ℹ️ [SNMP API] Asset tag ${proposedAssetTag} already exists, using existing inventory item ${existingByTag._id}`);
        inventoryItem = existingByTag;
      }
    }
    
    // Create or update inventory item
    if (!inventoryItem) {
      // Generate unique assetTag if needed
      const baseAssetTag = assetTag || `SNMP-${notes.management_ip || device.serialNumber || deviceId.substring(0, 8)}`;
      let uniqueAssetTag = baseAssetTag;
      let suffix = 1;
      
      // Check if base tag exists, append suffix if needed
      while (await InventoryItem.findOne({ assetTag: uniqueAssetTag, tenantId: req.tenantId })) {
        uniqueAssetTag = `${baseAssetTag}-${suffix}`;
        suffix++;
      }
      
      inventoryItem = new InventoryItem({
      tenantId: req.tenantId,
      assetTag: uniqueAssetTag,
      category: category === 'Network Equipment' ? 'Networking Equipment' : (category || 'Networking Equipment'),
      subcategory: device.type === 'router' ? 'Router' :
                   device.type === 'switch' ? 'Switch' :
                   device.type === 'ap' ? 'Access Point' : 'Network Device',
      equipmentType: device.manufacturer ? `${device.manufacturer} ${device.model || ''}`.trim() : 
                     notes.device_type || 'SNMP Device',
      manufacturer: device.manufacturer || 'Generic',
      model: device.model || notes.sysDescr || 'Unknown',
      serialNumber: notes.management_ip || device.serialNumber || deviceId,
      physicalDescription: `${device.name || 'Discovered SNMP Device'} - ${notes.management_ip || 'Unknown IP'}`,
      status: 'deployed',
      condition: 'good',
      currentLocation: {
        type: 'tower',
        siteId: site?._id?.toString() || null, // InventoryItem uses string for siteId in location
        siteName: site?.name || siteName || 'Unknown Site',
        address: location?.address || device.location?.address || site?.location?.address || 'Unknown Location'
      },
      ownership: 'owned',
      networkConfig: {
        management_ip: notes.management_ip || device.serialNumber || null,
        snmp_enabled: true,
        snmp_community: notes.snmp_community || 'public',
        snmp_version: notes.snmp_version || '2c'
      },
      notes: `Created from discovered SNMP device. Discovered by EPC: ${notes.discovered_by_epc || 'Unknown'}. IP: ${notes.management_ip || 'Unknown'}`,
      modules: {
        snmp: {
          deviceId: deviceId.toString(),
          lastSync: new Date()
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
      
      await inventoryItem.save();
      console.log(`✅ [SNMP API] Created new inventory item ${inventoryItem._id} with assetTag: ${uniqueAssetTag}`);
    } else {
      // Update existing inventory item
      inventoryItem.assetTag = assetTag || inventoryItem.assetTag;
      inventoryItem.category = category === 'Network Equipment' ? 'Networking Equipment' : (category || inventoryItem.category || 'Networking Equipment');
      inventoryItem.subcategory = device.type === 'router' ? 'Router' :
                                  device.type === 'switch' ? 'Switch' :
                                  device.type === 'ap' ? 'Access Point' : (inventoryItem.subcategory || 'Network Device');
      inventoryItem.equipmentType = device.manufacturer ? `${device.manufacturer} ${device.model || ''}`.trim() : 
                                    (notes.device_type || inventoryItem.equipmentType || 'SNMP Device');
      inventoryItem.manufacturer = device.manufacturer || inventoryItem.manufacturer || 'Generic';
      inventoryItem.model = device.model || notes.sysDescr || inventoryItem.model || 'Unknown';
      inventoryItem.status = 'deployed'; // Update status to deployed
      inventoryItem.currentLocation = {
        type: 'tower',
        siteId: site?._id?.toString() || inventoryItem.currentLocation?.siteId || null,
        siteName: site?.name || siteName || inventoryItem.currentLocation?.siteName || 'Unknown Site',
        address: location?.address || device.location?.address || site?.location?.address || inventoryItem.currentLocation?.address || 'Unknown Location'
      };
      inventoryItem.updatedAt = new Date();
      
      await inventoryItem.save();
      console.log(`✅ [SNMP API] Updated existing inventory item ${inventoryItem._id}`);
    }
    
    // Mark device as deployed: Set siteId and enable graphs using findOneAndUpdate
    const savedSiteId = site?._id || null;
    
    if (!savedSiteId) {
      console.warn(`⚠️ [SNMP API] No site found for siteId: ${siteId}, siteName: ${siteName}. Device will not be marked as deployed.`);
    } else {
      console.log(`✅ [SNMP API] Will set device siteId to: ${savedSiteId.toString()}`);
    }
    
    // Prepare notes update
    notes.inventory_id = inventoryItem._id.toString();
    notes.created_from_discovery = true;
    notes.enable_graphs = true; // Enable graphs when hardware is created
    
    // Build update object - use findOneAndUpdate for atomic update
    const updateData = {
      inventoryId: inventoryItem._id.toString(),
      updatedAt: new Date()
    };
    
    // Add siteId if we have it
    if (savedSiteId) {
      updateData.siteId = savedSiteId; // MongoDB will handle ObjectId conversion
    }
    
    // Update notes (handle both string and object formats)
    if (typeof device.notes === 'string') {
      updateData.notes = JSON.stringify(notes);
    } else {
      updateData.notes = notes;
    }
    
    // Use findOneAndUpdate for atomic update
    const updatedDevice = await NetworkEquipment.findOneAndUpdate(
      { _id: deviceId, tenantId: req.tenantId },
      { $set: updateData },
      { new: true, lean: true } // Return updated document
    );
    
    if (!updatedDevice) {
      console.error(`❌ [SNMP API] ERROR: Could not update device ${deviceId}`);
    } else {
      let parsedNotes = {};
      try {
        parsedNotes = typeof updatedDevice.notes === 'string' ? JSON.parse(updatedDevice.notes) : (updatedDevice.notes || {});
      } catch (e) {
        parsedNotes = {};
      }
      
      console.log(`✅ [SNMP API] Created hardware ${inventoryItem._id} from device ${deviceId}`);
      console.log(`✅ [SNMP API] Device updated with findOneAndUpdate:`, {
        _id: updatedDevice._id?.toString(),
        siteId: updatedDevice.siteId ? updatedDevice.siteId.toString() : 'null',
        inventoryId: updatedDevice.inventoryId,
        enable_graphs: parsedNotes.enable_graphs,
        siteId_type: typeof updatedDevice.siteId
      });
      
      if (!updatedDevice.siteId && savedSiteId) {
        console.error(`❌ [SNMP API] ERROR: Device siteId was NOT saved even though we tried to set it! Site was:`, site ? { id: site._id?.toString(), name: site.name } : 'null');
      }
    }
    
    // Final verification query - use multiple checks
    const finalCheck1 = await NetworkEquipment.findById(deviceId).lean();
    const finalCheck2 = await NetworkEquipment.findOne({ _id: deviceId, tenantId: req.tenantId }).lean();
    
    const finalSiteId = finalCheck1?.siteId ? finalCheck1.siteId.toString() : 
                       (finalCheck2?.siteId ? finalCheck2.siteId.toString() : null);
    
    console.log(`🔍 [SNMP API] Final verification - Device ${deviceId}:`, {
      check1_siteId: finalCheck1?.siteId ? finalCheck1.siteId.toString() : 'null',
      check2_siteId: finalCheck2?.siteId ? finalCheck2.siteId.toString() : 'null',
      finalSiteId: finalSiteId,
      attempted_siteId: savedSiteId ? savedSiteId.toString() : 'null',
      updatedDevice_siteId: updatedDevice?.siteId ? updatedDevice.siteId.toString() : 'null'
    });
    
    if (!finalSiteId && savedSiteId) {
      console.error(`❌ [SNMP API] CRITICAL: siteId was not persisted!`, {
        attempted: savedSiteId.toString(),
        check1_result: finalCheck1?.siteId || 'null',
        check2_result: finalCheck2?.siteId || 'null',
        update_result: updatedDevice?.siteId || 'null',
        site_name: site?.name || 'null'
      });
    }
    
    res.json({
      success: true,
      deviceId,
      hardwareId: inventoryItem._id.toString(),
      hardware: inventoryItem,
      deviceSiteId: finalSiteId, // Include siteId in response
      attemptedSiteId: savedSiteId ? savedSiteId.toString() : null, // Debug: what we tried to save
      updateResultSiteId: updatedDevice?.siteId ? updatedDevice.siteId.toString() : null, // Debug: what update returned
      message: finalSiteId ? 
        'Hardware created successfully and device marked as deployed' : 
        (savedSiteId ? 
          `Hardware created successfully but device siteId was not persisted (attempted: ${savedSiteId.toString()})` :
          'Hardware created successfully but no site was provided')
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error creating hardware:', error);
    res.status(500).json({
      error: 'Failed to create hardware',
      message: error.message
    });
  }
});

module.exports = router;

