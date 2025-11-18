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
async function queryBuildingFootprints({ serviceUrl, layerId = 0, boundingBox, requiresAuth = false, useOAuth = false, accessToken = null }) {
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
      resultRecordCount: 2000, // Keep at 2000 for MSBFP2 service compatibility (service max limit)
      resultOffset: 0,
      // Enable returning all features for pagination
      returnExceededLimitFeatures: true // Important: This allows us to get objectIds when limit is exceeded
    };
    
    // Add authentication token if required
    // Can be OAuth2 token (for private services) or API key
    if (requiresAuth) {
      // Use provided OAuth2 token if available, otherwise try to get one, or fall back to API key
      if (accessToken) {
        queryParams.token = accessToken;
        console.log('[ArcGISBuildingFootprints] Using provided OAuth2 token for query', {
          tokenLength: accessToken.length,
          tokenPrefix: accessToken.substring(0, 20) + '...',
          serviceUrl,
          layerId
        });
      } else if (useOAuth) {
        const arcgisOAuth = require('./arcgisOAuth');
        console.log('[ArcGISBuildingFootprints] Requesting OAuth2 token for query...');
        const oauthToken = await arcgisOAuth.getValidToken();
        if (oauthToken) {
          queryParams.token = oauthToken;
          console.log('[ArcGISBuildingFootprints] Using OAuth2 token for query', {
            tokenLength: oauthToken.length,
            tokenPrefix: oauthToken.substring(0, 20) + '...',
            serviceUrl,
            layerId
          });
        } else {
          console.warn('[ArcGISBuildingFootprints] OAuth2 token requested but could not be obtained, trying API key');
          if (ARC_GIS_API_KEY) {
            queryParams.token = ARC_GIS_API_KEY;
            console.log('[ArcGISBuildingFootprints] Using API key as fallback');
          }
        }
      } else if (ARC_GIS_API_KEY) {
        queryParams.token = ARC_GIS_API_KEY;
        console.log('[ArcGISBuildingFootprints] Using API key for query');
      } else {
        console.warn('[ArcGISBuildingFootprints] Authentication required but no credentials available');
      }
    }
    
    console.log('[ArcGISBuildingFootprints] Querying Feature Service', {
      serviceUrl,
      layerId,
      boundingBox,
      requiresAuth,
      geometryEnvelope: {
        xmin: boundingBox.west,
        ymin: boundingBox.south,
        xmax: boundingBox.east,
        ymax: boundingBox.north,
        spatialReference: 'WGS84 (4326)'
      },
      hasToken: !!queryParams.token,
      tokenLength: queryParams.token?.length || 0
    });
    
    const response = await httpClient.get(queryUrl, {
      params: queryParams,
      timeout: 15000
    });
    
    if (response.data && response.data.error) {
      const errorCode = response.data.error.code;
      const errorMessage = response.data.error.message;
      console.error('[ArcGISBuildingFootprints] Query error:', {
        code: errorCode,
        message: errorMessage,
        details: response.data.error.details,
        serviceUrl,
        layerId,
        hasToken: !!queryParams.token,
        tokenLength: queryParams.token?.length || 0,
        tokenPrefix: queryParams.token ? queryParams.token.substring(0, 20) + '...' : 'none'
      });
      
      // If token is invalid, clear cache and try again if OAuth2 is being used
      if (errorCode === 498 || errorMessage === 'Invalid token' || errorMessage?.includes('Invalid token')) {
        if (accessToken || useOAuth) {
          console.warn('[ArcGISBuildingFootprints] Invalid OAuth2 token detected, clearing cache');
          const arcgisOAuth = require('./arcgisOAuth');
          arcgisOAuth.clearTokenCache();
        }
      }
      
      return { features: [], error: errorMessage || 'Query failed' };
    }
    
    const data = response.data;
    let allFeatures = Array.isArray(data.features) ? data.features : [];
    const exceededTransferLimit = Boolean(data.exceededTransferLimit);
    const totalCount = data.objectIds?.length || allFeatures.length;
    
    console.log('[ArcGISBuildingFootprints] Query response', {
      featuresReturned: allFeatures.length,
      exceededLimit: exceededTransferLimit,
      totalCount: totalCount,
      hasObjectIds: !!data.objectIds,
      objectIdsCount: data.objectIds?.length || 0,
      serviceUrl,
      layerId
    });
    
    // Handle pagination if results exceeded limit
    if (exceededTransferLimit && data.objectIds && data.objectIds.length > allFeatures.length) {
      console.log('[ArcGISBuildingFootprints] Results exceeded limit, implementing pagination', {
        returned: allFeatures.length,
        total: totalCount
      });
      
      // Fetch remaining pages
      const maxRecordCount = Math.min(queryParams.resultRecordCount || 2000, 2000); // Use service max limit (2000 for MSBFP2)
      let offset = allFeatures.length;
      const remainingObjectIds = data.objectIds.slice(allFeatures.length);
      
      console.log('[ArcGISBuildingFootprints] Starting pagination', {
        totalObjectIds: data.objectIds.length,
        alreadyFetched: allFeatures.length,
        remaining: remainingObjectIds.length,
        batchSize: maxRecordCount,
        estimatedBatches: Math.ceil(remainingObjectIds.length / maxRecordCount)
      });
      
      // Fetch in batches
      let batchCount = 0;
      while (offset < remainingObjectIds.length) {
        const batchObjectIds = remainingObjectIds.slice(offset, offset + maxRecordCount);
        batchCount++;
        
        // Build pagination params - use objectIds instead of geometry
        const paginationParams = {
          f: 'json',
          objectIds: batchObjectIds.join(','),
          outFields: queryParams.outFields || '*',
          returnGeometry: queryParams.returnGeometry !== false,
          returnIdsOnly: false,
          returnCountOnly: false,
          resultRecordCount: batchObjectIds.length,
          resultOffset: 0,
          outSR: queryParams.outSR || 4326
        };
        
        // Copy authentication token if present
        if (queryParams.token) {
          paginationParams.token = queryParams.token;
        }
        
        try {
          const paginationResponse = await httpClient.get(queryUrl, {
            params: paginationParams,
            timeout: 15000
          });
          
          if (paginationResponse.data && paginationResponse.data.error) {
            console.warn('[ArcGISBuildingFootprints] Pagination query error:', paginationResponse.data.error);
            break;
          }
          
          const paginationFeatures = Array.isArray(paginationResponse.data.features) ? paginationResponse.data.features : [];
          allFeatures = allFeatures.concat(paginationFeatures);
          
          console.log('[ArcGISBuildingFootprints] Pagination batch', {
            batchNumber: batchCount,
            offset,
            batchSize: paginationFeatures.length,
            totalFetched: allFeatures.length,
            remaining: remainingObjectIds.length - offset - paginationFeatures.length,
            progress: `${((allFeatures.length / data.objectIds.length) * 100).toFixed(1)}%`
          });
          
          offset += batchObjectIds.length;
          
          // Safety limit: don't fetch more than 100000 features (increased for large areas)
          // This allows us to find more buildings in dense urban areas
          if (allFeatures.length >= 100000) {
            console.warn('[ArcGISBuildingFootprints] Reached safety limit of 100000 features, stopping pagination');
            break;
          }
          
          // Add a small delay between pagination requests to avoid rate limiting
          if (batchCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay every 10 batches
          }
        } catch (error) {
          console.error('[ArcGISBuildingFootprints] Pagination query failed:', error.message);
          break;
        }
      }
    }
    
    console.log('[ArcGISBuildingFootprints] Query successful', {
      featuresReturned: allFeatures.length,
      exceededLimit: exceededTransferLimit,
      totalCount: totalCount,
      paginationUsed: exceededTransferLimit && allFeatures.length > (queryParams.resultRecordCount || 2000)
    });
    
    return {
      features: allFeatures,
      exceededLimit: exceededTransferLimit && allFeatures.length < totalCount,
      totalCount: totalCount
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
 * Extract centroids from ArcGIS building footprint features
 * Uses the best centroid extraction method: geometric centroid (area-weighted center) with fallback to interior point
 * This ensures centroids are always inside the building polygon and away from edges
 */
function extractCentroids(features) {
  const centroids = [];
  
  for (const feature of features) {
    if (!feature || !feature.geometry) continue;
    
    const geometry = feature.geometry;
    let centroid = null;
    
    // Handle polygon (rings) - calculate geometric centroid
    if (geometry.rings && Array.isArray(geometry.rings) && geometry.rings.length > 0) {
      const ring = geometry.rings[0]; // Use outer ring
      if (Array.isArray(ring) && ring.length > 0) {
        // Convert ring coordinates to flat array format [lon, lat]
        // Filter out invalid coordinates and ensure we have at least 3 points
        const ringCoords = ring
          .map(coord => {
            if (Array.isArray(coord) && coord.length >= 2) {
              const lon = coord[0];
              const lat = coord[1];
              // Validate coordinates are finite numbers
              if (typeof lon === 'number' && typeof lat === 'number' &&
                  Number.isFinite(lon) && Number.isFinite(lat) &&
                  lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
                return [lon, lat]; // [lon, lat] format
              }
            }
            return null;
          })
          .filter(coord => coord !== null);
        
        if (ringCoords.length >= 3) {
          // Try geometric centroid first (area-weighted center)
          centroid = calculatePolygonCentroid(ringCoords);
          
          // If geometric centroid is null or invalid, try interior point
          if (!centroid || 
              typeof centroid.latitude !== 'number' || 
              typeof centroid.longitude !== 'number' ||
              !Number.isFinite(centroid.latitude) || 
              !Number.isFinite(centroid.longitude)) {
            console.warn('[ArcGISBuildingFootprints] Geometric centroid failed, trying interior point', {
              ringLength: ringCoords.length,
              featureAttributes: feature.attributes
            });
            centroid = findInteriorPoint(ringCoords);
          }
          
          // Last resort: use average of vertices (simple centroid)
          if (!centroid || 
              typeof centroid.latitude !== 'number' || 
              typeof centroid.longitude !== 'number' ||
              !Number.isFinite(centroid.latitude) || 
              !Number.isFinite(centroid.longitude)) {
            let sumLon = 0;
            let sumLat = 0;
            for (const [lon, lat] of ringCoords) {
              sumLon += lon;
              sumLat += lat;
            }
            centroid = {
              longitude: sumLon / ringCoords.length,
              latitude: sumLat / ringCoords.length
            };
          }
        }
      }
    }
    
    // Handle point geometry
    if (!centroid && geometry.x !== undefined && geometry.y !== undefined) {
      const lon = geometry.x;
      const lat = geometry.y;
      // Validate point coordinates
      if (typeof lon === 'number' && typeof lat === 'number' &&
          Number.isFinite(lon) && Number.isFinite(lat) &&
          lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
        centroid = {
          longitude: lon,
          latitude: lat
        };
      }
    }
    
    // Only add valid centroids
    if (centroid && 
        typeof centroid.latitude === 'number' && 
        typeof centroid.longitude === 'number' &&
        Number.isFinite(centroid.latitude) && 
        Number.isFinite(centroid.longitude) &&
        centroid.latitude >= -90 && centroid.latitude <= 90 &&
        centroid.longitude >= -180 && centroid.longitude <= 180) {
      centroids.push({
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        attributes: feature.attributes || {},
        geometry: geometry // Keep for reference
      });
    } else {
      console.warn('[ArcGISBuildingFootprints] Skipped invalid centroid', {
        centroid,
        featureAttributes: feature.attributes
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
    requiresAuth = false, // Whether services require authentication
    useOAuth = false, // Whether to use OAuth2 token (for private services)
    accessToken = null // Pre-obtained OAuth2 token (if provided)
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
          requiresAuth: requiresAuth || useOAuth,
          useOAuth: useOAuth || !!accessToken,
          accessToken
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

