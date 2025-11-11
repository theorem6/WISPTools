// Planning System API
// Manages deployment plans and project workflows

const express = require('express');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const router = express.Router();
const { PlanProject } = require('../models/plan');
const { InventoryItem } = require('../models/inventory');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../models/network');
const UnifiedTower = UnifiedSite; // Backwards compatibility alias
const { createProjectApprovalNotification } = require('./notifications');
const { PlanLayerFeature } = require('../models/plan-layer-feature');
const { verifyAuth } = require('./users/role-auth-middleware');
const { Customer } = require('../models/customer');

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

const parseCenter = (input) => {
  if (!input || typeof input !== 'object') return undefined;
  const lat = toNumber(input.lat ?? input.latitude);
  const lon = toNumber(input.lon ?? input.longitude);
  if (lat === undefined || lon === undefined) return undefined;
  return { lat, lon };
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
  return `${latitude.toFixed(5)}|${longitude.toFixed(5)}|${streetKey}|${postalKey}`;
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

    const street = address.addressLine1 ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
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

const MAX_BUILDING_RESULTS = 150;
const MAX_REVERSE_GEOCODE = 15;
const NOMINATIM_DELAY_MS = 1200;
const NOMINATIM_USER_AGENT = 'LTE-PCI-Mapper-Marketing/1.0 (admin@wisptools.io)';
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

const buildOverpassQuery = (bbox) => `
[out:json][timeout:60];
(
  way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["addr:housenumber"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["addr:housenumber"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["landuse"~"^(residential|village_green)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["landuse"~"^(residential|village_green)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out center meta;
`;

const reverseGeocodeCoordinate = async (lat, lon) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': NOMINATIM_USER_AGENT,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Reverse geocoding failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = await response.json();
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
};

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

// POST /plans/:id/marketing/discover - Find marketing addresses within area
router.post('/:id/marketing/discover', async (req, res) => {
  try {
    const plan = await PlanProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const boundingBox = parseBoundingBox(req.body.boundingBox);
    if (!boundingBox) {
      return res.status(400).json({
        error: 'Invalid bounding box',
        message: 'Provide boundingBox with numeric west, south, east, north values'
      });
    }

    const radiusMiles =
      toNumber(req.body.radiusMiles ?? req.body.radius ?? plan.marketing?.targetRadiusMiles) ?? 5;

    const explicitCenter = parseCenter(req.body.center);
    const computedCenter = explicitCenter || (plan.location?.latitude !== undefined && plan.location?.longitude !== undefined
      ? { lat: plan.location.latitude, lon: plan.location.longitude }
      : {
          lat: (boundingBox.north + boundingBox.south) / 2,
          lon: (boundingBox.east + boundingBox.west) / 2
        });

    const overpassQuery = buildOverpassQuery(boundingBox);
    const overpassResponse = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(overpassQuery)}`
    });

    if (!overpassResponse.ok) {
      const details = await overpassResponse.text().catch(() => '');
      return res.status(502).json({
        error: 'Failed to query building data',
        message: `Overpass API returned ${overpassResponse.status}`,
        details
      });
    }

    const overpassData = await overpassResponse.json();
    const elements = Array.isArray(overpassData.elements) ? overpassData.elements : [];

    const seen = new Set();
    const candidates = [];

    for (const element of elements) {
      const latitude =
        toNumber(element.lat) ??
        toNumber(element.center?.lat) ??
        (Array.isArray(element.geometry) ? toNumber(element.geometry[0]?.lat) : undefined);
      const longitude =
        toNumber(element.lon) ??
        toNumber(element.center?.lon) ??
        (Array.isArray(element.geometry) ? toNumber(element.geometry[0]?.lon) : undefined);

      if (latitude === undefined || longitude === undefined) continue;

      const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        lat: latitude,
        lon: longitude,
        source: element.type === 'node' ? 'osm_node' : 'osm_way'
      });

      if (candidates.length >= MAX_BUILDING_RESULTS) break;
    }

    const addresses = [];
    let geocodedCount = 0;

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (geocodedCount < MAX_REVERSE_GEOCODE) {
        try {
          if (geocodedCount > 0) {
            await delay(NOMINATIM_DELAY_MS);
          }
          const details = await reverseGeocodeCoordinate(candidate.lat, candidate.lon);
          addresses.push(details);
          geocodedCount += 1;
          continue;
        } catch (error) {
          console.warn('Reverse geocode fallback:', error.message);
        }
      }

      addresses.push({
        addressLine1: `${candidate.lat.toFixed(5)}, ${candidate.lon.toFixed(5)}`,
        latitude: candidate.lat,
        longitude: candidate.lon,
        country: 'US',
        source: geocodedCount >= MAX_REVERSE_GEOCODE ? 'coordinate-only' : 'coordinate-fallback'
      });
    }

    const marketingUpdate = {
      targetRadiusMiles: radiusMiles,
      lastRunAt: new Date(),
      lastResultCount: addresses.length,
      lastBoundingBox: boundingBox,
      lastCenter: computedCenter,
      addresses
    };

    await PlanProject.updateOne(
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

    res.json({
      summary: {
        totalCandidates: candidates.length,
        geocodedCount,
        radiusMiles,
        boundingBox,
        center: computedCenter
      },
      addresses
    });
  } catch (error) {
    console.error('Error discovering marketing addresses:', error);
    res.status(500).json({
      error: 'Failed to discover marketing addresses',
      message: error.message
    });
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
    
    const [featureResult, towerResult, sectorResult, cpeResult, equipmentResult] = await Promise.all([
      PlanLayerFeature.deleteMany({ tenantId: req.tenantId, planId: req.params.id }),
      UnifiedSite.deleteMany({ tenantId: req.tenantId, planId: req.params.id }),
      UnifiedSector.deleteMany({ tenantId: req.tenantId, planId: req.params.id }),
      UnifiedCPE.deleteMany({ tenantId: req.tenantId, planId: req.params.id }),
      NetworkEquipment.deleteMany({ tenantId: req.tenantId, planId: req.params.id })
    ]);

    res.json({
      message: 'Plan deleted successfully',
      plan,
      removed: {
        features: featureResult.deletedCount || 0,
        sites: towerResult.deletedCount || 0,
        sectors: sectorResult.deletedCount || 0,
        cpe: cpeResult.deletedCount || 0,
        equipment: equipmentResult.deletedCount || 0
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
    const axios = require('axios');
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
