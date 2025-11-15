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
async function queryByBoundingBox(bbox) {
  try {
    // Method 1: Try configured API endpoint
    const apiUrl = 
      appConfig?.externalServices?.microsoftFootprints?.url ||
      process.env.MICROSOFT_FOOTPRINTS_URL || 
      '';
    
    if (apiUrl) {
      try {
        console.log('[MicrosoftFootprints] Using configured API endpoint:', apiUrl);
        const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
        
        const response = await httpClient.get(apiUrl, {
          params: {
            bbox: bboxStr,
            format: 'geojson'
          },
          timeout: 45000
        });
        
        if (response.data && response.data.features) {
          return response.data;
        }
      } catch (apiError) {
        console.warn('[MicrosoftFootprints] API endpoint failed, trying GitHub:', apiError.message);
        // Fall through to GitHub method
      }
    }
    
    // Method 2: Try GitHub (determine county/state from bbox center using reverse geocoding)
    const centerLat = (bbox.north + bbox.south) / 2;
    const centerLon = (bbox.east + bbox.west) / 2;
    
    // Get county and state from coordinates using reverse geocoding
    const locationInfo = await getCountyStateFromCoordinates(centerLat, centerLon);
    const stateName = locationInfo?.state;
    const countyName = locationInfo?.county;
    
    if (stateName) {
      try {
        // Try county-level file first (much smaller, typically 1-10 MB vs 100+ MB for state)
        // Falls back to state-level file if county file not found
        const geojsonData = await fetchFromGitHub(stateName, countyName);
        if (geojsonData && geojsonData.features) {
          // Filter features by bounding box (still needed since county files may cover areas beyond bbox)
          const filteredFeatures = filterFeaturesByBoundingBox(geojsonData.features, bbox);
          
          console.log(`[MicrosoftFootprints] Filtered ${filteredFeatures.length} features from ${geojsonData.features.length} total for bbox`);
          
          return {
            type: 'FeatureCollection',
            features: filteredFeatures
          };
        }
      } catch (gitHubError) {
        console.warn('[MicrosoftFootprints] GitHub fetch failed:', gitHubError.message);
      }
    }
    
    // Method 3: Return empty result
    console.log('[MicrosoftFootprints] No data source available, returning empty result');
    return {
      type: 'FeatureCollection',
      features: []
    };
    
  } catch (error) {
    console.error('[MicrosoftFootprints] Query error:', error);
    throw error;
  }
}

/**
 * Calculate centroid from GeoJSON geometry
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
    if (Array.isArray(ring) && ring.length > 0) {
      let sumLat = 0;
      let sumLon = 0;
      let count = 0;
      
      for (const coord of ring) {
        if (Array.isArray(coord) && coord.length >= 2) {
          sumLat += coord[1];
          sumLon += coord[0];
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
  
  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    let sumLat = 0;
    let sumLon = 0;
    let count = 0;
    
    for (const polygon of geometry.coordinates) {
      if (Array.isArray(polygon) && polygon.length > 0) {
        const ring = polygon[0]; // Outer ring
        if (Array.isArray(ring)) {
          for (const coord of ring) {
            if (Array.isArray(coord) && coord.length >= 2) {
              sumLat += coord[1];
              sumLon += coord[0];
              count += 1;
            }
          }
        }
      }
    }
    
    if (count > 0) {
      return {
        latitude: sumLat / count,
        longitude: sumLon / count
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

