/**
 * Branding API
 * Manages tenant branding for customer portal
 */

const express = require('express');
const { Tenant } = require('../models/tenant');
const { requireAuth, requireAdmin: requireAdminMiddleware } = require('./middleware/admin-auth');

const router = express.Router();
const requireAdmin = requireAdminMiddleware();

/**
 * GET /api/branding/:tenantId
 * Get tenant branding (public endpoint for customer portal)
 */
router.get('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const tenant = await Tenant.findOne({ 
      _id: tenantId,
      status: 'active'
    }).select('branding displayName contactEmail');
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
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
router.put('/:tenantId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const brandingData = req.body;
    
    // Extract tenantId from request (set by middleware)
    const requestTenantId = req.tenantId || tenantId;
    
    const tenant = await Tenant.findOne({ 
      _id: requestTenantId,
      status: 'active'
    });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
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
      } else if (brandingData.portal.portalSubdomain || tenant.subdomain) {
        const subdomain = brandingData.portal.portalSubdomain || tenant.subdomain;
        tenant.branding.portal.portalSubdomain = subdomain;
        tenant.branding.portal.portalUrl = `https://${subdomain}.wisptools.io/portal`;
      } else {
        tenant.branding.portal.portalUrl = `/portal/${tenant._id}`;
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
router.post('/:tenantId/logo', requireAuth, requireAdmin, async (req, res) => {
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

