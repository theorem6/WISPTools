// Module Authorization Middleware
// Controls access to modules based on tenant configuration

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get tenant module configuration from Firestore
 */
async function getTenantConfig(tenantId) {
  try {
    const doc = await db.collection('tenants').doc(tenantId).get();
    
    if (!doc.exists) {
      console.warn(`Tenant ${tenantId} not found in Firestore`);
      return null;
    }
    
    const data = doc.data();
    return data.config || null;
  } catch (error) {
    console.error('Error fetching tenant config:', error);
    return null;
  }
}

/**
 * Middleware to check if a module is enabled for the tenant
 * Usage: router.use(requireModule('inventory'))
 */
function requireModule(moduleName) {
  return async (req, res, next) => {
    try {
      const tenantId = req.headers['x-tenant-id'] || req.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({ 
          error: 'X-Tenant-ID header is required',
          module: moduleName
        });
      }
      
      const config = await getTenantConfig(tenantId);
      
      // If no config exists, allow access (backward compatibility)
      if (!config) {
        console.warn(`No config for tenant ${tenantId}, allowing access to ${moduleName}`);
        return next();
      }
      
      // Check if module is enabled
      const isEnabled = config.enabledModules && config.enabledModules[moduleName];
      
      if (!isEnabled) {
        return res.status(403).json({
          error: 'Module not enabled',
          message: `The ${moduleName} module is not available for your subscription`,
          module: moduleName,
          tenantId: tenantId
        });
      }
      
      // Module is enabled, proceed
      next();
    } catch (error) {
      console.error('Module auth error:', error);
      // On error, fail open (allow access) to prevent blocking legitimate requests
      next();
    }
  };
}

/**
 * Middleware to check usage limits
 * Usage: router.use(checkLimit('maxSites', getCurrentCount))
 */
function checkLimit(limitName, getCurrentCountFn) {
  return async (req, res, next) => {
    try {
      const tenantId = req.headers['x-tenant-id'] || req.tenantId;
      
      if (!tenantId) {
        return next(); // No tenant, no limit check
      }
      
      const config = await getTenantConfig(tenantId);
      
      if (!config || !config.moduleLimits) {
        return next(); // No limits configured
      }
      
      const limit = config.moduleLimits[limitName];
      
      if (!limit || limit === 999999) {
        return next(); // Unlimited or not set
      }
      
      // Get current usage
      const currentCount = await getCurrentCountFn(tenantId);
      
      if (currentCount >= limit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You have reached the maximum allowed ${limitName} (${limit})`,
          limit: limit,
          current: currentCount,
          limitType: limitName
        });
      }
      
      // Under limit, proceed
      next();
    } catch (error) {
      console.error('Limit check error:', error);
      // On error, fail open
      next();
    }
  };
}

/**
 * Middleware to check feature flags
 * Usage: router.use(requireFeature('advancedReporting'))
 */
function requireFeature(featureName) {
  return async (req, res, next) => {
    try {
      const tenantId = req.headers['x-tenant-id'] || req.tenantId;
      
      if (!tenantId) {
        return next();
      }
      
      const config = await getTenantConfig(tenantId);
      
      if (!config || !config.features) {
        return next(); // No features configured
      }
      
      const isEnabled = config.features[featureName];
      
      if (!isEnabled) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `The ${featureName} feature is not included in your subscription`,
          feature: featureName,
          upgradeMessage: 'Please upgrade your subscription to access this feature'
        });
      }
      
      next();
    } catch (error) {
      console.error('Feature check error:', error);
      next();
    }
  };
}

/**
 * Get tenant subscription tier
 */
async function getSubscriptionTier(tenantId) {
  const config = await getTenantConfig(tenantId);
  return config?.subscriptionTier || 'basic';
}

/**
 * Check if tenant is admin/platform owner
 */
function isPlatformAdmin(email) {
  const adminEmails = [
    'david@theorem6.com',
    'admin@lte-pci-mapper.com'
    // Add more admin emails as needed
  ];
  return adminEmails.includes(email.toLowerCase());
}

module.exports = {
  getTenantConfig,
  requireModule,
  checkLimit,
  requireFeature,
  getSubscriptionTier,
  isPlatformAdmin
};

