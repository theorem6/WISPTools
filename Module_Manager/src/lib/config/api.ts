/**
 * Centralized API Configuration
 * All API endpoints and URLs should be defined here
 */

// API Base URLs - Use relative URLs for Firebase Hosting rewrites
export const API_CONFIG = {
  // Base API path (relative - goes through Firebase Hosting rewrite to apiProxy)
  BASE: '/api',
  
  // API Service Paths
  PATHS: {
    PLANS: '/api/plans',
    NETWORK: '/api/network',
    CUSTOMERS: '/api/customers',
    INVENTORY: '/api/inventory',
    BUNDLES: '/api/bundles',
    DEPLOY: '/api/deploy',
    HSS: '/api/hss',
    MONITORING: '/api/monitoring',
    MAINTAIN: '/api/maintain',
    TENANTS: '/api/tenants',
    USERS: '/api/users',
    WORK_ORDERS: '/api/work-orders',
    ADMIN: '/admin',
    ISO: '/api/deploy', // ISO proxy uses deploy endpoint
    PERMISSIONS: '/api/permissions',
  MIKROTIK: '/api/mikrotik',
  EPC_UPDATES: '/api/epc-updates',
  SNMP_MONITORING: '/api/snmp'
  },
  
  // Cloud Function endpoints (only used when direct access is needed)
  CLOUD_FUNCTIONS: {
    API_PROXY: 'https://us-central1-wisptools-production.cloudfunctions.net/apiProxy',
    ISO_PROXY: 'https://us-central1-wisptools-production.cloudfunctions.net/isoProxy',
    COVERAGE_MAP_PROXY: 'https://us-central1-wisptools-production.cloudfunctions.net/coverageMapProxy'
  },
  
  // Backend services (GCE VM)
  BACKEND_SERVICES: {
    HSS_MANAGEMENT: 'https://136.112.111.167:3001/api/hss',
    DEFAULT: 'https://136.112.111.167:3001/api'
  }
} as const;

/**
 * Get API URL for a specific service
 */
export function getApiUrl(service?: keyof typeof API_CONFIG.PATHS): string {
  if (service) {
    return API_CONFIG.PATHS[service];
  }
  return API_CONFIG.BASE;
}

/**
 * Get full API endpoint URL
 */
export function getApiEndpoint(service: keyof typeof API_CONFIG.PATHS, endpoint: string = ''): string {
  const baseUrl = API_CONFIG.PATHS[service];
  return `${baseUrl}${endpoint}`;
}

