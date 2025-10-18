/**
 * CBRS Management Functions - Modular Export
 * 
 * This replaces the monolithic cbrsManagement.ts with a modular architecture.
 * 
 * Structure:
 * - device-management.ts: Device CRUD operations
 * - sas-proxy.ts: SAS API proxy (Google & Federated Wireless)
 * - analytics.ts: Analytics and webhooks
 */

// Re-export all CBRS functions
export {
  getCBRSDevices,
  saveCBRSDevice,
  deleteCBRSDevice,
  logCBRSEvent
} from './device-management.js';

export {
  proxySASRequest,
  getSASUserIDs,
  getSASInstallations
} from './sas-proxy.js';

export {
  getCBRSAnalytics,
  cbrsWebhook
} from './analytics.js';

