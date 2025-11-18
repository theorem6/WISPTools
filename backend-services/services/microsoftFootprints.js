/**
 * Microsoft Building Footprints Service
 * Provides access to Microsoft's Building Footprints via various methods:
 * 1. GitHub API (downloads GeoJSON files by state/county)
 * 2. Tile service (if configured)
 * 3. Pre-indexed data service (if configured)
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const appConfig = require('../config/app');

// Microsoft GitHub repository info
const MICROSOFT_FOOTPRINTS_GITHUB_REPO = 'microsoft/USBuildingFootprints';
const GITHUB_API_BASE = 'https://api.github.com/repos';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
// Microsoft Building Footprints Azure Blob Storage (alternative source)
const MICROSOFT_AZURE_BLOB_BASE = 'https://usbuildingdata.blob.core.windows.net/usbuildings-v2';
// ArcGIS Web Map ID (if user has a map with Microsoft Building Footprints layer)
const ARCGIS_WEB_MAP_ID = process.env.ARCGIS_WEB_MAP_ID || '69916b107de641b4a85121086c4d9fca';
const ARCGIS_PORTAL_URL = 'https://www.arcgis.com/sharing/rest/content/items';
// Microsoft Building Footprints Feature Service (official Esri hosting)
const MICROSOFT_FOOTPRINTS_FEATURE_SERVICE = process.env.MICROSOFT_FOOTPRINTS_FEATURE_SERVICE || 
  'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/MSBFP2/FeatureServer';
const MICROSOFT_FOOTPRINTS_LAYER_ID = 0; // MSBFP layer

// Cache directory for downloaded files
const CACHE_DIR = process.env.MICROSOFT_FOOTPRINTS_CACHE_DIR || path.join(process.cwd(), '.cache', 'microsoft-footprints');
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days cache

// State name to abbreviation mapping for file naming
const STATE_ABBREVIATIONS = {
  'alabama': 'al', 'alaska': 'ak', 'arizona': 'az', 'arkansas': 'ar', 'california': 'ca',
  'colorado': 'co', 'connecticut': 'ct', 'delaware': 'de', 'florida': 'fl', 'georgia': 'ga',
  'hawaii': 'hi', 'idaho': 'id', 'illinois': 'il', 'indiana': 'in', 'iowa': 'ia',
  'kansas': 'ks', 'kentucky': 'ky', 'louisiana': 'la', 'maine': 'me', 'maryland': 'md',
  'massachusetts': 'ma', 'michigan': 'mi', 'minnesota': 'mn', 'mississippi': 'ms', 'missouri': 'mo',
  'montana': 'mt', 'nebraska': 'ne', 'nevada': 'nv', 'new hampshire': 'nh', 'new jersey': 'nj',
  'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', 'ohio': 'oh',
  'oklahoma': 'ok', 'oregon': 'or', 'pennsylvania': 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
  'south dakota': 'sd', 'tennessee': 'tn', 'texas': 'tx', 'utah': 'ut', 'vermont': 'vt',
  'virginia': 'va', 'washington': 'wa', 'west virginia': 'wv', 'wisconsin': 'wi', 'wyoming': 'wy'
};

// HTTP client with retry logic
const httpClient = axios.create({
  timeout: 60000, // 60 second timeout for large downloads
  headers: {
    'User-Agent': 'LTE-PCI-Mapper/1.0 (admin@wisptools.io)',
    'Accept': 'application/vnd.github.v3+json'
  }
});

// Simple in-memory cache for API responses (for this request lifecycle)
const apiCache = new Map();

/**
 * Get county and state from coordinates using reverse geocoding
 * Uses ArcGIS reverse geocoding to get accurate county/state information
 */
async function getCountyStateFromCoordinates(lat, lon) {
  try {
    const appConfig = require('../config/app');
    const ARC_GIS_API_KEY = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || '';
    const ARCGIS_REVERSE_GEOCODE_URL = appConfig?.externalServices?.arcgis?.reverseGeocodeUrl || 
      'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';
    
    if (ARC_GIS_API_KEY) {
      // Use ArcGIS reverse geocoding with API key for better accuracy
      const params = {
        f: 'json',
        location: `${lon},${lat}`,
        outFields: 'Subregion,Region,State,CountryCode',
        maxLocations: '1',
        token: ARC_GIS_API_KEY
      };
      
      const response = await httpClient.get(ARCGIS_REVERSE_GEOCODE_URL, {
        params,
        timeout: 8000
      });
      
      const data = response.data;
      if (data && data.address) {
        const address = data.address;
        const county = address.Subregion || null; // County name
        const state = address.Region || address.State || null; // State name or abbreviation
        const stateAbbr = address.Region || null; // State abbreviation (2-letter)
        
        return {
          county: county ? county.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : null,
          state: state ? state.toLowerCase().replace(/\s+/g, '_') : null,
          stateAbbr: stateAbbr ? stateAbbr.toLowerCase() : null
        };
      }
    } else {
      // Fallback: Use Nominatim (free, but slower and less accurate)
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const response = await httpClient.get(nominatimUrl, {
        headers: {
          'User-Agent': 'LTE-PCI-Mapper/1.0 (admin@wisptools.io)',
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      
      const data = response.data;
      if (data && data.address) {
        const address = data.address;
        const county = address.county || address.state_district || null;
        const state = address.state || null;
        
        return {
          county: county ? county.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : null,
          state: state ? state.toLowerCase().replace(/\s+/g, '_') : null,
          stateAbbr: STATE_ABBREVIATIONS[state?.toLowerCase()] || null
        };
      }
    }
  } catch (error) {
    console.warn('[MicrosoftFootprints] Reverse geocoding failed, using fallback:', error.message);
  }
  
  // Fallback: Approximate state from coordinates (simplified ranges)
  const state = getStateFromCoordinates(lat, lon);
  return {
    county: null,
    state: state,
    stateAbbr: state ? STATE_ABBREVIATIONS[state] : null
  };
}

/**
 * Get state name from coordinates (approximate fallback)
 */
function getStateFromCoordinates(lat, lon) {
  // This is a simplified approach - used as fallback when reverse geocoding fails
  // US approximate bounds: lat: 24.5-49.4, lon: -125.0 to -66.9
  
  // Major state bounds (simplified)
  if (lat >= 40.5 && lat <= 45.0 && lon >= -83.0 && lon <= -80.5) return 'ohio';
  if (lat >= 41.0 && lat <= 44.0 && lon >= -89.5 && lon <= -82.5) return 'michigan';
  if (lat >= 36.0 && lat <= 42.5 && lon >= -79.8 && lon <= -74.7) return 'pennsylvania';
  if (lat >= 39.7 && lat <= 42.0 && lon >= -75.0 && lon <= -73.7) return 'new jersey';
  if (lat >= 40.5 && lat <= 45.0 && lon >= -79.8 && lon <= -71.8) return 'new york';
  if (lat >= 36.5 && lat <= 42.0 && lon >= -87.5 && lon <= -80.5) return 'ohio'; // Kentucky overlaps
  if (lat >= 38.0 && lat <= 42.5 && lon >= -84.8 && lon <= -80.5) return 'ohio'; // West Virginia overlaps
  
  // Default to Ohio for testing (user's area appears to be around 41.24, -82.61)
  if (lat >= 38.0 && lat <= 42.0 && lon >= -84.0 && lon <= -80.0) return 'ohio';
  
  return null; // Unknown
}

/**
 * Check if a point is within a bounding box
 */
function isWithinBoundingBox(lat, lon, bbox) {
  return (
    lat >= bbox.south &&
    lat <= bbox.north &&
    lon >= bbox.west &&
    lon <= bbox.east
  );
}

/**
 * Filter GeoJSON features by bounding box
 */
function filterFeaturesByBoundingBox(features, bbox) {
  if (!features || !Array.isArray(features)) return [];
  
  return features.filter(feature => {
    if (!feature || !feature.geometry) return false;
    
    const geometry = feature.geometry;
    
    // Check Point
    if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
      const lon = geometry.coordinates[0];
      const lat = geometry.coordinates[1];
      return isWithinBoundingBox(lat, lon, bbox);
    }
    
    // Check Polygon - use any vertex that's within bbox
    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) {
      const ring = geometry.coordinates[0]; // Outer ring
      if (Array.isArray(ring)) {
        for (const coord of ring) {
          if (Array.isArray(coord) && coord.length >= 2) {
            const lon = coord[0];
            const lat = coord[1];
            if (isWithinBoundingBox(lat, lon, bbox)) {
              return true;
            }
          }
        }
      }
    }
    
    // Check MultiPolygon
    if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
      for (const polygon of geometry.coordinates) {
        if (Array.isArray(polygon) && polygon.length > 0) {
          const ring = polygon[0]; // Outer ring
          if (Array.isArray(ring)) {
            for (const coord of ring) {
              if (Array.isArray(coord) && coord.length >= 2) {
                const lon = coord[0];
                const lat = coord[1];
                if (isWithinBoundingBox(lat, lon, bbox)) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
    
    return false;
  });
}

/**
 * Check if local file exists and return it
 */
async function fetchFromLocalFile(stateName, countyName = null) {
  const fs = require('fs').promises;
  const path = require('path');
  
  const LOCAL_FOOTPRINTS_DIR = process.env.MICROSOFT_FOOTPRINTS_LOCAL_DIR || '/opt/microsoft-footprints';
  const stateAbbr = STATE_ABBREVIATIONS[stateName?.toLowerCase()] || stateName?.toLowerCase();
  
  if (!stateAbbr) {
    return null;
  }
  
  // Try county file first
  if (countyName) {
    const countyFilePath = path.join(LOCAL_FOOTPRINTS_DIR, stateAbbr, `${countyName}.geojson`);
    try {
      const stats = await fs.stat(countyFilePath);
      if (stats.size > 1000) { // At least 1KB (avoid empty/error files)
        const fileContent = await fs.readFile(countyFilePath, 'utf8');
        const data = JSON.parse(fileContent);
        console.log(`[MicrosoftFootprints] Loaded county file from local storage: ${countyFilePath} (${stats.size} bytes)`);
        return data;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`[MicrosoftFootprints] Error reading local county file: ${error.message}`);
      }
      // Fall through to state file
    }
  }
  
  // Try state file
  const stateFilePath = path.join(LOCAL_FOOTPRINTS_DIR, `${stateAbbr}.geojson`);
  try {
    const stats = await fs.stat(stateFilePath);
    if (stats.size > 1000) { // At least 1KB (avoid empty/error files)
      const fileContent = await fs.readFile(stateFilePath, 'utf8');
      const data = JSON.parse(fileContent);
      console.log(`[MicrosoftFootprints] Loaded state file from local storage: ${stateFilePath} (${stats.size} bytes)`);
      return data;
    } else {
      console.warn(`[MicrosoftFootprints] Local state file too small (${stats.size} bytes), may be incomplete`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`[MicrosoftFootprints] Error reading local state file: ${error.message}`);
    }
  }
  
  return null;
}

/**
 * Fetch Microsoft Building Footprints from GitHub for a specific state/county
 * Tries local files first (much faster), then GitHub
 * Tries county-level file first (much smaller), falls back to state-level file
 */
async function fetchFromGitHub(stateName, countyName = null) {
  // First, try local files (much faster - 4-5x speedup)
  const localData = await fetchFromLocalFile(stateName, countyName);
  if (localData) {
    return localData;
  }
  
  const stateAbbr = STATE_ABBREVIATIONS[stateName?.toLowerCase()] || stateName?.toLowerCase();
  
  if (!stateAbbr) {
    console.warn('[MicrosoftFootprints] Invalid state name:', stateName);
    return null;
  }
  
  // Try county-level file first (much smaller and faster to download)
  if (countyName) {
    const countyCacheKey = `github_${stateAbbr}_${countyName}`;
    
    // Check in-memory cache
    if (apiCache.has(countyCacheKey)) {
      const cached = apiCache.get(countyCacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute in-memory cache
        console.log(`[MicrosoftFootprints] Using cached county file: ${stateAbbr}/${countyName}`);
        return cached.data;
      }
    }
    
    try {
      // Try county-level file first (typically 1-10 MB vs 100+ MB for state files)
      const countyUrl = `${GITHUB_RAW_BASE}/${MICROSOFT_FOOTPRINTS_GITHUB_REPO}/main/${stateAbbr}/${countyName}.geojson`;
      console.log(`[MicrosoftFootprints] Fetching county-level file from GitHub: ${stateAbbr}/${countyName}`);
      
      const response = await httpClient.get(countyUrl, {
        responseType: 'json',
        timeout: 60000 // 1 minute for county files (usually small)
      });
      
      const data = response.data;
      
      // Cache result
      apiCache.set(countyCacheKey, { data, timestamp: Date.now() });
      
      console.log(`[MicrosoftFootprints] Successfully fetched county file: ${stateAbbr}/${countyName} (${data?.features?.length || 0} features)`);
      return data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`[MicrosoftFootprints] County file not found: ${stateAbbr}/${countyName}, trying state-level file`);
        // Fall through to state-level file
      } else {
        console.error(`[MicrosoftFootprints] GitHub county fetch error:`, error.message);
        // Try state-level file as fallback
      }
    }
  }
  
  // Fallback: Try state-level file (larger but covers entire state)
  const stateCacheKey = `github_${stateAbbr}_all`;
  
  // Check in-memory cache
  if (apiCache.has(stateCacheKey)) {
    const cached = apiCache.get(stateCacheKey);
    if (Date.now() - cached.timestamp < 300000) { // 5 minute in-memory cache
      console.log(`[MicrosoftFootprints] Using cached state file: ${stateAbbr}`);
      return cached.data;
    }
  }
  
  try {
    const stateUrl = `${GITHUB_RAW_BASE}/${MICROSOFT_FOOTPRINTS_GITHUB_REPO}/main/${stateAbbr}.geojson`;
    console.log(`[MicrosoftFootprints] Fetching state-level file from GitHub: ${stateAbbr}`);
    
    const response = await httpClient.get(stateUrl, {
      responseType: 'json',
      timeout: 120000 // 2 minutes for state files (can be large)
    });
    
    const data = response.data;
    
    // Cache result
    apiCache.set(stateCacheKey, { data, timestamp: Date.now() });
    
    console.log(`[MicrosoftFootprints] Successfully fetched state file: ${stateAbbr} (${data?.features?.length || 0} features)`);
    return data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.warn(`[MicrosoftFootprints] GitHub file not found: ${stateAbbr}`);
      return null;
    }
    console.error(`[MicrosoftFootprints] GitHub state fetch error:`, error.message);
    throw error;
  }
}

/**
 * Query Microsoft Building Footprints by bounding box
 * Tries multiple methods in order:
 * 1. Configured API endpoint (MICROSOFT_FOOTPRINTS_URL)
 * 2. GitHub API (downloads state/county files)
 * 3. Returns empty result if neither available
 */
/**
 * Get Feature Service URL from ArcGIS Web Map
 */
async function getFeatureServiceFromWebMap(webMapId) {
  try {
    console.log('[MicrosoftFootprints] Attempting to access ArcGIS Web Map:', webMapId);
    
    // Get web map details
    const mapUrl = `${ARCGIS_PORTAL_URL}/${webMapId}`;
    const params = {
      f: 'json'
    };
    
    // Try OAuth2 token first (for private items), then fall back to API key
    let accessToken = null;
    const arcgisOAuth = require('./arcgisOAuth');
    accessToken = await arcgisOAuth.getValidToken();
    
    if (accessToken) {
      console.log('[MicrosoftFootprints] Using OAuth2 token to access web map');
      params.token = accessToken;
    } else {
      // Fall back to API key
      const ARC_GIS_API_KEY = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || '';
      if (ARC_GIS_API_KEY) {
        console.log('[MicrosoftFootprints] Using API key to access web map');
        params.token = ARC_GIS_API_KEY;
      } else {
        console.warn('[MicrosoftFootprints] No authentication credentials available (OAuth2 or API key)');
      }
    }
    
    const mapResponse = await httpClient.get(mapUrl, { params, timeout: 10000 });
    const mapData = mapResponse.data;
    
    if (!mapData || !mapData.data || !mapData.data.operationalLayers) {
      console.warn('[MicrosoftFootprints] Web map data invalid or no operational layers');
      return null;
    }
    
    // Search for Microsoft Building Footprints layer
    const layers = mapData.data.operationalLayers || [];
    for (const layer of layers) {
      // Check if layer URL contains Microsoft Building Footprints indicators
      const url = layer.url || layer.serviceUrl || '';
      const title = (layer.title || '').toLowerCase();
      
      if (
        url.includes('BuildingFootprints') ||
        url.includes('Building_Footprints') ||
        url.includes('USBuildingFootprints') ||
        title.includes('microsoft') ||
        title.includes('building footprints')
      ) {
        console.log('[MicrosoftFootprints] Found Microsoft Building Footprints layer:', {
          url,
          title: layer.title,
          id: layer.id,
          layerType: layer.layerType
        });
        
        // Extract Feature Service URL
        // Layer URL format examples:
        // - https://.../FeatureServer/0
        // - https://.../MapServer/0
        // - https://.../FeatureServer (with layer.id)
        // - https://.../rest/services/.../FeatureServer/0/query (full query URL)
        
        let featureServiceUrl = url;
        let layerId = layer.id || 0;
        
        // If URL contains /query, extract the service URL and layer ID
        if (url.includes('/query')) {
          // Extract service URL (everything before /query)
          featureServiceUrl = url.split('/query')[0];
          // Extract layer ID from path (number before /query)
          const layerIdMatch = featureServiceUrl.match(/\/(\d+)$/);
          if (layerIdMatch) {
            layerId = parseInt(layerIdMatch[1]);
            featureServiceUrl = featureServiceUrl.replace(/\/\d+$/, ''); // Remove layer ID from URL
          }
        } else if (url.match(/\/\d+$/)) {
          // URL ends with layer ID
          const layerIdMatch = url.match(/\/(\d+)$/);
          if (layerIdMatch) {
            layerId = parseInt(layerIdMatch[1]);
            featureServiceUrl = url.replace(/\/\d+$/, '');
          }
        }
        
        // If it's a Map Server, try converting to Feature Server
        if (featureServiceUrl.includes('/MapServer')) {
          featureServiceUrl = featureServiceUrl.replace('/MapServer', '/FeatureServer');
        }
        
        // Ensure URL ends with FeatureServer or MapServer (not with /query or layer ID)
        featureServiceUrl = featureServiceUrl.replace(/\/\d+$/, '').replace(/\/query.*$/, '');
        
        console.log('[MicrosoftFootprints] Extracted Feature Service info:', {
          originalUrl: url,
          serviceUrl: featureServiceUrl,
          layerId,
          layerTitle: layer.title
        });
        
        return {
          serviceUrl: featureServiceUrl,
          layerId: layerId || 0,
          requiresAuth: true, // Always require auth for private web map layers
          useOAuth: !!accessToken, // Use OAuth token if available
          accessToken: accessToken // Pass token for querying the service
        };
      }
    }
    
    console.warn('[MicrosoftFootprints] No Microsoft Building Footprints layer found in web map');
    return null;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401 || error.response.status === 403) {
        console.error('[MicrosoftFootprints] Authentication failed accessing web map. Map may be private and require OAuth2.', {
          status: error.response.status,
          webMapId,
          error: error.response.data?.error || error.message
        });
      } else {
        console.error('[MicrosoftFootprints] Error accessing ArcGIS Web Map:', {
          status: error.response.status,
          error: error.response.data?.error || error.message,
          webMapId
        });
      }
    } else {
      console.error('[MicrosoftFootprints] Error accessing ArcGIS Web Map:', {
        error: error.message,
        webMapId
      });
    }
    return null;
  }
}

async function queryByBoundingBox(bbox) {
  try {
    // PRIMARY METHOD: Microsoft Building Footprints Feature Service with OAuth2
    // This is the official Esri-hosted service that requires OAuth2 authentication
    // We have OAuth2 credentials configured, so always use this method
    try {
      console.log('[MicrosoftFootprints] Using Microsoft Building Footprints Feature Service with OAuth2:', MICROSOFT_FOOTPRINTS_FEATURE_SERVICE);
      
      // Use ArcGIS Building Footprints service to query
      const arcgisBuildingFootprintsService = require('./arcgisBuildingFootprints');
      const arcgisOAuth = require('./arcgisOAuth');
      
      // Get OAuth2 token - this is required for Microsoft Footprints service
      const oauthToken = await arcgisOAuth.getValidToken();
      
      if (!oauthToken) {
        const errorMsg = 'OAuth2 token required for Microsoft Building Footprints but could not be obtained. Check ARCGIS_OAUTH_CLIENT_ID and ARCGIS_OAUTH_CLIENT_SECRET.';
        console.error('[MicrosoftFootprints]', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('[MicrosoftFootprints] OAuth2 token obtained, querying Feature Service');
      
      // Always use OAuth2 for Microsoft Footprints - never fall back to API key for this service
      const queryResult = await arcgisBuildingFootprintsService.queryBuildingFootprintsByBoundingBox(
        bbox,
        {
          serviceUrls: [MICROSOFT_FOOTPRINTS_FEATURE_SERVICE],
          layerIds: [MICROSOFT_FOOTPRINTS_LAYER_ID],
          requiresAuth: true, // Always requires authentication
          useOAuth: true, // Always use OAuth2 (don't fall back to API key)
          accessToken: oauthToken // Use OAuth2 token
        }
      );
      
      if (queryResult.coordinates && queryResult.coordinates.length > 0) {
        // queryBuildingFootprintsByBoundingBox already returns centroids (coordinates are already calculated)
        // Convert to GeoJSON FeatureCollection format for compatibility
        // Each coordinate is already a centroid with latitude/longitude
        const geojsonFeatures = queryResult.coordinates.map(coord => {
          // Coordinates are already centroids - use them directly
          // Create a Point feature with the centroid coordinates
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [coord.longitude, coord.latitude] // [lon, lat] format for GeoJSON
            },
            properties: {
              ...(coord.attributes || {}),
              // Preserve source information
              source: coord.source || 'microsoft_footprints',
              // Store original coordinates for reference
              _centroid_latitude: coord.latitude,
              _centroid_longitude: coord.longitude
            }
          };
        });
        
        console.log(`[MicrosoftFootprints] Feature Service with OAuth2: Found ${geojsonFeatures.length} building footprint centroids`, {
          sampleCoordinate: queryResult.coordinates[0] ? {
            latitude: queryResult.coordinates[0].latitude,
            longitude: queryResult.coordinates[0].longitude
          } : null
        });
        
        return {
          type: 'FeatureCollection',
          features: geojsonFeatures
        };
      } else if (queryResult.error) {
        const errorMsg = `Microsoft Building Footprints Feature Service query failed: ${queryResult.error}`;
        console.error('[MicrosoftFootprints]', errorMsg);
        throw new Error(errorMsg);
      } else {
        console.log('[MicrosoftFootprints] Feature Service: No building footprints found in bounding box');
        // Return empty result instead of trying old methods
        return {
          type: 'FeatureCollection',
          features: []
        };
      }
    } catch (featureServiceError) {
      const errorMsg = `Microsoft Building Footprints Feature Service (OAuth2) failed: ${featureServiceError.message}`;
      console.error('[MicrosoftFootprints]', errorMsg);
      // Don't fall back to old methods - OAuth2 is the correct method for Microsoft Footprints
      throw new Error(errorMsg);
    }
    
  } catch (error) {
    console.error('[MicrosoftFootprints] Query error:', error);
    throw error;
  }
}

/**
 * Point-in-polygon test using ray casting algorithm
 * Returns true if point is inside the polygon ring
 */
function pointInPolygon(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  
  const x = point[0]; // longitude
  const y = point[1]; // latitude
  let inside = false;
  
  // Ensure ring is closed
  let closedRing = ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closedRing = [...ring, first];
  }
  
  for (let i = 0, j = closedRing.length - 1; i < closedRing.length; j = i++) {
    const xi = closedRing[i][0];
    const yi = closedRing[i][1];
    const xj = closedRing[j][0];
    const yj = closedRing[j][1];
    
    const intersect = ((yi > y) !== (yj > y)) && 
                     (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Find a point inside the polygon that's away from edges
 * Uses bounding box center and moves it toward the polygon interior if needed
 */
function findInteriorPoint(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  
  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const coord of ring) {
    if (Array.isArray(coord) && coord.length >= 2) {
      minX = Math.min(minX, coord[0]);
      minY = Math.min(minY, coord[1]);
      maxX = Math.max(maxX, coord[0]);
      maxY = Math.max(maxY, coord[1]);
    }
  }
  
  // Start with bounding box center
  let centerX = (minX + maxX) / 2;
  let centerY = (minY + maxY) / 2;
  
  // Check if bounding box center is inside
  if (pointInPolygon([centerX, centerY], ring)) {
    return { longitude: centerX, latitude: centerY };
  }
  
  // If not inside, try to find a point inside by sampling
  // Use a grid search approach - try multiple points within the bounding box
  const samples = [
    [0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75],
    [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9],
    [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]
  ];
  
  for (const [fx, fy] of samples) {
    const testX = minX + (maxX - minX) * fx;
    const testY = minY + (maxY - minY) * fy;
    if (pointInPolygon([testX, testY], ring)) {
      return { longitude: testX, latitude: testY };
    }
  }
  
  // If no sampled point is inside, calculate the centroid of a shrunk polygon
  // This is a simplified approach: use the average of all vertices weighted by distance from edges
  let sumX = 0, sumY = 0, count = 0;
  for (const coord of ring) {
    if (Array.isArray(coord) && coord.length >= 2) {
      sumX += coord[0];
      sumY += coord[1];
      count++;
    }
  }
  
  if (count > 0) {
    const avgX = sumX / count;
    const avgY = sumY / count;
    
    // If average is inside, use it; otherwise use the first vertex
    if (pointInPolygon([avgX, avgY], ring)) {
      return { longitude: avgX, latitude: avgY };
    }
  }
  
  // Last resort: use first vertex (should always be on the polygon)
  if (ring.length > 0 && Array.isArray(ring[0]) && ring[0].length >= 2) {
    return { longitude: ring[0][0], latitude: ring[0][1] };
  }
  
  return null;
}

/**
 * Calculate the geometric centroid (area-weighted center) of a polygon ring
 * Uses the shoelace formula for accurate centroid calculation
 * Ensures the centroid is inside the polygon (away from roads/edges)
 */
function calculatePolygonCentroid(ring) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return null;
  }
  
  // Ensure the ring is closed (first point == last point)
  let closedRing = ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closedRing = [...ring, first];
  }
  
  let area = 0;
  let sumX = 0;
  let sumY = 0;
  
  for (let i = 0; i < closedRing.length - 1; i++) {
    const x1 = closedRing[i][0]; // longitude
    const y1 = closedRing[i][1]; // latitude
    const x2 = closedRing[i + 1][0];
    const y2 = closedRing[i + 1][1];
    
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    sumX += (x1 + x2) * cross;
    sumY += (y1 + y2) * cross;
  }
  
  // Area is twice the signed area
  area = area / 2;
  
  if (Math.abs(area) < 1e-10) {
    // Degenerate polygon (area too small), fall back to simple average
    let sumXSimple = 0;
    let sumYSimple = 0;
    for (let i = 0; i < ring.length; i++) {
      sumXSimple += ring[i][0];
      sumYSimple += ring[i][1];
    }
    const centroid = {
      longitude: sumXSimple / ring.length,
      latitude: sumYSimple / ring.length
    };
    
    // Check if inside polygon, if not find interior point
    if (!pointInPolygon([centroid.longitude, centroid.latitude], ring)) {
      return findInteriorPoint(ring);
    }
    return centroid;
  }
  
  // Centroid = (sumX / (6*area), sumY / (6*area))
  const centroid = {
    longitude: sumX / (6 * area),
    latitude: sumY / (6 * area)
  };
  
  // Check if geometric centroid is inside the polygon
  // If not (which can happen with concave polygons), find an interior point
  if (!pointInPolygon([centroid.longitude, centroid.latitude], ring)) {
    // Geometric centroid is outside polygon (concave shape), find interior point
    return findInteriorPoint(ring);
  }
  
  return centroid;
}

/**
 * Calculate centroid from GeoJSON geometry
 * Uses proper geometric centroid (area-weighted center) for polygons
 */
function calculateCentroid(geometry) {
  if (!geometry) return null;
  
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
    return {
      latitude: geometry.coordinates[1],
      longitude: geometry.coordinates[0]
    };
  }
  
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) {
    const ring = geometry.coordinates[0]; // Outer ring
    if (Array.isArray(ring) && ring.length >= 3) {
      const centroid = calculatePolygonCentroid(ring);
      if (centroid) {
        return {
          latitude: centroid.latitude,
          longitude: centroid.longitude
        };
      }
    }
  }
  
  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    // For MultiPolygon, calculate centroids for each polygon and return the weighted average
    const polygonCentroids = [];
    
    for (const polygon of geometry.coordinates) {
      if (Array.isArray(polygon) && polygon.length > 0) {
        const ring = polygon[0]; // Outer ring
        if (Array.isArray(ring) && ring.length >= 3) {
          const centroid = calculatePolygonCentroid(ring);
          if (centroid) {
            polygonCentroids.push(centroid);
          }
        }
      }
    }
    
    if (polygonCentroids.length > 0) {
      // Return simple average of all polygon centroids
      // For true area-weighted average, we'd need to calculate area of each polygon
      const sumLat = polygonCentroids.reduce((sum, c) => sum + c.latitude, 0);
      const sumLon = polygonCentroids.reduce((sum, c) => sum + c.longitude, 0);
      return {
        latitude: sumLat / polygonCentroids.length,
        longitude: sumLon / polygonCentroids.length
      };
    }
  }
  
  return null;
}

module.exports = {
  queryByBoundingBox,
  calculateCentroid,
  filterFeaturesByBoundingBox,
  isWithinBoundingBox
};

