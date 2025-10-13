/**
 * User Management Service
 * 
 * High-level service for managing subscribers with business logic
 * Provides user-friendly interface over HSS Core and ACS Integration
 */

import HSSCoreService from './hss-core';
import ACSIntegrationService from './acs-integration';
import { MongoClient, Db, Collection } from 'mongodb';

interface CreateSubscriberRequest {
  tenantId: string;
  imsi: string;
  ki: string;
  opc: string;
  msisdn?: string;
  profile?: {
    apn?: string;
    subscription_type?: 'prepaid' | 'postpaid';
    max_bandwidth_dl?: number;
    max_bandwidth_ul?: number;
  };
  metadata?: {
    notes?: string;
    tags?: string[];
  };
}

interface BulkImportSubscriber {
  imsi: string;
  ki: string;
  opc: string;
  msisdn?: string;
}

export class UserManagementService {
  private hssCore: HSSCoreService;
  private acsIntegration: ACSIntegrationService;
  private db: Db;
  private auditLogCollection: Collection;

  constructor(
    mongoUri: string,
    encryptionKey: string,
    genieacsApiUrl: string = 'http://localhost:7557'
  ) {
    this.hssCore = new HSSCoreService(mongoUri, encryptionKey);
    this.acsIntegration = new ACSIntegrationService(mongoUri, genieacsApiUrl);
    this.initializeAuditLog(mongoUri);
  }

  private async initializeAuditLog(mongoUri: string): Promise<void> {
    const client = new MongoClient(mongoUri);
    await client.connect();
    this.db = client.db('hss');
    this.auditLogCollection = this.db.collection('subscriber_audit_log');
    
    await this.auditLogCollection.createIndex({ imsi: 1 });
    await this.auditLogCollection.createIndex({ performed_at: -1 });
  }

  /**
   * Log all actions for audit trail
   */
  private async logAction(
    action: string,
    imsi: string,
    performedBy: string,
    details?: any
  ): Promise<void> {
    await this.auditLogCollection.insertOne({
      action,
      imsi,
      performed_by: performedBy,
      performed_at: new Date(),
      details,
      ip_address: details?.ip_address,
      user_agent: details?.user_agent
    });
  }

  /**
   * Create new subscriber with validation and audit logging
   */
  async createSubscriber(
    request: CreateSubscriberRequest,
    performedBy: string
  ): Promise<{ success: boolean; message: string; imsi?: string }> {
    try {
      // Validate inputs
      if (!request.imsi || !/^\d{15}$/.test(request.imsi)) {
        return { success: false, message: 'Invalid IMSI format. Must be 15 digits.' };
      }

      if (!request.ki || !/^[0-9A-Fa-f]{32}$/.test(request.ki)) {
        return { success: false, message: 'Invalid Ki format. Must be 128-bit hex string (32 characters).' };
      }

      if (!request.opc || !/^[0-9A-Fa-f]{32}$/.test(request.opc)) {
        return { success: false, message: 'Invalid OPc format. Must be 128-bit hex string (32 characters).' };
      }

      // Create subscriber in HSS
      await this.hssCore.addSubscriber({
        tenantId: request.tenantId,
        imsi: request.imsi,
        ki: request.ki,
        opc: request.opc,
        sqn: 0,
        status: 'active',
        msisdn: request.msisdn,
        profile: {
          apn: request.profile?.apn || 'internet',
          apn_config: [{
            apn: request.profile?.apn || 'internet',
            qos_profile: 'gold'
          }],
          subscription_type: request.profile?.subscription_type || 'postpaid',
          data_plan: {
            max_bandwidth_dl: request.profile?.max_bandwidth_dl || 100000000,
            max_bandwidth_ul: request.profile?.max_bandwidth_ul || 50000000,
            monthly_quota: 0,
            used_this_month: 0
          }
        }
      } as any);

      // Log action
      await this.logAction('created', request.imsi, performedBy, {
        tenantId: request.tenantId
      });

      return {
        success: true,
        message: 'Subscriber created successfully',
        imsi: request.imsi
      };

    } catch (error: any) {
      console.error('Error creating subscriber:', error);
      return {
        success: false,
        message: error.message || 'Failed to create subscriber'
      };
    }
  }

  /**
   * Bulk import subscribers from CSV or array
   */
  async bulkImportSubscribers(
    tenantId: string,
    subscribers: BulkImportSubscriber[],
    performedBy: string
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ imsi: string; error: string }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ imsi: string; error: string }>
    };

    for (const sub of subscribers) {
      try {
        const result = await this.createSubscriber({
          tenantId,
          imsi: sub.imsi,
          ki: sub.ki,
          opc: sub.opc,
          msisdn: sub.msisdn
        }, performedBy);

        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({ imsi: sub.imsi, error: result.message });
        }

      } catch (error: any) {
        results.failed++;
        results.errors.push({ imsi: sub.imsi, error: error.message });
      }
    }

    // Log bulk import
    await this.logAction('bulk_import', 'multiple', performedBy, {
      tenantId,
      total: subscribers.length,
      success: results.success,
      failed: results.failed
    });

    return results;
  }

  /**
   * Enable subscriber (activate)
   */
  async enableSubscriber(
    imsi: string,
    performedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if in inactive table
      const inactive = await this.hssCore.listInactiveSubscribers('', 1000);
      const found = inactive.find((s: any) => s.imsi === imsi);

      if (found) {
        // Reactivate from inactive table
        await this.hssCore.reactivateSubscriber(imsi, performedBy);
        await this.logAction('reactivated', imsi, performedBy);
        return { success: true, message: 'Subscriber enabled successfully' };
      }

      // Already active, just update status
      await this.hssCore.updateSubscriberProfile(imsi, { status: 'active' } as any);
      await this.logAction('enabled', imsi, performedBy);
      
      return { success: true, message: 'Subscriber enabled successfully' };

    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to enable subscriber' };
    }
  }

  /**
   * Disable subscriber (deactivate)
   */
  async disableSubscriber(
    imsi: string,
    reason: string,
    performedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Move to inactive table
      await this.hssCore.deactivateSubscriber(imsi, reason, performedBy);
      await this.logAction('deactivated', imsi, performedBy, { reason });
      
      return { success: true, message: 'Subscriber disabled successfully' };

    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to disable subscriber' };
    }
  }

  /**
   * Suspend subscriber (temporary)
   */
  async suspendSubscriber(
    imsi: string,
    reason: string,
    performedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.hssCore.updateSubscriberProfile(imsi, { status: 'suspended' } as any);
      await this.logAction('suspended', imsi, performedBy, { reason });
      
      return { success: true, message: 'Subscriber suspended successfully' };

    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to suspend subscriber' };
    }
  }

  /**
   * Delete subscriber permanently
   */
  async deleteSubscriber(
    imsi: string,
    performedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // First deactivate
      await this.hssCore.deactivateSubscriber(imsi, 'deleted', performedBy);
      await this.logAction('deleted', imsi, performedBy);
      
      return { success: true, message: 'Subscriber deleted successfully' };

    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to delete subscriber' };
    }
  }

  /**
   * Get subscriber with full details including CPE
   */
  async getSubscriberDetails(imsi: string): Promise<any> {
    const unifiedView = await this.acsIntegration.getUnifiedSubscriberView(imsi);
    return unifiedView;
  }

  /**
   * Search subscribers by various criteria
   */
  async searchSubscribers(
    tenantId: string,
    query: {
      imsi?: string;
      msisdn?: string;
      serial_number?: string;
      status?: 'active' | 'inactive' | 'suspended';
      cpe_online?: boolean;
    }
  ): Promise<any[]> {
    if (query.serial_number) {
      // Search by CPE serial number
      const subscriber = await this.acsIntegration.getSubscriberBySerial(query.serial_number);
      return subscriber ? [subscriber] : [];
    }

    if (query.imsi) {
      // Search by IMSI
      const subscriber = await this.getSubscriberDetails(query.imsi);
      return [subscriber];
    }

    // List with filters
    return await this.acsIntegration.listSubscribersWithCPE(
      tenantId,
      {
        status: query.status,
        cpe_online: query.cpe_online
      }
    );
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(tenantId: string): Promise<any> {
    const [subscriberStats, correlationStats] = await Promise.all([
      this.hssCore.getSubscriberStats(tenantId),
      this.acsIntegration.getCorrelationStats(tenantId)
    ]);

    return {
      subscribers: subscriberStats,
      cpe_correlation: correlationStats,
      health: {
        subscribers_without_cpe: correlationStats.subscribers_without_cpe,
        cpe_offline: correlationStats.cpe_offline,
        active_and_online: correlationStats.cpe_online
      }
    };
  }

  /**
   * Sync all CPE devices from ACS
   */
  async syncACSDevices(tenantId?: string): Promise<any> {
    return await this.acsIntegration.syncCPEDevices(tenantId);
  }

  /**
   * Update subscriber profile (APN, bandwidth, etc.)
   */
  async updateSubscriberProfile(
    imsi: string,
    updates: {
      msisdn?: string;
      apn?: string;
      max_bandwidth_dl?: number;
      max_bandwidth_ul?: number;
      notes?: string;
    },
    performedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const profileUpdates: any = {};
      
      if (updates.msisdn) profileUpdates.msisdn = updates.msisdn;
      if (updates.apn) profileUpdates['profile.apn'] = updates.apn;
      if (updates.max_bandwidth_dl) profileUpdates['profile.data_plan.max_bandwidth_dl'] = updates.max_bandwidth_dl;
      if (updates.max_bandwidth_ul) profileUpdates['profile.data_plan.max_bandwidth_ul'] = updates.max_bandwidth_ul;
      if (updates.notes) profileUpdates['metadata.notes'] = updates.notes;

      await this.hssCore.updateSubscriberProfile(imsi, profileUpdates);
      await this.logAction('profile_updated', imsi, performedBy, { updates });
      
      return { success: true, message: 'Profile updated successfully' };

    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to update profile' };
    }
  }

  /**
   * Get audit log for a subscriber
   */
  async getAuditLog(imsi: string, limit: number = 50): Promise<any[]> {
    return await this.auditLogCollection
      .find({ imsi })
      .sort({ performed_at: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Export subscribers to CSV
   */
  async exportSubscribers(tenantId: string, format: 'csv' | 'json' = 'csv'): Promise<string> {
    const subscribers = await this.hssCore.listSubscribers(tenantId, 10000);

    if (format === 'json') {
      return JSON.stringify(subscribers, null, 2);
    }

    // CSV format
    const headers = 'IMSI,MSISDN,Status,APN,Created At\n';
    const rows = subscribers.map((sub: any) => 
      `${sub.imsi},${sub.msisdn || ''},${sub.status},${sub.profile?.apn || ''},${sub.metadata?.created_at || ''}`
    ).join('\n');

    return headers + rows;
  }

  /**
   * Validate subscriber can attach (active + has CPE)
   */
  async validateAttach(imsi: string): Promise<{
    allowed: boolean;
    reason?: string;
    subscriber_status?: string;
    cpe_status?: string;
  }> {
    // Check if subscriber is active
    const isActive = await this.hssCore.isSubscriberActive(imsi);
    
    if (!isActive) {
      return {
        allowed: false,
        reason: 'Subscriber not active or not found',
        subscriber_status: 'inactive'
      };
    }

    // Check CPE status
    const cpe = await this.acsIntegration.getCPEByIMSI(imsi);
    
    if (!cpe) {
      return {
        allowed: true,
        reason: 'No CPE registered yet (will register on first attach)',
        subscriber_status: 'active',
        cpe_status: 'not_registered'
      };
    }

    return {
      allowed: true,
      subscriber_status: 'active',
      cpe_status: cpe.cpe.online ? 'online' : 'offline'
    };
  }
}

export default UserManagementService;

