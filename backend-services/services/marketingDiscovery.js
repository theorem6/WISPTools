// Marketing Address Discovery Service
// Extracted from plans.js for better organization and maintainability
// Version: 0.2

const axios = require('axios');
const axiosRetryModule = require('axios-retry');
const axiosRetry = axiosRetryModule.default || axiosRetryModule;
const appConfig = require('../config/app');

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
    console.log(`[MarketingDiscovery] Retry attempt ${retryCount} for ${requestConfig.url}: ${error.message}`);
  }
});

// Constants
const MAX_BUILDING_RESULTS = 10000;
const MAX_REVERSE_GEOCODE = 500;
const MAX_RESPONSE_ADDRESSES = 2000; // Reduced to prevent proxy timeouts
const NOMINATIM_DELAY_MS = 500;
const NOMINATIM_USER_AGENT = 'LTE-PCI-Mapper-Marketing/1.0 (admin@wisptools.io)';
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const ARCGIS_GEOCODER_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
const ARC_GIS_API_KEY = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || '';

const RURAL_AREA_THRESHOLD_KM2 = 1.0;
const RURAL_MIN_PRIMARY_RESULTS = 150;
const RURAL_MIN_AFTER_FALLBACK = 150;
const RURAL_FALLBACK_MAX_RESULTS = 600;

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

// Helper functions
const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const computeBoundingBoxAreaKm2 = (bbox) => {
  const width = Math.abs(bbox.east - bbox.west);
  const height = Math.abs(bbox.north - bbox.south);
  return width * height * 111 * 111;
};

// Overpass query builders
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
  (._;>;);
);
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
  
  (._;>;);
);
out body;
`;

// Overpass query execution
async function executeOverpassQuery({ query, label, timeoutMs = 45000 }) {
  try {
    if (!query || typeof query !== 'string') {
      throw new Error(`Invalid Overpass query for ${label}: query must be a non-empty string`);
    }

    console.log(`[MarketingDiscovery] Overpass request (${label}) starting`);
    
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

// Building candidate extraction
function extractBuildingCandidates(elements, { precision = 100000, sourceLabel = 'osm_primary' }) {
  const seen = new Map();
  const candidates = [];
  
  console.log(`[MarketingDiscovery] Extracting building candidates from ${elements.length} elements (source: ${sourceLabel})`);

  const sortedElements = [...elements];

  let extracted = 0;
  let skipped = 0;
  let skippedReasons = { noCoords: 0, duplicate: 0, invalid: 0 };

  for (const element of sortedElements) {
    let latitude;
    let longitude;

    if (element.type === 'way') {
      if (Array.isArray(element.geometry) && element.geometry.length > 0) {
        const coords = element.geometry.filter(g => g && g.lat !== undefined && g.lon !== undefined && Number.isFinite(toNumber(g.lat)) && Number.isFinite(toNumber(g.lon)));
        if (coords.length > 0) {
          const sumLat = coords.reduce((sum, g) => sum + toNumber(g.lat), 0);
          const sumLon = coords.reduce((sum, g) => sum + toNumber(g.lon), 0);
          latitude = sumLat / coords.length;
          longitude = sumLon / coords.length;
        } else if (element.center) {
          latitude = toNumber(element.center.lat);
          longitude = toNumber(element.center.lon);
        }
      } else if (element.center) {
        latitude = toNumber(element.center.lat);
        longitude = toNumber(element.center.lon);
      }
    } else if (element.type === 'node') {
      latitude = toNumber(element.lat);
      longitude = toNumber(element.lon);
    } else if (element.type === 'relation') {
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
      const coords = element.geometry.filter(g => g && g.lat !== undefined && g.lon !== undefined && Number.isFinite(toNumber(g.lat)) && Number.isFinite(toNumber(g.lon)));
      if (coords.length > 0) {
        const sumLat = coords.reduce((sum, g) => sum + toNumber(g.lat), 0);
        const sumLon = coords.reduce((sum, g) => sum + toNumber(g.lon), 0);
        latitude = sumLat / coords.length;
        longitude = sumLon / coords.length;
      } else {
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

// Reverse geocoding
const reverseGeocodeCoordinateArcgis = async (lat, lon) => {
  const runtimeApiKey = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || ARC_GIS_API_KEY || '';
  
  if (!runtimeApiKey) {
    return null;
  }

  try {
    const params = {
      f: 'json',
      location: `${lon.toFixed(7)},${lat.toFixed(7)}`,
      outFields: 'Address,City,Postal,Region,State,CountryCode',
      maxLocations: '1',
      token: runtimeApiKey
    };

    const response = await httpClient.get(`${ARCGIS_GEOCODER_URL}/reverseGeocode`, {
      params,
      timeout: 8000
    });
    
    const data = response.data;
    
    if (data.error) {
      if (data.error.code === 498 || data.error.message === 'Invalid Token') {
        console.warn('[MarketingDiscovery] ArcGIS reverse geocode API key invalid/expired:', {
          code: data.error.code,
          message: data.error.message,
          hasApiKey: !!runtimeApiKey
        });
        return null;
      }
      console.warn('[MarketingDiscovery] ArcGIS reverse geocode API error:', {
        code: data.error.code,
        message: data.error.message
      });
      return null;
    }
    
    if (!data.address) {
      console.warn('[MarketingDiscovery] ArcGIS returned no address data for', lat, lon);
      return null;
    }
    
    const address = data.address;
    const addressLine1 = address.Address || address.Match_addr;
    
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
      const status = error.response.status;
      const errorData = error.response.data;
      if (status === 498 || (errorData && (errorData.error?.code === 498 || errorData.error?.message === 'Invalid Token'))) {
        console.warn('[MarketingDiscovery] ArcGIS reverse geocode API key invalid/expired:', {
          status,
          code: errorData?.error?.code,
          message: errorData?.error?.message
        });
        return null;
      }
      console.warn('[MarketingDiscovery] ArcGIS reverse geocode HTTP error:', {
        status,
        statusText: error.response.statusText
      });
    } else {
      console.warn('[MarketingDiscovery] ArcGIS reverse geocode failed:', error.message || error);
    }
    return null;
  }
};

const reverseGeocodeCoordinate = async (lat, lon) => {
  const runtimeApiKey = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || ARC_GIS_API_KEY || '';
  
  if (runtimeApiKey) {
    const arcgisResult = await reverseGeocodeCoordinateArcgis(lat, lon);
    if (arcgisResult && arcgisResult.addressLine1 && !arcgisResult.addressLine1.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
      return arcgisResult;
    }
    console.log('[MarketingDiscovery] ArcGIS reverse geocode failed for', lat, lon, '- falling back to Nominatim');
  }

  try {
    const response = await httpClient.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'jsonv2',
        lat: lat.toFixed(7),
        lon: lon.toFixed(7),
        zoom: 18,
        addressdetails: 1
      },
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        Accept: 'application/json'
      },
      timeout: 5000
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

// Microsoft Footprints discovery (main algorithm)
async function discoverMicrosoftFootprints(boundingBox, options = {}) {
  const { progressCallback, requestId } = options;
  
  try {
    const microsoftFootprintsUrl = appConfig?.externalServices?.microsoftFootprints?.featureService ||
      'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/MSBFP2/FeatureServer/0/query';
    
    if (progressCallback) {
      progressCallback({ step: 'Querying Microsoft Building Footprints', progress: 10 });
    }

    const queryParams = {
      f: 'json',
      where: '1=1',
      geometryType: 'esriGeometryEnvelope',
      geometry: JSON.stringify({
        xmin: boundingBox.west,
        ymin: boundingBox.south,
        xmax: boundingBox.east,
        ymax: boundingBox.north,
        spatialReference: { wkid: 4326 }
      }),
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: true,
      resultRecordCount: 2000, // Microsoft service limit
      resultOffset: 0
    };

    if (ARC_GIS_API_KEY) {
      queryParams.token = ARC_GIS_API_KEY;
    }

    console.log('[MarketingDiscovery] Querying Microsoft Building Footprints:', {
      bbox: `${boundingBox.south.toFixed(7)},${boundingBox.west.toFixed(7)},${boundingBox.north.toFixed(7)},${boundingBox.east.toFixed(7)}`,
      requestId
    });

    const response = await httpClient.get(microsoftFootprintsUrl, {
      params: queryParams,
      timeout: 30000
    });

    const data = response.data;
    
    if (data.error) {
      console.error('[MarketingDiscovery] Microsoft Footprints API error:', data.error);
      throw new Error(`Microsoft Footprints API error: ${JSON.stringify(data.error)}`);
    }

    const features = Array.isArray(data.features) ? data.features : [];
    console.log('[MarketingDiscovery] Microsoft Footprints returned', features.length, 'features');

    if (progressCallback) {
      progressCallback({ step: 'Processing building footprints', progress: 30 });
    }

    const candidates = [];
    for (const feature of features) {
      if (!feature.geometry) continue;
      
      let lat, lon;
      
      // Calculate centroid from geometry
      if (feature.geometry.rings && Array.isArray(feature.geometry.rings[0])) {
        const ring = feature.geometry.rings[0];
        const coords = ring.filter(c => c && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]));
        if (coords.length > 0) {
          const sumLon = coords.reduce((sum, c) => sum + c[0], 0);
          const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
          lon = sumLon / coords.length;
          lat = sumLat / coords.length;
        }
      } else if (feature.geometry.x !== undefined && feature.geometry.y !== undefined) {
        lon = toNumber(feature.geometry.x);
        lat = toNumber(feature.geometry.y);
      }

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        candidates.push({
          lat,
          lon,
          tags: {},
          source: 'microsoft_footprints'
        });
      }
    }

    console.log('[MarketingDiscovery] Extracted', candidates.length, 'building candidates from Microsoft Footprints');
    return candidates;
  } catch (error) {
    console.error('[MarketingDiscovery] Microsoft Footprints discovery failed:', error.message || error);
    throw error;
  }
}

// Batch reverse geocode coordinates
async function batchReverseGeocodeCoordinates(coordinates = [], progressCallback) {
  try {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      console.log('[MarketingDiscovery] No coordinates to reverse geocode');
      return { addresses: [], geocoded: 0, failed: 0 };
    }

    const addresses = [];
    let geocodedCount = 0;
    let failedCount = 0;
    const reverseGeocodeStartTime = Date.now();
    
    const runtimeApiKey = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || ARC_GIS_API_KEY || '';
    const hasApiKey = !!runtimeApiKey;
    
    const REVERSE_GEOCODE_TIMEOUT = hasApiKey ? 8000 : 5000;
    const MAX_PARALLEL_GEOCODES = hasApiKey ? 30 : 10;
    const baseTimeout = hasApiKey ? 50 * 1000 : 90 * 1000;
    const coordinateBasedTimeout = Math.max(baseTimeout, Math.ceil(coordinates.length / MAX_PARALLEL_GEOCODES) * REVERSE_GEOCODE_TIMEOUT + 10000);
    const MAX_REVERSE_GEOCODE_TIME = Math.min(coordinateBasedTimeout, 90 * 1000);
    const MAX_COORDINATES_TO_GEOCODE = 10000;
    const overallTimeout = Date.now() + MAX_REVERSE_GEOCODE_TIME;
    
    const coordinatesToProcess = coordinates.length > MAX_COORDINATES_TO_GEOCODE 
      ? coordinates.slice(0, MAX_COORDINATES_TO_GEOCODE)
      : coordinates;
    
    if (coordinates.length > MAX_COORDINATES_TO_GEOCODE) {
      console.warn(`[MarketingDiscovery] Limiting reverse geocoding to ${MAX_COORDINATES_TO_GEOCODE} of ${coordinates.length} coordinates to prevent timeout`);
    }

    for (let batchStart = 0; batchStart < coordinatesToProcess.length; batchStart += MAX_PARALLEL_GEOCODES) {
      if (Date.now() > overallTimeout) {
        console.warn(`[MarketingDiscovery] Batch reverse geocoding timeout reached after ${MAX_REVERSE_GEOCODE_TIME / 1000}s. Processed ${batchStart}/${coordinatesToProcess.length} coordinates.`);
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

      const batchPromises = batch.map(async (coord, batchIndex) => {
        const originalIndex = batchStart + batchIndex;
        try {
          const latitude = toNumber(coord?.latitude);
          const longitude = toNumber(coord?.longitude);
          const source = coord?.source || 'unknown';
          
          if (latitude === undefined || longitude === undefined || 
              !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
              latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return {
              success: false,
              address: latitude !== undefined && longitude !== undefined ? {
                addressLine1: `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`,
                latitude,
                longitude,
                country: 'US',
                source
              } : null,
              index: originalIndex,
              source
            };
          }
          
          const geocodePromise = reverseGeocodeCoordinate(latitude, longitude);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Reverse geocode timeout')), REVERSE_GEOCODE_TIMEOUT)
          );
          
          const details = await Promise.race([geocodePromise, timeoutPromise]);
          
          if (details && details.addressLine1 && !details.addressLine1.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
            return {
              success: true,
              address: { ...details, source: source || details.source || 'unknown' },
              index: originalIndex,
              source
            };
          } else {
            return {
              success: false,
              address: {
                addressLine1: `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`,
                latitude,
                longitude,
                country: 'US',
                source
              },
              index: originalIndex,
              source
            };
          }
        } catch (error) {
          const lat = toNumber(coord?.latitude);
          const lon = toNumber(coord?.longitude);
          const coordSource = coord?.source || 'unknown';
          
          return {
            success: false,
            address: lat !== undefined && lon !== undefined ? {
              addressLine1: `${lat.toFixed(7)}, ${lon.toFixed(7)}`,
              latitude: lat,
              longitude: lon,
              country: 'US',
              source: coordSource
            } : null,
            index: originalIndex,
            source: coordSource
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.sort((a, b) => (a.index || 0) - (b.index || 0));
      
      for (const result of batchResults) {
        if (result.address) {
          addresses.push(result.address);
          if (result.success) {
            geocodedCount += 1;
          } else {
            failedCount += 1;
          }
        } else {
          failedCount += 1;
        }
      }

      const runtimeApiKeyCheck = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || ARC_GIS_API_KEY || '';
      if (batchEnd < coordinatesToProcess.length && !runtimeApiKeyCheck && Date.now() < overallTimeout) {
        await delay(1000);
      }
      
      if (Date.now() > overallTimeout) {
        console.warn(`[MarketingDiscovery] Timeout reached before processing all batches. Processed ${batchEnd}/${coordinatesToProcess.length} coordinates.`);
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
    
    if (coordinates.length > coordinatesToProcess.length) {
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
      geocoded: geocodedCount,
      failed: failedCount,
      processed: coordinatesToProcess.length,
      total: coordinates.length
    });

    return { addresses, geocoded: geocodedCount, failed: failedCount };
  } catch (error) {
    console.error('[MarketingDiscovery] Batch reverse geocoding error:', error?.message || error);
    return { addresses: [], geocoded: 0, failed: coordinates?.length || 0, error: error?.message || 'Unknown error' };
  }
}

// Distance calculation
const toRadians = (degrees) => degrees * (Math.PI / 180);

function distanceInMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
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
}

// Address hashing
function normalizeAddressComponent(value) {
  if (!value || typeof value !== 'string') return '';

  const directionMap = {
    northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
    north: 'n', south: 's', east: 'e', west: 'w'
  };

  const streetTypeMap = {
    street: 'st', avenue: 'ave', boulevard: 'blvd', court: 'ct',
    drive: 'dr', lane: 'ln', place: 'pl', road: 'rd',
    terrace: 'ter', trail: 'trl', highway: 'hwy', parkway: 'pkwy', circle: 'cir'
  };

  let normalized = value.toLowerCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim();

  Object.entries(directionMap).forEach(([full, abbr]) => {
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  });

  Object.entries(streetTypeMap).forEach(([full, abbr]) => {
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  });

  return normalized;
}

function buildAddressHash(address = {}) {
  const latitude = toNumber(address.latitude);
  const longitude = toNumber(address.longitude);
  const line1 = normalizeAddressComponent(address.addressLine1 || '');
  const postal = normalizeAddressComponent(address.postalCode || address.zip || '');

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${latitude.toFixed(7)}|${longitude.toFixed(7)}|${line1}|${postal}`;
  }

  if (line1) {
    return `${line1}|${postal}`;
  }

  return null;
}

function normalizeArcgisAddressKey(address = {}) {
  return buildAddressHash(address);
}

// ArcGIS Address Points discovery by bounding box
async function discoverAddressPointsByBoundingBox({ boundingBox, center, radiusMiles }) {
  const result = {
    addresses: [],
    error: null
  };

  try {
    const runtimeApiKey = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || ARC_GIS_API_KEY || '';
    
    if (!runtimeApiKey) {
      result.error = 'ArcGIS API key not configured';
      return result;
    }

    if (!boundingBox || !boundingBox.west || !boundingBox.south || !boundingBox.east || !boundingBox.north) {
      result.error = 'Invalid bounding box';
      return result;
    }

    // Use ArcGIS Geocoding Service to find address candidates within bounding box
    // We'll query with a search that should return addresses in the area
    const searchExtent = `${boundingBox.west},${boundingBox.south},${boundingBox.east},${boundingBox.north}`;
    
    // Query for address points - use findAddressCandidates with bounding box
    const params = {
      f: 'json',
      searchExtent: searchExtent,
      outFields: 'Match_addr,Addr_type,City,Region,Postal,Country',
      maxLocations: 2000, // Max allowed by ArcGIS
      outSR: 4326,
      forStorage: false,
      token: runtimeApiKey
    };

    // Try multiple queries to get residential addresses
    // Use a generic search that should return addresses in the area
    const queries = [];
    
    // Query 1: Search for addresses in the center of the bounding box
    const centerLat = center?.lat || (boundingBox.north + boundingBox.south) / 2;
    const centerLon = center?.lon || (boundingBox.east + boundingBox.west) / 2;
    
    queries.push({
      singleLine: `${centerLat},${centerLon}`,
      searchExtent: searchExtent,
      category: 'Address',
      maxLocations: 2000,
      token: runtimeApiKey
    });

    const addresses = [];
    const seenAddresses = new Set();

    for (const queryParams of queries) {
      try {
        const response = await httpClient.get(`${ARCGIS_GEOCODER_URL}/findAddressCandidates`, {
          params: {
            f: 'json',
            ...queryParams,
            outFields: 'Match_addr,Addr_type,City,Region,Postal,Country,StAddr',
            outSR: 4326,
            forStorage: false
          },
          timeout: 15000
        });

        const data = response.data;
        
        if (data.error) {
          console.warn('[MarketingDiscovery] ArcGIS address points query error:', data.error);
          continue;
        }

        if (data.candidates && Array.isArray(data.candidates)) {
          for (const candidate of data.candidates) {
            if (!candidate.location) continue;
            
            const lat = candidate.location.y;
            const lon = candidate.location.x;
            
            // Check if within bounding box
            if (lat < boundingBox.south || lat > boundingBox.north ||
                lon < boundingBox.west || lon > boundingBox.east) {
              continue;
            }

            // Filter to residential addresses only (exclude POI)
            const addrType = candidate.attributes?.Addr_type || '';
            if (addrType && !['PointAddress', 'StreetAddress', 'Subaddress'].includes(addrType)) {
              continue;
            }

            const addressKey = `${lat.toFixed(7)},${lon.toFixed(7)}`;
            if (seenAddresses.has(addressKey)) {
              continue;
            }
            seenAddresses.add(addressKey);

            const addressLine1 = candidate.attributes?.StAddr || candidate.attributes?.Match_addr || '';
            
            addresses.push({
              addressLine1: addressLine1,
              city: candidate.attributes?.City || undefined,
              state: candidate.attributes?.Region || undefined,
              postalCode: candidate.attributes?.Postal || undefined,
              country: candidate.attributes?.Country || 'US',
              latitude: lat,
              longitude: lon,
              source: 'arcgis_address_points'
            });
          }
        }
      } catch (queryError) {
        console.warn('[MarketingDiscovery] ArcGIS address points query failed:', queryError.message);
        // Continue with other queries
      }
    }

    result.addresses = addresses;
    console.log(`[MarketingDiscovery] ArcGIS address points discovery found ${addresses.length} addresses`);
    
    return result;
  } catch (error) {
    result.error = error?.message || 'Unknown error in ArcGIS address points discovery';
    console.error('[MarketingDiscovery] ArcGIS address points discovery error:', error);
    return result;
  }
}

// ArcGIS Places discovery by bounding box
async function discoverPlacesByBoundingBox({ boundingBox, center, radiusMiles }) {
  const result = {
    addresses: [],
    error: null
  };

  try {
    const runtimeApiKey = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || ARC_GIS_API_KEY || '';
    
    if (!runtimeApiKey) {
      result.error = 'ArcGIS API key not configured';
      return result;
    }

    if (!boundingBox || !boundingBox.west || !boundingBox.south || !boundingBox.east || !boundingBox.north) {
      result.error = 'Invalid bounding box';
      return result;
    }

    const searchExtent = `${boundingBox.west},${boundingBox.south},${boundingBox.east},${boundingBox.north}`;
    
    // Query for POI/Places
    const params = {
      f: 'json',
      searchExtent: searchExtent,
      category: 'POI',
      maxLocations: 2000,
      outSR: 4326,
      forStorage: false,
      token: runtimeApiKey
    };

    const addresses = [];
    const seenAddresses = new Set();

    try {
      const response = await httpClient.get(`${ARCGIS_GEOCODER_URL}/findAddressCandidates`, {
        params: {
          f: 'json',
          category: 'POI',
          searchExtent: searchExtent,
          maxLocations: 2000,
          outFields: 'Match_addr,Place_addr,PlaceName,City,Region,Postal,Country',
          outSR: 4326,
          forStorage: false,
          token: runtimeApiKey
        },
        timeout: 15000
      });

      const data = response.data;
      
      if (data.error) {
        result.error = data.error.message || 'ArcGIS places query error';
        return result;
      }

      if (data.candidates && Array.isArray(data.candidates)) {
        for (const candidate of data.candidates) {
          if (!candidate.location) continue;
          
          const lat = candidate.location.y;
          const lon = candidate.location.x;
          
          // Check if within bounding box
          if (lat < boundingBox.south || lat > boundingBox.north ||
              lon < boundingBox.west || lon > boundingBox.east) {
            continue;
          }

          const addressKey = `${lat.toFixed(7)},${lon.toFixed(7)}`;
          if (seenAddresses.has(addressKey)) {
            continue;
          }
          seenAddresses.add(addressKey);

          const addressLine1 = candidate.attributes?.Place_addr || candidate.attributes?.Match_addr || candidate.attributes?.PlaceName || '';
          
          addresses.push({
            addressLine1: addressLine1,
            city: candidate.attributes?.City || undefined,
            state: candidate.attributes?.Region || undefined,
            postalCode: candidate.attributes?.Postal || undefined,
            country: candidate.attributes?.Country || 'US',
            latitude: lat,
            longitude: lon,
            source: 'arcgis_places'
          });
        }
      }
    } catch (queryError) {
      result.error = queryError?.message || 'ArcGIS places query failed';
      console.error('[MarketingDiscovery] ArcGIS places discovery error:', queryError);
      return result;
    }

    result.addresses = addresses;
    console.log(`[MarketingDiscovery] ArcGIS places discovery found ${addresses.length} places`);
    
    return result;
  } catch (error) {
    result.error = error?.message || 'Unknown error in ArcGIS places discovery';
    console.error('[MarketingDiscovery] ArcGIS places discovery error:', error);
    return result;
  }
}

module.exports = {
  // Query execution
  executeOverpassQuery,
  buildPrimaryOverpassQuery,
  buildFallbackOverpassQuery,
  
  // Building extraction
  extractBuildingCandidates,
  mergeCandidateSets,
  candidateHasResidentialSignal,
  candidateLooksLikeRoad,
  
  // Reverse geocoding
  reverseGeocodeCoordinate,
  reverseGeocodeCoordinateArcgis,
  batchReverseGeocodeCoordinates,
  
  // Algorithm implementations
  discoverMicrosoftFootprints,
  discoverAddressPointsByBoundingBox,
  discoverPlacesByBoundingBox,
  
  // Address utilities
  buildAddressHash,
  normalizeAddressComponent,
  normalizeArcgisAddressKey,
  distanceInMeters,
  
  // Utilities
  computeBoundingBoxAreaKm2,
  delay,
  toNumber,
  
  // Constants
  MAX_BUILDING_RESULTS,
  MAX_REVERSE_GEOCODE,
  MAX_RESPONSE_ADDRESSES,
  NOMINATIM_DELAY_MS,
  OVERPASS_ENDPOINT,
  RURAL_AREA_THRESHOLD_KM2,
  RURAL_MIN_PRIMARY_RESULTS,
  RURAL_MIN_AFTER_FALLBACK,
  RURAL_FALLBACK_MAX_RESULTS,
  RESIDENTIAL_BUILDING_TYPES
};

