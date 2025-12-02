/**
 * Tenant Service - Isolated Tenant Management
 * This service provides robust, isolated tenant operations with comprehensive error handling
 */

const mongoose = require('mongoose');
const { Tenant } = require('../models/tenant');
const { UserTenant } = require('../routes/users/user-schema');

class TenantService {
  constructor() {
    this.isInitialized = false;
    this.init();
  }

  /**
   * Initialize the service - verify models are available
   */
  async init() {
    try {
      // Verify mongoose is connected
      if (mongoose.connection.readyState !== 1) {
        console.warn('[TenantService] MongoDB not connected during initialization. Will retry on first operation.');
        this.isInitialized = false;
        return;
      }

      // Verify models exist
      if (!Tenant || typeof Tenant.find !== 'function') {
        throw new Error('Tenant model is not properly initialized');
      }

      if (!UserTenant || typeof UserTenant.find !== 'function') {
        throw new Error('UserTenant model is not properly initialized');
      }

      this.isInitialized = true;
      console.log('[TenantService] ✅ Service initialized successfully');
    } catch (error) {
      console.error('[TenantService] ❌ Initialization error:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Ensure service is ready before operations
   */
  async ensureReady() {
    if (!this.isInitialized) {
      await this.init();
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection not ready');
    }

    // Verify models
    if (!Tenant || !UserTenant) {
      throw new Error('Required models not available');
    }
  }

  /**
   * Get all tenants for a user
   * @param {string} userId - Firebase user UID
   * @returns {Promise<Array>} Array of tenant objects
   */
  async getUserTenants(userId) {
    try {
      await this.ensureReady();

      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid userId provided');
      }

      console.log('[TenantService] Getting tenants for user:', userId);

      // Get user-tenant associations
      const userTenants = await UserTenant.find({
        userId: userId,
        status: 'active'
      }).lean();

      if (!userTenants || userTenants.length === 0) {
        console.log('[TenantService] No tenant associations found for user:', userId);
        return [];
      }

      console.log(`[TenantService] Found ${userTenants.length} tenant associations`);

      // Get full tenant details
      const tenants = [];
      for (const ut of userTenants) {
        try {
          if (!ut.tenantId) {
            console.warn('[TenantService] UserTenant record missing tenantId, skipping:', ut._id);
            continue;
          }

          // Convert tenantId to ObjectId if valid
          if (!mongoose.Types.ObjectId.isValid(ut.tenantId)) {
            console.warn('[TenantService] Invalid tenantId format:', ut.tenantId);
            continue;
          }

          const tenantObjectId = new mongoose.Types.ObjectId(ut.tenantId);
          const tenant = await Tenant.findById(tenantObjectId).lean();

          if (tenant) {
            tenants.push({
              ...tenant,
              id: tenant._id ? tenant._id.toString() : tenant.id,
              userRole: ut.role || 'viewer'
            });
          } else {
            console.warn('[TenantService] Tenant not found for tenantId:', ut.tenantId);
          }
        } catch (error) {
          console.error('[TenantService] Error processing tenant association:', error.message);
          // Continue with other tenants
          continue;
        }
      }

      console.log(`[TenantService] Returning ${tenants.length} tenants for user: ${userId}`);
      return tenants;
    } catch (error) {
      console.error('[TenantService] Error in getUserTenants:', error);
      throw error;
    }
  }

  /**
   * Get a single tenant by ID (with authorization check)
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - Firebase user UID
   * @returns {Promise<Object|null>} Tenant object or null if not found/unauthorized
   */
  async getTenant(tenantId, userId) {
    try {
      await this.ensureReady();

      if (!tenantId || !userId) {
        throw new Error('tenantId and userId are required');
      }

      // Check if user is assigned to this tenant
      const userTenant = await UserTenant.findOne({
        userId: userId,
        tenantId: tenantId,
        status: 'active'
      }).lean();

      if (!userTenant) {
        return null; // Not authorized or not found
      }

      // Get tenant details
      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        throw new Error('Invalid tenantId format');
      }

      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const tenant = await Tenant.findById(tenantObjectId).lean();

      if (!tenant) {
        return null;
      }

      return {
        ...tenant,
        id: tenant._id.toString(),
        userRole: userTenant.role
      };
    } catch (error) {
      console.error('[TenantService] Error in getTenant:', error);
      throw error;
    }
  }

  /**
   * Health check
   * @returns {Promise<Object>} Service health status
   */
  async healthCheck() {
    try {
      const mongoConnected = mongoose.connection.readyState === 1;
      const modelsReady = !!(Tenant && UserTenant);

      return {
        healthy: mongoConnected && modelsReady && this.isInitialized,
        mongoConnected,
        modelsReady,
        initialized: this.isInitialized
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const tenantService = new TenantService();

module.exports = tenantService;

