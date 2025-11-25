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
 */
router.get('/tenant/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const tenant = await Tenant.findById(tenantId);
    
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

module.exports = router;

