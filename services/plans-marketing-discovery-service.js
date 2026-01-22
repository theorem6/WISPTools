/**
 * Plans Marketing Discovery Service
 * Handles the complex marketing discovery logic for plans
 * This was extracted from routes/plans.js to separate business logic from routes
 */

const { PlanProject } = require('../models/plan');
const marketingDiscovery = require('./marketingDiscovery');
const microsoftFootprintsService = require('./microsoftFootprints');
const arcgisBuildingFootprintsService = require('./arcgisBuildingFootprints');
const appConfig = require('../config/app');
const { parseBoundingBox, isValidBoundingBox, parseCenter, parseMarketingAlgorithms, toNumber, computeBoundingBoxCenter, computeBoundingBoxSpanMiles } = require('../routes/plans/plans-helpers');

// Progress store (in-memory, shared across requests)
const progressStore = new Map();

// Constants
const ARC_GIS_API_KEY = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || '';
const ARC_GIS_MAX_CANDIDATES_PER_REQUEST = 500;
const ARC_GIS_SUBDIVIDE_TRIGGER_COUNT = Math.round(ARC_GIS_MAX_CANDIDATES_PER_REQUEST * 0.9);
const ARC_GIS_MIN_SUBDIVIDE_SPAN_MILES = 1.5;
const ARC_GIS_MAX_SUBDIVISION_DEPTH = 3;

/**
 * Get progress by request ID
 */
function getProgress(requestId) {
  return progressStore.get(requestId);
}

/**
 * Set progress
 */
function setProgress(requestId, progress) {
  progressStore.set(requestId, progress);
}

/**
 * Delete progress
 */
function deleteProgress(requestId) {
  progressStore.delete(requestId);
}

/**
 * Run Microsoft Building Footprints discovery
 */
async function runMicrosoftBuildingFootprintsDiscovery({ boundingBox, progressCallback }) {
  const result = {
    coordinates: [],
    stats: { rawCandidates: 0 },
    error: null
  };

  try {
    if (!boundingBox || !isValidBoundingBox(boundingBox)) {
      result.error = 'Invalid bounding box provided to Microsoft Building Footprints discovery';
      return result;
    }

    if (progressCallback) progressCallback('Fetching Microsoft building footprints', 5);

    const geojsonData = await microsoftFootprintsService.queryByBoundingBox(boundingBox);

    if (!geojsonData?.features || !Array.isArray(geojsonData.features)) {
      result.error = 'Invalid response format from Microsoft Building Footprints service';
      return result;
    }

    if (progressCallback) progressCallback('Processing building footprints', 20);

    const coordinates = [];
    const seenKeys = new Set();
    let skippedInvalidGeometry = 0;
    let skippedInvalidCentroid = 0;
    let skippedDuplicate = 0;

    for (const feature of geojsonData.features) {
      if (!feature?.geometry) {
        skippedInvalidGeometry++;
        continue;
      }

      const centroid = microsoftFootprintsService.calculateCentroid(feature.geometry);

      if (!centroid || !Number.isFinite(centroid.latitude) || !Number.isFinite(centroid.longitude)) {
        skippedInvalidCentroid++;
        continue;
      }

      const key = `${centroid.latitude.toFixed(7)},${centroid.longitude.toFixed(7)}`;
      if (seenKeys.has(key)) {
        skippedDuplicate++;
        continue;
      }

      seenKeys.add(key);
      coordinates.push({
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        source: 'microsoft_footprints',
        properties: feature.properties || {}
      });

      if (coordinates.length >= 50000) {
        console.warn('[MarketingDiscovery] Reached safety limit of 50000 coordinates');
        break;
      }
    }

    result.coordinates = coordinates;
    result.stats.rawCandidates = coordinates.length;

    return result;
  } catch (error) {
    result.error = error?.message || 'Failed to fetch Microsoft building footprints';
    return result;
  }
}

/**
 * Run ArcGIS Address Points discovery
 */
async function runArcgisAddressPointsDiscovery({ boundingBox, center, radiusMiles }) {
  // This uses the marketingDiscovery service
  // Return coordinates only - geocoding happens later
  const result = await marketingDiscovery.discoverAddressPointsByBoundingBox({
    boundingBox,
    center,
    radiusMiles
  });

  // Convert addresses to coordinates format
  if (result.addresses && Array.isArray(result.addresses)) {
    result.coordinates = result.addresses.map(addr => ({
      latitude: addr.latitude,
      longitude: addr.longitude,
      source: 'arcgis_address_points',
      attributes: {}
    }));
  } else {
    result.coordinates = [];
  }

  return result;
}

/**
 * Run ArcGIS Places discovery
 */
async function runArcgisPlacesDiscovery({ boundingBox, center, radiusMiles }) {
  const result = {
    coordinates: [],
    error: null
  };

  try {
    // Use marketingDiscovery service for places
    const placesResult = await marketingDiscovery.discoverPlacesByBoundingBox({
      boundingBox,
      center,
      radiusMiles
    });

    if (placesResult.addresses && Array.isArray(placesResult.addresses)) {
      result.coordinates = placesResult.addresses.map(addr => ({
        latitude: addr.latitude,
        longitude: addr.longitude,
        source: 'arcgis_places',
        attributes: {}
      }));
    }

    if (placesResult.error) {
      result.error = placesResult.error;
    }

    return result;
  } catch (error) {
    result.error = error?.message || 'Unknown error';
    return result;
  }
}

module.exports = {
  getProgress,
  setProgress,
  deleteProgress,
  runMicrosoftBuildingFootprintsDiscovery,
  runArcgisAddressPointsDiscovery,
  runArcgisPlacesDiscovery,
  ARC_GIS_API_KEY,
  progressStore
};

