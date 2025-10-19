// Tenant Module Configuration
// Controls which modules are enabled for each tenant

import { firestore } from './firebase-admin';

export interface TenantModuleConfig {
  // Module Access Control
  enabledModules: {
    pciResolution: boolean;
    cbrsManagement: boolean;
    acsManagement: boolean;
    hssManagement: boolean;
    coverageMap: boolean;
    inventory: boolean;
    distributedEpc: boolean;
    monitoring: boolean;
    backendManagement: boolean; // Admin only
  };
  
  // Usage Limits
  moduleLimits: {
    maxSites?: number;
    maxSubscribers?: number;
    maxCPEs?: number;
    maxUsers?: number;
    maxInventoryItems?: number;
  };
  
  // Subscription Information
  subscriptionTier: 'free' | 'basic' | 'professional' | 'enterprise' | 'custom';
  
  // Feature Flags
  features: {
    advancedReporting: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    customIntegrations: boolean;
    prioritySupport: boolean;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Default configuration for new tenants
export const DEFAULT_TENANT_CONFIG: TenantModuleConfig = {
  enabledModules: {
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    distributedEpc: false, // Advanced feature
    monitoring: true,
    backendManagement: false // Admin only
  },
  moduleLimits: {
    maxSites: 10,
    maxSubscribers: 1000,
    maxCPEs: 500,
    maxUsers: 5,
    maxInventoryItems: 1000
  },
  subscriptionTier: 'basic',
  features: {
    advancedReporting: false,
    apiAccess: false,
    whiteLabel: false,
    customIntegrations: false,
    prioritySupport: false
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

// Subscription tier configurations
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    enabledModules: {
      pciResolution: true,
      cbrsManagement: false,
      acsManagement: true,
      hssManagement: false,
      coverageMap: true,
      inventory: true,
      distributedEpc: false,
      monitoring: false,
      backendManagement: false
    },
    limits: {
      maxSites: 3,
      maxSubscribers: 100,
      maxCPEs: 50,
      maxUsers: 1,
      maxInventoryItems: 100
    },
    features: {
      advancedReporting: false,
      apiAccess: false,
      whiteLabel: false,
      customIntegrations: false,
      prioritySupport: false
    }
  },
  basic: {
    name: 'Basic',
    enabledModules: {
      pciResolution: true,
      cbrsManagement: true,
      acsManagement: true,
      hssManagement: true,
      coverageMap: true,
      inventory: true,
      distributedEpc: false,
      monitoring: true,
      backendManagement: false
    },
    limits: {
      maxSites: 10,
      maxSubscribers: 1000,
      maxCPEs: 500,
      maxUsers: 5,
      maxInventoryItems: 1000
    },
    features: {
      advancedReporting: false,
      apiAccess: false,
      whiteLabel: false,
      customIntegrations: false,
      prioritySupport: false
    }
  },
  professional: {
    name: 'Professional',
    enabledModules: {
      pciResolution: true,
      cbrsManagement: true,
      acsManagement: true,
      hssManagement: true,
      coverageMap: true,
      inventory: true,
      distributedEpc: true,
      monitoring: true,
      backendManagement: false
    },
    limits: {
      maxSites: 50,
      maxSubscribers: 10000,
      maxCPEs: 5000,
      maxUsers: 20,
      maxInventoryItems: 10000
    },
    features: {
      advancedReporting: true,
      apiAccess: true,
      whiteLabel: false,
      customIntegrations: false,
      prioritySupport: true
    }
  },
  enterprise: {
    name: 'Enterprise',
    enabledModules: {
      pciResolution: true,
      cbrsManagement: true,
      acsManagement: true,
      hssManagement: true,
      coverageMap: true,
      inventory: true,
      distributedEpc: true,
      monitoring: true,
      backendManagement: false
    },
    limits: {
      maxSites: 999999, // Unlimited
      maxSubscribers: 999999,
      maxCPEs: 999999,
      maxUsers: 999999,
      maxInventoryItems: 999999
    },
    features: {
      advancedReporting: true,
      apiAccess: true,
      whiteLabel: true,
      customIntegrations: true,
      prioritySupport: true
    }
  }
};

/**
 * Get tenant module configuration
 */
export async function getTenantConfig(tenantId: string): Promise<TenantModuleConfig | null> {
  try {
    const doc = await firestore.collection('tenants').doc(tenantId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    return data?.config || DEFAULT_TENANT_CONFIG;
  } catch (error) {
    console.error('Error fetching tenant config:', error);
    return null;
  }
}

/**
 * Update tenant module configuration
 */
export async function updateTenantConfig(
  tenantId: string,
  config: Partial<TenantModuleConfig>,
  updatedBy?: string
): Promise<void> {
  try {
    await firestore.collection('tenants').doc(tenantId).update({
      config: {
        ...config,
        updatedAt: new Date(),
        updatedBy
      }
    });
  } catch (error) {
    console.error('Error updating tenant config:', error);
    throw error;
  }
}

/**
 * Initialize tenant configuration with default or tier-based settings
 */
export async function initializeTenantConfig(
  tenantId: string,
  tier: keyof typeof SUBSCRIPTION_TIERS = 'basic'
): Promise<void> {
  try {
    const tierConfig = SUBSCRIPTION_TIERS[tier];
    const config: TenantModuleConfig = {
      enabledModules: tierConfig.enabledModules,
      moduleLimits: tierConfig.limits,
      subscriptionTier: tier,
      features: tierConfig.features,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await firestore.collection('tenants').doc(tenantId).set({
      config
    }, { merge: true });
  } catch (error) {
    console.error('Error initializing tenant config:', error);
    throw error;
  }
}

/**
 * Check if a module is enabled for a tenant
 */
export async function isModuleEnabled(
  tenantId: string,
  moduleName: keyof TenantModuleConfig['enabledModules']
): Promise<boolean> {
  const config = await getTenantConfig(tenantId);
  return config?.enabledModules[moduleName] ?? false;
}

/**
 * Check if tenant is within usage limits
 */
export async function checkUsageLimit(
  tenantId: string,
  limitType: keyof TenantModuleConfig['moduleLimits'],
  currentUsage: number
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const config = await getTenantConfig(tenantId);
  const limit = config?.moduleLimits[limitType] || 0;
  
  return {
    allowed: currentUsage < limit,
    limit,
    current: currentUsage
  };
}

/**
 * Apply subscription tier to tenant
 */
export async function applySubscriptionTier(
  tenantId: string,
  tier: keyof typeof SUBSCRIPTION_TIERS,
  updatedBy?: string
): Promise<void> {
  const tierConfig = SUBSCRIPTION_TIERS[tier];
  
  const config: Partial<TenantModuleConfig> = {
    enabledModules: tierConfig.enabledModules,
    moduleLimits: tierConfig.limits,
    subscriptionTier: tier,
    features: tierConfig.features,
    updatedAt: new Date(),
    updatedBy
  };
  
  await updateTenantConfig(tenantId, config, updatedBy);
}

