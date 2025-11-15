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
  osm_buildings: 'OpenStreetMap Building Footprints',
  arcgis_address_points: 'ArcGIS Address Points',
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

const generateLeadCustomerId = async (tenantId) => {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const candidate = `LEAD-${year}-${suffix}`;
    const exists = await Customer.exists({ tenantId, customerId: candidate });
    if (!exists) {
      return candidate;
    }
  }
  return `LEAD-${Date.now()}`;
};

const buildLeadHash = (latitude, longitude, addressLine1, postalCode) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const streetKey = (addressLine1 || '').toLowerCase();
  const postalKey = (postalCode || '').toLowerCase();
  // Use 7 decimal places for better precision (~1cm vs ~1m with 5 places)
  return `${latitude.toFixed(7)}|${longitude.toFixed(7)}|${streetKey}|${postalKey}`;
};

const normalizePlanNameForLead = (planName) => {
  if (!planName) return 'Lead';
  const str = String(planName).trim();
  return str.length > 0 ? str.substring(0, 40) : 'Lead';
};

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_BUILDING_RESULTS = 2000; // Increase limit to capture more buildings
const MAX_REVERSE_GEOCODE = 500; // No artificial limit - geocode all (FTTH approach)
const NOMINATIM_DELAY_MS = 500; // Reduced delay since ArcGIS doesn't need rate limiting
const NOMINATIM_USER_AGENT = 'LTE-PCI-Mapper-Marketing/1.0 (admin@wisptools.io)';
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const ARCGIS_GEOCODER_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
const ARC_GIS_API_KEY = appConfig?.externalServices?.arcgis?.apiKey || '';

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
);
out center;
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
);
out center;
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

  // Sort elements to prioritize ways (which have centroids) over nodes (which are just points)
  const sortedElements = [...elements].sort((a, b) => {
    // Ways with centroids come first (these are building polygons with calculated centroids)
    if (a.type === 'way' && a.center && b.type !== 'way') return -1;
    if (b.type === 'way' && b.center && a.type !== 'way') return 1;
    return 0;
  });

  let extracted = 0;
  let skipped = 0;
  let skippedReasons = { noCoords: 0, duplicate: 0, invalid: 0 };

  for (const element of sortedElements) {
    let latitude;
    let longitude;

    // Always prefer way centroids (building polygon centers) over node coordinates (point locations)
    if (element.type === 'way' && element.center) {
      // Use the calculated centroid for building polygons - this is the actual building center
      latitude = toNumber(element.center.lat);
      longitude = toNumber(element.center.lon);
    } else if (element.type === 'way' && !element.center && Array.isArray(element.geometry) && element.geometry.length > 0) {
      // Fallback: Calculate centroid from geometry if center is missing
      const coords = element.geometry.filter(g => g && g.lat !== undefined && g.lon !== undefined);
      if (coords.length > 0) {
        const sumLat = coords.reduce((sum, g) => sum + toNumber(g.lat), 0);
        const sumLon = coords.reduce((sum, g) => sum + toNumber(g.lon), 0);
        latitude = sumLat / coords.length;
        longitude = sumLon / coords.length;
      }
    } else if (element.type === 'node') {
      // Nodes are just points - use their coordinates directly
      // Note: These may not be true building centroids if the building is represented as a point
      latitude = toNumber(element.lat);
      longitude = toNumber(element.lon);
    } else if (Array.isArray(element.geometry) && element.geometry.length > 0) {
      latitude = toNumber(element.geometry[0]?.lat);
      longitude = toNumber(element.geometry[0]?.lon);
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

const reverseGeocodeCoordinateArcgis = async (lat, lon) => {
  if (!ARC_GIS_API_KEY) {
    return null; // Fall back to Nominatim if no API key
  }

  try {
    // Use axios with automatic retries instead of fetch
    const params = {
      f: 'json',
      location: `${lon},${lat}`,
      outFields: 'Address,City,Postal,Region,State,CountryCode',
      maxLocations: '1',
      token: ARC_GIS_API_KEY
    };

    const response = await httpClient.get(`${ARCGIS_GEOCODER_URL}/reverseGeocode`, {
      params,
      timeout: 8000 // 8 second timeout for ArcGIS
    });
    
    const data = response.data;
    
    // Check for ArcGIS API errors
    if (data.error) {
      console.warn('[MarketingDiscovery] ArcGIS reverse geocode API error:', data.error.code, data.error.message);
      return null;
    }
    
    if (!data.address) {
      console.warn('[MarketingDiscovery] ArcGIS returned no address data for', lat, lon);
      return null;
    }
    
    const address = data.address;

    // FTTH approach: Use Address field (street address), not Match_addr (which can include business names)
    const addressLine1 = address.Address || address.Match_addr;
    
    // Skip if we only got business name or place name (no actual street address)
    if (!addressLine1 || addressLine1.length < 3) {
      return null;
    }

    const location = data.location || {};
    const resolvedLat = toNumber(location?.y);
    const resolvedLon = toNumber(location?.x);

    return {
      addressLine1: addressLine1,
      addressLine2: undefined,
      city: address.City || undefined,
      state: address.Region || address.State || undefined,
      postalCode: address.Postal || undefined,
      country: address.CountryCode || 'US',
      latitude: resolvedLat ?? lat,
      longitude: resolvedLon ?? lon,
      source: 'arcgis'
    };
  } catch (error) {
    if (error.response) {
      console.warn('[MarketingDiscovery] ArcGIS reverse geocode HTTP error:', error.response.status, error.response.data ? JSON.stringify(error.response.data).substring(0, 200) : 'Unknown error');
    } else {
      console.warn('[MarketingDiscovery] ArcGIS reverse geocode failed:', error.message || error);
    }
    return null;
  }
};

const reverseGeocodeCoordinate = async (lat, lon) => {
  // Always use ArcGIS if available - it's much faster and more accurate
  if (ARC_GIS_API_KEY) {
    const arcgisResult = await reverseGeocodeCoordinateArcgis(lat, lon);
    if (arcgisResult) {
      return arcgisResult;
    }
    // If ArcGIS fails, return coordinates instead of slow Nominatim
    // This speeds up the process significantly
    return {
      addressLine1: `${lat.toFixed(7)}, ${lon.toFixed(7)}`,
      latitude: lat,
      longitude: lon,
      country: 'US',
      source: 'arcgis_failed'
    };
  }

  // Only use Nominatim if ArcGIS API key is not available (shouldn't happen in production)
  try {
    const response = await httpClient.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'jsonv2',
        lat: lat,
        lon: lon,
        zoom: 18,
        addressdetails: 1
      },
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        Accept: 'application/json'
      },
      timeout: 5000 // 5 second timeout for Nominatim
    });

    const data = response.data;
    const address = data.address || {};

    const line1 =
      address.house_number && address.road
        ? `${address.house_number} ${address.road}`
        : data.display_name?.split(',')?.slice(0, 1)?.[0] || undefined;

    return {
      addressLine1: line1 ? line1.trim() : undefined,
      addressLine2: undefined,
      city: address.city || address.town || address.village || address.hamlet || undefined,
      state: address.state || address.region || undefined,
      postalCode: address.postcode || undefined,
      country: address.country || address.country_code?.toUpperCase() || undefined,
      latitude: lat,
      longitude: lon,
      source: 'nominatim'
    };
  } catch (error) {
    if (error.response) {
      const errorMsg = `Reverse geocoding failed: ${error.response.status} ${error.response.statusText}`;
      console.warn('[MarketingDiscovery] Nominatim reverse geocode failed:', errorMsg);
      throw new Error(errorMsg);
    }
    console.warn('[MarketingDiscovery] Nominatim reverse geocode failed:', error.message || error);
    throw error;
  }
};

// Batch reverse geocode all coordinates - processes all at once for efficiency
const batchReverseGeocodeCoordinates = async (coordinates = [], progressCallback) => {
  try {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      console.log('[MarketingDiscovery] No coordinates to reverse geocode');
      return { addresses: [], geocoded: 0, failed: 0 };
    }

    const addresses = [];
    let geocodedCount = 0;
    let failedCount = 0;
    const reverseGeocodeStartTime = Date.now();
    
    // Configuration for batch processing
    // Limit to 45 seconds to respond before proxy/nginx timeout (usually 60 seconds)
    const REVERSE_GEOCODE_TIMEOUT = ARC_GIS_API_KEY ? 8000 : 5000;
    const MAX_PARALLEL_GEOCODES = ARC_GIS_API_KEY ? 20 : 5; // ArcGIS can handle more parallel requests
    const MAX_REVERSE_GEOCODE_TIME = 45 * 1000; // 45 seconds - must finish before proxy timeout
    const MAX_COORDINATES_TO_GEOCODE = 1000; // Increased limit - axios retry improves reliability
    const overallTimeout = Date.now() + MAX_REVERSE_GEOCODE_TIME;
    
    // Limit coordinates if too many to prevent timeout
    const coordinatesToProcess = coordinates.length > MAX_COORDINATES_TO_GEOCODE 
      ? coordinates.slice(0, MAX_COORDINATES_TO_GEOCODE)
      : coordinates;
    
    if (coordinates.length > MAX_COORDINATES_TO_GEOCODE) {
      console.warn(`[MarketingDiscovery] Limiting reverse geocoding to ${MAX_COORDINATES_TO_GEOCODE} of ${coordinates.length} coordinates to prevent timeout`);
    }

    console.log('[MarketingDiscovery] Starting batch reverse geocoding', {
      totalCoordinates: coordinates.length,
      processingCoordinates: coordinatesToProcess.length,
      usingArcGIS: !!ARC_GIS_API_KEY,
      maxParallel: MAX_PARALLEL_GEOCODES,
      maxDuration: `${MAX_REVERSE_GEOCODE_TIME / 1000}s`
    });

    // Process coordinates in batches for parallel geocoding
    for (let batchStart = 0; batchStart < coordinatesToProcess.length; batchStart += MAX_PARALLEL_GEOCODES) {
      // Check overall timeout - must respond before proxy timeout
      if (Date.now() > overallTimeout) {
        console.warn(`[MarketingDiscovery] Batch reverse geocoding timeout reached after ${MAX_REVERSE_GEOCODE_TIME / 1000}s. Processed ${batchStart}/${coordinatesToProcess.length} coordinates. Returning partial results.`);
        // Add remaining coordinates as coordinate-only addresses
        for (let i = batchStart; i < coordinatesToProcess.length; i += 1) {
          const lat = toNumber(coordinates[i]?.latitude);
          const lon = toNumber(coordinates[i]?.longitude);
          if (lat !== undefined && lon !== undefined) {
            addresses.push({
              addressLine1: `${lat.toFixed(7)}, ${lon.toFixed(7)}`,
              latitude: lat,
              longitude: lon,
              country: 'US',
              source: coordinates[i]?.source || 'unknown'
            });
            failedCount += 1;
          }
        }
        break;
      }

      const batchEnd = Math.min(batchStart + MAX_PARALLEL_GEOCODES, coordinatesToProcess.length);
      const batch = coordinatesToProcess.slice(batchStart, batchEnd);
      
      if (progressCallback && batchStart % 20 === 0) {
        const geocodeProgress = (batchStart / coordinatesToProcess.length) * 100;
        progressCallback(`Reverse geocoding ${batchStart + 1}/${coordinatesToProcess.length}`, geocodeProgress, {
          current: batchStart + 1,
          total: coordinatesToProcess.length,
          geocoded: geocodedCount,
          failed: failedCount
        });
      }

      // Process batch in parallel
      const batchPromises = batch.map(async (coord, batchIndex) => {
        try {
          const latitude = toNumber(coord?.latitude);
          const longitude = toNumber(coord?.longitude);
          const source = coord?.source || 'unknown';
          
          if (latitude === undefined || longitude === undefined) {
            console.warn('[MarketingDiscovery] Skipping invalid coordinate in batch:', coord);
            return {
              success: false,
              address: null
            };
          }
          
          // Add timeout to individual reverse geocode calls
          const geocodePromise = reverseGeocodeCoordinate(latitude, longitude);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Reverse geocode timeout')), REVERSE_GEOCODE_TIMEOUT)
          );
          
          const details = await Promise.race([geocodePromise, timeoutPromise]);
          if (details && details.addressLine1) {
            return {
              success: true,
              address: {
                ...details,
                source: source || details.source || 'unknown'
              }
            };
          } else {
            // No address returned, use coordinates
            return {
              success: false,
              address: {
                addressLine1: `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`,
                latitude,
                longitude,
                country: 'US',
                source: source || 'unknown'
              }
            };
          }
        } catch (error) {
          const lat = toNumber(coord?.latitude);
          const lon = toNumber(coord?.longitude);
          const coordSource = coord?.source || 'unknown';
          
          console.warn('[MarketingDiscovery] Reverse geocode failed for coordinate:', {
            lat,
            lon,
            source: coordSource,
            error: error?.message || error
          });
          
          // Fallback to coordinates if valid
          if (lat !== undefined && lon !== undefined) {
            return {
              success: false,
              address: {
                addressLine1: `${lat.toFixed(7)}, ${lon.toFixed(7)}`,
                latitude: lat,
                longitude: lon,
                country: 'US',
                source: coordSource
              }
            };
          } else {
            return {
              success: false,
              address: null
            };
          }
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Process batch results
      for (const result of batchResults) {
        if (result.address) {
          addresses.push(result.address);
          if (result.success) {
            geocodedCount += 1;
          } else {
            failedCount += 1;
          }
        } else {
          // Skip invalid coordinates
          failedCount += 1;
        }
      }

      // No delay needed for ArcGIS - it's designed for high throughput
      // Only delay for Nominatim to respect rate limits
      // Also check timeout before continuing
      if (batchEnd < coordinatesToProcess.length && !ARC_GIS_API_KEY && Date.now() < overallTimeout) {
        await delay(1000); // 1 second delay between batches for Nominatim rate limiting
      }
      
      // Check timeout before next batch
      if (Date.now() > overallTimeout) {
        console.warn(`[MarketingDiscovery] Timeout reached before processing all batches. Processed ${batchEnd}/${coordinatesToProcess.length} coordinates.`);
        // Add remaining coordinates as coordinate-only addresses
        for (let i = batchEnd; i < coordinatesToProcess.length; i += 1) {
          const lat = toNumber(coordinatesToProcess[i]?.latitude);
          const lon = toNumber(coordinatesToProcess[i]?.longitude);
          if (lat !== undefined && lon !== undefined) {
            addresses.push({
              addressLine1: `${lat.toFixed(7)}, ${lon.toFixed(7)}`,
              latitude: lat,
              longitude: lon,
              country: 'US',
              source: coordinatesToProcess[i]?.source || 'unknown'
            });
            failedCount += 1;
          }
        }
        break;
      }
    }
    
    // Add any remaining unprocessed coordinates from original list as coordinate-only addresses
    if (coordinates.length > coordinatesToProcess.length) {
      console.log(`[MarketingDiscovery] Adding ${coordinates.length - coordinatesToProcess.length} remaining coordinates as coordinate-only addresses`);
      for (let i = coordinatesToProcess.length; i < coordinates.length; i += 1) {
        const lat = toNumber(coordinates[i]?.latitude);
        const lon = toNumber(coordinates[i]?.longitude);
        if (lat !== undefined && lon !== undefined) {
          addresses.push({
            addressLine1: `${lat.toFixed(7)}, ${lon.toFixed(7)}`,
            latitude: lat,
            longitude: lon,
            country: 'US',
            source: coordinates[i]?.source || 'unknown'
          });
          failedCount += 1;
        }
      }
    }
      
    const reverseGeocodeDuration = Date.now() - reverseGeocodeStartTime;
    console.log('[MarketingDiscovery] Batch reverse geocoding completed', { 
      duration: `${reverseGeocodeDuration}ms`,
      durationPerCoordinate: coordinatesToProcess.length ? `${(reverseGeocodeDuration / coordinatesToProcess.length).toFixed(0)}ms` : '0ms',
      geocoded: geocodedCount,
      failed: failedCount,
      processed: coordinatesToProcess.length,
      total: coordinates.length,
      successRate: coordinatesToProcess.length ? `${((geocodedCount / coordinatesToProcess.length) * 100).toFixed(1)}%` : '0%'
    });

    return { addresses, geocoded: geocodedCount, failed: failedCount };
  } catch (error) {
    console.error('[MarketingDiscovery] Batch reverse geocoding error:', {
      error: error?.message || error,
      stack: error?.stack,
      coordinatesCount: coordinates?.length || 0
    });
    // Return whatever addresses we've collected so far, even if there was an error
    return { addresses: [], geocoded: 0, failed: coordinates?.length || 0, error: error?.message || 'Unknown error' };
  }
};

const toRadians = (degrees) => degrees * (Math.PI / 180);

const distanceInMeters = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const normalizeAddressComponent = (value) => {
  if (!value || typeof value !== 'string') return '';

  const directionMap = {
    northeast: 'ne',
    northwest: 'nw',
    southeast: 'se',
    southwest: 'sw',
    north: 'n',
    south: 's',
    east: 'e',
    west: 'w'
  };

  const streetTypeMap = {
    street: 'st',
    avenue: 'ave',
    boulevard: 'blvd',
    court: 'ct',
    drive: 'dr',
    lane: 'ln',
    place: 'pl',
    road: 'rd',
    terrace: 'ter',
    trail: 'trl',
    highway: 'hwy',
    parkway: 'pkwy',
    circle: 'cir'
  };

  let normalized = value
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  Object.entries(directionMap).forEach(([full, abbr]) => {
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  });

  Object.entries(streetTypeMap).forEach(([full, abbr]) => {
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  });

  return normalized;
};

const normalizeArcgisAddressKey = (address = {}) => {
  const latitude = toNumber(address.latitude);
  const longitude = toNumber(address.longitude);
  const line1 = normalizeAddressComponent(address.addressLine1);
  const postal = normalizeAddressComponent(address.postalCode || address.zip);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    // Use 7 decimal places for better precision
    return `${latitude.toFixed(7)}|${longitude.toFixed(7)}|${line1}|${postal}`;
  }

  if (line1) {
    return `${line1}|${postal}`;
  }

  return null;
};

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

const buildAddressHash = (address = {}) => {
  const line1 = normalizeAddressComponent(address.addressLine1);
  const line2 = normalizeAddressComponent(address.addressLine2);
  const city = normalizeAddressComponent(address.city);
  const state = normalizeAddressComponent(address.state);
  const postal = normalizeAddressComponent(address.postalCode || address.zip);

  if (!line1 && !city && !postal) {
    return null;
  }

  return [line1, line2, city, state, postal].filter(Boolean).join('|');
};

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

    let candidates = extractBuildingCandidates(primaryElements, {
      precision: isRuralArea ? 10000 : 20000,
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
        precision: 10000,
        sourceLabel: 'osm_fallback'
      }).slice(0, RURAL_FALLBACK_MAX_RESULTS);

      console.log('[MarketingDiscovery] Fallback extraction stats', {
        fallbackElements: fallbackElements.length,
        fallbackCandidates: fallbackCandidates.length
      });

      candidates = mergeCandidateSets(candidates, fallbackCandidates, 10000);
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

        candidates = mergeCandidateSets(candidates, interpolated, 10000);
      }
    }

    candidates = candidates.slice(0, MAX_BUILDING_RESULTS);

    const beforeFilterCount = candidates.length;
    const filteredCandidates = candidates.filter((candidate) => {
      if (!candidate || !candidate.tags) return false;
      if (candidateLooksLikeRoad(candidate.tags)) return false;
      return candidateHasResidentialSignal(candidate.tags);
    });

    if (filteredCandidates.length === 0 && beforeFilterCount > 0) {
      console.log('[MarketingDiscovery] Residential filter removed all candidates, falling back to original set', {
        beforeFilterCount
      });
      candidates = candidates.slice(0, Math.min(beforeFilterCount, RURAL_FALLBACK_MAX_RESULTS));
    } else {
      console.log('[MarketingDiscovery] Residential filter applied', {
        beforeFilterCount,
        afterFilterCount: filteredCandidates.length,
        removed: beforeFilterCount - filteredCandidates.length
      });
      if (filteredCandidates.length > 0) {
        candidates = filteredCandidates;
      }
    }

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

const fetchArcgisCandidatesForExtent = async ({ boundingBox, centerOverride }) => {
  try {
    const params = new URLSearchParams({
      f: 'json',
      outFields: 'Match_addr,Addr_type,PlaceName,City,Region,Postal',
      maxLocations: String(ARC_GIS_MAX_CANDIDATES_PER_REQUEST),
      searchExtent: `${boundingBox.west},${boundingBox.south},${boundingBox.east},${boundingBox.north}`,
      category: 'Point Address',
      forStorage: 'false',
      token: ARC_GIS_API_KEY
    });

    if (centerOverride?.lon !== undefined && centerOverride?.lat !== undefined) {
      params.set('location', `${centerOverride.lon},${centerOverride.lat}`);
    }

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
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const exceededLimit = Boolean(payload?.exceededTransferLimit) || candidates.length >= ARC_GIS_MAX_CANDIDATES_PER_REQUEST;

    return {
      candidateCount: candidates.length,
      exceededLimit,
      rawCandidates: candidates // Return raw candidates for coordinate extraction
    };
  } catch (error) {
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
  console.log('[MarketingDiscovery] ArcGIS Address Points Discovery called (coordinates only)', {
    hasApiKey: !!ARC_GIS_API_KEY,
    boundingBox
  });
  
  if (!ARC_GIS_API_KEY) {
    console.warn('[MarketingDiscovery] ArcGIS API key not configured, skipping address points');
    return { coordinates: [], error: 'ArcGIS API key not configured' };
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

      const result = await fetchArcgisCandidatesForExtent({
        boundingBox: currentBBox,
        centerOverride: requestCenter
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
    let algorithms = (userAlgorithms && userAlgorithms.length ? userAlgorithms : ['osm_buildings', 'arcgis_address_points']).filter(Boolean);

    if (!ARC_GIS_API_KEY) {
      const filtered = algorithms.filter((id) => id === 'osm_buildings');
      if (algorithms.length !== filtered.length) {
        console.warn('[MarketingDiscovery] ArcGIS API key missing. Skipping ArcGIS-based algorithms.');
      }
      algorithms = filtered;
    }

    if (!algorithms || algorithms.length === 0) {
      console.warn('[MarketingDiscovery] No valid algorithms selected, defaulting to OSM');
      algorithms = ['osm_buildings'];
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
        if (!workingAddress.addressLine1) {
          workingAddress.addressLine1 = `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`;
        }

        // Always include existing addresses, regardless of current bounding box
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
      
      console.log(`[MarketingDiscovery] Seeded ${combinedAddresses.length} existing addresses from ${addressesToSeed.length} input addresses`);
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

    // Step 1: Collect coordinates from OSM (centroids)
    if (algorithms.includes('osm_buildings')) {
      try {
        updateProgress('Running OSM centroid lookup', 10);
        console.log('[MarketingDiscovery] Running OSM building discovery algorithm (coordinates only)');
        const osmResult = await runOsmBuildingDiscovery({
          boundingBox,
          radiusMiles,
          center: computedCenter,
          advancedOptions,
          progressCallback: (step, progress, details) => {
            updateProgress(`OSM: ${step}`, 10 + (progress * 15 * 0.01), details);
          }
        });
        
        if (Array.isArray(osmResult.coordinates)) {
          for (const coord of osmResult.coordinates) {
            const latitude = toNumber(coord?.latitude);
            const longitude = toNumber(coord?.longitude);
            if (latitude === undefined || longitude === undefined) {
              console.warn('[MarketingDiscovery] Skipping invalid OSM coordinate:', coord);
              continue;
            }
            const key = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
            if (!coordinateKeys.has(key)) {
              coordinateKeys.add(key);
              allCoordinates.push({
                latitude,
                longitude,
                source: coord.source || 'osm_buildings',
                tags: coord.tags || {}
              });
            }
          }
        }

        updateProgress('OSM centroid lookup completed', 25, { 
          coordinates: osmResult.coordinates?.length || 0,
          totalCoordinates: allCoordinates.length,
          error: osmResult.error 
        });
        console.log('[MarketingDiscovery] OSM algorithm completed', { 
          coordinates: osmResult.coordinates?.length || 0,
          totalCoordinates: allCoordinates.length,
          error: osmResult.error 
        });

        recordAlgorithmStats('osm_buildings', osmResult.coordinates?.length || 0, 0, osmResult.error);
      } catch (err) {
        updateProgress('OSM centroid lookup failed', 25, { error: err.message });
        console.error('[MarketingDiscovery] OSM Building Discovery failed:', err);
        recordAlgorithmStats('osm_buildings', 0, 0, err.message || 'Unknown error');
      }
    }

    // Step 2: Collect coordinates from ArcGIS address points
    if (algorithms.includes('arcgis_address_points') && ARC_GIS_API_KEY) {
      try {
        console.log('[MarketingDiscovery] Starting ArcGIS address points discovery (coordinates only)', {
          boundingBox,
          center: computedCenter,
          hasApiKey: !!ARC_GIS_API_KEY
        });
        updateProgress('Running ArcGIS address points lookup', 25);
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

        updateProgress('ArcGIS address points lookup completed', 40, { 
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
        updateProgress('ArcGIS address points failed', 40, { error: err.message });
        console.error('[MarketingDiscovery] ArcGIS Address Points Discovery failed:', err);
        recordAlgorithmStats('arcgis_address_points', 0, 0, err.message || 'Unknown error');
      }
    }

    // Step 3: Collect coordinates from ArcGIS places
    if (algorithms.includes('arcgis_places') && ARC_GIS_API_KEY) {
      try {
        updateProgress('Running ArcGIS places lookup', 40);
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
    if (reverseGeocodeResult && Array.isArray(reverseGeocodeResult.addresses)) {
      for (const address of reverseGeocodeResult.addresses) {
        if (address && address.latitude !== undefined && address.longitude !== undefined) {
          addAddressToCombined(address, address.source || 'unknown');
        }
      }
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
      if (algorithmStats['osm_buildings']) {
        algorithmStats['osm_buildings'].geocoded = geocodedBySource['osm_buildings'] || 0;
      }
      if (algorithmStats['arcgis_address_points']) {
        algorithmStats['arcgis_address_points'].geocoded = geocodedBySource['arcgis_address_points'] || 0;
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
      // Increased to 1000 since addresses are stripped down (minimal fields)
      const MAX_RESPONSE_ADDRESSES = 1000;
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

async function analyzeMissingHardware(plan) {
  try {
    const existingInventory = await InventoryItem.find({ tenantId: plan.tenantId }).lean();
    
    // Clear existing missing hardware analysis
    plan.purchasePlan.missingHardware = [];
    plan.purchasePlan.totalEstimatedCost = 0;
    
    // Analyze each hardware requirement
    for (const requirement of plan.hardwareRequirements.needed) {
      const available = existingInventory.filter(item => 
        item.category === requirement.category &&
        item.equipmentType === requirement.equipmentType &&
        (item.status === 'available' || item.status === 'reserved')
      );
      
      const availableQuantity = available.length;
      const neededQuantity = requirement.quantity;
      
      if (availableQuantity < neededQuantity) {
        const missingQuantity = neededQuantity - availableQuantity;
        const costEstimate = await estimateHardwareCost(plan.tenantId, requirement);
        const estimatedCost = costEstimate.estimatedCost;
        
        plan.purchasePlan.missingHardware.push({
          id: `missing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          category: requirement.category,
          equipmentType: requirement.equipmentType,
          manufacturer: requirement.manufacturer,
          model: requirement.model,
          quantity: missingQuantity,
          estimatedCost: estimatedCost * missingQuantity,
          priority: requirement.priority,
          specifications: requirement.specifications,
          reason: generateMissingHardwareReason(requirement, missingQuantity, availableQuantity),
          alternatives: generateAlternatives(requirement),
          costConfidence: costEstimate.confidence,
          costSource: costEstimate.source
        });
        
        plan.purchasePlan.totalEstimatedCost += estimatedCost * missingQuantity;
      }
    }
    
    plan.updatedAt = new Date();
    await plan.save();
  } catch (error) {
    console.error('Error analyzing missing hardware:', error);
    throw error;
  }
}

/**
 * Estimate hardware cost using pricing database
 * Falls back to inventory averages, then hardcoded defaults
 */
async function estimateHardwareCost(tenantId, requirement) {
  try {
    // Try to get price from pricing database
    // axios already required at top of file
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    
    const params = new URLSearchParams({
      category: requirement.category || '',
      equipmentType: requirement.equipmentType || '',
      manufacturer: requirement.manufacturer || '',
      model: requirement.model || ''
    });
    
    try {
      const response = await axios.get(`${baseUrl}/api/equipment-pricing/price?${params}`, {
        headers: {
          'x-tenant-id': tenantId
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.data?.price) {
        return {
          estimatedCost: response.data.price * (requirement.quantity || 1),
          confidence: response.data.confidence || 'high',
          source: response.data.source || 'pricing_database'
        };
      }
    } catch (apiError) {
      console.warn('Pricing API not available, using fallback:', apiError.message);
    }
    
    // Fallback to hardcoded estimates (last resort)
    const costEstimates = {
      'tower': 50000,
      'sector-antenna': 2000,
      'cpe-device': 500,
      'router': 300,
      'switch': 200,
      'power-supply': 150,
      'cable': 5,
      'connector': 10,
      'mounting-hardware': 100,
      'backhaul-radio': 3000,
      'fiber-optic': 2,
      'ups': 800,
      'generator': 5000,
      // Add more defaults
      'Base Station (eNodeB/gNodeB)': 15000,
      'Remote Radio Head (RRH)': 3000,
      'Radio Unit (RU)': 2500,
      'Baseband Unit (BBU)': 8000,
      'Sector Antenna': 2000,
      'Panel Antenna': 1500,
      'Parabolic Dish': 2500,
      'LTE CPE': 500,
      'CBRS CPE': 600,
      'Rectifier': 800,
      'Battery Bank': 1500,
      'UPS': 800,
      'Generator': 5000
    };
    
    const basePrice = costEstimates[requirement.equipmentType] || 1000;
    
    return {
      estimatedCost: basePrice * (requirement.quantity || 1),
      confidence: 'low',
      source: 'fallback_default'
    };
  } catch (error) {
    console.error('Error estimating cost:', error);
    // Ultimate fallback
    return {
      estimatedCost: 1000 * (requirement.quantity || 1),
      confidence: 'low',
      source: 'error_fallback'
    };
  }
}

function generateMissingHardwareReason(requirement, missingQuantity, availableQuantity) {
  if (availableQuantity === 0) {
    return `No ${requirement.equipmentType} equipment available in inventory`;
  } else {
    return `Only ${availableQuantity} ${requirement.equipmentType} available, need ${missingQuantity} more`;
  }
}

function generateAlternatives(requirement) {
  const alternatives = [];
  
  // Add some generic alternatives based on equipment type
  switch (requirement.equipmentType) {
    case 'cpe-device':
      alternatives.push(
        { manufacturer: 'Ubiquiti', model: 'NanoStation M5', estimatedCost: 450, availability: 'in-stock' },
        { manufacturer: 'MikroTik', model: 'SXT Lite5', estimatedCost: 380, availability: 'in-stock' },
        { manufacturer: 'Cambium', model: 'ePMP 1000', estimatedCost: 520, availability: 'backorder' }
      );
      break;
    case 'sector-antenna':
      alternatives.push(
        { manufacturer: 'RFS', model: 'Sector Antenna 120?', estimatedCost: 1800, availability: 'in-stock' },
        { manufacturer: 'CommScope', model: 'Sector Antenna 90?', estimatedCost: 2200, availability: 'in-stock' }
      );
      break;
    case 'router':
      alternatives.push(
        { manufacturer: 'Cisco', model: 'ISR 4331', estimatedCost: 2500, availability: 'in-stock' },
        { manufacturer: 'Juniper', model: 'MX104', estimatedCost: 3000, availability: 'backorder' }
      );
      break;
  }
  
  return alternatives;
}

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

async function createEquipmentFromFeature(feature, planId, tenantId, user, session) {
  const { latitude, longitude } = extractLatLng(feature);
  if (latitude === null || longitude === null) {
    throw new Error('Equipment feature requires valid latitude/longitude');
  }

  const properties = feature.properties || {};
  const equipmentType = properties.type || properties.equipmentType || 'other';

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
    siteId: properties.siteId || null,
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

function extractLatLng(feature) {
  if (feature.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
    const [lng, lat] = feature.geometry.coordinates;
    return {
      latitude: typeof lat === 'number' ? lat : null,
      longitude: typeof lng === 'number' ? lng : null
    };
  }

  const location = feature.properties?.location;
  if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
    return {
      latitude: location.latitude,
      longitude: location.longitude
    };
  }

  return { latitude: null, longitude: null };
}

function normalizeEquipmentType(type) {
  const allowed = ['router', 'switch', 'power-supply', 'ups', 'generator', 'cable', 'connector', 'mounting-hardware', 'backhaul', 'antenna', 'radio', 'other'];
  if (!type) return 'other';
  const normalized = type.toLowerCase();
  return allowed.includes(normalized) ? normalized : 'other';
}

module.exports = router;

