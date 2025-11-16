/**
 * ArcGIS Building Footprints Feature Service
 * Queries building footprint Feature Services for building discovery
 */

const axios = require('axios');
const appConfig = require('../config/app');

const ARC_GIS_API_KEY = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || '';

// HTTP client with retry logic
const httpClient = axios.create({
  timeout: 15000, // 15 second timeout
  headers: {
    'User-Agent': 'LTE-PCI-Mapper/1.0 (admin@wisptools.io)'
  }
});

// Known building footprint Feature Services (can be configured)
const BUILDING_FOOTPRINT_SERVICES = {
  // New York State (public, no auth)
  newYork: 'https://gisservices.its.ny.gov/arcgis/rest/services/BuildingFootprints/FeatureServer',
  
  // Tarrant County, TX (public, no auth)
  tarrantCountyTX: 'https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/Building_Footprint/MapServer',
  
  // Oregon (public, no auth)
  oregon: 'https://services8.arcgis.com/8PAo5HGmvRMlF2eU/arcgis/rest/services/Building_Footprints/FeatureServer',
  
  // Esri World Building Footprints (requires subscription/API key)
  world: 'https://geocode.arcgis.com/arcgis/rest/services/World/BuildingFootprints/FeatureServer',
  
  // Custom service (can be configured via environment variable)
  custom: process.env.ARCGIS_BUILDING_FOOTPRINTS_SERVICE_URL || ''
};

/**
 * Query building footprints from ArcGIS Feature Service
 */
async function queryBuildingFootprints({ serviceUrl, layerId = 0, boundingBox, requiresAuth = false }) {
  try {
    if (!serviceUrl) {
      return { features: [], error: 'Service URL not provided' };
    }
    
    if (!boundingBox || !boundingBox.west || !boundingBox.south || !boundingBox.east || !boundingBox.north) {
      return { features: [], error: 'Invalid bounding box' };
    }
    
    const queryUrl = `${serviceUrl}/${layerId}/query`;
    
    // Build query parameters
    // Note: Feature Service may use Web Mercator (3857) but we send WGS84 (4326)
    // ArcGIS will auto-convert if we specify inSR and outSR
    const queryParams = {
      f: 'json',
      geometry: JSON.stringify({
        xmin: boundingBox.west,
        ymin: boundingBox.south,
        xmax: boundingBox.east,
        ymax: boundingBox.north,
        spatialReference: { wkid: 4326 } // Specify WGS84 input
      }),
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      inSR: 4326, // Input spatial reference: WGS84
      outSR: 4326, // Output spatial reference: WGS84 (for consistency)
      outFields: '*',
      returnGeometry: true,
      returnIdsOnly: false,
      returnCountOnly: false,
      where: '1=1', // Return all features
      resultRecordCount: 2000, // Use max record count for MSBFP2 service
      resultOffset: 0
    };
    
    // Add API key if required
    if (requiresAuth && ARC_GIS_API_KEY) {
      queryParams.token = ARC_GIS_API_KEY;
    }
    
    console.log('[ArcGISBuildingFootprints] Querying Feature Service', {
      serviceUrl,
      layerId,
      boundingBox,
      requiresAuth
    });
    
    const response = await httpClient.get(queryUrl, {
      params: queryParams,
      timeout: 15000
    });
    
    if (response.data && response.data.error) {
      console.error('[ArcGISBuildingFootprints] Query error:', response.data.error);
      return { features: [], error: response.data.error.message || 'Query failed' };
    }
    
    const data = response.data;
    const features = Array.isArray(data.features) ? data.features : [];
    const exceededTransferLimit = Boolean(data.exceededTransferLimit);
    
    // Handle pagination if results exceeded limit
    if (exceededTransferLimit && data.objectIds) {
      console.log('[ArcGISBuildingFootprints] Results exceeded limit, would need pagination');
      // Note: Could implement pagination here if needed
    }
    
    console.log('[ArcGISBuildingFootprints] Query successful', {
      featuresReturned: features.length,
      exceededLimit: exceededTransferLimit,
      totalCount: data.objectIds?.length || features.length
    });
    
    return {
      features,
      exceededLimit: exceededTransferLimit,
      totalCount: data.objectIds?.length || features.length
    };
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401 || error.response.status === 403) {
        return { features: [], error: 'Authentication required (invalid or missing API key)' };
      } else if (error.response.status === 404) {
        return { features: [], error: 'Service or layer not found' };
      }
      return { features: [], error: `HTTP ${error.response.status}: ${error.response.statusText}` };
    }
    return { features: [], error: error.message || 'Unknown error' };
  }
}

/**
 * Convert ArcGIS Feature Service geometry to GeoJSON format
 */
function convertEsriGeometryToGeoJSON(esriGeometry) {
  if (!esriGeometry) return null;
  
  // Handle polygon (rings)
  if (esriGeometry.rings && Array.isArray(esriGeometry.rings)) {
    return {
      type: 'Polygon',
      coordinates: esriGeometry.rings.map(ring => 
        ring.map(coord => [coord[0], coord[1]]) // Convert [x, y] to [lon, lat]
      )
    };
  }
  
  // Handle point
  if (esriGeometry.x !== undefined && esriGeometry.y !== undefined) {
    return {
      type: 'Point',
      coordinates: [esriGeometry.x, esriGeometry.y] // [lon, lat]
    };
  }
  
  // Handle multipolygon
  if (esriGeometry.rings && esriGeometry.rings.length > 1) {
    return {
      type: 'MultiPolygon',
      coordinates: esriGeometry.rings.map(ring => 
        [ring.map(coord => [coord[0], coord[1]])]
      )
    };
  }
  
  return null;
}

/**
 * Extract centroids from ArcGIS building footprint features
 */
function extractCentroids(features) {
  const centroids = [];
  
  for (const feature of features) {
    if (!feature || !feature.geometry) continue;
    
    const geometry = feature.geometry;
    let centroid = null;
    
    // Handle polygon (rings) - calculate centroid from vertices
    if (geometry.rings && Array.isArray(geometry.rings) && geometry.rings.length > 0) {
      const ring = geometry.rings[0]; // Use outer ring
      if (Array.isArray(ring) && ring.length > 0) {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        
        for (const coord of ring) {
          if (Array.isArray(coord) && coord.length >= 2) {
            sumX += coord[0]; // longitude
            sumY += coord[1]; // latitude
            count += 1;
          }
        }
        
        if (count > 0) {
          centroid = {
            longitude: sumX / count,
            latitude: sumY / count
          };
        }
      }
    }
    
    // Handle point
    if (geometry.x !== undefined && geometry.y !== undefined) {
      centroid = {
        longitude: geometry.x,
        latitude: geometry.y
      };
    }
    
    if (centroid && typeof centroid.latitude === 'number' && typeof centroid.longitude === 'number') {
      centroids.push({
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        attributes: feature.attributes || {},
        geometry: geometry // Keep for reference
      });
    }
  }
  
  return centroids;
}

/**
 * Query building footprints from configured ArcGIS services
 * Tries multiple services and returns combined results
 */
async function queryBuildingFootprintsByBoundingBox(boundingBox, options = {}) {
  const {
    serviceUrls = null, // If provided, use these specific services
    layerIds = [0], // Which layers to query (default: layer 0)
    requiresAuth = false // Whether services require authentication
  } = options;
  
  // Determine which services to query
  const servicesToQuery = serviceUrls || [
    BUILDING_FOOTPRINT_SERVICES.custom, // Custom configured service
    BUILDING_FOOTPRINT_SERVICES.world // World service (if auth available)
  ].filter(url => url && url.length > 0);
  
  if (servicesToQuery.length === 0) {
    console.log('[ArcGISBuildingFootprints] No building footprint services configured');
    return { coordinates: [], error: 'No building footprint services configured' };
  }
  
  const allCoordinates = [];
  const seenKeys = new Set();
  
  // Query each service
  for (const serviceUrl of servicesToQuery) {
    for (const layerId of layerIds) {
      try {
        const result = await queryBuildingFootprints({
          serviceUrl,
          layerId,
          boundingBox,
          requiresAuth
        });
        
        if (result.error) {
          console.warn('[ArcGISBuildingFootprints] Service query failed:', {
            serviceUrl,
            layerId,
            error: result.error
          });
          continue;
        }
        
        // Extract centroids from features
        const centroids = extractCentroids(result.features);
        
        // Deduplicate and add coordinates
        for (const centroid of centroids) {
          const key = `${centroid.latitude.toFixed(7)},${centroid.longitude.toFixed(7)}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allCoordinates.push({
              latitude: centroid.latitude,
              longitude: centroid.longitude,
              source: 'arcgis_building_footprints',
              attributes: centroid.attributes || {},
              serviceUrl,
              layerId
            });
          }
        }
        
        console.log('[ArcGISBuildingFootprints] Extracted centroids', {
          serviceUrl,
          layerId,
          features: result.features.length,
          centroids: centroids.length,
          uniqueCoordinates: allCoordinates.length
        });
      } catch (error) {
        console.error('[ArcGISBuildingFootprints] Error querying service:', {
          serviceUrl,
          layerId,
          error: error.message
        });
      }
    }
  }
  
  return {
    coordinates: allCoordinates,
    totalFeatures: allCoordinates.length
  };
}

module.exports = {
  queryBuildingFootprints,
  queryBuildingFootprintsByBoundingBox,
  extractCentroids,
  convertEsriGeometryToGeoJSON,
  BUILDING_FOOTPRINT_SERVICES
};

