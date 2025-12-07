// Plan Promotion Service
// Extracted from plans.js for better organization and maintainability
// Version: 0.2

const { PlanLayerFeature } = require('../models/plan-layer-feature');
const { PlanProject } = require('../models/plan');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../models/network');
const UnifiedTower = UnifiedSite; // Backwards compatibility alias

/**
 * Extract latitude/longitude from feature geometry
 */
function extractLatLng(feature) {
  if (!feature || !feature.geometry) {
    return { latitude: null, longitude: null };
  }

  const { geometry } = feature;

  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
    return {
      latitude: geometry.coordinates[1],
      longitude: geometry.coordinates[0]
    };
  }

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) {
    const ring = geometry.coordinates[0];
    if (Array.isArray(ring) && ring.length > 0) {
      // Calculate centroid from polygon
      let sumLat = 0;
      let sumLon = 0;
      let count = 0;

      for (const coord of ring) {
        if (Array.isArray(coord) && coord.length >= 2) {
          sumLon += coord[0];
          sumLat += coord[1];
          count += 1;
        }
      }

      if (count > 0) {
        return {
          latitude: sumLat / count,
          longitude: sumLon / count
        };
      }
    }
  }

  return { latitude: null, longitude: null };
}

/**
 * Update plan feature summary counts
 */
async function updatePlanFeatureSummary(tenantId, planId, session) {
  try {
    const summary = await PlanLayerFeature.countByPlan(tenantId, planId);
    const update = {
      $set: {
        stagedFeatureCounts: summary,
        updatedAt: new Date()
      }
    };

    const query = { _id: planId, tenantId };

    if (session) {
      await PlanProject.updateOne(query, update).session(session);
    } else {
      await PlanProject.updateOne(query, update);
    }

    return summary;
  } catch (error) {
    console.error('Error updating plan feature summary:', error);
    return { total: 0, byType: {}, byStatus: {} };
  }
}

/**
 * Promote plan layer features to production
 */
async function promotePlanLayerFeatures(plan, tenantId, user, session) {
  const planId = plan._id.toString();
  const promotionResults = [];
  const promotedFeatureIds = [];
  const features = await PlanLayerFeature.find({ tenantId, planId }).session(session);

  for (const feature of features) {
    try {
      let promotedDoc = null;
      switch (feature.featureType) {
        case 'site':
          promotedDoc = await createSiteFromFeature(feature, planId, tenantId, user, session);
          break;
        case 'equipment':
          promotedDoc = await createEquipmentFromFeature(feature, planId, tenantId, user, session);
          break;
        default:
          promotionResults.push({
            featureId: feature._id.toString(),
            featureType: feature.featureType,
            status: 'skipped'
          });
          continue;
      }

      if (promotedDoc) {
        feature.status = 'authorized';
        feature.promotedResourceId = promotedDoc._id.toString();
        feature.promotedResourceType = promotedDoc.constructor.modelName;
        feature.updatedBy = user?.email || feature.updatedBy || 'System';
        feature.updatedById = user?.uid || feature.updatedById || null;
        await feature.save({ session });

        promotionResults.push({
          featureId: feature._id.toString(),
          featureType: feature.featureType,
          status: 'promoted',
          resourceId: promotedDoc._id.toString(),
          resourceType: promotedDoc.constructor.modelName
        });
        promotedFeatureIds.push(feature._id);
      }
    } catch (error) {
      console.error('Failed to promote plan feature:', {
        featureId: feature._id.toString(),
        featureType: feature.featureType,
        error: error.message
      });
      promotionResults.push({
        featureId: feature._id.toString(),
        featureType: feature.featureType,
        status: 'error',
        message: error.message
      });
    }
  }

  if (promotedFeatureIds.length > 0) {
    await PlanLayerFeature.deleteMany({
      _id: { $in: promotedFeatureIds },
      tenantId,
      planId
    }).session(session);

    await updatePlanFeatureSummary(tenantId, planId, session);
  }

  return promotionResults;
}

/**
 * Create a site from a plan layer feature
 */
async function createSiteFromFeature(feature, planId, tenantId, user, session) {
  const { latitude, longitude } = extractLatLng(feature);
  if (latitude === null || longitude === null) {
    throw new Error('Site feature requires valid latitude/longitude');
  }

  const properties = feature.properties || {};
  const site = new UnifiedSite({
    tenantId,
    name: properties.name || `Planned Site ${planId.slice(-6)}`,
    type: properties.type || 'tower',
    status: properties.status || 'planned',
    location: {
      latitude,
      longitude,
      address: properties.address || properties.location?.address || ''
    },
    contact: properties.contact,
    towerContact: properties.towerContact,
    buildingContact: properties.buildingContact,
    siteContact: properties.siteContact,
    accessInstructions: properties.accessInstructions,
    gateCode: properties.gateCode,
    safetyNotes: properties.safetyNotes,
    accessHours: properties.accessHours,
    height: properties.height,
    structureType: properties.structureType,
    planId: null,
    originPlanId: planId,
    createdBy: user?.email || feature.createdBy || 'System',
    createdById: user?.uid || feature.createdById || null,
    updatedBy: user?.email || feature.updatedBy || 'System',
    updatedById: user?.uid || feature.updatedById || null
  });

  await site.save({ session });
  return site;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Find nearest site to a given location
 */
async function findNearestSite(latitude, longitude, tenantId) {
  if (!latitude || !longitude || latitude === 0 || longitude === 0) {
    return null;
  }

  const sites = await UnifiedSite.find({
    tenantId,
    location: {
      $exists: true,
      $ne: null
    },
    'location.latitude': { $exists: true, $ne: null, $ne: 0 },
    'location.longitude': { $exists: true, $ne: null, $ne: 0 }
  }).lean();

  let nearestSite = null;
  let minDistance = Infinity;

  for (const site of sites) {
    const siteLat = site.location?.latitude;
    const siteLon = site.location?.longitude;

    if (!siteLat || !siteLon) continue;

    const distance = getDistance(latitude, longitude, siteLat, siteLon);

    // Only consider sites within 5km (5000 meters)
    if (distance < 5000 && distance < minDistance) {
      minDistance = distance;
      nearestSite = site;
    }
  }

  return nearestSite;
}

/**
 * Create equipment from a plan layer feature
 */
async function createEquipmentFromFeature(feature, planId, tenantId, user, session) {
  const { latitude, longitude } = extractLatLng(feature);
  if (latitude === null || longitude === null) {
    throw new Error('Equipment feature requires valid latitude/longitude');
  }

  const properties = feature.properties || {};
  const equipmentType = properties.type || properties.equipmentType || 'other';

  // If siteId is not provided, find the nearest site
  let siteId = properties.siteId || null;
  if (!siteId) {
    const nearestSite = await findNearestSite(latitude, longitude, tenantId);
    if (nearestSite) {
      siteId = nearestSite._id;
      console.log(`📍 Auto-assigned siteId ${siteId} (${nearestSite.name}) to equipment at (${latitude}, ${longitude})`);
    }
  }

  const equipment = new NetworkEquipment({
    tenantId,
    name: properties.name || `Planned Equipment ${planId.slice(-6)}`,
    type: normalizeEquipmentType(equipmentType),
    status: properties.status || 'planned',
    manufacturer: properties.manufacturer,
    model: properties.model,
    serialNumber: properties.serialNumber,
    partNumber: properties.partNumber,
    location: {
      latitude,
      longitude,
      address: properties.address || properties.location?.address || ''
    },
    siteId: siteId,
    inventoryId: properties.inventoryId,
    notes: properties.notes,
    planId: null,
    originPlanId: planId,
    createdBy: user?.email || feature.createdBy || 'System',
    createdById: user?.uid || feature.createdById || null,
    updatedBy: user?.email || feature.updatedBy || 'System',
    updatedById: user?.uid || feature.updatedById || null
  });

  await equipment.save({ session });
  return equipment;
}

function normalizeEquipmentType(type) {
  const allowed = ['router', 'switch', 'power-supply', 'ups', 'generator', 'cable', 'connector', 'mounting-hardware', 'backhaul', 'antenna', 'radio', 'other'];
  if (!type) return 'other';
  const normalized = type.toLowerCase();
  return allowed.includes(normalized) ? normalized : 'other';
}

module.exports = {
  promotePlanLayerFeatures,
  createSiteFromFeature,
  createEquipmentFromFeature,
  updatePlanFeatureSummary,
  extractLatLng,
  normalizeEquipmentType
};

