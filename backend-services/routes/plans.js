// Planning System API
// Manages deployment plans and project workflows

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const axiosRetryModule = require('axios-retry');
const axiosRetry = axiosRetryModule.default || axiosRetryModule;
const router = express.Router();

// Configure axios with retry logic for all requests
const httpClient = axios.create({
  timeout: 30000, // 30 second default timeout
  headers: {
    'User-Agent': 'LTE-PCI-Mapper/1.0 (admin@wisptools.io)'
  }
});

// Configure automatic retries with exponential backoff
const { exponentialDelay, isNetworkOrIdempotentRequestError } = axiosRetryModule;
axiosRetry(httpClient, {
  retries: 3, // Retry 3 times on failure
  retryDelay: exponentialDelay, // Exponential backoff: 1s, 2s, 4s
  retryCondition: (error) => {
    // Retry on network errors, 5xx errors, or timeout
    return isNetworkOrIdempotentRequestError(error) ||
           (error.response && error.response.status >= 500) ||
           error.code === 'ECONNABORTED' || // Timeout
           error.code === 'ETIMEDOUT';
  },
  onRetry: (retryCount, error, requestConfig) => {
    console.log(`[API] Retry attempt ${retryCount} for ${requestConfig.url}: ${error.message}`);
  }
});
const { PlanProject } = require('../models/plan');
const { InventoryItem } = require('../models/inventory');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../models/network');
const UnifiedTower = UnifiedSite; // Backwards compatibility alias
const { createProjectApprovalNotification } = require('./notifications');
const { PlanLayerFeature } = require('../models/plan-layer-feature');
const { verifyAuth } = require('./users/role-auth-middleware');
const { Customer } = require('../models/customer');
const appConfig = require('../config/app');

// Services (extracted functions)
const marketingDiscovery = require('../services/marketingDiscovery');
const planHardwareService = require('../services/planHardwareService');
const planPromotionService = require('../services/planPromotionService');
const planMarketingLeadService = require('../services/planMarketingLeadService');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Require tenant ID
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(verifyAuth);
router.use(requireTenant);

// ============================================================================
// HELPERS
// ============================================================================

const trimString = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseLocation = (input) => {
  if (input === null) return null;
  if (!input || typeof input !== 'object') return undefined;

  const latitude = toNumber(input.latitude ?? input.lat);
  const longitude = toNumber(input.longitude ?? input.lon);

  const location = {
    addressLine1: trimString(input.addressLine1 ?? input.address),
    addressLine2: trimString(input.addressLine2 ?? input.unit),
    city: trimString(input.city),
    state: trimString(input.state ?? input.region),
    postalCode: trimString(input.postalCode ?? input.zip ?? input.postcode),
    country: trimString(input.country) ?? 'US'
  };

  if (latitude !== undefined) location.latitude = latitude;
  if (longitude !== undefined) location.longitude = longitude;

  const hasData = Object.values(location).some((value) => value !== undefined);
  return hasData ? location : undefined;
};

const parseBoundingBox = (input) => {
  if (!input || typeof input !== 'object') return undefined;
  const west = toNumber(input.west);
  const south = toNumber(input.south);
  const east = toNumber(input.east);
  const north = toNumber(input.north);
  if ([west, south, east, north].some((value) => value === undefined)) {
    return undefined;
  }
  return { west, south, east, north };
};

const isValidBoundingBox = (bbox) => {
  if (!bbox) return false;
  const required = ['west', 'south', 'east', 'north'];
  if (required.some((key) => !Number.isFinite(bbox[key]))) return false;
  if (bbox.east <= bbox.west) return false;
  if (bbox.north <= bbox.south) return false;
  return true;
};

const computeBoundingBoxCenter = (bbox) => ({
  lat: (bbox.north + bbox.south) / 2,
  lon: (bbox.east + bbox.west) / 2
});

const computeBoundingBoxSpanMiles = (bbox) => {
  const latSpan = Math.abs(bbox.north - bbox.south);
  const lonSpan = Math.abs(bbox.east - bbox.west);
  const centerLat = (bbox.north + bbox.south) / 2;
  const milesPerLat = 69.0;
  const milesPerLon = Math.cos((centerLat * Math.PI) / 180) * 69.172 || 69.172;
  return {
    widthMiles: lonSpan * Math.abs(milesPerLon),
    heightMiles: latSpan * milesPerLat
  };
};

const isWithinBoundingBox = (lat, lon, bbox, toleranceMeters = 40) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isValidBoundingBox(bbox)) {
    return false;
  }
  const centerLat = (bbox.north + bbox.south) / 2;
  const latTolerance = toleranceMeters / 111000;
  const lonDenominator = Math.cos((centerLat * Math.PI) / 180) * 111000;
  const lonTolerance = lonDenominator ? toleranceMeters / lonDenominator : toleranceMeters / 111000;

  return (
    lat >= bbox.south - latTolerance &&
    lat <= bbox.north + latTolerance &&
    lon >= bbox.west - lonTolerance &&
    lon <= bbox.east + lonTolerance
  );
};

const subdivideBoundingBox = (bbox) => {
  const midLat = (bbox.north + bbox.south) / 2;
  const midLon = (bbox.east + bbox.west) / 2;
  if (!Number.isFinite(midLat) || !Number.isFinite(midLon)) {
    return [];
  }
  const subBoxes = [
    { west: bbox.west, south: midLat, east: midLon, north: bbox.north }, // NW
    { west: midLon, south: midLat, east: bbox.east, north: bbox.north }, // NE
    { west: bbox.west, south: bbox.south, east: midLon, north: midLat }, // SW
    { west: midLon, south: bbox.south, east: bbox.east, north: midLat } // SE
  ];
  return subBoxes.filter((box) => isValidBoundingBox(box));
};

const parseCenter = (input) => {
  if (!input || typeof input !== 'object') return undefined;
  const lat = toNumber(input.lat ?? input.latitude);
  const lon = toNumber(input.lon ?? input.longitude);
  if (lat === undefined || lon === undefined) return undefined;
  return { lat, lon };
};

const AVAILABLE_MARKETING_ALGORITHMS = {
  microsoft_footprints: 'Microsoft Building Footprints (OAuth2)',
  osm_buildings: 'OpenStreetMap Building Footprints',
  arcgis_address_points: 'ArcGIS Address Points',
  arcgis_building_footprints: 'ArcGIS Building Footprints (Feature Service)',
  arcgis_places: 'ArcGIS Places & Amenities'
};

const ARC_GIS_MAX_CANDIDATES_PER_REQUEST = 500;
const ARC_GIS_SUBDIVIDE_TRIGGER_COUNT = Math.round(ARC_GIS_MAX_CANDIDATES_PER_REQUEST * 0.9);
const ARC_GIS_MIN_SUBDIVIDE_SPAN_MILES = 1.5;
const ARC_GIS_MAX_SUBDIVISION_DEPTH = 3;

const parseMarketingAlgorithms = (input) => {
  if (!Array.isArray(input)) return undefined;
  const normalized = input
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : null))
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index)
    .filter((value) => Object.prototype.hasOwnProperty.call(AVAILABLE_MARKETING_ALGORITHMS, value));
  return normalized.length ? normalized : undefined;
};

const parseMarketing = (input) => {
  if (input === null) return null;
  if (!input || typeof input !== 'object') return undefined;

  const marketing = {};

  const radius = toNumber(input.targetRadiusMiles ?? input.radiusMiles ?? input.radius);
  if (radius !== undefined) marketing.targetRadiusMiles = radius;

  const lastRunAt = input.lastRunAt ? new Date(input.lastRunAt) : undefined;
  if (lastRunAt && !Number.isNaN(lastRunAt.valueOf())) {
    marketing.lastRunAt = lastRunAt;
  }

  const lastResultCount = toNumber(input.lastResultCount);
  if (lastResultCount !== undefined) marketing.lastResultCount = lastResultCount;

  const boundingBox = parseBoundingBox(input.lastBoundingBox ?? input.boundingBox);
  if (boundingBox) marketing.lastBoundingBox = boundingBox;

  const center = parseCenter(input.lastCenter ?? input.center);
  if (center) marketing.lastCenter = center;

  if (Array.isArray(input.addresses)) {
    marketing.addresses = input.addresses
      .map((addr) => {
        const latitude = toNumber(addr.latitude ?? addr.lat);
        const longitude = toNumber(addr.longitude ?? addr.lon);
        const addressLine1 = trimString(addr.addressLine1 ?? addr.address);
        const addressLine2 = trimString(addr.addressLine2 ?? addr.unit);
        const city = trimString(addr.city);
        const state = trimString(addr.state);
        const postalCode = trimString(addr.postalCode ?? addr.zip ?? addr.postcode);
        const country = trimString(addr.country);
        const source = trimString(addr.source);

        if (
          addressLine1 ||
          addressLine2 ||
          city ||
          state ||
          postalCode ||
          country ||
          (latitude !== undefined && longitude !== undefined)
        ) {
          const result = {
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country,
            source
          };
          if (latitude !== undefined) result.latitude = latitude;
          if (longitude !== undefined) result.longitude = longitude;
          return result;
        }
        return null;
      })
      .filter(Boolean);
  }

  const algorithms = parseMarketingAlgorithms(input.algorithms);
  if (algorithms) {
    marketing.algorithms = algorithms;
  }
  if (input.algorithmStats && typeof input.algorithmStats === 'object') {
    marketing.algorithmStats = input.algorithmStats;
  }

  const hasData = Object.keys(marketing).length > 0;
  return hasData ? marketing : undefined;
};

// Marketing lead functions - use service module
const generateLeadCustomerId = planMarketingLeadService.generateLeadCustomerId;
const buildLeadHash = planMarketingLeadService.buildLeadHash;
const normalizePlanNameForLead = planMarketingLeadService.normalizePlanNameForLead;
const createMarketingLeadsForPlan = planMarketingLeadService.createMarketingLeadsForPlan;

// Old inline implementations removed - see backend-services/services/planMarketingLeadService.js
/* COMMENTED OUT - see planMarketingLeadService.js
const createMarketingLeadsForPlan = async (plan, tenantId, userEmail) => {
  const marketing = plan?.marketing;
  if (!marketing || !Array.isArray(marketing.addresses) || marketing.addresses.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  const planIdString =
    (typeof plan._id === 'object' && plan._id !== null && plan._id.toString) ? plan._id.toString() :
    (typeof plan.id === 'string' ? plan.id : null);

  const radiusMiles = toNumber(marketing.targetRadiusMiles) ?? null;
  const marketingRunAt = marketing.lastRunAt ? new Date(marketing.lastRunAt).toISOString() : new Date().toISOString();
  const boundingBox = marketing.lastBoundingBox ?? null;
  const center = marketing.lastCenter ?? null;

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const address of marketing.addresses) {
    const latitude = toNumber(address.latitude);
    const longitude = toNumber(address.longitude);
    if (latitude === undefined || longitude === undefined) {
      skipped += 1;
      continue;
    }

    const leadHash = buildLeadHash(latitude, longitude, address.addressLine1, address.postalCode);
    if (!leadHash) {
      skipped += 1;
      continue;
    }

    const street = address.addressLine1 ?? `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`;
    const now = new Date();
    const metadata = {
      planId: planIdString,
      planName: plan.name ?? null,
      marketingRunAt,
      radiusMiles,
      boundingBox,
      center,
      source: address.source ?? 'marketing',
      addressLine2: address.addressLine2 ?? null
    };

    const setPayload = {
      isLead: true,
      leadSource: 'plan-marketing',
      associatedPlanId: planIdString,
      leadMetadata: metadata,
      leadHash,
      updatedAt: now,
      updatedBy: userEmail || 'system',
      'serviceAddress.street': street,
      'serviceAddress.latitude': latitude,
      'serviceAddress.longitude': longitude
    };

    if (address.city) {
      setPayload['serviceAddress.city'] = address.city;
    }
    if (address.state) {
      setPayload['serviceAddress.state'] = address.state;
    }
    if (address.postalCode) {
      setPayload['serviceAddress.zipCode'] = address.postalCode;
    }
    setPayload['serviceAddress.country'] = address.country || 'USA';
    if (address.email) {
      setPayload.email = address.email;
    }

    const setOnInsertPayload = {
      tenantId,
      customerId: await generateLeadCustomerId(tenantId),
      firstName: 'Prospect',
      lastName: normalizePlanNameForLead(plan.name),
      primaryPhone: '000-000-0000',
      serviceStatus: 'pending',
      accountStatus: 'good-standing',
      isActive: true,
      createdAt: now,
      createdBy: userEmail || 'system',
      notes: 'Auto-generated marketing lead',
      leadStatus: 'new',
      fullName: `Prospect (${street})`
    };

    if (address.email) {
      setOnInsertPayload.email = address.email;
    }

    const updateDoc = {
      $setOnInsert: setOnInsertPayload,
      $set: setPayload,
      $addToSet: {
        tags: { $each: ['marketing', 'lead'] }
      }
    };

    try {
      const result = await Customer.updateOne(
        { tenantId, leadHash },
        updateDoc,
        { upsert: true }
      );

      if (result.upsertedCount && result.upsertedCount > 0) {
        created += 1;
      } else if (result.matchedCount && result.matchedCount > 0) {
        updated += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      console.error('Failed to sync marketing lead:', {
        tenantId,
        planId: planIdString,
        address: street,
        error: err.message
      });
      skipped += 1;
    }
  }

  return { created, updated, skipped };
};
*/

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_BUILDING_RESULTS = 10000; // Increase limit to capture more buildings
const MAX_REVERSE_GEOCODE = 500; // No artificial limit - geocode all (FTTH approach)
const NOMINATIM_DELAY_MS = 500; // Reduced delay since ArcGIS doesn't need rate limiting
const NOMINATIM_USER_AGENT = 'LTE-PCI-Mapper-Marketing/1.0 (admin@wisptools.io)';
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const ARCGIS_GEOCODER_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
const ARC_GIS_API_KEY = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || '';

const RURAL_AREA_THRESHOLD_KM2 = 1.0;
const RURAL_MIN_PRIMARY_RESULTS = 150;
const RURAL_MIN_AFTER_FALLBACK = 150;
const RURAL_FALLBACK_MAX_RESULTS = 600;

const buildPrimaryOverpassQuery = (bbox) => `
[out:json][timeout:90][maxsize:100000000];
(
  // Strategy 1: All buildings with any building tag (most comprehensive)
  way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});

  // Strategy 2: Explicit residential buildings
  way["building"~"^(residential|house|apartments|detached|semidetached_house|semi_detached_house|terrace|bungalow|cabin|farm|static_caravan|stilt_house)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["building"~"^(residential|house|apartments|detached|semidetached_house|semi_detached_house|terrace|bungalow|cabin|farm|static_caravan|stilt_house)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});

  // Strategy 3: Amenities tagged as dwellings
  way["amenity"~"^(house|residential|dwelling)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["amenity"~"^(house|residential|dwelling)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});

  // Strategy 4: Small structures & outbuildings
  way["building"~"^(garage|shed|barn|outbuilding|storage|warehouse|hangar)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["building"~"^(garage|shed|barn|outbuilding|storage|warehouse|hangar)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});

  // Strategy 5: Any structure with address information
  way["addr:housenumber"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["addr:housenumber"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});

  // Strategy 6: Named structures
  way["name"]["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["name"]["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});

  // Strategy 7: Rural tagging patterns
  way["place"~"^(household|house)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["place"~"^(household|house)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});

  // Strategy 8: Residential landuse polygons with addresses
  way["landuse"~"^(residential|village_green)$"]["addr:housenumber"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["landuse"~"^(residential|village_green)$"]["addr:housenumber"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  
  // CRITICAL: Recursively get all nodes that are part of ways, and all referenced elements
  // This ensures we get full geometry for ways, not just their center
  // (._;>;); means: take the current set, and recursively get all nodes/ways referenced by it
  (._;>;);
);
// Use out body to get full geometry (all nodes for ways), not just centers
// This is essential for calculating accurate centroids from actual geometry
out body;
`;

const buildFallbackOverpassQuery = (bbox) => `
[out:json][timeout:90][maxsize:100000000];
(
  way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["amenity"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["amenity"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["shop"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["shop"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["office"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["office"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["addr:housenumber"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["addr:housenumber"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["addr:street"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["addr:street"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["addr:city"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["addr:city"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["addr:postcode"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["addr:postcode"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["power"~"^(pole|tower)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["power"~"^(pole|tower)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["name"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["name"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  
  // CRITICAL: Recursively get all nodes that are part of ways
  // This ensures we get full geometry for ways, not just their center
  (._;>;);
);
// Use out body to get full geometry (all nodes for ways), not just centers
out body;
`;

const buildInterpolationOverpassQuery = (bbox) => `
[out:json][timeout:90][maxsize:100000000];
(
  way["highway"~"^(primary|secondary|tertiary|residential|unclassified|track)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["addr:interpolation"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["boundary"~"^(administrative|parcel)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["landuse"~"^(residential|village_green)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out geom;
`;

const computeBoundingBoxAreaKm2 = (bbox) => {
  const width = Math.abs(bbox.east - bbox.west);
  const height = Math.abs(bbox.north - bbox.south);
  return width * height * 111 * 111;
};

async function executeOverpassQuery({ query, label, timeoutMs = 45000 }) {
  try {
    if (!query || typeof query !== 'string') {
      throw new Error(`Invalid Overpass query for ${label}: query must be a non-empty string`);
    }

    console.log(`[MarketingDiscovery] Overpass request (${label}) starting`);
    
    // Use axios with automatic retries instead of fetch
    const response = await httpClient.post(
      OVERPASS_ENDPOINT,
      `data=${encodeURIComponent(query)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: timeoutMs
      }
    );

    const payload = response.data;

    if (payload?.remark) {
      console.log(`[MarketingDiscovery] Overpass remark (${label}):`, payload.remark);
    }

    if (payload?.error) {
      console.error(`[MarketingDiscovery] Overpass API error (${label}):`, payload.error);
      throw new Error(`Overpass API error: ${payload.error}`);
    }

    return Array.isArray(payload?.elements) ? payload.elements : [];
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      console.error(`[MarketingDiscovery] Overpass request (${label}) timed out after ${timeoutMs}ms`);
      throw new Error(`Overpass query (${label}) timed out after ${timeoutMs}ms`);
    }
    if (error.response) {
      const errorMsg = `Overpass API returned ${error.response.status}: ${error.response.data ? JSON.stringify(error.response.data).substring(0, 500) : 'Unknown error'}`;
      console.error(`[MarketingDiscovery] Overpass API error (${label}):`, errorMsg);
      throw new Error(errorMsg);
    }
    console.error(`[MarketingDiscovery] Overpass request (${label}) failed:`, error.message || error);
    throw error;
  }
}

function extractBuildingCandidates(elements, { precision = 100000, sourceLabel = 'osm_primary' }) {
  const seen = new Map();
  const candidates = [];
  
  console.log(`[MarketingDiscovery] Extracting building candidates from ${elements.length} elements (source: ${sourceLabel})`);

  // Don't sort by size - include all buildings equally (ways and nodes)
  // This ensures small buildings aren't filtered out
  const sortedElements = [...elements]; // Keep original order - no size-based filtering

  let extracted = 0;
  let skipped = 0;
  let skippedReasons = { noCoords: 0, duplicate: 0, invalid: 0 };

  for (const element of sortedElements) {
    let latitude;
    let longitude;

    // With out body, we get full geometry for ways (all nodes)
    // Always prefer calculating centroid from actual geometry over center property
    if (element.type === 'way') {
      // For ways, calculate centroid from actual geometry (all nodes)
      // With out body, geometry array contains actual node coordinates
      if (Array.isArray(element.geometry) && element.geometry.length > 0) {
        // Calculate proper geometric centroid from all vertices
        // This is more accurate than using center (which is bounding box center)
        const coords = element.geometry.filter(g => g && g.lat !== undefined && g.lon !== undefined && Number.isFinite(toNumber(g.lat)) && Number.isFinite(toNumber(g.lon)));
        if (coords.length > 0) {
          // Calculate geometric centroid (average of all vertices)
          const sumLat = coords.reduce((sum, g) => sum + toNumber(g.lat), 0);
          const sumLon = coords.reduce((sum, g) => sum + toNumber(g.lon), 0);
          latitude = sumLat / coords.length;
          longitude = sumLon / coords.length;
        } else if (element.center) {
          // Fallback: Use center if geometry is empty or invalid
          latitude = toNumber(element.center.lat);
          longitude = toNumber(element.center.lon);
        }
      } else if (element.center) {
        // Fallback: Use center if no geometry available
        latitude = toNumber(element.center.lat);
        longitude = toNumber(element.center.lon);
      }
    } else if (element.type === 'node') {
      // Nodes are just points - use their coordinates directly
      // Note: These may not be true building centroids if the building is represented as a point
      latitude = toNumber(element.lat);
      longitude = toNumber(element.lon);
    } else if (element.type === 'relation') {
      // Relations (multipolygons) - calculate centroid from all members' geometry
      if (Array.isArray(element.geometry) && element.geometry.length > 0) {
        const coords = element.geometry.filter(g => g && g.lat !== undefined && g.lon !== undefined && Number.isFinite(toNumber(g.lat)) && Number.isFinite(toNumber(g.lon)));
        if (coords.length > 0) {
          const sumLat = coords.reduce((sum, g) => sum + toNumber(g.lat), 0);
          const sumLon = coords.reduce((sum, g) => sum + toNumber(g.lon), 0);
          latitude = sumLat / coords.length;
          longitude = sumLon / coords.length;
        }
      }
    } else if (Array.isArray(element.geometry) && element.geometry.length > 0) {
      // For other element types with geometry, calculate centroid from all points
      const coords = element.geometry.filter(g => g && g.lat !== undefined && g.lon !== undefined && Number.isFinite(toNumber(g.lat)) && Number.isFinite(toNumber(g.lon)));
      if (coords.length > 0) {
        const sumLat = coords.reduce((sum, g) => sum + toNumber(g.lat), 0);
        const sumLon = coords.reduce((sum, g) => sum + toNumber(g.lon), 0);
        latitude = sumLat / coords.length;
        longitude = sumLon / coords.length;
      } else {
        // Last resort: use first point if available
        latitude = toNumber(element.geometry[0]?.lat);
        longitude = toNumber(element.geometry[0]?.lon);
      }
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      skipped++;
      skippedReasons.noCoords++;
      if (extracted === 0 && skipped < 10) {
        console.warn(`[MarketingDiscovery] Skipping element with invalid coordinates:`, {
          type: element.type,
          hasCenter: !!element.center,
          hasGeometry: !!element.geometry,
          geometryLength: element.geometry?.length || 0,
          elementKeys: Object.keys(element).filter(k => !['tags', 'members'].includes(k))
        });
      }
      continue;
    }

    const roundedLat = Math.round(latitude * precision) / precision;
    const roundedLon = Math.round(longitude * precision) / precision;
    const key = `${roundedLat},${roundedLon}`;

    if (!seen.has(key)) {
      const candidate = {
        lat: latitude,
        lon: longitude,
        tags: element.tags || {},
        source: sourceLabel
      };
      seen.set(key, candidate);
      candidates.push(candidate);
    } else {
      const existing = seen.get(key);

      const existingHasAddress =
        existing.tags?.['addr:housenumber'] ||
        existing.tags?.['addr:street'] ||
        existing.tags?.name;
      const incomingHasAddress =
        element.tags?.['addr:housenumber'] ||
        element.tags?.['addr:street'] ||
        element.tags?.name;

      if (!existingHasAddress && incomingHasAddress) {
        const updated = {
          lat: latitude,
          lon: longitude,
          tags: element.tags || {},
          source: sourceLabel
        };
        seen.set(key, updated);
        const index = candidates.findIndex(
          (candidate) =>
            Math.abs(candidate.lat - existing.lat) < 0.00001 &&
            Math.abs(candidate.lon - existing.lon) < 0.00001
        );
        if (index >= 0) {
          candidates[index] = updated;
        }
      }
    }
    
    extracted++;
    if (candidates.length >= MAX_BUILDING_RESULTS) {
      break;
    }
  }

  console.log(`[MarketingDiscovery] Extraction complete for ${sourceLabel}:`, {
    totalElements: elements.length,
    extracted,
    candidates: candidates.length,
    skipped,
    skippedReasons
  });

  return candidates;
}

function mergeCandidateSets(primary, secondary, precision = 100000) {
  const merged = new Map();
  const addCandidate = (candidate) => {
    const roundedLat = Math.round(candidate.lat * precision) / precision;
    const roundedLon = Math.round(candidate.lon * precision) / precision;
    const key = `${roundedLat},${roundedLon}`;
    if (!merged.has(key)) {
      merged.set(key, candidate);
    }
  };

  primary.forEach(addCandidate);
  secondary.forEach(addCandidate);

  return Array.from(merged.values()).slice(0, MAX_BUILDING_RESULTS);
}

function generateInterpolatedCandidates(elements) {
  const interpolated = [];

  for (const element of elements) {
    if (element.type === 'way' && Array.isArray(element.geometry)) {
      for (let i = 0; i < element.geometry.length; i += 2) {
        const point = element.geometry[i];
        if (!point) continue;
        const lat = toNumber(point.lat);
        const lon = toNumber(point.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const offsetLat = lat + (Math.random() - 0.5) * 0.0005; // ~30m offset
        const offsetLon = lon + (Math.random() - 0.5) * 0.0005;

        interpolated.push({
          lat: offsetLat,
          lon: offsetLon,
          tags: {
            building: 'residential',
            source: 'osm_interpolated',
            note: 'Potential rural house location'
          },
          source: 'osm_interpolated'
        });

        if (interpolated.length >= 20) {
          return interpolated;
        }
      }
    }
  }

  return interpolated;
}

const RESIDENTIAL_BUILDING_TYPES = new Set([
  'house',
  'residential',
  'apartments',
  'detached',
  'semidetached_house',
  'semi_detached_house',
  'terrace',
  'bungalow',
  'cabin',
  'farm',
  'static_caravan',
  'stilt_house',
  'yes'
]);

function candidateHasResidentialSignal(tags = {}) {
  if (!tags || typeof tags !== 'object') return false;
  if (tags['addr:housenumber'] || tags['addr:unit']) return true;
  const building = tags.building;
  if (building && RESIDENTIAL_BUILDING_TYPES.has(building)) return true;
  if (building && building !== 'commercial') return true;
  const place = tags.place;
  if (place && ['household', 'house', 'hamlet', 'village'].includes(place)) return true;
  if (tags.amenity && ['dwelling', 'house'].includes(tags.amenity)) return true;
  return false;
}

function candidateLooksLikeRoad(tags = {}) {
  if (!tags) return false;
  if (tags.highway) return true;
  if (tags.railway) return true;
  if (tags.route) return true;
  if (tags.waterway) return true;
  return false;
}

// Marketing discovery functions - use service module
// Batch reverse geocode all coordinates - processes all at once for efficiency
const batchReverseGeocodeCoordinates = marketingDiscovery.batchReverseGeocodeCoordinates;

// Legacy function references - now use marketingDiscovery service
const reverseGeocodeCoordinate = marketingDiscovery.reverseGeocodeCoordinate;
const reverseGeocodeCoordinateArcgis = marketingDiscovery.reverseGeocodeCoordinateArcgis;
const distanceInMeters = marketingDiscovery.distanceInMeters;
const buildAddressHash = marketingDiscovery.buildAddressHash;
const normalizeArcgisAddressKey = marketingDiscovery.normalizeArcgisAddressKey;

const mergeArcgisAddresses = (target, candidates, seen, boundingBox) => {
  let added = 0;
  if (!Array.isArray(candidates) || !candidates.length) {
    return added;
  }

  for (const candidate of candidates) {
    const key = normalizeArcgisAddressKey(candidate);
    if (!key) continue;
    if (seen.has(key)) continue;

    if (boundingBox) {
      const latitude = toNumber(candidate.latitude);
      const longitude = toNumber(candidate.longitude);
      if (!isWithinBoundingBox(latitude, longitude, boundingBox)) {
        continue;
      }
    }

    seen.add(key);
    target.push(candidate);
    added += 1;
  }
  return added;
};

// buildAddressHash now uses marketingDiscovery service (see line 1012)

function generateGridSamplePoints({ boundingBox, spacingMeters, maxPoints = 1000 }) {
  const points = [];
  const latStep = spacingMeters / 111000;
  const centerLatRad = ((boundingBox.north + boundingBox.south) / 2) * (Math.PI / 180);
  const lonStep = spacingMeters / (111000 * Math.cos(centerLatRad || 0.00001));

  for (let lat = boundingBox.south; lat <= boundingBox.north; lat += latStep) {
    for (let lon = boundingBox.west; lon <= boundingBox.east; lon += lonStep) {
      points.push({ lat, lon });
      if (points.length >= maxPoints) {
        return points;
      }
    }
  }

  return points;
}

async function runArcgisGridSampler({ boundingBox, spacingMeters = 40 }) {
  const start = Date.now();
  const samplePoints = generateGridSamplePoints({ boundingBox, spacingMeters, maxPoints: 750 });
  console.log('[MarketingDiscovery] ArcGIS grid sampler', {
    spacingMeters,
    samplePoints: samplePoints.length
  });

  const addresses = [];
  let geocoded = 0;
  let failed = 0;

  for (const point of samplePoints) {
    try {
      const result = await reverseGeocodeCoordinateArcgis(point.lat, point.lon);
      if (result && result.addressLine1) {
        addresses.push({
          ...result,
          source: 'arcgis_grid'
        });
        geocoded += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn('[MarketingDiscovery] Grid sampler reverse geocode failed', {
        lat: point.lat,
        lon: point.lon,
        error: error?.message || error
      });
    }
  }

  console.log('[MarketingDiscovery] ArcGIS grid sampler completed', {
    durationMs: Date.now() - start,
    totalSamples: samplePoints.length,
    geocoded,
    failed
  });

  return { addresses, geocoded, failed };
}

// Microsoft Building Footprints service
const microsoftFootprintsService = require('../services/microsoftFootprints');

// ArcGIS Building Footprints Feature Service
const arcgisBuildingFootprintsService = require('../services/arcgisBuildingFootprints');

// Microsoft Building Footprints discovery - returns coordinates only
// Microsoft provides building footprints via their GitHub releases or tile services
// For now, we'll use a tile-based approach if available, or skip if not configured
async function runMicrosoftBuildingFootprintsDiscovery({ boundingBox, progressCallback }) {
  const result = {
    coordinates: [],
    stats: {
      rawCandidates: 0
    },
    error: null
  };

  try {
    console.log('[MarketingDiscovery] Starting Microsoft Building Footprints discovery', { 
      boundingBox,
      hasBoundingBox: !!boundingBox
    });

    if (!boundingBox || !isValidBoundingBox(boundingBox)) {
      const errorMsg = 'Invalid bounding box provided to Microsoft Building Footprints discovery';
      console.error('[MarketingDiscovery]', errorMsg, boundingBox);
      result.error = errorMsg;
      return result;
    }

    if (progressCallback) progressCallback('Fetching Microsoft building footprints', 5);

    // Microsoft Building Footprints are available via various methods:
    // 1. GitHub releases (state/county GeoJSON files) - would require pre-download
    // 2. Tile services - if available
    // 3. Cloud services that index the data
    
    // For now, we'll use a simple bounding box query approach
    // This could be enhanced with a tile service or pre-processed data
    // Microsoft's data is organized by state/county, so we'd need to identify which files to load
    
    // Use the Microsoft Footprints service to query by bounding box
    // This will try: 1) Configured API 2) GitHub 3) Return empty if neither available
    try {
      if (progressCallback) progressCallback('Querying Microsoft building footprints', 10);
      
      const geojsonData = await microsoftFootprintsService.queryByBoundingBox(boundingBox);
      
      if (!geojsonData || !geojsonData.features || !Array.isArray(geojsonData.features)) {
        console.warn('[MarketingDiscovery] Microsoft Building Footprints returned invalid data format');
        result.error = 'Invalid response format from Microsoft Building Footprints service';
        return result;
      }

      const features = geojsonData.features;
      console.log('[MarketingDiscovery] Microsoft Building Footprints API returned', {
        featuresCount: features.length,
        sampleFeature: features[0] ? {
          type: features[0].type,
          geometryType: features[0].geometry?.type,
          hasCoordinates: !!features[0].geometry?.coordinates,
          propertiesKeys: features[0].properties ? Object.keys(features[0].properties) : []
        } : null
      });

      if (progressCallback) progressCallback('Processing building footprints', 20);

      const coordinates = [];
      const seenKeys = new Set();
      let skippedInvalidGeometry = 0;
      let skippedInvalidCentroid = 0;
      let skippedDuplicate = 0;

      for (const feature of features) {
        if (!feature || !feature.geometry) {
          skippedInvalidGeometry++;
          continue;
        }

        // Use the service's centroid calculation function
        const centroid = microsoftFootprintsService.calculateCentroid(feature.geometry);

        if (!centroid || !Number.isFinite(centroid.latitude) || !Number.isFinite(centroid.longitude)) {
          skippedInvalidCentroid++;
          if (skippedInvalidCentroid <= 3) {
            console.warn('[MarketingDiscovery] Microsoft Building Footprints: Skipped invalid centroid', {
              geometryType: feature.geometry?.type,
              centroid,
              featureProperties: feature.properties
            });
          }
          continue;
        }

        // Deduplicate using coordinate key
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

        // Don't break early - process all features from service
        // The service will handle pagination if needed
        // Only check for safety limit to prevent memory issues
        if (coordinates.length >= 50000) {
          console.warn('[MarketingDiscovery] Microsoft Building Footprints: Reached safety limit of 50000 coordinates, stopping early');
          break;
        }
      }

      result.coordinates = coordinates;
      result.stats.rawCandidates = coordinates.length;
      
      console.log('[MarketingDiscovery] Microsoft Building Footprints discovery completed', { 
        totalCandidates: coordinates.length,
        coordinatesReturned: coordinates.length,
        featuresProcessed: features.length,
        skippedInvalidGeometry,
        skippedInvalidCentroid,
        skippedDuplicate,
        successRate: features.length > 0 ? `${((coordinates.length / features.length) * 100).toFixed(1)}%` : '0%'
      });
      
      return result;
    } catch (serviceError) {
      console.error('[MarketingDiscovery] Microsoft Building Footprints service error:', {
        error: serviceError?.message || serviceError,
        stack: serviceError?.stack
      });
      result.error = serviceError?.message || 'Failed to fetch Microsoft building footprints';
      return result;
    }
  } catch (error) {
    const message =
      error?.message ||
      (typeof error === 'string' ? error : 'Unexpected error during Microsoft Building Footprints discovery');
    console.warn('[MarketingDiscovery] Microsoft Building Footprints discovery error:', message);
    result.error = message;
    return result;
  }
}

// Modified to return coordinates only - reverse geocoding happens later in batch
async function runOsmBuildingDiscovery({ boundingBox, radiusMiles, center, advancedOptions, progressCallback }) {
  const result = {
    coordinates: [], // Changed from addresses to coordinates
    stats: {
      rawCandidates: 0
    },
    error: null
  };

  try {
    console.log('[MarketingDiscovery] Starting OSM building discovery (coordinates only)', { 
      boundingBox,
      hasBoundingBox: !!boundingBox
    });

    if (!boundingBox || !isValidBoundingBox(boundingBox)) {
      const errorMsg = 'Invalid bounding box provided to OSM discovery';
      console.error('[MarketingDiscovery]', errorMsg, boundingBox);
      result.error = errorMsg;
      return result;
    }

    if (progressCallback) progressCallback('Building Overpass query', 5);

    const areaKm2 = computeBoundingBoxAreaKm2(boundingBox);
    const isRuralArea = areaKm2 > RURAL_AREA_THRESHOLD_KM2;
    console.log('[MarketingDiscovery] OSM area analysis', {
      areaKm2: areaKm2.toFixed(2),
      isRuralArea
    });

    if (progressCallback) progressCallback('Fetching primary OSM dataset', 10);
    
    let primaryElements = [];
    try {
      const query = buildPrimaryOverpassQuery(boundingBox);
      if (!query || typeof query !== 'string') {
        throw new Error('Failed to build Overpass query');
      }
      primaryElements = await executeOverpassQuery({
        query,
        label: 'primary'
      });
    } catch (queryError) {
      console.error('[MarketingDiscovery] Primary Overpass query failed:', queryError);
      result.error = queryError?.message || 'Failed to fetch primary OSM dataset';
      return result; // Return early with error
    }

    // Use higher precision to avoid deduplicating nearby small buildings
    // Lower precision values = more aggressive deduplication (may remove houses close together)
    // Higher precision values = less aggressive deduplication (preserves more buildings)
    // For houses, use precision of 50000 (preserves buildings ~2 meters apart) instead of 10000/20000
    let candidates = extractBuildingCandidates(primaryElements, {
      precision: 50000, // Higher precision to preserve small buildings
      sourceLabel: 'osm_primary'
    });

    console.log('[MarketingDiscovery] OSM primary extraction stats', {
      totalElements: primaryElements.length,
      waysWithCenters: primaryElements.filter(e => e.type === 'way' && e.center).length,
      waysWithoutCenters: primaryElements.filter(e => e.type === 'way' && !e.center).length,
      nodes: primaryElements.filter(e => e.type === 'node').length,
      candidates: candidates.length,
      isRuralArea,
      sampleElements: primaryElements.slice(0, 3).map(e => ({
        type: e.type,
        hasCenter: !!e.center,
        center: e.center || null,
        hasGeometry: !!e.geometry,
        geometryLength: e.geometry?.length || 0
      }))
    });

    if (isRuralArea) {
      const shouldRunFallback = candidates.length < RURAL_MIN_PRIMARY_RESULTS;

      console.log('[MarketingDiscovery] Rural fallback policy', {
        primaryCandidates: candidates.length,
        threshold: RURAL_MIN_PRIMARY_RESULTS,
        executingFallback: shouldRunFallback ? true : 'forced'
      });

      if (progressCallback) progressCallback('Running rural fallback query', 18);
      
      let fallbackElements = [];
      try {
        const fallbackQuery = buildFallbackOverpassQuery(boundingBox);
        if (fallbackQuery && typeof fallbackQuery === 'string') {
          fallbackElements = await executeOverpassQuery({
            query: fallbackQuery,
            label: 'fallback'
          });
        }
      } catch (fallbackError) {
        console.warn('[MarketingDiscovery] Fallback Overpass query failed (non-critical):', fallbackError);
        // Continue with primary results only - fallback is optional
      }

      const fallbackCandidates = extractBuildingCandidates(fallbackElements, {
        precision: 50000, // Higher precision to preserve small buildings
        sourceLabel: 'osm_fallback'
      }).slice(0, RURAL_FALLBACK_MAX_RESULTS);

      console.log('[MarketingDiscovery] Fallback extraction stats', {
        fallbackElements: fallbackElements.length,
        fallbackCandidates: fallbackCandidates.length
      });

      candidates = mergeCandidateSets(candidates, fallbackCandidates, 50000); // Higher precision
      console.log('[MarketingDiscovery] Candidate count after fallback merge', {
        mergedCandidates: candidates.length
      });

      if (candidates.length < RURAL_MIN_AFTER_FALLBACK) {
        console.log('[MarketingDiscovery] Results still sparse, generating interpolation candidates', {
          currentCandidates: candidates.length
        });

        if (progressCallback) progressCallback('Interpolating rural houses', 22);
        
        let interpolationElements = [];
        try {
          const interpolationQuery = buildInterpolationOverpassQuery(boundingBox);
          if (interpolationQuery && typeof interpolationQuery === 'string') {
            interpolationElements = await executeOverpassQuery({
              query: interpolationQuery,
              label: 'interpolation'
            });
          }
        } catch (interpolationError) {
          console.warn('[MarketingDiscovery] Interpolation Overpass query failed (non-critical):', interpolationError);
          // Continue without interpolation - it's optional
        }

        const interpolated = generateInterpolatedCandidates(interpolationElements);
        console.log('[MarketingDiscovery] Interpolation generated candidates', {
          interpolationElements: interpolationElements.length,
          interpolated: interpolated.length
        });

        candidates = mergeCandidateSets(candidates, interpolated, 50000); // Higher precision
      }
    }

    // Don't filter by residential signal - include ALL buildings
    // The residential filter was too aggressive and excluded many houses
    // Just filter out obvious non-buildings (roads, railways, etc.)
    const beforeFilterCount = candidates.length;
    const filteredCandidates = candidates.filter((candidate) => {
      if (!candidate || !candidate.tags) return false;
      // Only filter out obvious non-buildings (roads, railways, waterways)
      // Keep ALL buildings, even if not explicitly tagged as residential
      if (candidateLooksLikeRoad(candidate.tags)) return false;
      // Keep everything else - reverse geocoding will determine if it's a valid address
      return true;
    });

    console.log('[MarketingDiscovery] Building filter applied (only removing roads/non-buildings)', {
      beforeFilterCount,
      afterFilterCount: filteredCandidates.length,
      removed: beforeFilterCount - filteredCandidates.length
    });
    
    // Use filtered candidates, but don't limit - keep ALL buildings
    candidates = filteredCandidates.slice(0, MAX_BUILDING_RESULTS);

    console.log('[MarketingDiscovery] Final OSM candidate summary', {
      totalCandidates: candidates.length,
      sample: candidates.slice(0, 5).map((c) => ({
        lat: c.lat,
        lon: c.lon,
        source: c.source
      }))
    });

    if (progressCallback) progressCallback('Extracting coordinates', 25);

    // Return coordinates only - no reverse geocoding
    const coordinates = candidates.map((candidate) => ({
      latitude: candidate.lat,
      longitude: candidate.lon,
      source: 'osm_buildings',
      tags: candidate.tags || {} // Keep tags for potential later use
    }));

    result.coordinates = coordinates;
    result.stats.rawCandidates = candidates.length;
    console.log('[MarketingDiscovery] OSM discovery completed (coordinates only)', { 
      totalCandidates: candidates.length,
      coordinatesReturned: coordinates.length
    });
    return result;
  } catch (error) {
    const message =
      error?.message ||
      (typeof error === 'string' ? error : 'Unexpected error during OSM building discovery');
    console.warn('[MarketingDiscovery] OSM building discovery error:', message);
    result.error = message;
    return result;
  }
}

// Modified to extract coordinates only - reverse geocoding happens later in batch
const extractArcgisCoordinates = (candidates = []) => {
  const businessKeywords = /\b(restaurant|mall|store|shop|market|office|hotel|hospital|school|university|church|warehouse|factory|garage|auto|car|dealership|gas|station|bank|pharmacy|drug|clinic|dental|law|attorney|realty|agency|plaza|center|centre|park|complex|inc|llc|corp|company)\b/i;

  return candidates
    .map((candidate) => {
      const location = candidate?.location;
      const attributes = candidate?.attributes || {};
      const latitude = toNumber(location?.y);
      const longitude = toNumber(location?.x);
      if (latitude === undefined || longitude === undefined) {
        return null;
      }

      const addrType = attributes.Addr_type || '';
      const placeName = attributes.PlaceName || candidate.address || '';

      if (addrType && (addrType.includes('Commercial') || addrType.includes('Business') || addrType.includes('POI'))) {
        return null;
      }

      if (businessKeywords.test(placeName)) {
        return null;
      }

      // Return coordinates only
      return {
        latitude,
        longitude,
        source: 'arcgis_address_points',
        attributes: attributes // Keep for potential later use
      };
    })
    .filter(Boolean);
};

const fetchArcgisCandidatesForExtent = async ({ boundingBox, centerOverride, apiKey: providedApiKey }) => {
  try {
    // Use provided API key, or fall back to module-level constant, or runtime env
    const apiKey = providedApiKey || ARC_GIS_API_KEY || appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || '';
    
    if (!apiKey || apiKey.length === 0) {
      console.error('[MarketingDiscovery] fetchArcgisCandidatesForExtent: API key is not set', {
        provided: !!providedApiKey,
        moduleLevel: !!ARC_GIS_API_KEY,
        processEnv: !!process.env.ARCGIS_API_KEY,
        appConfig: !!appConfig?.externalServices?.arcgis?.apiKey
      });
      throw new Error('ArcGIS API key not configured');
    }

    // Use JSON envelope format for searchExtent (required for proper coordinate system handling)
    const searchExtentJson = {
      xmin: boundingBox.west,
      ymin: boundingBox.south,
      xmax: boundingBox.east,
      ymax: boundingBox.north,
      spatialReference: { wkid: 4326 } // WGS84
    };

    const params = new URLSearchParams({
      f: 'json',
      outFields: 'Match_addr,Addr_type,PlaceName,City,Region,Postal,Address,Score',
      maxLocations: String(ARC_GIS_MAX_CANDIDATES_PER_REQUEST),
      searchExtent: JSON.stringify(searchExtentJson), // JSON envelope format with spatial reference
      inSR: '4326', // Input spatial reference: WGS84
      outSR: '4326', // Output spatial reference: WGS84
      // Remove category filter - it may be too restrictive. We'll filter by Addr_type in extractArcgisCoordinates instead.
      // category: 'Point Address',
      forStorage: 'false',
      token: apiKey
    });

    if (centerOverride?.lon !== undefined && centerOverride?.lat !== undefined) {
      params.set('location', `${centerOverride.lon},${centerOverride.lat}`);
    }

    console.log('[MarketingDiscovery] fetchArcgisCandidatesForExtent: Calling ArcGIS API', {
      boundingBox,
      searchExtent: searchExtentJson,
      centerOverride,
      hasToken: !!apiKey,
      tokenLength: apiKey.length,
      tokenPrefix: apiKey ? apiKey.substring(0, 20) + '...' : 'none'
    });

    // Use axios with automatic retries instead of fetch
    const response = await httpClient.post(
      `${ARCGIS_GEOCODER_URL}/findAddressCandidates`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000 // 15 second timeout for ArcGIS address search
      }
    );

    const payload = response.data;
    
    // Check for ArcGIS API errors
    if (payload.error) {
      console.error('[MarketingDiscovery] fetchArcgisCandidatesForExtent: ArcGIS API error', {
        error: payload.error,
        code: payload.error.code,
        message: payload.error.message
      });
      throw new Error(`ArcGIS API error: ${payload.error.code || 'unknown'} - ${payload.error.message || 'Unknown error'}`);
    }
    
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const exceededLimit = Boolean(payload?.exceededTransferLimit) || candidates.length >= ARC_GIS_MAX_CANDIDATES_PER_REQUEST;

    console.log('[MarketingDiscovery] fetchArcgisCandidatesForExtent: Success', {
      candidateCount: candidates.length,
      exceededLimit,
      sampleCandidates: candidates.length > 0 ? candidates.slice(0, 3).map(c => ({
        address: c.address,
        location: c.location,
        score: c.score,
        attributes: c.attributes
      })) : [],
      // Log full response if no candidates to debug
      fullResponse: candidates.length === 0 ? {
        hasError: !!payload.error,
        error: payload.error,
        spatialReference: payload.spatialReference,
        extent: payload.extent
      } : undefined
    });

    return {
      candidateCount: candidates.length,
      exceededLimit,
      rawCandidates: candidates // Return raw candidates for coordinate extraction
    };
  } catch (error) {
    console.error('[MarketingDiscovery] fetchArcgisCandidatesForExtent: Failed', {
      error: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
    if (error.response) {
      const details = error.response.data ? JSON.stringify(error.response.data).substring(0, 500) : 'Unknown error';
      throw new Error(`ArcGIS API returned ${error.response.status}: ${details}`);
    }
    throw error;
  }
};

const shouldSubdivideArcgisExtent = ({ spanMiles, depth, candidateCount, exceededLimit }) => {
  if (depth >= ARC_GIS_MAX_SUBDIVISION_DEPTH) return false;

  const largeExtent =
    spanMiles.widthMiles > ARC_GIS_MIN_SUBDIVIDE_SPAN_MILES || spanMiles.heightMiles > ARC_GIS_MIN_SUBDIVIDE_SPAN_MILES;

  if (exceededLimit) return true;
  if (candidateCount >= ARC_GIS_SUBDIVIDE_TRIGGER_COUNT) return true;
  if (largeExtent && candidateCount === 0) return true;
  if (largeExtent && candidateCount > ARC_GIS_SUBDIVIDE_TRIGGER_COUNT / 2) return true;

  return false;
};

// Modified to return coordinates only - reverse geocoding happens later in batch
async function runArcgisAddressPointsDiscovery({ boundingBox, center }) {
  // Re-check API key at runtime (in case it wasn't loaded at module load time)
  const apiKey = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || ARC_GIS_API_KEY || '';
  
  console.log('[MarketingDiscovery] ArcGIS Address Points Discovery called (coordinates only)', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey.length,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 20) + '...' : 'none',
    boundingBox,
    moduleLevelKey: !!ARC_GIS_API_KEY,
    processEnvKey: !!process.env.ARCGIS_API_KEY,
    appConfigKey: !!appConfig?.externalServices?.arcgis?.apiKey
  });
  
  if (!apiKey || apiKey.length === 0) {
    const errorMsg = 'ArcGIS API key not configured';
    console.error('[MarketingDiscovery]', errorMsg, {
      moduleLevel: !!ARC_GIS_API_KEY,
      processEnv: !!process.env.ARCGIS_API_KEY,
      appConfig: !!appConfig?.externalServices?.arcgis?.apiKey
    });
    return { coordinates: [], error: errorMsg };
  }

  if (!isValidBoundingBox(boundingBox)) {
    console.warn('[MarketingDiscovery] Invalid bounding box provided to ArcGIS discovery', boundingBox);
    return { coordinates: [], error: 'Invalid bounding box' };
  }

  try {
    const queue = [{ bbox: boundingBox, depth: 0 }];
    const uniqueCoordinates = [];
    const seenKeys = new Set();

    while (queue.length > 0) {
      const { bbox: currentBBox, depth } = queue.shift();
      if (!isValidBoundingBox(currentBBox)) {
        continue;
      }

      const requestCenter = center ?? computeBoundingBoxCenter(currentBBox);
      const spanMiles = computeBoundingBoxSpanMiles(currentBBox);

      // Use runtime API key (not module-level constant)
      const apiKey = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || ARC_GIS_API_KEY || '';
      const result = await fetchArcgisCandidatesForExtent({
        boundingBox: currentBBox,
        centerOverride: requestCenter,
        apiKey // Pass API key explicitly
      });

      // Extract coordinates instead of full addresses
      const coordinates = extractArcgisCoordinates(result.rawCandidates || []);
      
      // Deduplicate coordinates with validation
      for (const coord of coordinates) {
        if (!coord || coord.latitude === undefined || coord.longitude === undefined) {
          console.warn('[MarketingDiscovery] Skipping invalid ArcGIS coordinate:', coord);
          continue;
        }
        const latitude = toNumber(coord.latitude);
        const longitude = toNumber(coord.longitude);
        if (latitude === undefined || longitude === undefined) {
          console.warn('[MarketingDiscovery] Skipping invalid ArcGIS coordinate (non-numeric):', coord);
          continue;
        }
        const key = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueCoordinates.push({
            latitude,
            longitude,
            source: coord.source || 'arcgis_address_points',
            attributes: coord.attributes || {}
          });
        }
      }

      console.log('[MarketingDiscovery] ArcGIS address extent processed', {
        depth,
        spanMiles,
        candidateCount: result.candidateCount,
        coordinatesAdded: coordinates.length,
        exceededLimit: result.exceededLimit,
        bbox: currentBBox
      });

      if (
        shouldSubdivideArcgisExtent({
          spanMiles,
          depth,
          candidateCount: result.candidateCount,
          exceededLimit: result.exceededLimit
        })
      ) {
        const subdivisions = subdivideBoundingBox(currentBBox);
        subdivisions.forEach((subBBox) => queue.push({ bbox: subBBox, depth: depth + 1 }));
      }
    }

    if (uniqueCoordinates.length === 0) {
      console.log('[MarketingDiscovery] ArcGIS address points subdivisions yielded no results, falling back to grid sampler');
      const gridResult = await runArcgisGridSampler({
        boundingBox,
        spacingMeters: 40
      });
      // Grid sampler returns addresses, extract coordinates from them
      for (const addr of gridResult.addresses || []) {
        if (addr.latitude !== undefined && addr.longitude !== undefined) {
          const key = `${addr.latitude.toFixed(7)},${addr.longitude.toFixed(7)}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueCoordinates.push({
              latitude: addr.latitude,
              longitude: addr.longitude,
              source: 'arcgis_address_points'
            });
          }
        }
      }
    }

    return { coordinates: uniqueCoordinates };
  } catch (error) {
    const message = error?.message || (typeof error === 'string' ? error : 'Unknown ArcGIS address points error');
    console.warn('[MarketingDiscovery] ArcGIS address points error', message);
    return { coordinates: [], error: message };
  }
}

// Modified to return coordinates only - reverse geocoding happens later in batch
async function runArcgisPlacesDiscovery({ boundingBox, center }) {
  if (!ARC_GIS_API_KEY) {
    return { coordinates: [], error: 'ArcGIS API key not configured' };
  }

  try {
    const params = new URLSearchParams({
      f: 'json',
      outFields: 'Match_addr,PlaceName,Type,Address,City,Region,Postal',
      maxLocations: '120',
      searchExtent: `${boundingBox.west},${boundingBox.south},${boundingBox.east},${boundingBox.north}`,
      category: 'POI',
      forStorage: 'false'
    });

    if (center?.lon !== undefined && center?.lat !== undefined) {
      params.set('location', `${center.lon},${center.lat}`);
    }

    params.set('token', ARC_GIS_API_KEY);

    // Use axios with automatic retries instead of fetch
    const response = await httpClient.post(
      `${ARCGIS_GEOCODER_URL}/findAddressCandidates`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000 // 15 second timeout for ArcGIS places search
      }
    );

    const payload = response.data || {};
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];

    // Extract coordinates only
    const coordinates = candidates
      .map((candidate) => {
        const location = candidate?.location;
        const latitude = toNumber(location?.y);
        const longitude = toNumber(location?.x);
        if (latitude === undefined || longitude === undefined) {
          return null;
        }

        return {
          latitude,
          longitude,
          source: 'arcgis_places',
          attributes: candidate?.attributes || {} // Keep for potential later use
        };
      })
      .filter(Boolean);

    return { coordinates };
  } catch (error) {
    const message = error?.message || (typeof error === 'string' ? error : 'Unknown ArcGIS places error');
    console.warn('[MarketingDiscovery] ArcGIS places error', message);
    return { coordinates: [], error: message };
  }
}

// ============================================================================
// PLAN MANAGEMENT
// ============================================================================

// GET /plans - Get all plans for tenant
router.get('/', async (req, res) => {
  try {
    const { status, createdBy } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (status) query.status = status;
    if (createdBy) query.createdBy = createdBy;
    
    const plans = await PlanProject.find(query)
      .sort({ updatedAt: -1 })
      .lean();
    
    plans.forEach(plan => {
      if (!plan.stagedFeatureCounts) {
        plan.stagedFeatureCounts = { total: 0, byType: {}, byStatus: {} };
      }
    });

    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans', message: error.message });
  }
});

// GET /plans/:id/marketing/addresses - Get all marketing addresses for a plan
router.get('/:id/marketing/addresses', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).select('marketing.addresses').lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const addresses = plan.marketing?.addresses || [];
    console.log(`[plans] Returning ${addresses.length} marketing addresses for plan ${req.params.id}`);
    
    res.json({ addresses });
  } catch (error) {
    console.error('Error fetching marketing addresses:', error);
    res.status(500).json({ error: 'Failed to fetch marketing addresses', message: error.message });
  }
});

// GET /plans/:id - Get single plan
router.get('/:id', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    if (!plan.stagedFeatureCounts) {
      plan.stagedFeatureCounts = { total: 0, byType: {}, byStatus: {} };
    }
    
    res.json(plan);
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ error: 'Failed to fetch plan', message: error.message });
  }
});

// POST /plans - Create new plan
router.post('/', async (req, res) => {
  try {
    // Ensure createdBy is always set (required field)
    // Priority: req.body.createdBy (if truthy) > req.body.email > 'System'
    let createdBy = 'System'; // Default fallback
    
    if (req.body.createdBy && typeof req.body.createdBy === 'string' && req.body.createdBy.trim()) {
      createdBy = req.body.createdBy.trim();
    } else if (req.body.email && typeof req.body.email === 'string' && req.body.email.trim()) {
      createdBy = req.body.email.trim();
    }
    
    // Log for debugging
    console.log('[plans] Creating plan with createdBy:', createdBy, 'from req.body:', JSON.stringify({
      createdBy: req.body.createdBy,
      email: req.body.email,
      name: req.body.name
    }));
    
    const location = parseLocation(req.body.location);
    const marketing = parseMarketing(req.body.marketing);

    // Build planData WITHOUT spreading req.body first (to avoid overwriting createdBy)
    const planData = {
      name: req.body.name || 'New Plan',
      description: req.body.description || '',
      status: req.body.status || 'draft',
      showOnMap: req.body.showOnMap !== undefined ? req.body.showOnMap : false,
      tenantId: req.tenantId,
      createdBy: createdBy, // ALWAYS set this explicitly - never overwritten
      createdById: req.body.createdById || req.body.uid || null,
      scope: req.body.scope || {
        towers: [],
        sectors: [],
        cpeDevices: [],
        equipment: [],
        backhauls: []
      },
      hardwareRequirements: req.body.hardwareRequirements || {
        existing: [],
        needed: []
      },
      purchasePlan: req.body.purchasePlan || {
        totalEstimatedCost: 0,
        missingHardware: [],
        procurementStatus: 'pending'
      },
      deployment: req.body.deployment || {}
    };

    if (location === null) {
      planData.location = null;
    } else if (location !== undefined) {
      planData.location = location;
    }

    if (marketing === null) {
      planData.marketing = null;
    } else if (marketing !== undefined) {
      planData.marketing = {
        targetRadiusMiles: marketing.targetRadiusMiles ?? 5,
        ...marketing
      };
    }
    
    // Verify createdBy is set before validation
    if (!planData.createdBy || planData.createdBy.trim() === '') {
      planData.createdBy = 'System';
    }
    
    console.log('[plans] Final planData.createdBy:', planData.createdBy);
    
    const plan = new PlanProject(planData);
    await plan.save();
    
    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: 'Failed to create plan', message: error.message });
  }
});

// PUT /plans/:id - Update plan
router.put('/:id', async (req, res) => {
  try {
    // Find the plan first to check authorization
    const existingPlan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!existingPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Authorization check: Only allow updates if user created the plan or is admin
    // Get user email from request headers or body
    const userEmail = (req.user?.email || req.body.email || req.headers['x-user-email'] || '').trim();
    const normalizedCreator = (existingPlan.createdBy || '').trim();
    const isOwner = normalizedCreator && userEmail && normalizedCreator.toLowerCase() === userEmail.toLowerCase();
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'owner';

    const adoptableOwner = !normalizedCreator || ['system', 'auto', 'automated', 'unknown'].includes(normalizedCreator.toLowerCase());

    if (!isOwner && !isAdmin && !adoptableOwner) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You can only edit plans you created' 
      });
    }
     
    const parsedLocation = req.body.location !== undefined ? parseLocation(req.body.location) : undefined;
    const parsedMarketing = req.body.marketing !== undefined ? parseMarketing(req.body.marketing) : undefined;

    const locationUpdate =
      req.body.location !== undefined
        ? (parsedLocation === undefined ? existingPlan.location : parsedLocation)
        : existingPlan.location;

    const marketingUpdateRaw =
      req.body.marketing !== undefined
        ? (parsedMarketing === undefined ? existingPlan.marketing : parsedMarketing)
        : existingPlan.marketing;

    const marketingUpdate =
      marketingUpdateRaw && marketingUpdateRaw !== null
        ? {
            targetRadiusMiles:
              marketingUpdateRaw.targetRadiusMiles ??
              existingPlan.marketing?.targetRadiusMiles ??
              5,
            ...marketingUpdateRaw
          }
        : marketingUpdateRaw;

    const plan = await PlanProject.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { 
        name: req.body.name !== undefined ? req.body.name : existingPlan.name,
        description: req.body.description !== undefined ? req.body.description : existingPlan.description,
        status: req.body.status !== undefined ? req.body.status : existingPlan.status,
        showOnMap: req.body.showOnMap !== undefined ? req.body.showOnMap : existingPlan.showOnMap,
        scope: req.body.scope !== undefined ? req.body.scope : existingPlan.scope,
        hardwareRequirements: req.body.hardwareRequirements !== undefined ? req.body.hardwareRequirements : existingPlan.hardwareRequirements,
        purchasePlan: req.body.purchasePlan !== undefined ? req.body.purchasePlan : existingPlan.purchasePlan,
        deployment: req.body.deployment !== undefined ? req.body.deployment : existingPlan.deployment,
        location: locationUpdate,
        marketing: marketingUpdate,
        updatedAt: new Date(),
        updatedBy: userEmail || 'System',
        updatedById: req.user?.uid || req.body.uid || null,
        ...(adoptableOwner && userEmail ? { createdBy: userEmail, createdById: req.user?.uid || req.body.uid || null } : {})
      },
      { new: true, runValidators: true }
    );
    
    res.json(plan);
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan', message: error.message });
  }
});

// In-memory progress store (keyed by requestId)
const progressStore = new Map();

// GET /plans/:id/marketing/progress/:requestId - Get progress for a discovery request
router.get('/:id/marketing/progress/:requestId', (req, res) => {
  const { requestId } = req.params;
  const progress = progressStore.get(requestId);
  
  if (!progress) {
    return res.status(404).json({ error: 'Progress not found' });
  }
  
  res.json(progress);
});

// POST /plans/:id/marketing/discover - Find marketing addresses within area
router.post('/:id/marketing/discover', async (req, res) => {
  const requestStartTime = Date.now();
  const requestId = `${req.params?.id || 'unknown'}-${Date.now()}`;
  let timeoutCleanup = null;
  
  // Log immediately - before any try/catch or validation
  console.log('[MarketingDiscovery] ===== ENDPOINT HIT =====', {
    requestId,
    planId: req.params?.id,
    tenantId: req.tenantId || 'MISSING',
    method: req.method,
    url: req.url,
    hasBody: !!req.body,
    hasBoundingBox: !!req.body?.boundingBox,
    timestamp: new Date().toISOString(),
    headers: {
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    }
  });
  
  try {
    console.log('[MarketingDiscovery] Request received', {
      requestId,
      planId: req.params?.id,
      tenantId: req.tenantId,
      hasBoundingBox: !!req.body?.boundingBox,
      timestamp: new Date().toISOString()
    });
    
    // Validate request parameters
    if (!req.params?.id) {
      console.error('[MarketingDiscovery] Missing plan ID');
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    
    if (!req.tenantId) {
      console.error('[MarketingDiscovery] Missing tenant ID');
      return res.status(400).json({ error: 'Tenant ID is required' });
    }
    
    // Initialize progress
    try {
      progressStore.set(requestId, {
        requestId,
        planId: req.params.id,
        progress: 0,
        step: 'Initializing',
        startedAt: new Date().toISOString(),
        details: {}
      });
      
      // Clean up progress after 5 minutes (safety net)
      timeoutCleanup = setTimeout(() => {
        progressStore.delete(requestId);
        console.log('[MarketingDiscovery] Timeout cleanup for progress entry:', requestId);
      }, 5 * 60 * 1000);
      
      // Handle client abort
      req.on('close', () => {
        if (timeoutCleanup) clearTimeout(timeoutCleanup);
        progressStore.delete(requestId);
        console.log('[MarketingDiscovery] Client disconnected, cleaned up progress entry:', requestId);
      });
    } catch (progressError) {
      console.error('[MarketingDiscovery] Error initializing progress:', progressError);
      // Continue anyway - progress is optional
    }
  
    console.log('[MarketingDiscovery] Fetching plan from database...', {
      requestId,
      planId: req.params.id,
      tenantId: req.tenantId
    });
    
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });

    if (!plan) {
      if (timeoutCleanup) clearTimeout(timeoutCleanup);
      progressStore.delete(requestId);
      return res.status(404).json({ error: 'Plan not found' });
    }

    console.log('[MarketingDiscovery] Parsing bounding box...', {
      requestId,
      rawBoundingBox: req.body?.boundingBox
    });
    
    const boundingBox = parseBoundingBox(req.body?.boundingBox);
    if (!boundingBox || !isValidBoundingBox(boundingBox)) {
      console.error('[MarketingDiscovery] Invalid bounding box received:', req.body?.boundingBox, 'Parsed:', boundingBox);
      if (timeoutCleanup) clearTimeout(timeoutCleanup);
      try {
        progressStore.delete(requestId);
      } catch (e) {
        // Ignore cleanup errors
      }
      return res.status(400).json({
        error: 'Invalid bounding box',
        message: 'Provide boundingBox with numeric west, south, east, north values'
      });
    }

    console.log('[MarketingDiscovery] Received bounding box:', {
      west: boundingBox.west.toFixed(7),
      south: boundingBox.south.toFixed(7),
      east: boundingBox.east.toFixed(7),
      north: boundingBox.north.toFixed(7),
      rawInput: req.body.boundingBox,
      requestId,
      timestamp: new Date().toISOString()
    });
    
    // Calculate bounding box size for debugging
    const latSpan = Math.abs(boundingBox.north - boundingBox.south);
    const lonSpan = Math.abs(boundingBox.east - boundingBox.west);
    const centerLat = (boundingBox.north + boundingBox.south) / 2;
    const milesPerLat = 69.0;
    const milesPerLon = Math.cos((centerLat * Math.PI) / 180) * 69.172 || 69.172;
    const widthMiles = lonSpan * Math.abs(milesPerLon);
    const heightMiles = latSpan * milesPerLat;
    
    console.log('[MarketingDiscovery] Bounding box dimensions:', {
      latSpan: latSpan.toFixed(7),
      lonSpan: lonSpan.toFixed(7),
      widthMiles: widthMiles.toFixed(2),
      heightMiles: heightMiles.toFixed(2),
      centerLat: centerLat.toFixed(7),
      centerLon: ((boundingBox.east + boundingBox.west) / 2).toFixed(7),
      requestId
    });

    const radiusMiles =
      toNumber(req.body.radiusMiles ?? req.body.radius ?? plan.marketing?.targetRadiusMiles) ?? 5;

    const explicitCenter = parseCenter(req.body.center);
    const computedCenter = explicitCenter || (plan.location?.latitude !== undefined && plan.location?.longitude !== undefined
      ? { lat: plan.location.latitude, lon: plan.location.longitude }
      : {
          lat: (boundingBox.north + boundingBox.south) / 2,
          lon: (boundingBox.east + boundingBox.west) / 2
        });

    const advancedOptions = req.body?.options?.advancedOptions || {};
    const userAlgorithms = parseMarketingAlgorithms(req.body?.options?.algorithms);
    let algorithms = (userAlgorithms && userAlgorithms.length ? userAlgorithms : ['microsoft_footprints']).filter(Boolean);

    // Remove OSM from algorithms if present
    algorithms = algorithms.filter((id) => id !== 'osm_buildings');

    if (!ARC_GIS_API_KEY) {
      // Filter out ArcGIS-based algorithms but keep Microsoft Footprints
      const arcgisAlgorithms = ['arcgis_address_points', 'arcgis_places', 'arcgis_building_footprints'];
      const filtered = algorithms.filter((id) => 
        id === 'microsoft_footprints' || !arcgisAlgorithms.includes(id)
      );
      if (algorithms.length !== filtered.length) {
        console.warn('[MarketingDiscovery] ArcGIS API key missing. Skipping ArcGIS-based algorithms.');
      }
      algorithms = filtered;
    }

    if (!algorithms || algorithms.length === 0) {
      console.warn('[MarketingDiscovery] No valid algorithms selected, defaulting to Microsoft Footprints');
      algorithms = ['microsoft_footprints'];
    }

    console.log('[MarketingDiscovery] Algorithms selected:', {
      algorithms,
      hasArcGisKey: !!ARC_GIS_API_KEY,
      userAlgorithms: userAlgorithms
    });

    // Always deduplicate addresses within 25 meters (≈82 feet)
    const dedupDistanceMeters = 25;

    const algorithmStats = {};
    const combinedAddresses = [];
    const coordinateHashes = new Set();
    const addressHashes = new Set();
    const existingAddresses = Array.isArray(plan.marketing?.addresses)
      ? plan.marketing.addresses
      : [];
    const previousAddressCount = existingAddresses.length;
    const runTimestampIso = new Date().toISOString();
    const lastRunAtIso = plan.marketing?.lastRunAt ? new Date(plan.marketing.lastRunAt).toISOString() : null;
    const priorTotalRuns = Number.isFinite(Number(plan.marketing?.totalRuns))
      ? Number(plan.marketing.totalRuns)
      : 0;
    let newAddressesAdded = 0;
    let totalProgress = 0;
    let currentStep = '';

    const updateProgress = (step, progress, details = {}) => {
      currentStep = step;
      totalProgress = progress;
      const elapsed = Date.now() - requestStartTime;
      
      // Update progress store
      progressStore.set(requestId, {
        requestId,
        planId: req.params.id,
        progress: Math.round(progress),
        step,
        startedAt: new Date(requestStartTime).toISOString(),
        elapsed: elapsed,
        details: {
          ...details,
          elapsedMs: elapsed
        }
      });
      
      console.log(`[MarketingDiscovery] Progress [${Math.round(progress)}%] ${step}`, { 
        requestId,
        elapsed: `${elapsed}ms`,
        ...details 
      });
    };

    updateProgress('Initializing', 0);

    const addAddressToCombined = (address, algorithmId) => {
      const latitude = toNumber(address.latitude);
      const longitude = toNumber(address.longitude);
      if (latitude === undefined || longitude === undefined) return false;

      // Don't filter by bounding box - save ALL addresses found by the search services
      // The search services (OSM/ArcGIS) already filter by bounding box in their queries
      // Any addresses returned are valid and should be saved to the database
      // This allows all addresses to be saved for later management (save to system or delete)

      // Filter out addresses that only have street name (no house number)
      // BUT allow empty addressLine1 (we'll use coordinates as fallback)
      const workingAddress = { ...address };
      const addressLine1 = workingAddress.addressLine1 || '';
      if (addressLine1 && addressLine1.length > 0) {
        // Check if address starts with a number (valid house number)
        const startsWithNumber = /^\d/.test(addressLine1.trim());
        
        // If it doesn't start with a number and doesn't look like coordinates, skip it
        // Coordinates format: "lat, lon" like "40.1234, -74.5678"
        const looksLikeCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+/.test(addressLine1.trim());
        
        if (!startsWithNumber && !looksLikeCoordinates) {
          console.log('[MarketingDiscovery] Filtered street-only (no house number):', addressLine1);
          return false;
        }
      } else {
        // No address line, use coordinates as identifier (7 decimal places = ~1cm precision)
        workingAddress.addressLine1 = `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`;
      }

      const normalizedAddressKey = buildAddressHash(workingAddress);
      if (normalizedAddressKey && addressHashes.has(normalizedAddressKey)) {
        return false;
      }

      // Use 7 decimal places for coordinate keys (~1cm precision, good for building centroids)
      const coordinateKey = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
      if (coordinateHashes.has(coordinateKey)) {
        return false;
      }

      // Optimized distance check: only check against a sample of nearby addresses if there are many
      // This prevents O(n²) performance issues with large datasets
      const MAX_DISTANCE_CHECKS = 100;
      const addressesToCheck = combinedAddresses.length > MAX_DISTANCE_CHECKS
        ? combinedAddresses.slice(-MAX_DISTANCE_CHECKS) // Check most recently added
        : combinedAddresses;
      
      for (const existing of addressesToCheck) {
        if (distanceInMeters(latitude, longitude, existing.latitude, existing.longitude) <= dedupDistanceMeters) {
          return false;
        }
      }

      combinedAddresses.push({
        ...workingAddress,
        latitude,
        longitude,
        source: workingAddress.source || algorithmId,
        discoveredAt:
          workingAddress.discoveredAt && !Number.isNaN(new Date(workingAddress.discoveredAt).valueOf())
            ? new Date(workingAddress.discoveredAt).toISOString()
            : runTimestampIso
      });
      coordinateHashes.add(coordinateKey);
      if (normalizedAddressKey) {
        addressHashes.add(normalizedAddressKey);
      }
      newAddressesAdded += 1;
      return true;
    };

    const seedExistingAddresses = (addresses = []) => {
      const MAX_EXISTING_ADDRESSES = 10000; // Limit to prevent performance issues
      const addressesToSeed = addresses.slice(0, MAX_EXISTING_ADDRESSES);
      
      if (addresses.length > MAX_EXISTING_ADDRESSES) {
        console.warn(`[MarketingDiscovery] Limiting existing addresses from ${addresses.length} to ${MAX_EXISTING_ADDRESSES} for performance`);
      }
      
      let existingAddressesWithRealAddresses = 0;
      let existingAddressesSkippedAsDuplicates = 0;
      
      // Use a spatial grid to optimize distance checks for large datasets
      // Grid cell size ~50m to match dedupDistanceMeters
      const GRID_CELL_SIZE = 0.0005; // ~50m at equator
      const spatialGrid = new Map();
      
      const getGridKey = (lat, lon) => {
        const latCell = Math.floor(lat / GRID_CELL_SIZE);
        const lonCell = Math.floor(lon / GRID_CELL_SIZE);
        return `${latCell},${lonCell}`;
      };
      
      const getNearbyGridKeys = (lat, lon) => {
        const centerKey = getGridKey(lat, lon);
        const [latCell, lonCell] = centerKey.split(',').map(Number);
        const keys = [];
        // Check current cell and 8 surrounding cells
        for (let dLat = -1; dLat <= 1; dLat++) {
          for (let dLon = -1; dLon <= 1; dLon++) {
            keys.push(`${latCell + dLat},${lonCell + dLon}`);
          }
        }
        return keys;
      };
      
      for (const existing of addressesToSeed) {
        const latitude = toNumber(existing.latitude);
        const longitude = toNumber(existing.longitude);
        if (latitude === undefined || longitude === undefined) {
          continue;
        }

        const workingAddress = { ...existing };
        const addressLine1Str = workingAddress.addressLine1 ? String(workingAddress.addressLine1).trim() : '';
        
        // Check if addressLine1 is just coordinates (these are duplicates with less precision)
        // Skip these - they'll be replaced by new addresses with full precision and proper geocoding
        const isCoordinates = addressLine1Str.length > 0 && 
                             /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(addressLine1Str);
        
        // If existing address only has coordinates, skip it as a duplicate
        // The new discovery will replace it with properly geocoded addresses
        if (isCoordinates || !addressLine1Str) {
          // Mark coordinate as seen to prevent adding it as a duplicate later
          const coordinateKey = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
          if (!coordinateHashes.has(coordinateKey)) {
            coordinateHashes.add(coordinateKey);
          }
          existingAddressesSkippedAsDuplicates++;
          continue;
        }
        
        existingAddressesWithRealAddresses++;

        // Address has a real address (not just coordinates), so include it directly
        // Always include existing addresses with real addresses, regardless of current bounding box
        // This allows re-discover to merge addresses from multiple areas scanned

        const normalizedAddressKey = buildAddressHash(workingAddress);
        if (normalizedAddressKey && addressHashes.has(normalizedAddressKey)) {
          continue;
        }

        // Use 7 decimal places for coordinate keys in seed function too
        const coordinateKey = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
        if (coordinateHashes.has(coordinateKey)) {
          continue;
        }

        // Optimized distance check using spatial grid
        let duplicateWithinRadius = false;
        const nearbyKeys = getNearbyGridKeys(latitude, longitude);
        for (const key of nearbyKeys) {
          const candidates = spatialGrid.get(key) || [];
          for (const candidate of candidates) {
            if (distanceInMeters(latitude, longitude, candidate.latitude, candidate.longitude) <= dedupDistanceMeters) {
              duplicateWithinRadius = true;
              break;
            }
          }
          if (duplicateWithinRadius) break;
        }
        
        if (duplicateWithinRadius) {
          continue;
        }

        const discoveredAtSource =
          workingAddress.discoveredAt ||
          workingAddress.createdAt ||
          workingAddress.updatedAt ||
          lastRunAtIso;
        let discoveredAtIso = runTimestampIso;
        if (discoveredAtSource) {
          const parsed = new Date(discoveredAtSource);
          if (!Number.isNaN(parsed.valueOf())) {
            discoveredAtIso = parsed.toISOString();
          }
        }

        const seededAddress = {
          ...workingAddress,
          latitude,
          longitude,
          source: workingAddress.source || 'existing',
          discoveredAt: discoveredAtIso
        };
        
        combinedAddresses.push(seededAddress);
        coordinateHashes.add(coordinateKey);
        if (normalizedAddressKey) {
          addressHashes.add(normalizedAddressKey);
        }
        
        // Add to spatial grid for future distance checks
        const gridKey = getGridKey(latitude, longitude);
        if (!spatialGrid.has(gridKey)) {
          spatialGrid.set(gridKey, []);
        }
        spatialGrid.get(gridKey).push(seededAddress);
      }
      
      console.log(`[MarketingDiscovery] Seeded existing addresses`, {
        totalInput: addressesToSeed.length,
        withRealAddresses: existingAddressesWithRealAddresses,
        skippedAsCoordinateDuplicates: existingAddressesSkippedAsDuplicates,
        addedToCombined: combinedAddresses.length
      });
    };

    seedExistingAddresses(existingAddresses);

    if (previousAddressCount > 0) {
      console.log('[MarketingDiscovery] Seeded existing marketing addresses', {
        previousAddressCount,
        dedupedSeedCount: combinedAddresses.length
      });
    }

    const recordAlgorithmStats = (algorithmId, produced, geocoded, errorMessage) => {
      algorithmStats[algorithmId] = {
        produced: (algorithmStats[algorithmId]?.produced || 0) + produced,
        geocoded: (algorithmStats[algorithmId]?.geocoded || 0) + geocoded
      };
      if (errorMessage) {
        algorithmStats[algorithmId].error = errorMessage;
      }
    };

    // NEW APPROACH: Collect all coordinates first, then batch reverse geocode
    // Progress allocation: Coordinate collection 10-60%, Reverse geocoding 60-90%
    const allCoordinates = [];
    const coordinateKeys = new Set(); // For deduplication

    // Step 1: Collect coordinates from Microsoft Building Footprints (if enabled)
    if (algorithms.includes('microsoft_footprints')) {
      try {
        updateProgress('Running Microsoft Building Footprints lookup', 10);
        console.log('[MarketingDiscovery] Running Microsoft Building Footprints discovery algorithm (coordinates only)');
        console.log('[MarketingDiscovery] Calling runMicrosoftBuildingFootprintsDiscovery with bounding box:', {
          west: boundingBox.west.toFixed(7),
          south: boundingBox.south.toFixed(7),
          east: boundingBox.east.toFixed(7),
          north: boundingBox.north.toFixed(7)
        });
        
        const microsoftResult = await runMicrosoftBuildingFootprintsDiscovery({
          boundingBox,
          progressCallback: (step, progress, details) => {
            updateProgress(`Microsoft: ${step}`, 10 + (progress * 5 * 0.01), details);
          }
        });
        
        if (Array.isArray(microsoftResult.coordinates)) {
          let addedCount = 0;
          let duplicateCount = 0;
          for (const coord of microsoftResult.coordinates) {
            const latitude = toNumber(coord?.latitude);
            const longitude = toNumber(coord?.longitude);
            if (latitude === undefined || longitude === undefined) {
              console.warn('[MarketingDiscovery] Skipping invalid Microsoft coordinate:', coord);
              continue;
            }
            const key = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
            if (!coordinateKeys.has(key)) {
              coordinateKeys.add(key);
              allCoordinates.push({
                latitude,
                longitude,
                source: coord.source || 'microsoft_footprints',
                properties: coord.properties || {}
              });
              addedCount++;
            } else {
              duplicateCount++;
            }
          }
          console.log('[MarketingDiscovery] Microsoft Footprints coordinates collected', {
            totalFound: microsoftResult.coordinates.length,
            addedToAllCoordinates: addedCount,
            duplicatesSkipped: duplicateCount,
            totalCoordinatesNow: allCoordinates.length,
            sampleCoordinate: microsoftResult.coordinates[0] ? {
              latitude: microsoftResult.coordinates[0].latitude,
              longitude: microsoftResult.coordinates[0].longitude,
              source: microsoftResult.coordinates[0].source
            } : null
          });
        } else {
          console.warn('[MarketingDiscovery] Microsoft Footprints returned non-array coordinates:', {
            type: typeof microsoftResult.coordinates,
            isArray: Array.isArray(microsoftResult.coordinates),
            value: microsoftResult.coordinates
          });
        }

        updateProgress('Microsoft Building Footprints lookup completed', 15, { 
          coordinates: microsoftResult.coordinates?.length || 0,
          totalCoordinates: allCoordinates.length,
          error: microsoftResult.error 
        });
        console.log('[MarketingDiscovery] Microsoft Building Footprints algorithm completed', { 
          coordinates: microsoftResult.coordinates?.length || 0,
          totalCoordinates: allCoordinates.length,
          error: microsoftResult.error 
        });

        recordAlgorithmStats('microsoft_footprints', microsoftResult.coordinates?.length || 0, 0, microsoftResult.error);
      } catch (err) {
        updateProgress('Microsoft Building Footprints lookup failed', 15, { error: err.message });
        console.error('[MarketingDiscovery] Microsoft Building Footprints Discovery failed:', err);
        recordAlgorithmStats('microsoft_footprints', 0, 0, err.message || 'Unknown error');
      }
    }

    // OSM buildings removed - using Microsoft Footprints only

    // Step 2: Collect coordinates from ArcGIS address points
    // Check API key at runtime (not just module-level constant)
    const runtimeApiKey = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || ARC_GIS_API_KEY || '';
    if (algorithms.includes('arcgis_address_points') && runtimeApiKey) {
      try {
        console.log('[MarketingDiscovery] Starting ArcGIS address points discovery (coordinates only)', {
          boundingBox,
          center: computedCenter,
          hasApiKey: !!runtimeApiKey,
          apiKeyLength: runtimeApiKey.length,
          apiKeyPrefix: runtimeApiKey ? runtimeApiKey.substring(0, 20) + '...' : 'none'
        });
        updateProgress('Running ArcGIS address points lookup', 40);
        const arcgisResult = await runArcgisAddressPointsDiscovery({
          boundingBox,
          center: computedCenter,
          radiusMiles
        });
        
        if (Array.isArray(arcgisResult.coordinates)) {
          for (const coord of arcgisResult.coordinates) {
            const latitude = toNumber(coord?.latitude);
            const longitude = toNumber(coord?.longitude);
            if (latitude === undefined || longitude === undefined) {
              console.warn('[MarketingDiscovery] Skipping invalid ArcGIS address point coordinate:', coord);
              continue;
            }
            const key = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
            if (!coordinateKeys.has(key)) {
              coordinateKeys.add(key);
              allCoordinates.push({
                latitude,
                longitude,
                source: coord.source || 'arcgis_address_points',
                attributes: coord.attributes || {}
              });
            }
          }
        }

        updateProgress('ArcGIS address points lookup completed', 50, { 
          coordinates: arcgisResult.coordinates?.length || 0,
          totalCoordinates: allCoordinates.length,
          error: arcgisResult.error 
        });
        console.log('[MarketingDiscovery] ArcGIS address points completed', {
          coordinates: arcgisResult.coordinates?.length || 0,
          totalCoordinates: allCoordinates.length
        });

        recordAlgorithmStats('arcgis_address_points', arcgisResult.coordinates?.length || 0, 0, arcgisResult.error);
      } catch (err) {
        updateProgress('ArcGIS address points failed', 50, { error: err.message });
        console.error('[MarketingDiscovery] ArcGIS Address Points Discovery failed:', err);
        recordAlgorithmStats('arcgis_address_points', 0, 0, err.message || 'Unknown error');
      }
    }

    // Step 3: Collect coordinates from ArcGIS Building Footprints Feature Service (if enabled)
    if (algorithms.includes('arcgis_building_footprints')) {
      try {
        // Check if custom service URL is configured - skip if not configured
        // The default "world" service doesn't exist, so we need a custom service URL
        const customServiceUrl = 
          appConfig?.externalServices?.arcgis?.buildingFootprintsServiceUrl ||
          process.env.ARCGIS_BUILDING_FOOTPRINTS_SERVICE_URL ||
          null;
        
        if (!customServiceUrl) {
          // If arcgis_building_footprints is the ONLY selected algorithm and no service URL is configured,
          // return an error immediately instead of silently skipping
          if (algorithms.length === 1 && algorithms[0] === 'arcgis_building_footprints') {
            const errorMsg = 'ArcGIS Building Footprints requires a custom service URL. Configure ARCGIS_BUILDING_FOOTPRINTS_SERVICE_URL or select a different algorithm like arcgis_address_points or microsoft_footprints.';
            console.error('[MarketingDiscovery]', errorMsg);
            updateProgress('ArcGIS Building Footprints failed (no service URL)', 50);
            recordAlgorithmStats('arcgis_building_footprints', 0, 0, errorMsg);
            throw new Error(errorMsg);
          }
          // Otherwise, just skip it if other algorithms are also selected
          console.warn('[MarketingDiscovery] ArcGIS Building Footprints skipped - no custom service URL configured. Use ARCGIS_BUILDING_FOOTPRINTS_SERVICE_URL or microsoft_footprints instead.');
          updateProgress('ArcGIS Building Footprints skipped (no service URL)', 50);
          recordAlgorithmStats('arcgis_building_footprints', 0, 0, 'No custom service URL configured');
        } else {
          updateProgress('Running ArcGIS Building Footprints lookup', 50);
          console.log('[MarketingDiscovery] Running ArcGIS Building Footprints Feature Service discovery', {
            customServiceUrl
          });
          
          const arcgisFootprintsResult = await arcgisBuildingFootprintsService.queryBuildingFootprintsByBoundingBox(
            boundingBox,
            {
              serviceUrls: [customServiceUrl], // Use only the custom service
              layerIds: [0], // Default to layer 0
              requiresAuth: !!ARC_GIS_API_KEY // Require auth if API key is configured
            }
          );
          
          if (Array.isArray(arcgisFootprintsResult.coordinates)) {
            for (const coord of arcgisFootprintsResult.coordinates) {
              const latitude = toNumber(coord?.latitude);
              const longitude = toNumber(coord?.longitude);
              if (latitude === undefined || longitude === undefined) {
                console.warn('[MarketingDiscovery] Skipping invalid ArcGIS building footprint coordinate:', coord);
                continue;
              }
              const key = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
              if (!coordinateKeys.has(key)) {
                coordinateKeys.add(key);
                allCoordinates.push({
                  latitude,
                  longitude,
                  source: coord.source || 'arcgis_building_footprints',
                  attributes: coord.attributes || {}
                });
              }
            }
          }

          updateProgress('ArcGIS Building Footprints lookup completed', 52, { 
            coordinates: arcgisFootprintsResult.coordinates?.length || 0,
            totalCoordinates: allCoordinates.length,
            error: arcgisFootprintsResult.error 
          });
          console.log('[MarketingDiscovery] ArcGIS Building Footprints completed', {
            coordinates: arcgisFootprintsResult.coordinates?.length || 0,
            totalCoordinates: allCoordinates.length
          });

          recordAlgorithmStats('arcgis_building_footprints', arcgisFootprintsResult.coordinates?.length || 0, 0, arcgisFootprintsResult.error);
        }
      } catch (err) {
        updateProgress('ArcGIS Building Footprints failed', 52, { error: err.message });
        console.error('[MarketingDiscovery] ArcGIS Building Footprints Discovery failed:', err);
        recordAlgorithmStats('arcgis_building_footprints', 0, 0, err.message || 'Unknown error');
      }
    }

    // Step 4: Collect coordinates from ArcGIS places
    if (algorithms.includes('arcgis_places') && ARC_GIS_API_KEY) {
      try {
        updateProgress('Running ArcGIS places lookup', 50);
        const arcgisPlacesResult = await runArcgisPlacesDiscovery({
          boundingBox,
          center: computedCenter,
          radiusMiles
        });
        
        if (Array.isArray(arcgisPlacesResult.coordinates)) {
          for (const coord of arcgisPlacesResult.coordinates) {
            const latitude = toNumber(coord?.latitude);
            const longitude = toNumber(coord?.longitude);
            if (latitude === undefined || longitude === undefined) {
              console.warn('[MarketingDiscovery] Skipping invalid ArcGIS places coordinate:', coord);
              continue;
            }
            const key = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
            if (!coordinateKeys.has(key)) {
              coordinateKeys.add(key);
              allCoordinates.push({
                latitude,
                longitude,
                source: coord.source || 'arcgis_places',
                attributes: coord.attributes || {}
              });
            }
          }
        }

        updateProgress('ArcGIS places lookup completed', 55, { 
          coordinates: arcgisPlacesResult.coordinates?.length || 0,
          totalCoordinates: allCoordinates.length,
          error: arcgisPlacesResult.error 
        });
        console.log('[MarketingDiscovery] ArcGIS places completed', {
          coordinates: arcgisPlacesResult.coordinates?.length || 0,
          totalCoordinates: allCoordinates.length
        });

        recordAlgorithmStats('arcgis_places', arcgisPlacesResult.coordinates?.length || 0, 0, arcgisPlacesResult.error);
      } catch (err) {
        updateProgress('ArcGIS places failed', 55, { error: err.message });
        console.error('[MarketingDiscovery] ArcGIS Places Discovery failed:', err);
        recordAlgorithmStats('arcgis_places', 0, 0, err.message || 'Unknown error');
      }
    }

    // Step 4: Batch reverse geocode all coordinates
    console.log('[MarketingDiscovery] Starting batch reverse geocoding', {
      totalCoordinates: allCoordinates.length,
      algorithms: algorithms,
      coordinateSources: allCoordinates.length > 0 ? allCoordinates.reduce((acc, coord) => {
        if (coord && coord.source) {
          acc[coord.source] = (acc[coord.source] || 0) + 1;
        }
        return acc;
      }, {}) : {}
    });

    let reverseGeocodeResult = { addresses: [], geocoded: 0, failed: 0 };
    
    if (allCoordinates.length === 0) {
      console.warn('[MarketingDiscovery] No coordinates collected from any algorithm. Algorithms selected:', algorithms);
      updateProgress('No coordinates found to reverse geocode', 60, { 
        algorithms: algorithms,
        warning: 'No coordinates were collected from the selected algorithms'
      });
      // Continue to save results (empty set)
    } else {
      updateProgress('Reverse geocoding all coordinates', 60, {
        totalCoordinates: allCoordinates.length
      });
      
      try {
        reverseGeocodeResult = await batchReverseGeocodeCoordinates(allCoordinates, (step, progress, details) => {
          if (typeof progress === 'number' && !isNaN(progress)) {
            updateProgress(`Reverse geocoding: ${step}`, 60 + (progress * 30 * 0.01), details);
          } else {
            updateProgress(`Reverse geocoding: ${step}`, 60, details);
          }
        });
      } catch (error) {
        console.error('[MarketingDiscovery] Batch reverse geocoding failed:', {
          error: error?.message || error,
          stack: error?.stack,
          totalCoordinates: allCoordinates.length
        });
        updateProgress('Reverse geocoding failed', 75, { error: error?.message || 'Unknown error' });
        // Set error but continue - return empty addresses
        reverseGeocodeResult = { 
          addresses: [], 
          geocoded: 0, 
          failed: allCoordinates.length,
          error: error?.message || 'Unknown error during reverse geocoding'
        };
      }
    }

    // Add all reverse geocoded addresses to combined addresses
    // Filter out only arcgis_places (explicitly POI/businesses) - don't filter other sources
    const addressesAddedBySource = {};
    if (reverseGeocodeResult && Array.isArray(reverseGeocodeResult.addresses)) {
      for (const address of reverseGeocodeResult.addresses) {
        if (!address || address.latitude === undefined || address.longitude === undefined) {
          continue;
        }
        
        // Skip only arcgis_places - they're businesses/POI by definition
        // Don't filter other sources - let them through (they were already filtered at source if needed)
        if (address.source === 'arcgis_places') {
          continue;
        }
        
        const source = address.source || 'unknown';
        const wasAdded = addAddressToCombined(address, source);
        if (wasAdded) {
          addressesAddedBySource[source] = (addressesAddedBySource[source] || 0) + 1;
        }
      }
      
      console.log('[MarketingDiscovery] Reverse geocoded addresses added to combined', {
        totalAddresses: reverseGeocodeResult.addresses.length,
        addressesAddedBySource: addressesAddedBySource,
        hasMicrosoftFootprints: addressesAddedBySource['microsoft_footprints'] > 0
      });
    } else {
      console.warn('[MarketingDiscovery] No reverse geocoded addresses to add', {
        hasResult: !!reverseGeocodeResult,
        isArray: Array.isArray(reverseGeocodeResult?.addresses),
        addressCount: reverseGeocodeResult?.addresses?.length || 0
      });
    }

    updateProgress('Reverse geocoding completed', 90, {
      totalCoordinates: allCoordinates.length,
      geocoded: reverseGeocodeResult?.geocoded || 0,
      failed: reverseGeocodeResult?.failed || 0,
      error: reverseGeocodeResult?.error
    });

    // Update algorithm stats with geocoding results - count geocoded per source
    if (reverseGeocodeResult && Array.isArray(reverseGeocodeResult.addresses)) {
      const geocodedBySource = {};
      for (const address of reverseGeocodeResult.addresses) {
        if (address && address.addressLine1 && !address.addressLine1.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
          // Only count as geocoded if it's not just coordinates
          const source = address.source || 'unknown';
          geocodedBySource[source] = (geocodedBySource[source] || 0) + 1;
        }
      }
      
      // Update algorithm stats
      if (algorithmStats['microsoft_footprints']) {
        algorithmStats['microsoft_footprints'].geocoded = geocodedBySource['microsoft_footprints'] || 0;
      }
      if (algorithmStats['arcgis_address_points']) {
        algorithmStats['arcgis_address_points'].geocoded = geocodedBySource['arcgis_address_points'] || 0;
      }
      if (algorithmStats['arcgis_building_footprints']) {
        algorithmStats['arcgis_building_footprints'].geocoded = geocodedBySource['arcgis_building_footprints'] || 0;
      }
      if (algorithmStats['arcgis_places']) {
        algorithmStats['arcgis_places'].geocoded = geocodedBySource['arcgis_places'] || 0;
      }
    }

    // Don't filter existing addresses - only new addresses were already filtered in addAddressToCombined
    // This allows re-discover to merge addresses from multiple areas scanned
    // New addresses are already checked against bounding box at line 1840 in addAddressToCombined

    const totalUniqueAddresses = combinedAddresses.length;
    const totalRuns = priorTotalRuns + 1;
    updateProgress('Deduplicating addresses', 85, {
      totalAddresses: totalUniqueAddresses,
      newlyAdded: newAddressesAdded,
      previousCount: previousAddressCount
    });
    const geocodedCount = combinedAddresses.filter((addr) => !!addr.addressLine1).length;
    
    console.log('[MarketingDiscovery] Final combined addresses', {
      totalAddresses: totalUniqueAddresses,
      withAddressLine1: geocodedCount,
      newlyAdded: newAddressesAdded,
      previousAddressCount,
      totalRuns,
      sampleAddresses: combinedAddresses.slice(0, 5).map(a => ({ 
        addressLine1: a.addressLine1, 
        source: a.source,
        lat: a.latitude,
        lon: a.longitude
      })),
      algorithmStats,
      // Log address count by source for debugging
      addressCountBySource: combinedAddresses.reduce((acc, addr) => {
        const source = addr.source || 'unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {})
    });

    updateProgress('Saving results to database', 90, {
      totalAddresses: totalUniqueAddresses,
      newlyAdded: newAddressesAdded
    });

    const previousMarketing =
      plan.marketing && typeof plan.marketing.toObject === 'function'
        ? plan.marketing.toObject()
        : plan.marketing || {};
    const existingHistory = Array.isArray(previousMarketing.runHistory) ? previousMarketing.runHistory : [];
    const runHistoryEntry = {
      runAt: new Date(runTimestampIso),
      boundingBox,
      center: computedCenter,
      newAddresses: newAddressesAdded,
      totalAddresses: totalUniqueAddresses,
      algorithms
    };
    const runHistory = [runHistoryEntry, ...existingHistory].slice(0, 20);

    const marketingUpdate = {
      ...previousMarketing,
      targetRadiusMiles: radiusMiles,
      lastRunAt: new Date(runTimestampIso),
      lastResultCount: totalUniqueAddresses,
      lastBoundingBox: boundingBox,
      lastCenter: computedCenter,
      algorithms,
      algorithmStats,
      addresses: combinedAddresses,
      totalUniqueAddresses,
      totalRuns,
      lastRunNewAddresses: newAddressesAdded,
      runHistory
    };

    const updateResult = await PlanProject.updateOne(
      { _id: plan._id, tenantId: req.tenantId },
      {
        $set: {
          marketing: marketingUpdate,
          updatedAt: new Date(),
          updatedBy: req.user?.email || plan.updatedBy || 'System',
          updatedById: req.user?.uid || plan.updatedById || null
        }
      }
    );
    
    console.log('[MarketingDiscovery] Database update result', {
      planId: plan._id.toString(),
      matched: updateResult.matchedCount,
      modified: updateResult.modifiedCount,
      addressesSaved: totalUniqueAddresses,
      addressesInUpdate: combinedAddresses.length,
      newlyAdded: newAddressesAdded,
      previousAddressCount,
      totalRuns,
      // Verify all addresses are in the update object
      addressesCountCheck: marketingUpdate.addresses?.length === combinedAddresses.length
    });
    
    // Verify addresses were saved correctly (non-blocking - don't fail if verification fails)
    if (updateResult.modifiedCount > 0) {
      try {
        const savedPlan = await PlanProject.findById(plan._id).select('marketing.addresses').lean();
        const savedAddressCount = savedPlan?.marketing?.addresses?.length || 0;
        console.log('[MarketingDiscovery] Verification - addresses in database after save', {
          planId: plan._id.toString(),
          savedAddressCount,
          expectedCount: totalUniqueAddresses,
          match: savedAddressCount === totalUniqueAddresses
        });
        
        if (savedAddressCount !== totalUniqueAddresses) {
          console.error('[MarketingDiscovery] WARNING: Address count mismatch!', {
            expected: totalUniqueAddresses,
            actual: savedAddressCount,
            difference: totalUniqueAddresses - savedAddressCount
          });
        }
      } catch (verifyError) {
        // Don't fail the request if verification fails - just log it
        console.warn('[MarketingDiscovery] Verification query failed (non-critical):', verifyError?.message);
      }
    }

    const requestDuration = Date.now() - requestStartTime;
    updateProgress('Request completed', 100, { 
      totalAddresses: totalUniqueAddresses,
      geocodedCount,
      newlyAdded: newAddressesAdded
    });
    console.log('[MarketingDiscovery] Request completed successfully', { 
      requestId,
      duration: `${requestDuration}ms`,
      totalAddresses: totalUniqueAddresses,
      geocodedCount,
      newlyAdded: newAddressesAdded,
      totalRuns
    });
    
    // Mark progress as complete
    progressStore.set(requestId, {
      ...progressStore.get(requestId),
      progress: 100,
      step: 'Completed',
      completed: true,
      completedAt: new Date().toISOString(),
      result: {
        totalAddresses: totalUniqueAddresses,
        geocodedCount,
        newlyAdded: newAddressesAdded
      }
    });
    
    if (!res.headersSent) {
      // Limit response size to avoid Node.js JSON.stringify "Invalid string length" error
      // Reduced to 2000 to prevent proxy timeout issues with large responses
      const MAX_RESPONSE_ADDRESSES = 2000;
      const addressesToReturn = combinedAddresses.length > MAX_RESPONSE_ADDRESSES
        ? combinedAddresses.slice(0, MAX_RESPONSE_ADDRESSES)
        : combinedAddresses;
      
      if (combinedAddresses.length > MAX_RESPONSE_ADDRESSES) {
        console.log(`[MarketingDiscovery] Limiting response addresses from ${combinedAddresses.length} to ${MAX_RESPONSE_ADDRESSES} to prevent response size issues`);
      }
      
      // Strip down address objects to minimal essential fields for response (reduce JSON size)
      const strippedAddresses = addressesToReturn.map(addr => ({
        a1: addr.addressLine1, // Shortened field names to reduce JSON size
        c: addr.city,
        s: addr.state,
        z: addr.postalCode,
        lat: addr.latitude,
        lon: addr.longitude,
        src: addr.source
        // Omit addressLine2, country, discoveredAt and other non-essential fields
      }));
      
      // Strip down algorithmStats to just counts (remove error messages that could be large)
      const strippedAlgorithmStats = {};
      for (const [key, value] of Object.entries(algorithmStats || {})) {
        strippedAlgorithmStats[key] = {
          produced: value.produced || 0,
          geocoded: value.geocoded || 0
          // Omit error messages to reduce size
        };
      }
      
      try {
        res.json({
          summary: {
            total: totalUniqueAddresses,
            geocoded: geocodedCount,
            new: newAddressesAdded,
            prev: previousAddressCount,
            runs: totalRuns,
            truncated: combinedAddresses.length > MAX_RESPONSE_ADDRESSES,
            shown: strippedAddresses.length
          },
          addresses: strippedAddresses,
          algorithms: algorithms,
          stats: strippedAlgorithmStats,
          requestId
        });
      } catch (jsonError) {
        if (jsonError.message && jsonError.message.includes('Invalid string length')) {
          console.error('[MarketingDiscovery] JSON response too large even after limiting. Sending minimal response.');
          // Try with even fewer addresses and minimal fields
          const minimalAddresses = combinedAddresses.slice(0, 50).map(addr => ({
            a1: addr.addressLine1,
            lat: addr.latitude,
            lon: addr.longitude
          }));
          
          res.json({
            total: totalUniqueAddresses,
            shown: minimalAddresses.length,
            truncated: true,
            addresses: minimalAddresses,
            note: `Showing first 50 of ${totalUniqueAddresses} addresses. All saved to database.`,
            requestId
          });
        } else {
          throw jsonError; // Re-throw if it's a different error
        }
      }
      
      // Clean up progress entry after successful response (but keep for 30 seconds for progress polling)
      clearTimeout(timeoutCleanup);
      setTimeout(() => {
        progressStore.delete(requestId);
        console.log('[MarketingDiscovery] Cleaned up progress entry:', requestId, 'Store size:', progressStore.size);
      }, 30000); // Keep for 30 seconds after completion for progress polling
    } else {
      console.warn('[MarketingDiscovery] Response already sent, skipping duplicate response');
      // Still clean up even if response was already sent
      clearTimeout(timeoutCleanup);
      setTimeout(() => {
        progressStore.delete(requestId);
        console.log('[MarketingDiscovery] Cleaned up progress entry (response already sent):', requestId);
      }, 30000);
    }
  } catch (error) {
    const requestDuration = Date.now() - requestStartTime;
    
    // Only update progress if we haven't already sent a response
    // Note: updateProgress may not be defined if error occurs before it's initialized
    if (!res.headersSent) {
      try {
        if (typeof updateProgress === 'function') {
          updateProgress('Request failed', 0, { error: error.message });
        } else {
          // Update progress store directly if updateProgress function isn't available
          const existingProgress = progressStore.get(requestId);
          if (existingProgress) {
            progressStore.set(requestId, {
              ...existingProgress,
              progress: 0,
              step: 'Failed',
              details: { error: error.message }
            });
          }
        }
      } catch (updateError) {
        console.error('[MarketingDiscovery] Failed to update progress on error:', updateError);
      }
    }
    
    // Mark progress as failed
    try {
      progressStore.set(requestId, {
        ...progressStore.get(requestId),
        progress: 0,
        step: 'Failed',
        completed: true,
        failed: true,
        error: error.message,
        errorType: error.constructor.name,
        completedAt: new Date().toISOString()
      });
    } catch (storeError) {
      console.error('[MarketingDiscovery] Failed to update progress store on error:', storeError);
    }
    
    console.error('[MarketingDiscovery] Error discovering marketing addresses:', {
      requestId,
      error: error.message,
      errorType: error.constructor.name,
      stack: error.stack,
      duration: `${requestDuration}ms`,
      progressStoreSize: progressStore.size
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to discover marketing addresses',
        message: error.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        requestId
      });
      
      // Clean up progress entry after error response
      clearTimeout(timeoutCleanup);
      setTimeout(() => {
        progressStore.delete(requestId);
        console.log('[MarketingDiscovery] Cleaned up failed progress entry:', requestId, 'Store size:', progressStore.size, 'Error:', error.message);
      }, 30000); // Keep for 30 seconds for debugging
    } else {
      console.warn('[MarketingDiscovery] Response already sent, skipping error response');
      // Still clean up even if response was already sent
      clearTimeout(timeoutCleanup);
      setTimeout(() => {
        progressStore.delete(requestId);
        console.log('[MarketingDiscovery] Cleaned up failed progress entry (response already sent):', requestId);
      }, 30000);
    }
  }
});

// PUT /plans/:id/toggle-visibility - Toggle plan visibility on map
router.put('/:id/toggle-visibility', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    plan.showOnMap = !plan.showOnMap;
    plan.updatedAt = new Date();
    await plan.save();
    
    res.json({ 
      plan,
      message: plan.showOnMap ? 'Plan is now visible on map' : 'Plan is now hidden on map'
    });
  } catch (error) {
    console.error('Error toggling plan visibility:', error);
    res.status(500).json({ error: 'Failed to toggle plan visibility', message: error.message });
  }
});

// POST /plans/:id/approve - Approve plan for deployment
router.post('/:id/approve', async (req, res) => {
  try {
    const { notes } = req.body;
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    if (plan.status !== 'ready') {
      return res.status(400).json({ error: 'Plan must be in "ready" status to approve' });
    }
    
    plan.status = 'approved';
    plan.approval = {
      approvedBy: req.user?.email || req.user?.name || 'System',
      approvedAt: new Date(),
      approvalNotes: notes || ''
    };
    plan.updatedAt = new Date();
    await plan.save();

    let marketingLeadSummary = { created: 0, updated: 0, skipped: 0 };
    try {
      marketingLeadSummary = await createMarketingLeadsForPlan(
        plan,
        req.tenantId,
        req.user?.email || req.user?.name || 'System'
      );
      console.log('Marketing leads synced for plan approval:', {
        planId: plan._id?.toString?.() ?? plan.id,
        ...marketingLeadSummary
      });
    } catch (leadError) {
      console.error('Failed to sync marketing leads during plan approval:', leadError);
    }
    
    // Create notifications for field techs
    try {
      await createProjectApprovalNotification(
        plan._id.toString(),
        plan.name,
        req.tenantId,
        plan.approval.approvedBy
      );
    } catch (notifError) {
      console.error('Failed to create notifications (non-blocking):', notifError);
      // Don't fail the approval if notifications fail
    }
    
    res.json({ plan, message: 'Plan approved for deployment', marketingLeads: marketingLeadSummary });
  } catch (error) {
    console.error('Error approving plan:', error);
    res.status(500).json({ error: 'Failed to approve plan', message: error.message });
  }
});

// POST /plans/:id/reject - Reject plan with reason
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason, notes } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    if (plan.status !== 'ready' && plan.status !== 'approved') {
      return res.status(400).json({ error: 'Plan must be in "ready" or "approved" status to reject' });
    }
    
    plan.status = 'rejected';
    plan.approval = {
      rejectedBy: req.user?.email || req.user?.name || 'System',
      rejectedAt: new Date(),
      rejectionReason: reason,
      approvalNotes: notes || ''
    };
    plan.updatedAt = new Date();
    await plan.save();
    
    res.json({ plan, message: 'Plan rejected' });
  } catch (error) {
    console.error('Error rejecting plan:', error);
    res.status(500).json({ error: 'Failed to reject plan', message: error.message });
  }
});

// POST /plans/:id/authorize - Promote plan-layer assets to production
router.post('/:id/authorize', async (req, res) => {
  const session = await mongoose.startSession();
  let updatedPlan;
  let promotionResults = [];

  try {
    const { notes } = req.body;
    const existingPlan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();

    if (!existingPlan) {
      await session.endSession();
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (existingPlan.status !== 'approved') {
      await session.endSession();
      return res.status(400).json({ error: 'Plan must be approved before authorization' });
    }

    await session.withTransaction(async () => {
      const planDoc = await PlanProject.findOne({
        _id: req.params.id,
        tenantId: req.tenantId
      }).session(session);

      if (!planDoc) {
        throw new Error('plan_missing');
      }

      const planId = planDoc._id.toString();
      const timestamp = new Date();

      promotionResults = await promotePlanLayerFeatures(planDoc, req.tenantId, req.user, session);

      const updatePayload = {
        planId: null,
        status: 'active',
        originPlanId: planId,
        updatedAt: timestamp
      };

      await Promise.all([
        UnifiedTower.updateMany({ tenantId: req.tenantId, planId }, { $set: updatePayload }).session(session),
        UnifiedSector.updateMany({ tenantId: req.tenantId, planId }, { $set: updatePayload }).session(session),
        UnifiedCPE.updateMany({ tenantId: req.tenantId, planId }, { $set: updatePayload }).session(session),
        NetworkEquipment.updateMany({ tenantId: req.tenantId, planId }, { $set: updatePayload }).session(session)
      ]);

      planDoc.status = 'authorized';
      planDoc.authorization = {
        authorizedBy: req.user?.email || req.user?.name || 'System',
        authorizedAt: timestamp,
        notes: notes || ''
      };
      planDoc.showOnMap = false;
      planDoc.updatedAt = timestamp;
      planDoc.stagedFeatureCounts = await PlanLayerFeature.countByPlan(req.tenantId, planId);
      await planDoc.save({ session });

      updatedPlan = planDoc.toObject();
    });

    await session.endSession();

    if (!updatedPlan) {
      return res.status(500).json({ error: 'Failed to authorize plan', message: 'Authorization transaction did not complete' });
    }

    res.json({
      plan: updatedPlan,
      promotionResults,
      message: 'Plan authorized and promoted to production'
    });
  } catch (error) {
    await session.endSession();
    if (error.message === 'plan_missing') {
      return res.status(404).json({ error: 'Plan not found' });
    }
    console.error('Error authorizing plan:', error);
    res.status(500).json({ error: 'Failed to authorize plan', message: error.message });
  }
});

// =========================================================================
// PLAN LAYER FEATURES
// =========================================================================

// GET /plans/:id/features - list staged features for plan
router.get('/:id/features', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const features = await PlanLayerFeature.find({
      tenantId: req.tenantId,
      planId: req.params.id
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      features,
      summary: plan.stagedFeatureCounts || { total: 0, byType: {}, byStatus: {} }
    });
  } catch (error) {
    console.error('Error fetching plan features:', error);
    res.status(500).json({ error: 'Failed to fetch plan features', message: error.message });
  }
});

// POST /plans/:id/features - create staged feature
router.post('/:id/features', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const { featureType, geometry, properties, status, metadata } = req.body;

    if (!featureType) {
      return res.status(400).json({ error: 'featureType is required' });
    }

    if (!geometry || !geometry.type || geometry.coordinates === undefined) {
      return res.status(400).json({ error: 'geometry with type and coordinates is required' });
    }

    const feature = new PlanLayerFeature({
      tenantId: req.tenantId,
      planId: req.params.id,
      featureType,
      geometry,
      properties: properties || {},
      status: status || 'draft',
      metadata: metadata || {},
      createdBy: req.user?.email || req.body.createdBy || 'System',
      createdById: req.user?.uid || req.body.createdById || null,
      updatedBy: req.user?.email || req.body.createdBy || 'System',
      updatedById: req.user?.uid || req.body.createdById || null
    });

    await feature.save();

    const summary = await updatePlanFeatureSummary(req.tenantId, req.params.id);

    res.status(201).json({
      feature: feature.toObject(),
      summary
    });
  } catch (error) {
    console.error('Error creating plan feature:', error);
    res.status(500).json({ error: 'Failed to create feature', message: error.message });
  }
});

// PATCH /plans/:id/features/:featureId - update staged feature
router.patch('/:id/features/:featureId', async (req, res) => {
  try {
    const updates = {};

    if (req.body.featureType) {
      updates.featureType = req.body.featureType;
    }

    if (req.body.geometry) {
      const { geometry } = req.body;
      if (!geometry.type || geometry.coordinates === undefined) {
        return res.status(400).json({ error: 'geometry must include type and coordinates' });
      }
      updates.geometry = geometry;
    }

    if (req.body.properties !== undefined) {
      updates.properties = req.body.properties;
    }

    if (req.body.status) {
      updates.status = req.body.status;
    }

    if (req.body.metadata !== undefined) {
      updates.metadata = req.body.metadata;
    }

    updates.updatedBy = req.user?.email || req.body.updatedBy || 'System';
    updates.updatedById = req.user?.uid || req.body.updatedById || null;

    const feature = await PlanLayerFeature.findOneAndUpdate(
      {
        _id: req.params.featureId,
        tenantId: req.tenantId,
        planId: req.params.id
      },
      { $set: updates },
      { new: true }
    ).lean();

    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    const summary = await updatePlanFeatureSummary(req.tenantId, req.params.id);

    res.json({ feature, summary });
  } catch (error) {
    console.error('Error updating plan feature:', error);
    res.status(500).json({ error: 'Failed to update feature', message: error.message });
  }
});

// DELETE /plans/:id/features/:featureId - remove staged feature
router.delete('/:id/features/:featureId', async (req, res) => {
  try {
    const feature = await PlanLayerFeature.findOneAndDelete({
      _id: req.params.featureId,
      tenantId: req.tenantId,
      planId: req.params.id
    }).lean();

    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    const summary = await updatePlanFeatureSummary(req.tenantId, req.params.id);

    res.json({
      message: 'Feature deleted',
      summary
    });
  } catch (error) {
    console.error('Error deleting plan feature:', error);
    res.status(500).json({ error: 'Failed to delete feature', message: error.message });
  }
});

// GET /plans/:id/sites - Get all sites/equipment associated with a plan
router.get('/:id/sites', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Get all sites/equipment with this planId
    const [towers, sectors, cpe, equipment] = await Promise.all([
      UnifiedTower.find({ tenantId: req.tenantId, planId: req.params.id }).lean(),
      UnifiedSector.find({ tenantId: req.tenantId, planId: req.params.id }).lean(),
      UnifiedCPE.find({ tenantId: req.tenantId, planId: req.params.id }).lean(),
      NetworkEquipment.find({ tenantId: req.tenantId, planId: req.params.id }).lean()
    ]);
    
    res.json({
      plan: {
        id: plan._id,
        name: plan.name,
        status: plan.status,
        showOnMap: plan.showOnMap
      },
      sites: towers,
      sectors,
      cpeDevices: cpe,
      equipment
    });
  } catch (error) {
    console.error('Error fetching plan sites:', error);
    res.status(500).json({ error: 'Failed to fetch plan sites', message: error.message });
  }
});

// ============================================================================
// MOBILE API - Plan Distribution with Role-Based Views
// ============================================================================

// GET /plans/mobile/:userId - Get plans for mobile app user (role-based)
router.get('/mobile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query; // 'engineer', 'tower-crew', 'manager', etc.
    
    // Get all approved/ready plans for the tenant
    const plans = await PlanProject.find({
      tenantId: req.tenantId,
      status: { $in: ['approved', 'ready'] }
    }).lean();
    
    // Filter and format plans based on user role
    const roleBasedPlans = plans.map(plan => {
      const planData = {
        id: plan._id.toString(),
        name: plan.name,
        description: plan.description,
        status: plan.status,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      };
      
      // Role-based filtering - different roles see different portions
      switch (role) {
        case 'engineer':
          // Engineers see full technical details
          planData.scope = plan.scope;
          planData.hardwareRequirements = plan.hardwareRequirements;
          planData.deployment = plan.deployment;
          break;
          
        case 'tower-crew':
        case 'installer':
          // Tower crew sees installation-specific info
          planData.scope = {
            towers: plan.scope.towers,
            sectors: plan.scope.sectors,
            equipment: plan.scope.equipment
          };
          planData.deployment = {
            estimatedStartDate: plan.deployment?.estimatedStartDate,
            estimatedEndDate: plan.deployment?.estimatedEndDate,
            assignedTo: plan.deployment?.assignedTo,
            notes: plan.deployment?.notes
          };
          // Get actual site locations for installation
          planData.sites = []; // Will be populated below
          break;
          
        case 'manager':
        case 'supervisor':
          // Managers see overview and financials
          planData.scope = plan.scope;
          planData.purchasePlan = {
            totalEstimatedCost: plan.purchasePlan?.totalEstimatedCost,
            procurementStatus: plan.purchasePlan?.procurementStatus
          };
          planData.deployment = plan.deployment;
          break;
          
        default:
          // Default: minimal info
          planData.scope = {
            towers: plan.scope.towers?.length || 0,
            sectors: plan.scope.sectors?.length || 0,
            cpeDevices: plan.scope.cpeDevices?.length || 0,
            equipment: plan.scope.equipment?.length || 0
          };
      }
      
      return planData;
    });
    
    // For tower crew, fetch actual site details
    if (role === 'tower-crew' || role === 'installer') {
      for (const planData of roleBasedPlans) {
        if (planData.sites && planData.scope) {
          const [towers, sectors] = await Promise.all([
            UnifiedTower.find({ 
              tenantId: req.tenantId, 
              _id: { $in: planData.scope.towers } 
            }).select('name location address towerContact siteContact accessInstructions gateCode').lean(),
            UnifiedSector.find({ 
              tenantId: req.tenantId, 
              _id: { $in: planData.scope.sectors } 
            }).select('name location azimuth beamwidth').lean()
          ]);
          
          planData.sites = towers.map(t => ({
            id: t._id.toString(),
            name: t.name,
            location: t.location,
            address: t.address,
            contact: t.siteContact || t.towerContact,
            accessInstructions: t.accessInstructions,
            gateCode: t.gateCode
          }));
          
          planData.sectors = sectors.map(s => ({
            id: s._id.toString(),
            name: s.name,
            location: s.location,
            azimuth: s.azimuth,
            beamwidth: s.beamwidth
          }));
        }
      }
    }
    
    res.json({
      plans: roleBasedPlans,
      userRole: role,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching mobile plans:', error);
    res.status(500).json({ error: 'Failed to fetch mobile plans', message: error.message });
  }
});

// GET /plans/mobile/:userId/:planId - Get detailed plan for mobile
router.get('/mobile/:userId/:planId', async (req, res) => {
  try {
    const { userId, planId } = req.params;
    const { role } = req.query;
    
    const plan = await PlanProject.findOne({
      _id: planId,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Return role-appropriate details
    const planDetails = {
      id: plan._id.toString(),
      name: plan.name,
      description: plan.description,
      status: plan.status
    };
    
    // Role-based data filtering
    if (role === 'engineer' || role === 'manager') {
      planDetails.fullDetails = plan;
    } else if (role === 'tower-crew' || role === 'installer') {
      // Get site-specific installation details
      const [towers, sectors, equipment] = await Promise.all([
        UnifiedTower.find({ tenantId: req.tenantId, planId }).lean(),
        UnifiedSector.find({ tenantId: req.tenantId, planId }).lean(),
        NetworkEquipment.find({ tenantId: req.tenantId, planId }).lean()
      ]);
      
      planDetails.installationSites = towers.map(t => ({
        id: t._id.toString(),
        name: t.name,
        location: t.location,
        address: t.address,
        contact: t.siteContact || t.towerContact,
        accessInstructions: t.accessInstructions,
        gateCode: t.gateCode,
        safetyNotes: t.safetyNotes,
        accessHours: t.accessHours
      }));
      
      planDetails.sectors = sectors;
      planDetails.equipment = equipment.filter(eq => 
        ['antenna', 'radio', 'mounting-hardware', 'cable'].includes(eq.type)
      );
    }
    
    res.json(planDetails);
  } catch (error) {
    console.error('Error fetching mobile plan details:', error);
    res.status(500).json({ error: 'Failed to fetch plan details', message: error.message });
  }
});

// DELETE /plans/:id - Delete plan
router.delete('/:id', async (req, res) => {
  try {
    const plan = await PlanProject.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const planIdString = req.params.id;
    
    const [featureResult, towerResult, sectorResult, cpeResult, equipmentResult, customerResult] = await Promise.all([
      PlanLayerFeature.deleteMany({ tenantId: req.tenantId, planId: planIdString }),
      UnifiedSite.deleteMany({ tenantId: req.tenantId, planId: planIdString }),
      UnifiedSector.deleteMany({ tenantId: req.tenantId, planId: planIdString }),
      UnifiedCPE.deleteMany({ tenantId: req.tenantId, planId: planIdString }),
      NetworkEquipment.deleteMany({ tenantId: req.tenantId, planId: planIdString }),
      // Delete customer prospects created from this plan's marketing leads
      (async () => {
        try {
          const result = await Customer.deleteMany({
            tenantId: req.tenantId,
            associatedPlanId: planIdString,
            leadSource: 'plan-marketing',
            serviceStatus: 'prospect'
          });
          return result;
        } catch (err) {
          console.error('Error deleting customer prospects:', err);
          return { deletedCount: 0 };
        }
      })()
    ]);

    res.json({
      message: 'Plan deleted successfully',
      plan,
      removed: {
        features: featureResult.deletedCount || 0,
        sites: towerResult.deletedCount || 0,
        sectors: sectorResult.deletedCount || 0,
        cpe: cpeResult.deletedCount || 0,
        equipment: equipmentResult.deletedCount || 0,
        customers: customerResult.deletedCount || 0
      }
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ error: 'Failed to delete plan', message: error.message });
  }
});

// ============================================================================
// HARDWARE REQUIREMENTS
// ============================================================================

// POST /plans/:id/requirements - Add hardware requirement
router.post('/:id/requirements', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const costEstimate = await estimateHardwareCost(req.tenantId, req.body);
    
    const requirement = {
      ...req.body,
      estimatedCost: costEstimate.estimatedCost,
      costConfidence: costEstimate.confidence,
      costSource: costEstimate.source
    };
    
    plan.hardwareRequirements.needed.push(requirement);
    await plan.save();
    
    // Re-analyze missing hardware
    await analyzeMissingHardware(plan);
    
    res.json(plan);
  } catch (error) {
    console.error('Error adding requirement:', error);
    res.status(500).json({ error: 'Failed to add requirement', message: error.message });
  }
});

// DELETE /plans/:id/requirements/:requirementIndex - Remove hardware requirement
router.delete('/:id/requirements/:requirementIndex', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const requirementIndex = parseInt(req.params.requirementIndex);
    if (requirementIndex < 0 || requirementIndex >= plan.hardwareRequirements.needed.length) {
      return res.status(400).json({ error: 'Invalid requirement index' });
    }
    
    plan.hardwareRequirements.needed.splice(requirementIndex, 1);
    await plan.save();
    
    // Re-analyze missing hardware
    await analyzeMissingHardware(plan);
    
    res.json(plan);
  } catch (error) {
    console.error('Error removing requirement:', error);
    res.status(500).json({ error: 'Failed to remove requirement', message: error.message });
  }
});

// ============================================================================
// MISSING HARDWARE ANALYSIS
// ============================================================================

// POST /plans/:id/analyze - Analyze missing hardware
router.post('/:id/analyze', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    await analyzeMissingHardware(plan);
    
    res.json(plan);
  } catch (error) {
    console.error('Error analyzing missing hardware:', error);
    res.status(500).json({ error: 'Failed to analyze missing hardware', message: error.message });
  }
});

// GET /plans/:id/missing-hardware - Get missing hardware analysis
router.get('/:id/missing-hardware', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json({
      missingHardware: plan.purchasePlan.missingHardware,
      totalEstimatedCost: plan.purchasePlan.totalEstimatedCost,
      procurementStatus: plan.purchasePlan.procurementStatus
    });
  } catch (error) {
    console.error('Error fetching missing hardware:', error);
    res.status(500).json({ error: 'Failed to fetch missing hardware', message: error.message });
  }
});

// ============================================================================
// PURCHASE ORDERS
// ============================================================================

// POST /plans/:id/purchase-order - Generate purchase order
router.post('/:id/purchase-order', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    if (plan.purchasePlan.missingHardware.length === 0) {
      return res.status(400).json({ error: 'No missing hardware to generate purchase order' });
    }
    
    const purchaseOrderId = `PO_${plan._id}_${Date.now()}`;
    
    const items = plan.purchasePlan.missingHardware.map(item => ({
      equipmentType: `${item.manufacturer || 'Generic'} ${item.model || item.equipmentType}`,
      quantity: item.quantity,
      estimatedCost: item.estimatedCost,
      priority: item.priority,
      specifications: item.specifications,
      alternatives: item.alternatives
    }));
    
    const purchaseOrder = {
      purchaseOrderId,
      planId: plan._id,
      planName: plan.name,
      items,
      totalCost: plan.purchasePlan.totalEstimatedCost,
      generatedAt: new Date(),
      generatedBy: req.user?.email || req.user?.name
    };
    
    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error generating purchase order:', error);
    res.status(500).json({ error: 'Failed to generate purchase order', message: error.message });
  }
});

// ============================================================================
// EXISTING HARDWARE QUERY
// ============================================================================

// GET /plans/hardware/existing - Get all existing hardware from all modules
router.get('/hardware/existing', async (req, res) => {
  try {
    const hardware = [];
    
    // Get towers
    const towers = await UnifiedTower.find({ tenantId: req.tenantId }).lean();
    towers.forEach(tower => {
      hardware.push({
        id: tower._id.toString(),
        type: 'tower',
        name: tower.name,
        location: {
          latitude: tower.location.latitude,
          longitude: tower.location.longitude,
          address: tower.location.address
        },
        status: tower.status,
        module: 'manual',
        lastUpdated: tower.updatedAt,
        isReadOnly: true,
        inventoryId: tower.inventoryId
      });
    });
    
    // Get sectors
    const sectors = await UnifiedSector.find({ tenantId: req.tenantId }).lean();
    sectors.forEach(sector => {
      hardware.push({
        id: sector._id.toString(),
        type: 'sector',
        name: `${sector.name} - Sector ${sector.azimuth}?`,
        location: {
          latitude: sector.location.latitude,
          longitude: sector.location.longitude
        },
        status: sector.status,
        module: sector.modules?.pci ? 'pci' : 'manual',
        lastUpdated: sector.updatedAt,
        isReadOnly: true,
        inventoryId: sector.inventoryId
      });
    });
    
    // Get CPE devices
    const cpeDevices = await UnifiedCPE.find({ tenantId: req.tenantId }).lean();
    cpeDevices.forEach(cpe => {
      hardware.push({
        id: cpe._id.toString(),
        type: 'cpe',
        name: `${cpe.manufacturer} ${cpe.model} - ${cpe.serialNumber}`,
        location: {
          latitude: cpe.location.latitude,
          longitude: cpe.location.longitude,
          address: cpe.location.address
        },
        status: cpe.status,
        module: cpe.modules?.acs ? 'acs' : cpe.modules?.hss ? 'hss' : 'manual',
        lastUpdated: cpe.updatedAt,
        isReadOnly: true,
        inventoryId: cpe.inventoryId
      });
    });
    
    // Get inventory items
    const inventoryItems = await InventoryItem.find({ tenantId: req.tenantId }).lean();
    inventoryItems.forEach(item => {
      // Only include items that aren't already mapped to coverage map
      const alreadyMapped = hardware.some(h => h.inventoryId === item._id.toString());
      if (!alreadyMapped) {
        hardware.push({
          id: item._id.toString(),
          type: 'equipment',
          name: `${item.manufacturer || 'Unknown'} ${item.model || 'Unknown'} - ${item.serialNumber}`,
          location: {
            latitude: item.currentLocation?.latitude || 0,
            longitude: item.currentLocation?.longitude || 0,
            address: item.currentLocation?.address
          },
          status: item.status,
          module: item.modules?.acs ? 'acs' : item.modules?.hss ? 'hss' : 'inventory',
          lastUpdated: item.updatedAt,
          isReadOnly: true,
          inventoryId: item._id.toString()
        });
      }
    });
    
    res.json(hardware);
  } catch (error) {
    console.error('Error fetching existing hardware:', error);
    res.status(500).json({ error: 'Failed to fetch existing hardware', message: error.message });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Hardware analysis functions - use service module
const analyzeMissingHardware = planHardwareService.analyzeMissingHardware;
const estimateHardwareCost = planHardwareService.estimateHardwareCost;
const generateMissingHardwareReason = planHardwareService.generateMissingHardwareReason;
const generateAlternatives = planHardwareService.generateAlternatives;

// Old inline implementations removed - see backend-services/services/planHardwareService.js and planPromotionService.js

// Plan promotion functions - use service module
const promotePlanLayerFeatures = planPromotionService.promotePlanLayerFeatures;
const createSiteFromFeature = planPromotionService.createSiteFromFeature;
const createEquipmentFromFeature = planPromotionService.createEquipmentFromFeature;
const updatePlanFeatureSummary = planPromotionService.updatePlanFeatureSummary;
const extractLatLng = planPromotionService.extractLatLng;
const normalizeEquipmentType = planPromotionService.normalizeEquipmentType;

module.exports = router;

