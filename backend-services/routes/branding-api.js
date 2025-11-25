/**
 * Branding API
 * Manages tenant branding for customer portal
 */

const { Tenant } = require('../models/tenant');
const { Customer } = require('../models/customer');
const { requireAuth, requireAdmin } = require('../middleware/admin-auth');
const { auth } = require('../config/firebase');

/**
 * Registers branding API routes directly on the main Express app.
 * Using direct app routes avoids router mount issues we observed in production.
 */
function registerBrandingRoutes(app) {
  const requireAdminMiddleware = requireAdmin();

  /**
   * Middleware: Allow admin OR customer to update branding
   * Customers can only update their own tenant's branding
   */
  const requireAdminOrCustomer = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await auth.verifyIdToken(token);
      const uid = decodedToken.uid;
      
      // Try to find customer first
      const customer = await Customer.findOne({ 
        'portalAccess.firebaseUid': uid,
        'portalAccess.enabled': true,
        'portalAccess.accountStatus': 'active'
      });
      
      if (customer) {
        // Customer authentication - verify they belong to the tenant being updated
        const { tenantId } = req.params;
        if (customer.tenantId !== tenantId) {
          return res.status(403).json({ 
            error: 'Forbidden', 
            message: 'You can only update branding for your own tenant' 
          });
        }
        
        // Attach customer to request
        req.customer = customer;
        req.isCustomer = true;
        return next();
      }
      
      // Not a customer, try admin authentication
      // First verify auth
      const { requireAuth: verifyAuth } = require('../middleware/admin-auth');
      let authError = null;
      await new Promise((resolve) => {
        verifyAuth(req, res, (err) => {
          authError = err;
          resolve();
        });
      });
      
      if (authError) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
      }
      
      // Check if admin
      const { requireAdmin: checkAdmin } = require('../middleware/admin-auth');
      const adminMiddleware = checkAdmin();
      let adminError = null;
      await new Promise((resolve) => {
        adminMiddleware(req, res, (err) => {
          adminError = err;
          resolve();
        });
      });
      
      if (adminError) {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
      }
      
      req.isCustomer = false;
      next();
    } catch (error) {
      console.error('Admin or customer auth error:', error);
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid token or insufficient permissions' });
    }
  };

  console.log('[Branding API] Registering routes on application instance:');
  console.log('  GET /api/branding/:tenantId');
  console.log('  PUT /api/branding/:tenantId');
  console.log('  POST /api/branding/:tenantId/logo');

  /**
   * GET /api/branding/:tenantId
   * Get tenant branding (public endpoint for customer portal)
   */
  app.get('/api/branding/:tenantId', async (req, res) => {
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
   * Update tenant branding (admin or customer - customer can only update their own tenant)
   */
  app.put('/api/branding/:tenantId', requireAdminOrCustomer, async (req, res) => {
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
  app.post('/api/branding/:tenantId/logo', requireAuth, requireAdminMiddleware, async (req, res) => {
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
}

module.exports = registerBrandingRoutes;

