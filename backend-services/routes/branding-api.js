/**
 * Branding API
 * Manages tenant branding for customer portal
 */

const express = require('express');
const { Tenant } = require('../models/tenant');
const { requireAuth, requireAdmin } = require('../middleware/admin-auth');

// Create router with mergeParams to handle path parameters correctly
const router = express.Router({ mergeParams: true, strict: false });

// Create admin middleware with default options
const requireAdminMiddleware = requireAdmin();

// Log route registration
console.log('[Branding API] Routes registered:');
console.log('  GET /api/branding/:tenantId');
console.log('  PUT /api/branding/:tenantId');
console.log('  POST /api/branding/:tenantId/logo');

/**
 * GET /api/branding/:tenantId
 * Get tenant branding (public endpoint for customer portal)
 */
router.get('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    console.log('[Branding API] Fetching branding for tenant:', tenantId);
    
    // Try to find tenant by ID (handle both string and ObjectId)
    const mongoose = require('mongoose');
    let tenant;
    
    // Check if tenantId is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(tenantId)) {
      tenant = await Tenant.findOne({ 
        _id: new mongoose.Types.ObjectId(tenantId),
        status: 'active'
      }).select('branding displayName contactEmail name');
    } else {
      // If not valid ObjectId, try as string
      tenant = await Tenant.findOne({ 
        _id: tenantId,
        status: 'active'
      }).select('branding displayName contactEmail name');
    }
    
    if (!tenant) {
      console.log('[Branding API] Tenant not found:', tenantId);
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    console.log('[Branding API] Tenant found:', { 
      hasBranding: !!tenant.branding, 
      displayName: tenant.displayName 
    });
    
    // Return branding with defaults
    const branding = tenant.branding || {};
    const defaultBranding = {
      logo: { url: '', altText: tenant.displayName || 'Logo' },
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        accent: '#10b981',
        background: '#ffffff',
        text: '#111827',
        textSecondary: '#6b7280'
      },
      company: {
        name: tenant.displayName || tenant.name,
        displayName: tenant.displayName,
        supportEmail: tenant.contactEmail,
        supportPhone: '',
        supportHours: 'Mon-Fri 8am-5pm',
        website: '',
        address: ''
      },
      portal: {
        welcomeMessage: `Welcome to ${tenant.displayName || 'Customer'} Portal`,
        footerText: '',
        customCSS: '',
        enableCustomDomain: false,
        customDomain: ''
      },
      features: {
        enableFAQ: true,
        enableServiceStatus: true,
        enableLiveChat: false,
        enableKnowledgeBase: false
      }
    };
    
    // Merge with tenant branding
    const mergedBranding = {
      logo: { ...defaultBranding.logo, ...(branding.logo || {}) },
      colors: { ...defaultBranding.colors, ...(branding.colors || {}) },
      company: { ...defaultBranding.company, ...(branding.company || {}) },
      portal: { ...defaultBranding.portal, ...(branding.portal || {}) },
      features: { ...defaultBranding.features, ...(branding.features || {}) }
    };
    
    res.json(mergedBranding);
  } catch (error) {
    console.error('Error fetching branding:', error);
    res.status(500).json({ error: 'Failed to fetch branding' });
  }
});

/**
 * PUT /api/branding/:tenantId
 * Update tenant branding (admin only)
 */
// PUT route - update branding
router.put('/:tenantId', (req, res, next) => {
  console.log('[Branding API] PUT route MATCHED!', {
    method: req.method,
    path: req.path,
    url: req.url,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    params: req.params,
    tenantId: req.params.tenantId,
    route: '/:tenantId',
    routerStack: router.stack ? router.stack.length : 'no stack'
  });
  next();
}, requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const brandingData = req.body;
    
    console.log('[Branding API] PUT /:tenantId handler called:', { tenantId, hasData: !!brandingData, method: req.method, path: req.path });
    
    // Extract tenantId from request (set by middleware)
    const requestTenantId = req.tenantId || tenantId;
    
    // Handle both ObjectId and string
    const mongoose = require('mongoose');
    let tenant;
    
    if (mongoose.Types.ObjectId.isValid(requestTenantId)) {
      tenant = await Tenant.findOne({ 
        _id: new mongoose.Types.ObjectId(requestTenantId),
        status: 'active'
      });
    } else {
      tenant = await Tenant.findOne({ 
        _id: requestTenantId,
        status: 'active'
      });
    }
    
    if (!tenant) {
      console.log('[Branding API] Tenant not found for update:', requestTenantId);
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    console.log('[Branding API] Tenant found, updating branding');
    
    // Update branding
    if (!tenant.branding) {
      tenant.branding = {};
    }
    
    if (brandingData.logo) {
      tenant.branding.logo = { ...tenant.branding.logo, ...brandingData.logo };
    }
    
    if (brandingData.colors) {
      tenant.branding.colors = { ...tenant.branding.colors, ...brandingData.colors };
    }
    
    if (brandingData.company) {
      tenant.branding.company = { ...tenant.branding.company, ...brandingData.company };
    }
    
    if (brandingData.portal) {
      tenant.branding.portal = { ...tenant.branding.portal, ...brandingData.portal };
      
      // Generate portal URL based on configuration
      if (brandingData.portal.enableCustomDomain && brandingData.portal.customDomain) {
        tenant.branding.portal.portalUrl = `https://${brandingData.portal.customDomain}`;
      } else {
        // Use tenant ID (first 12 chars) as portal path
        const portalPath = brandingData.portal.portalSubdomain || tenant._id.toString().slice(0, 12);
        tenant.branding.portal.portalSubdomain = portalPath;
        tenant.branding.portal.portalUrl = `https://wisptools.io/portal/${portalPath}`;
      }
    }
    
    if (brandingData.features) {
      tenant.branding.features = { ...tenant.branding.features, ...brandingData.features };
    }
    
    await tenant.save();
    
    res.json({ 
      success: true, 
      message: 'Branding updated successfully',
      branding: tenant.branding 
    });
  } catch (error) {
    console.error('Error updating branding:', error);
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

/**
 * POST /api/branding/:tenantId/logo
 * Upload logo (admin only)
 */
router.post('/:tenantId/logo', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { logoUrl, altText } = req.body;
    
    const requestTenantId = req.tenantId || tenantId;
    
    const tenant = await Tenant.findOne({ 
      _id: requestTenantId,
      status: 'active'
    });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    if (!tenant.branding) {
      tenant.branding = {};
    }
    
    if (!tenant.branding.logo) {
      tenant.branding.logo = {};
    }
    
    tenant.branding.logo.url = logoUrl;
    if (altText) {
      tenant.branding.logo.altText = altText;
    }
    
    await tenant.save();
    
    res.json({ 
      success: true, 
      message: 'Logo updated successfully',
      logo: tenant.branding.logo 
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

module.exports = router;

