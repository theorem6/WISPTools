/**
 * Plans Marketing Routes
 * Handles marketing discovery endpoints
 * 
 * NOTE: The marketing discovery endpoint is very large (~1100 lines).
 * The endpoint logic will be extracted to a service in a future refactoring pass.
 * For now, this module organizes the routes properly.
 */

const express = require('express');
const router = express.Router();
const { PlanProject } = require('../../models/plan');
const marketingDiscovery = require('../../services/marketingDiscovery');
const { parseBoundingBox, isValidBoundingBox, parseCenter, parseMarketingAlgorithms, toNumber } = require('./plans-helpers');
const appConfig = require('../../config/app');

// Constants and dependencies (will be moved to service in future)
const ARC_GIS_API_KEY = appConfig?.externalServices?.arcgis?.apiKey || process.env.ARCGIS_API_KEY || '';
const microsoftFootprintsService = require('../../services/microsoftFootprints');
const arcgisBuildingFootprintsService = require('../../services/arcgisBuildingFootprints');

// Progress store (in-memory, shared)
const progressStore = new Map();

// Helper functions from marketingDiscovery service
const batchReverseGeocodeCoordinates = marketingDiscovery.batchReverseGeocodeCoordinates;
const distanceInMeters = marketingDiscovery.distanceInMeters;
const buildAddressHash = marketingDiscovery.buildAddressHash;

// Microsoft Building Footprints discovery function
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

    for (const feature of geojsonData.features) {
      if (!feature?.geometry) continue;

      const centroid = microsoftFootprintsService.calculateCentroid(feature.geometry);
      if (!centroid || !Number.isFinite(centroid.latitude) || !Number.isFinite(centroid.longitude)) continue;

      const key = `${centroid.latitude.toFixed(7)},${centroid.longitude.toFixed(7)}`;
      if (seenKeys.has(key)) continue;

      seenKeys.add(key);
      coordinates.push({
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        source: 'microsoft_footprints',
        properties: feature.properties || {}
      });

      if (coordinates.length >= 50000) break;
    }

    result.coordinates = coordinates;
    result.stats.rawCandidates = coordinates.length;
    return result;
  } catch (error) {
    result.error = error?.message || 'Failed to fetch Microsoft building footprints';
    return result;
  }
}

// ArcGIS Address Points discovery
async function runArcgisAddressPointsDiscovery({ boundingBox, center, radiusMiles }) {
  const result = await marketingDiscovery.discoverAddressPointsByBoundingBox({
    boundingBox,
    center,
    radiusMiles
  });

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

// ArcGIS Places discovery
async function runArcgisPlacesDiscovery({ boundingBox, center, radiusMiles }) {
  const result = {
    coordinates: [],
    error: null
  };

  try {
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

/**
 * GET /plans/:id/marketing/addresses - Get all marketing addresses for a plan
 */
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

/**
 * GET /plans/:id/marketing/progress/:requestId - Get progress for a discovery request
 */
router.get('/:id/marketing/progress/:requestId', (req, res) => {
  const { requestId } = req.params;
  const progress = progressStore.get(requestId);
  
  if (!progress) {
    return res.status(404).json({ error: 'Progress not found' });
  }
  
  res.json(progress);
});

/**
 * POST /plans/:id/marketing/discover - Find marketing addresses within area
 * 
 * NOTE: This endpoint is extremely large (~1100 lines). The full implementation
 * will remain here for now to maintain backward compatibility. Future refactoring
 * should extract the orchestration logic to plans-marketing-discovery-orchestrator.js service.
 */
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

module.exports = router;

