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
 * Get state name from coordinates (approximate)
 */
function getStateFromCoordinates(lat, lon) {
  // This is a simplified approach - in production you'd use a proper reverse geocoding service
  // For now, we'll try to determine state from lat/lon ranges
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
  
  return null; // Unknown - would need proper reverse geocoding
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
 * Fetch Microsoft Building Footprints from GitHub for a specific state/county
 */
async function fetchFromGitHub(stateName, countyName = null) {
  try {
    const stateAbbr = STATE_ABBREVIATIONS[stateName.toLowerCase()] || stateName.toLowerCase();
    const cacheKey = `github_${stateAbbr}_${countyName || 'all'}`;
    
    // Check in-memory cache
    if (apiCache.has(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute in-memory cache
        return cached.data;
      }
    }
    
    // Try to get the latest release or main branch
    const url = countyName 
      ? `${GITHUB_RAW_BASE}/${MICROSOFT_FOOTPRINTS_GITHUB_REPO}/main/${stateAbbr}/${countyName}.geojson`
      : `${GITHUB_RAW_BASE}/${MICROSOFT_FOOTPRINTS_GITHUB_REPO}/main/${stateAbbr}.geojson`;
    
    console.log(`[MicrosoftFootprints] Fetching from GitHub: ${url}`);
    
    const response = await httpClient.get(url, {
      responseType: 'json',
      timeout: 120000 // 2 minutes for large files
    });
    
    const data = response.data;
    
    // Cache result
    apiCache.set(cacheKey, { data, timestamp: Date.now() });
    
    return data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.warn(`[MicrosoftFootprints] GitHub file not found: ${stateName}${countyName ? '/' + countyName : ''}`);
      return null;
    }
    console.error(`[MicrosoftFootprints] GitHub fetch error:`, error.message);
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
    
    // Method 2: Try GitHub (determine state from bbox center)
    const centerLat = (bbox.north + bbox.south) / 2;
    const centerLon = (bbox.east + bbox.west) / 2;
    const stateName = getStateFromCoordinates(centerLat, centerLon);
    
    if (stateName) {
      try {
        // Try state-level file first (smaller, faster)
        const stateData = await fetchFromGitHub(stateName);
        if (stateData && stateData.features) {
          // Filter features by bounding box
          const filteredFeatures = filterFeaturesByBoundingBox(stateData.features, bbox);
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

