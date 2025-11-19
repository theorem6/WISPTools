// Plan Marketing Lead Service
// Extracted from plans.js for better organization and maintainability
// Version: 0.2

const { Customer } = require('../models/customer');

/**
 * Generate a unique customer ID for a marketing lead
 */
async function generateLeadCustomerId(tenantId) {
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
}

/**
 * Build a hash key for a marketing lead
 */
function buildLeadHash(latitude, longitude, addressLine1, postalCode) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const streetKey = (addressLine1 || '').toLowerCase();
  const postalKey = (postalCode || '').toLowerCase();
  // Use 7 decimal places for better precision (~1cm vs ~1m with 5 places)
  return `${latitude.toFixed(7)}|${longitude.toFixed(7)}|${streetKey}|${postalKey}`;
}

/**
 * Normalize plan name for lead customer name
 */
function normalizePlanNameForLead(planName) {
  if (!planName) return 'Lead';
  const str = String(planName).trim();
  return str.length > 0 ? str.substring(0, 40) : 'Lead';
}

/**
 * Create marketing leads from plan addresses
 */
async function createMarketingLeadsForPlan(plan, tenantId, userEmail) {
  const marketing = plan?.marketing;
  if (!marketing || !Array.isArray(marketing.addresses) || marketing.addresses.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  const planIdString =
    (typeof plan._id === 'object' && plan._id !== null && plan._id.toString) ? plan._id.toString() :
    (typeof plan.id === 'string' ? plan.id : null);

  const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

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
}

module.exports = {
  createMarketingLeadsForPlan,
  generateLeadCustomerId,
  buildLeadHash,
  normalizePlanNameForLead
};

