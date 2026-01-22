/**
 * Portal Domain Routing
 * Handles custom domain and subdomain routing to tenant portals
 */

const express = require('express');
const router = express.Router();
const { Tenant } = require('../models/tenant');

/**
 * GET /api/portal/domain/:domain
 * Get tenant ID from domain
 */
router.get('/domain/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    
    // Try to find tenant by custom domain
    let tenant = await Tenant.findOne({
      'branding.portal.customDomain': domain,
      'branding.portal.enableCustomDomain': true,
      status: 'active'
    });
    
    // If not found, try subdomain
    if (!tenant) {
      tenant = await Tenant.findOne({
        'branding.portal.portalSubdomain': domain.replace('.wisptools.io', ''),
        status: 'active'
      });
    }
    
    // If still not found, try by subdomain field
    if (!tenant) {
      tenant = await Tenant.findOne({
        subdomain: domain.replace('.wisptools.io', '').replace('.wisptools-production.web.app', ''),
        status: 'active'
      });
    }
    
    if (!tenant) {
      return res.status(404).json({ 
        error: 'Tenant not found',
        message: `No tenant found for domain: ${domain}`
      });
    }
    
    res.json({
      tenantId: tenant._id.toString(),
      tenantName: tenant.displayName,
      portalUrl: tenant.branding?.portal?.portalUrl || `/portal/${tenant._id}`,
      customDomain: tenant.branding?.portal?.customDomain,
      branding: tenant.branding
    });
  } catch (error) {
    console.error('Error looking up domain:', error);
    res.status(500).json({ 
      error: 'Failed to lookup domain',
      message: error.message 
    });
  }
});

/**
 * GET /api/portal/tenant/:tenantId
 * Get portal configuration for tenant
 * Supports both full MongoDB ObjectId and short portal subdomain (12 chars)
 */
router.get('/tenant/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const mongoose = require('mongoose');
    
    let tenant;
    
    // Check if it's a valid ObjectId (24 chars)
    if (mongoose.Types.ObjectId.isValid(tenantId) && tenantId.length === 24) {
      tenant = await Tenant.findById(tenantId);
    }
    
    // If not found or not a valid ObjectId, try portal subdomain lookup
    if (!tenant) {
      tenant = await Tenant.findOne({
        'branding.portal.portalSubdomain': tenantId,
        status: 'active'
      });
    }
    
    // Also try matching the start of the _id (for 12-char short IDs)
    if (!tenant && tenantId.length === 12) {
      // Search for tenant whose _id starts with this prefix
      tenant = await Tenant.findOne({
        _id: { $regex: `^${tenantId}` },
        status: 'active'
      });
    }
    
    if (!tenant) {
      return res.status(404).json({ 
        error: 'Tenant not found' 
      });
    }
    
    res.json({
      tenantId: tenant._id.toString(),
      tenantName: tenant.displayName,
      portalUrl: tenant.branding?.portal?.portalUrl || `/portal/${tenant._id}`,
      customDomain: tenant.branding?.portal?.customDomain,
      portalSubdomain: tenant.branding?.portal?.portalSubdomain || tenant.subdomain,
      branding: tenant.branding
    });
  } catch (error) {
    console.error('Error fetching portal config:', error);
    res.status(500).json({ 
      error: 'Failed to fetch portal configuration',
      message: error.message 
    });
  }
});

/**
 * GET /api/portal/subdomain/:subdomain
 * Get tenant by portal subdomain (short ID or custom subdomain)
 */
router.get('/subdomain/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const mongoose = require('mongoose');
    
    let tenant;
    
    // Try portal subdomain lookup first
    tenant = await Tenant.findOne({
      'branding.portal.portalSubdomain': subdomain,
      status: 'active'
    });
    
    // Try matching the start of the _id (for 12-char short IDs)
    if (!tenant && subdomain.length === 12) {
      tenant = await Tenant.findOne({
        _id: { $regex: `^${subdomain}` },
        status: 'active'
      });
    }
    
    // Try full ObjectId
    if (!tenant && mongoose.Types.ObjectId.isValid(subdomain)) {
      tenant = await Tenant.findById(subdomain);
    }
    
    if (!tenant) {
      return res.status(404).json({ 
        error: 'Tenant not found',
        message: `No tenant found for subdomain: ${subdomain}`
      });
    }
    
    res.json({
      tenantId: tenant._id.toString(),
      tenantName: tenant.displayName,
      portalUrl: tenant.branding?.portal?.portalUrl || `/portal/${tenant._id}`,
      branding: tenant.branding
    });
  } catch (error) {
    console.error('Error looking up subdomain:', error);
    res.status(500).json({ 
      error: 'Failed to lookup subdomain',
      message: error.message 
    });
  }
});

module.exports = router;

