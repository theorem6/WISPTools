// Unified Network Equipment API
// Central repository for all sites, sectors, and CPE
// Other modules extend this data with their specific needs

const express = require('express');
const router = express.Router();
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment, HardwareDeployment } = require('../models/network');
const appConfig = require('../config/app');

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

// Helper utilities for plan-layer filtering
function extractPlanIdList(query) {
  const ids = [];
  if (query.planId) {
    ids.push(String(query.planId));
  }
  if (query.planIds) {
    const splitIds = String(query.planIds)
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);
    ids.push(...splitIds);
  }
  // Ensure uniqueness
  return [...new Set(ids)];
}

function applyPlanVisibilityFilter(baseQuery, req, options = {}) {
  const includePlanLayer = req.query.includePlanLayer === 'true';
  const planIdList = options.planIds || extractPlanIdList(req.query);

  if (!includePlanLayer) {
    // Exclude plan-layer objects by default
    baseQuery.$or = [
      { planId: { $exists: false } },
      { planId: null },
      { planId: '' }
    ];
  } else if (planIdList.length > 0) {
    // Include requested plan-layer objects along with production assets
    baseQuery.$or = [
      { planId: { $in: planIdList } },
      { planId: { $exists: false } },
      { planId: null },
      { planId: '' }
    ];
  }

  return baseQuery;
}

// ========== UNIFIED SITES ==========

router.get('/sites', async (req, res) => {
  try {
    console.log(`🔍 Fetching sites for tenant: ${req.tenantId}`);
    
    const query = applyPlanVisibilityFilter({ tenantId: req.tenantId }, req);
    const sites = await UnifiedSite.find(query).sort({ name: 1 }).lean();
    
    console.log(`📊 Found ${sites.length} sites for tenant ${req.tenantId}`);
    
    res.json(sites);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites', message: error.message });
  }
});

router.get('/sites/:id', async (req, res) => {
  try {
    const site = await UnifiedSite.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
    if (!site) return res.status(404).json({ error: 'Site not found' });
    
    // Normalize type field for backward compatibility: convert single string to array
    if (site.type && !Array.isArray(site.type)) {
      site.type = [site.type];
    }
    
    res.json(site);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

router.post('/sites', async (req, res) => {
  try {
    // Ensure createdBy is set
    const createdBy = req.body.createdBy || req.body.email || req.user?.email || 'System';
    
    // Normalize type field: convert single string to array for backward compatibility
    let normalizedType = req.body.type;
    if (normalizedType && !Array.isArray(normalizedType)) {
      normalizedType = [normalizedType];
    } else if (!normalizedType || normalizedType.length === 0) {
      normalizedType = ['tower']; // Default
    }
    
    const site = new UnifiedSite({ 
      ...req.body,
      type: normalizedType,
      tenantId: req.tenantId,
      createdBy: createdBy
    });
    await site.save();
    res.status(201).json(site);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create site', details: error.message });
  }
});

router.put('/sites/:id', async (req, res) => {
  try {
    // Find site first to check authorization
    const existingSite = await UnifiedSite.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!existingSite) return res.status(404).json({ error: 'Site not found' });
    
    // Authorization check: Only allow updates if user created the site or is admin
    const userEmail = (req.user?.email || req.body.email || req.headers['x-user-email'] || '').trim();
    const normalizedCreator = (existingSite.createdBy || '').trim();
    const isOwner = normalizedCreator && userEmail && normalizedCreator.toLowerCase() === userEmail.toLowerCase();
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'owner';
    
    // Allow editing sites created by system/auto/automated/unknown (adoptable)
    const adoptableOwner = !normalizedCreator || ['system', 'auto', 'automated', 'unknown'].includes(normalizedCreator.toLowerCase());
    
    if (!isOwner && !isAdmin && !adoptableOwner) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You can only edit sites you created' 
      });
    }
    
    // Normalize type field: convert single string to array for backward compatibility
    let updateData = { ...req.body };
    if (updateData.type !== undefined) {
      if (!Array.isArray(updateData.type)) {
        updateData.type = [updateData.type];
      } else if (updateData.type.length === 0) {
        updateData.type = ['tower']; // Ensure at least one type
      }
    }
    
    const site = await UnifiedSite.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...updateData, updatedAt: new Date(), updatedBy: userEmail || 'System' },
      { new: true, runValidators: true }
    );
    res.json(site);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update site' });
  }
});

router.delete('/sites/:id', async (req, res) => {
  try {
    const siteId = req.params.id;
    
    // Find the site first
    const site = await UnifiedSite.findOne({ _id: siteId, tenantId: req.tenantId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Clean up related records:
    // 1. Delete sectors at this site
    await UnifiedSector.deleteMany({ 
      $or: [
        { siteId: siteId },
        { towerId: siteId }
      ],
      tenantId: req.tenantId 
    });
    
    // 2. Remove siteId from hardware deployments (undeploy hardware)
    const { HardwareDeployment } = require('../models/network');
    await HardwareDeployment.updateMany(
      { siteId: siteId, tenantId: req.tenantId },
      { $unset: { siteId: '' }, status: 'planned' } // Set status back to planned
    );
    
    // 3. Remove siteId from network equipment
    const { NetworkEquipment } = require('../models/network');
    await NetworkEquipment.updateMany(
      { siteId: siteId, tenantId: req.tenantId },
      { $unset: { siteId: '' } }
    );
    
    // 4. Remove siteId from inventory items' currentLocation
    const { InventoryItem } = require('../models/inventory');
    await InventoryItem.updateMany(
      { 
        'currentLocation.siteId': siteId, 
        tenantId: req.tenantId 
      },
      { 
        $unset: { 'currentLocation.siteId': '', 'currentLocation.siteName': '' },
        $set: { status: 'available' } // Mark inventory as available again
      }
    );
    
    // 5. Remove siteId from CPE devices
    const { UnifiedCPE } = require('../models/network');
    await UnifiedCPE.updateMany(
      { siteId: siteId, tenantId: req.tenantId },
      { $unset: { siteId: '' } }
    );
    
    // 6. Remove site_id from RemoteEPC devices
    const { RemoteEPC } = require('../models/distributed-epc-schema');
    await RemoteEPC.updateMany(
      { site_id: siteId, tenant_id: req.tenantId },
      { $unset: { site_id: '', site_name: '' } }
    );
    
    // Finally, delete the site itself
    await UnifiedSite.findOneAndDelete({ _id: siteId, tenantId: req.tenantId });
    
    console.log(`✅ [Network API] Deleted site ${siteId} and cleaned up related records`);
    res.json({ success: true, message: 'Site deleted and related records cleaned up' });
  } catch (error) {
    console.error('[Network API] Error deleting site:', error);
    res.status(500).json({ error: 'Failed to delete site', message: error.message });
  }
});

// ========== UNIFIED SECTORS ==========

router.get('/sectors', async (req, res) => {
  try {
    const { band, technology, siteId } = req.query;
    const includePlanLayer = req.query.includePlanLayer === 'true';
    const planIdList = extractPlanIdList(req.query);
    
    const query = applyPlanVisibilityFilter({ tenantId: req.tenantId }, req);
    
    if (band) query.band = band;
    if (technology) query.technology = technology;
    if (siteId) query.siteId = siteId;
    
    // Populate siteId if it exists and is a valid ObjectId, otherwise handle gracefully
    let sectors = [];
    try {
      const productionSectors = await UnifiedSector.find(query)
        .populate({
          path: 'siteId',
          select: 'name type location',
          match: { tenantId: req.tenantId } // Only populate if site belongs to same tenant
        })
        .sort({ name: 1 })
        .lean();
      
      // Filter out sectors where populate returned null (site not found or doesn't belong to tenant)
      sectors = productionSectors.filter(sector => sector.siteId !== null && sector.siteId !== undefined);
    } catch (populateError) {
      console.warn('[Network API] Populate failed, fetching without populate:', populateError.message);
      // Fallback: fetch without populate if populate fails
      sectors = await UnifiedSector.find(query)
        .sort({ name: 1 })
        .lean();
    }
    
    // If includePlanLayer is true, also fetch plan layer sectors
    if (includePlanLayer && planIdList.length > 0) {
      const { PlanLayerFeature } = require('../models/plan-layer-feature');
      const planSectorFeatures = await PlanLayerFeature.find({
        tenantId: req.tenantId,
        planId: { $in: planIdList },
        featureType: 'sector'
      }).lean();
      
      // Get all unique siteIds from plan sectors to populate location fallback
      const planSectorSiteIds = [...new Set(planSectorFeatures
        .map(f => f.properties?.siteId)
        .filter(Boolean))];
      
      const siteMap = new Map();
      if (planSectorSiteIds.length > 0) {
        // First, try to find production sites
        const productionSites = await UnifiedSite.find({
          _id: { $in: planSectorSiteIds },
          tenantId: req.tenantId
        }).select('_id name location').lean();
        productionSites.forEach(site => {
          siteMap.set(String(site._id), site);
        });
        
        // Also check for plan layer sites (staged sites) - these are referenced by their _id
        const planLayerSiteIds = planSectorSiteIds.filter(id => !siteMap.has(String(id)));
        if (planLayerSiteIds.length > 0) {
          // Try to match plan layer sites by _id
          const mongoose = require('mongoose');
          const validObjectIds = planLayerSiteIds.filter(id => mongoose.Types.ObjectId.isValid(String(id)));
          
          if (validObjectIds.length > 0) {
            const planLayerSites = await PlanLayerFeature.find({
              tenantId: req.tenantId,
              planId: { $in: planIdList },
              featureType: 'site',
              _id: { $in: validObjectIds }
            }).lean();
            
            for (const siteFeature of planLayerSites) {
              const siteId = String(siteFeature._id);
              const props = siteFeature.properties || {};
              
              // Extract location from geometry or properties
              let latitude = null;
              let longitude = null;
              if (siteFeature.geometry && siteFeature.geometry.type === 'Point' && Array.isArray(siteFeature.geometry.coordinates)) {
                longitude = siteFeature.geometry.coordinates[0];
                latitude = siteFeature.geometry.coordinates[1];
              } else if (props.latitude !== undefined && props.longitude !== undefined) {
                latitude = props.latitude;
                longitude = props.longitude;
              } else if (props.location) {
                latitude = props.location.latitude;
                longitude = props.location.longitude;
              }
              
              if (latitude !== null && longitude !== null) {
                siteMap.set(siteId, {
                  _id: siteFeature._id,
                  name: props.name || props.siteName || 'Plan Site',
                  location: {
                    latitude,
                    longitude,
                    address: props.address || props.location?.address || ''
                  }
                });
              }
            }
          }
        }
      }
      
      // Convert plan layer features to sector format
      for (const feature of planSectorFeatures) {
        const props = feature.properties || {};
        
        // Extract coordinates from geometry
        let latitude = null;
        let longitude = null;
        if (feature.geometry && feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
          longitude = feature.geometry.coordinates[0];
          latitude = feature.geometry.coordinates[1];
        } else if (props.latitude !== undefined && props.longitude !== undefined) {
          latitude = props.latitude;
          longitude = props.longitude;
        } else if (props.location) {
          latitude = props.location.latitude;
          longitude = props.location.longitude;
        }
        
        // Fallback: get location from associated site if coordinates are missing
        if ((latitude === null || longitude === null) && props.siteId) {
          const siteIdStr = String(props.siteId);
          const site = siteMap.get(siteIdStr);
          if (site && site.location && site.location.latitude && site.location.longitude) {
            latitude = site.location.latitude;
            longitude = site.location.longitude;
          }
        }
        
        // Build sector object in UnifiedSector format
        const planSector = {
          _id: feature._id,
          id: feature._id.toString(),
          name: props.name || 'Staged Sector',
          status: props.status || feature.status || 'planned',
          technology: props.technology || 'LTE',
          band: props.band,
          frequency: props.frequency,
          azimuth: props.azimuth || 0,
          beamwidth: props.beamwidth,
          power: props.power,
          location: latitude !== null && longitude !== null ? {
            latitude,
            longitude,
            address: props.address || props.location?.address || ''
          } : null,
          siteId: props.siteId ? (typeof props.siteId === 'object' ? String(props.siteId) : String(props.siteId)) : null,
          tenantId: feature.tenantId,
          planId: feature.planId,
          inventoryId: props.inventoryId,
          createdBy: feature.createdBy,
          createdAt: feature.createdAt,
          updatedBy: feature.updatedBy,
          updatedAt: feature.updatedAt
        };
        
        // Apply filters if specified
        if (band && planSector.band !== band) continue;
        if (technology && planSector.technology !== technology) continue;
        if (siteId && planSector.siteId !== siteId && String(planSector.siteId) !== String(siteId)) continue;
        
        // Only add if it has valid location data
        if (planSector.location && planSector.location.latitude && planSector.location.longitude) {
          sectors.push(planSector);
        }
      }
    }
    
    res.json(sectors);
  } catch (error) {
    console.error('[Network API] Error fetching sectors:', error);
    console.error('[Network API] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch sectors', message: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
});

router.get('/sectors/:id', async (req, res) => {
  try {
    const sector = await UnifiedSector.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('siteId', 'name type location')
      .lean();
    if (!sector) return res.status(404).json({ error: 'Sector not found' });
    res.json(sector);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sector' });
  }
});

router.post('/sectors', async (req, res) => {
  try {
    console.log('[Network API] Creating sector:', {
      tenantId: req.tenantId,
      body: JSON.stringify(req.body, null, 2)
    });
    
    // Ensure createdBy is set
    const createdBy = req.body.createdBy || req.body.email || req.user?.email || 'System';
    
    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({ error: 'Sector name is required' });
    }
    if (!req.body.technology) {
      return res.status(400).json({ error: 'Technology is required' });
    }
    if (req.body.azimuth === undefined || req.body.azimuth === null) {
      return res.status(400).json({ error: 'Azimuth is required' });
    }
    if (!req.body.siteId) {
      return res.status(400).json({ error: 'Site ID is required' });
    }
    
    // Validate siteId is a valid ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.body.siteId)) {
      return res.status(400).json({ error: 'Invalid site ID format' });
    }
    
    // Verify site exists and belongs to tenant
    const site = await UnifiedSite.findOne({ _id: req.body.siteId, tenantId: req.tenantId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found or does not belong to tenant' });
    }
    
    // Ensure location is set (use site location if not provided)
    let location = req.body.location;
    if (!location || !location.latitude || !location.longitude) {
      if (site.location && site.location.latitude && site.location.longitude) {
        location = {
          latitude: site.location.latitude,
          longitude: site.location.longitude,
          address: site.location.address || ''
        };
      } else {
        return res.status(400).json({ error: 'Location is required. Site must have valid coordinates.' });
      }
    }
    
    // Convert siteId to ObjectId
    const siteId = new mongoose.Types.ObjectId(req.body.siteId);
    
    const sector = new UnifiedSector({ 
      ...req.body,
      siteId: siteId,
      location: location,
      tenantId: req.tenantId,
      createdBy: createdBy
    });
    
    await sector.save();
    console.log('[Network API] ✅ Sector created successfully:', sector._id);
    res.status(201).json(sector);
  } catch (error) {
    console.error('[Network API] ❌ Error creating sector:', error);
    console.error('[Network API] Error stack:', error.stack);
    console.error('[Network API] Error name:', error.name);
    if (error.errors) {
      console.error('[Network API] Validation errors:', JSON.stringify(error.errors, null, 2));
    }
    
    // Return more detailed error information
    let errorMessage = error.message || 'Failed to create sector';
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors || {}).map((e: any) => e.message).join(', ');
      errorMessage = `Validation error: ${validationErrors}`;
    }
    
    res.status(500).json({ 
      error: 'Failed to create sector', 
      details: errorMessage,
      validationErrors: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : undefined
    });
  }
});

router.put('/sectors/:id', async (req, res) => {
  try {
    // Find sector first to check authorization
    const existingSector = await UnifiedSector.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!existingSector) return res.status(404).json({ error: 'Sector not found' });
    
    // Authorization check
    const userEmail = (req.user?.email || req.body.email || req.headers['x-user-email'] || '').trim();
    const normalizedCreator = (existingSector.createdBy || '').trim();
    const isOwner = normalizedCreator && userEmail && normalizedCreator.toLowerCase() === userEmail.toLowerCase();
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'owner';
    
    // Allow editing sectors created by system/auto/automated/unknown (adoptable)
    const adoptableOwner = !normalizedCreator || ['system', 'auto', 'automated', 'unknown'].includes(normalizedCreator.toLowerCase());
    
    if (!isOwner && !isAdmin && !adoptableOwner) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You can only edit sectors you created' 
      });
    }
    
    const sector = await UnifiedSector.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date(), updatedBy: userEmail || 'System' },
      { new: true, runValidators: true }
    );
    res.json(sector);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sector' });
  }
});

router.delete('/sectors/:id', async (req, res) => {
  try {
    const sector = await UnifiedSector.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!sector) return res.status(404).json({ error: 'Sector not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete sector' });
  }
});

// Get sectors by site
router.get('/sites/:siteId/sectors', async (req, res) => {
  try {
    const sectors = await UnifiedSector.find({ 
      siteId: req.params.siteId,
      tenantId: req.tenantId 
    }).sort({ name: 1 }).lean();
    res.json(sectors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

// ========== UNIFIED CPE ==========

router.get('/cpe', async (req, res) => {
  try {
    const { status, technology, siteId } = req.query;
    const query = applyPlanVisibilityFilter({ tenantId: req.tenantId }, req);
    
    if (status) query.status = status;
    if (technology) query.technology = technology;
    if (siteId) query.siteId = siteId;
    
    // Populate siteId if it exists and is a valid ObjectId, otherwise handle gracefully
    let cpe;
    try {
      cpe = await UnifiedCPE.find(query)
        .populate({
          path: 'siteId',
          select: 'name type location',
          match: { tenantId: req.tenantId } // Only populate if site belongs to same tenant
        })
        .sort({ name: 1 })
        .lean();
      
      // Filter out CPE where populate returned null (site not found or doesn't belong to tenant)
      cpe = cpe.filter(item => !item.siteId || (item.siteId && item.siteId !== null && item.siteId !== undefined));
    } catch (populateError) {
      console.warn('[Network API] Populate failed for CPE, fetching without populate:', populateError.message);
      // Fallback: fetch without populate if populate fails
      cpe = await UnifiedCPE.find(query)
        .sort({ name: 1 })
        .lean();
    }
    
    res.json(cpe);
  } catch (error) {
    console.error('[Network API] Error fetching CPE:', error);
    console.error('[Network API] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch CPE', message: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
});

router.get('/cpe/:id', async (req, res) => {
  try {
    const cpe = await UnifiedCPE.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('siteId', 'name type location')
      .lean();
    if (!cpe) return res.status(404).json({ error: 'CPE not found' });
    res.json(cpe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CPE' });
  }
});

router.post('/cpe', async (req, res) => {
  try {
    // Ensure createdBy is set
    const createdBy = req.body.createdBy || req.body.email || req.user?.email || 'System';
    const cpe = new UnifiedCPE({ 
      ...req.body, 
      tenantId: req.tenantId,
      createdBy: createdBy
    });
    await cpe.save();
    res.status(201).json(cpe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create CPE', details: error.message });
  }
});

router.put('/cpe/:id', async (req, res) => {
  try {
    // Find CPE first to check authorization
    const existingCPE = await UnifiedCPE.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!existingCPE) return res.status(404).json({ error: 'CPE not found' });
    
    // Authorization check
    const userEmail = req.user?.email || req.body.email || req.headers['x-user-email'];
    const isOwner = existingCPE.createdBy === userEmail;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'owner';
    
    if (!isOwner && !isAdmin && existingCPE.createdBy) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You can only edit CPE devices you created' 
      });
    }
    
    const cpe = await UnifiedCPE.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date(), updatedBy: userEmail || 'System' },
      { new: true, runValidators: true }
    );
    res.json(cpe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update CPE' });
  }
});

router.delete('/cpe/:id', async (req, res) => {
  try {
    const cpe = await UnifiedCPE.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!cpe) return res.status(404).json({ error: 'CPE not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete CPE' });
  }
});

// ========== NETWORK EQUIPMENT ==========

router.get('/equipment', async (req, res) => {
  try {
    const { locationType, status, type } = req.query;
    const query = applyPlanVisibilityFilter({ tenantId: req.tenantId }, req);
    
    if (locationType) query.locationType = locationType;
    if (status) query.status = status;
    if (type) query.type = type;
    
    // Populate siteId if it exists and is a valid ObjectId, otherwise handle gracefully
    let equipment;
    try {
      equipment = await NetworkEquipment.find(query)
        .populate({
          path: 'siteId',
          select: 'name type',
          match: { tenantId: req.tenantId } // Only populate if site belongs to same tenant
        })
        .sort({ name: 1 })
        .lean();
      
      // Filter out equipment where populate returned null (site not found or doesn't belong to tenant)
      equipment = equipment.filter(item => !item.siteId || (item.siteId && item.siteId !== null && item.siteId !== undefined));
    } catch (populateError) {
      console.warn('[Network API] Populate failed for equipment, fetching without populate:', populateError.message);
      // Fallback: fetch without populate if populate fails
      equipment = await NetworkEquipment.find(query)
        .sort({ name: 1 })
        .lean();
    }
    
    res.json(equipment);
  } catch (error) {
    console.error('[Network API] Error fetching equipment:', error);
    console.error('[Network API] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch equipment', message: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
});

router.post('/equipment', async (req, res) => {
  try {
    // Ensure createdBy is set
    const createdBy = req.body.createdBy || req.body.email || req.user?.email || 'System';
    const equipment = new NetworkEquipment({ 
      ...req.body, 
      tenantId: req.tenantId,
      createdBy: createdBy
    });
    await equipment.save();
    res.status(201).json(equipment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create equipment', details: error.message });
  }
});

router.put('/equipment/:id', async (req, res) => {
  try {
    // Find equipment first to check authorization
    const existingEquipment = await NetworkEquipment.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!existingEquipment) return res.status(404).json({ error: 'Equipment not found' });
    
    // Authorization check
    const userEmail = (req.user?.email || req.body.email || req.headers['x-user-email'] || '').trim();
    const normalizedCreator = (existingEquipment.createdBy || '').trim();
    const isOwner = normalizedCreator && userEmail && normalizedCreator.toLowerCase() === userEmail.toLowerCase();
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'owner';
    
    // Allow editing equipment created by system/auto/automated/unknown (adoptable)
    const adoptableOwner = !normalizedCreator || ['system', 'auto', 'automated', 'unknown'].includes(normalizedCreator.toLowerCase());
    
    if (!isOwner && !isAdmin && !adoptableOwner) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You can only edit equipment you created' 
      });
    }
    
    const equipment = await NetworkEquipment.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date(), updatedBy: userEmail || 'System' },
      { new: true, runValidators: true }
    );
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

router.delete('/equipment/:id', async (req, res) => {
  try {
    const equipment = await NetworkEquipment.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

// ========== GEOCODING ==========

const NOMINATIM_USER_AGENT = 'LTE-PCI-Mapper-Geocoder/1.0 (support@wisptools.io)';

router.post('/geocode', async (req, res) => {
  const { address } = req.body || {};
  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  const arcgisConfig = appConfig?.externalServices?.arcgis || {};
  const geocodeUrl = arcgisConfig.geocodeUrl;
  const apiKey = arcgisConfig.apiKey;

  const tryArcgisGeocode = async () => {
    if (!geocodeUrl) return null;

    const params = new URLSearchParams({
      f: 'json',
      singleLine: address,
      outFields: 'Match_addr,Addr_type'
    });

    if (apiKey) {
      params.set('token', apiKey);
    }

    const response = await fetch(`${geocodeUrl}?${params.toString()}`);
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.warn('[NetworkRoutes] ArcGIS geocode failed', response.status, details);
      return null;
    }

    const data = await response.json();
    if (Array.isArray(data?.candidates) && data.candidates.length > 0) {
      const best = data.candidates[0];
      return {
        latitude: best?.location?.y,
        longitude: best?.location?.x,
        address: best?.address || best?.attributes?.Match_addr
      };
    }

    return null;
  };

  const tryNominatimGeocode = async () => {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      format: 'jsonv2',
      q: address,
      addressdetails: '1',
      limit: '1'
    }).toString()}`;

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.warn('[NetworkRoutes] Nominatim geocode failed', response.status, details);
      return null;
    }

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const best = results[0];
    const displayName = best.display_name || address;
    return {
      latitude: best.lat ? Number(best.lat) : undefined,
      longitude: best.lon ? Number(best.lon) : undefined,
      address: displayName
    };
  };

  try {
    let result = await tryArcgisGeocode();
    if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
      result = await tryNominatimGeocode();
    }

    if (result && Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) {
      return res.json(result);
    }

    return res.status(404).json({ error: 'Address not found' });
  } catch (error) {
    console.error('[NetworkRoutes] Geocoding failed', error);
    return res.status(500).json({ error: 'Geocoding failed' });
  }
});

router.post('/reverse-geocode', async (req, res) => {
  const { latitude, longitude } = req.body || {};
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  const arcgisConfig = appConfig?.externalServices?.arcgis || {};
  const reverseUrl = arcgisConfig.reverseGeocodeUrl;
  const apiKey = arcgisConfig.apiKey;

  const tryArcgisReverse = async () => {
    if (!reverseUrl) return null;

    const params = new URLSearchParams({
      f: 'json',
      location: `${longitude},${latitude}`,
      outSR: '4326'
    });

    if (apiKey) {
      params.set('token', apiKey);
    }

    const response = await fetch(`${reverseUrl}?${params.toString()}`);
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.warn('[NetworkRoutes] ArcGIS reverse geocode failed', response.status, details);
      return null;
    }

    const data = await response.json();
    if (data?.address) {
      const addr = data.address;
      return { address: `${addr.Address ?? ''}, ${addr.City ?? ''}, ${addr.Region ?? ''} ${addr.Postal ?? ''}`.trim() };
    }

    return null;
  };

  const tryNominatimReverse = async () => {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(latitude),
      lon: String(longitude),
      zoom: '18',
      addressdetails: '1'
    });
    const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.warn('[NetworkRoutes] Nominatim reverse geocode failed', response.status, details);
      return null;
    }

    const data = await response.json();
    const displayName = data?.display_name;
    if (displayName) {
      return { address: displayName };
    }

    return null;
  };

  try {
    let result = await tryArcgisReverse();
    if (!result?.address) {
      result = await tryNominatimReverse();
    }

    if (result?.address) {
      return res.json(result);
    }

    return res.status(404).json({ error: 'Address not found' });
  } catch (error) {
    console.error('[NetworkRoutes] Reverse geocoding failed', error);
    return res.status(500).json({ error: 'Reverse geocoding failed' });
  }
});

// ========== HARDWARE DEPLOYMENTS ==========

// Get hardware deployments for a site
router.get('/sites/:siteId/hardware', async (req, res) => {
  try {
    const hardware = await HardwareDeployment.find({ 
      siteId: req.params.siteId,
      tenantId: req.tenantId 
    }).sort({ deployedAt: -1 }).lean();
    res.json(hardware);
  } catch (error) {
    console.error('Error fetching hardware:', error);
    res.status(500).json({ error: 'Failed to fetch hardware' });
  }
});

// Create hardware deployment
router.post('/sites/:siteId/hardware', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { hardware_type, name, config, epc_config, inventory_item_id, planId } = req.body;
    
    // Verify site exists and belongs to tenant
    const site = await UnifiedSite.findOne({ _id: siteId, tenantId: req.tenantId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const hardware = new HardwareDeployment({
      siteId,
      tenantId: req.tenantId,
      hardware_type,
      name,
      config,
      epc_config,
      inventory_item_id,
      planId, // Link to project/plan if provided
      deployedAt: new Date(),
      status: 'deployed'
    });
    
    await hardware.save();
    res.status(201).json(hardware);
  } catch (error) {
    console.error('Error creating hardware:', error);
    res.status(500).json({ error: 'Failed to create hardware deployment', details: error.message });
  }
});

// Get all hardware deployments for tenant
router.get('/hardware-deployments', async (req, res) => {
  try {
    const { hardware_type, status } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (hardware_type) query.hardware_type = hardware_type;
    if (status) query.status = status;
    
    const hardware = await HardwareDeployment.find(query)
      .populate('siteId', 'name type location')
      .sort({ deployedAt: -1 })
      .lean();
    
    res.json(hardware);
  } catch (error) {
    console.error('Error fetching hardware deployments:', error);
    res.status(500).json({ error: 'Failed to fetch hardware deployments' });
  }
});

// Update hardware deployment
router.put('/hardware-deployments/:id', async (req, res) => {
  try {
    const hardware = await HardwareDeployment.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!hardware) return res.status(404).json({ error: 'Hardware deployment not found' });
    res.json(hardware);
  } catch (error) {
    console.error('Error updating hardware:', error);
    res.status(500).json({ error: 'Failed to update hardware deployment' });
  }
});

// Delete hardware deployment
router.delete('/hardware-deployments/:id', async (req, res) => {
  try {
    const hardware = await HardwareDeployment.findOneAndDelete({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    if (!hardware) return res.status(404).json({ error: 'Hardware deployment not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting hardware:', error);
    res.status(500).json({ error: 'Failed to delete hardware deployment' });
  }
});

// ========== IMPORT FROM OTHER MODULES ==========

// Import CPE devices from GenieACS/ACS module
router.post('/import/acs', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    let imported = 0;
    const errors = [];
    
    // Try to fetch from GenieACS NBI API
    // This would typically connect to GenieACS running on the tenant's infrastructure
    const appConfig = require('../../config/app');
    const genieacsUrl = appConfig.externalServices.genieacs.baseUrl;
    
    try {
      // Fetch devices from GenieACS
      const devicesResponse = await fetch(`${genieacsUrl}/devices`, {
        headers: {
          'X-Tenant-ID': tenantId
        }
      });
      
      if (!devicesResponse.ok) {
        throw new Error(`GenieACS API returned ${devicesResponse.status}`);
      }
      
      const devices = await devicesResponse.json();
      
      for (const device of devices) {
        try {
          // Extract location from device parameters
          const location = device.location || {};
          const latitude = location.latitude || device['Device.DeviceInfo.Location']?.latitude || 0;
          const longitude = location.longitude || device['Device.DeviceInfo.Location']?.longitude || 0;
          
          // Check if CPE already exists by serial number
          const existingCPE = await UnifiedCPE.findOne({
            tenantId,
            serialNumber: device.serialNumber || device._id
          });
          
          if (!existingCPE && latitude && longitude) {
            // Create new CPE from GenieACS device
            const cpe = new UnifiedCPE({
              tenantId,
              name: device.productClass || device._id,
              manufacturer: device.manufacturer || 'Unknown',
              model: device.modelName || 'Unknown',
              serialNumber: device.serialNumber || device._id,
              location: {
                latitude,
                longitude,
                address: location.address || ''
              },
              status: device.online ? 'active' : 'inactive',
              modules: {
                acs: true
              },
              technology: device.productClass?.includes('LTE') ? 'LTE' : 'Unknown',
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            await cpe.save();
            imported++;
          }
        } catch (err) {
          errors.push(`Failed to import device ${device._id}: ${err.message}`);
        }
      }
      
      res.json({
        imported,
        errors,
        message: `Successfully imported ${imported} CPE devices from ACS`
      });
    } catch (fetchError) {
      // If GenieACS is not available, return empty result
      console.warn('GenieACS not available or unreachable:', fetchError.message);
      res.json({
        imported: 0,
        errors: [`GenieACS not available: ${fetchError.message}`],
        message: 'GenieACS not available - no devices imported'
      });
    }
  } catch (error) {
    console.error('Error importing from ACS:', error);
    res.status(500).json({ error: 'Failed to import from ACS', message: error.message });
  }
});

// Import from CBRS (if needed)
router.post('/import/cbrs', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    // CBRS import would go here
    // This would typically fetch from CBRS API endpoints
    res.json({
      imported: 0,
      errors: [],
      message: 'CBRS import not yet implemented'
    });
  } catch (error) {
    console.error('Error importing from CBRS:', error);
    res.status(500).json({ error: 'Failed to import from CBRS', message: error.message });
  }
});

// ============================================================================
// BULK IMPORT
// ============================================================================

/**
 * POST /api/network/sites/bulk-import
 * Bulk import sites from CSV/JSON
 */
router.post('/sites/bulk-import', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header is required' });
    }
    
    const { sites } = req.body;
    
    if (!Array.isArray(sites) || sites.length === 0) {
      return res.status(400).json({ error: 'sites array is required and must not be empty' });
    }
    
    const results = {
      imported: 0,
      failed: 0,
      errors: []
    };
    
    // Process sites one by one
    for (let i = 0; i < sites.length; i++) {
      try {
        const siteData = sites[i];
        const createdBy = siteData.createdBy || req.user?.email || 'System';
        
        // Handle nested address fields
        if (siteData['address.street'] || siteData['address.city']) {
          siteData.address = {
            street: siteData['address.street'] || siteData.address?.street,
            city: siteData['address.city'] || siteData.address?.city,
            state: siteData['address.state'] || siteData.address?.state,
            zipCode: siteData['address.zipCode'] || siteData.address?.zipCode,
            country: siteData['address.country'] || siteData.address?.country || 'USA'
          };
        }
        
        // Remove dot-notation fields
        Object.keys(siteData).forEach(key => {
          if (key.includes('.')) {
            delete siteData[key];
          }
        });
        
        // Ensure required fields
        if (!siteData.name) {
          throw new Error('name is required');
        }
        
        if (siteData.latitude !== undefined && (isNaN(parseFloat(siteData.latitude)) || parseFloat(siteData.latitude) < -90 || parseFloat(siteData.latitude) > 90)) {
          throw new Error('Invalid latitude');
        }
        
        if (siteData.longitude !== undefined && (isNaN(parseFloat(siteData.longitude)) || parseFloat(siteData.longitude) < -180 || parseFloat(siteData.longitude) > 180)) {
          throw new Error('Invalid longitude');
        }
        
        const site = new UnifiedSite({
          ...siteData,
          tenantId,
          createdBy
        });
        
        await site.save();
        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: err.message || 'Failed to import'
        });
      }
    }
    
    res.json({
      message: 'Bulk import completed',
      ...results
    });
  } catch (error) {
    console.error('Error bulk importing sites:', error);
    res.status(500).json({ error: 'Failed to bulk import sites', message: error.message });
  }
});

/**
 * POST /api/network/equipment/bulk-import
 * Bulk import network equipment from CSV/JSON
 */
router.post('/equipment/bulk-import', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header is required' });
    }
    
    const { equipment } = req.body;
    
    if (!Array.isArray(equipment) || equipment.length === 0) {
      return res.status(400).json({ error: 'equipment array is required and must not be empty' });
    }
    
    const results = {
      imported: 0,
      failed: 0,
      errors: []
    };
    
    // Process equipment one by one
    for (let i = 0; i < equipment.length; i++) {
      try {
        const equipData = equipment[i];
        const createdBy = equipData.createdBy || req.user?.email || 'System';
        
        // Parse config if it's a string
        if (typeof equipData.config === 'string') {
          try {
            equipData.config = JSON.parse(equipData.config);
          } catch (e) {
            // Keep as string if not valid JSON
          }
        }
        
        // Ensure required fields
        if (!equipData.name) {
          throw new Error('name is required');
        }
        
        if (!equipData.hardware_type) {
          throw new Error('hardware_type is required');
        }
        
        const equip = new NetworkEquipment({
          ...equipData,
          tenantId,
          createdBy,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await equip.save();
        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: err.message || 'Failed to import'
        });
      }
    }
    
    res.json({
      message: 'Bulk import completed',
      ...results
    });
  } catch (error) {
    console.error('Error bulk importing equipment:', error);
    res.status(500).json({ error: 'Failed to bulk import equipment', message: error.message });
  }
});

module.exports = router;