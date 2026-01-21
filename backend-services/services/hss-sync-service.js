/**
 * HSS Sync Service
 * Syncs customer data to cloud HSS (hss.wisptools.io) and remote HSS instances
 */

const mongoose = require('mongoose');
const axios = require('axios');

const CLOUD_HSS_API = process.env.CLOUD_HSS_API || 'https://hss.wisptools.io/api/hss';
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { Customer } = require('../models/customer');

/**
 * Sync customer to cloud HSS
 * Creates or updates subscriber in cloud HSS database
 */
async function syncCustomerToCloudHSS(customer, tenantId) {
  try {
    // Only sync if customer has LTE/5G service type and required auth credentials
    if (customer.serviceType !== '4G/5G') {
      console.log(`[HSS Sync] Skipping sync for customer ${customer.customerId} - not 4G/5G service type`);
      return { success: false, reason: 'not_4g_5g' };
    }

    if (!customer.networkInfo?.imsi) {
      console.log(`[HSS Sync] Skipping sync for customer ${customer.customerId} - no IMSI`);
      return { success: false, reason: 'no_imsi' };
    }

    if (!customer.lteAuth?.ki || !customer.lteAuth?.opc) {
      console.log(`[HSS Sync] Skipping sync for customer ${customer.customerId} - missing Ki or OPc`);
      return { success: false, reason: 'missing_auth_credentials' };
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }

    const subscriberData = {
      imsi: customer.networkInfo.imsi,
      msisdn: customer.networkInfo.msisdn || customer.primaryPhone?.replace(/\D/g, '') || '',
      full_name: customer.fullName || `${customer.firstName} ${customer.lastName}`,
      ki: customer.lteAuth.ki,
      opc: customer.lteAuth.opc,
      op: customer.lteAuth.op || null,
      sqn: customer.lteAuth.sqn || 0,
      qci: customer.servicePlan?.qci || 9,
      enabled: customer.serviceStatus === 'active' && customer.isActive !== false,
      tenant_id: tenantId,
      customer_id: customer._id.toString(),
      customer_customerId: customer.customerId,
      
      // Speed package information
      profile: {
        apn: 'internet',
        apn_config: [{
          apn: 'internet',
          qos_profile: customer.servicePlan?.priorityLevel || 'medium',
          static_ip: customer.networkInfo?.ipAddress || null
        }],
        subscription_type: 'postpaid',
        data_plan: {
          max_bandwidth_dl: customer.servicePlan?.maxBandwidthDl || 
                           (customer.servicePlan?.downloadMbps ? customer.servicePlan.downloadMbps * 1000000 : 100000000),
          max_bandwidth_ul: customer.servicePlan?.maxBandwidthUl || 
                           (customer.servicePlan?.uploadMbps ? customer.servicePlan.uploadMbps * 1000000 : 50000000),
          monthly_quota: customer.servicePlan?.dataQuota || 0,
          used_this_month: 0
        }
      },
      
      // MAC address for ACS integration (optional)
      mac_address: customer.macAddress || null,
      cpe_serial_number: customer.installation?.cpeSerialNumber || customer.networkInfo?.cpeSerialNumber || null,
      
      updated_at: new Date()
    };

    // Check if subscriber already exists
    const existingSubscriber = await db.collection('subscribers').findOne({
      imsi: subscriberData.imsi,
      tenant_id: tenantId
    });

    if (existingSubscriber) {
      // Update existing subscriber
      await db.collection('subscribers').updateOne(
        { _id: existingSubscriber._id },
        { 
          $set: subscriberData,
          $setOnInsert: { created_at: new Date() }
        }
      );
      console.log(`[HSS Sync] Updated subscriber in cloud HSS for customer ${customer.customerId} (IMSI: ${subscriberData.imsi})`);
      
      // Update customer with subscriber reference
      await Customer.findByIdAndUpdate(customer._id, {
        $set: { hssSubscriberId: existingSubscriber._id.toString() }
      });
      
      return { success: true, action: 'updated', subscriberId: existingSubscriber._id.toString() };
    } else {
      // Create new subscriber
      subscriberData.created_at = new Date();
      const result = await db.collection('subscribers').insertOne(subscriberData);
      console.log(`[HSS Sync] Created subscriber in cloud HSS for customer ${customer.customerId} (IMSI: ${subscriberData.imsi})`);
      
      // Update customer with subscriber reference
      await Customer.findByIdAndUpdate(customer._id, {
        $set: { hssSubscriberId: result.insertedId.toString() }
      });
      
      return { success: true, action: 'created', subscriberId: result.insertedId.toString() };
    }
  } catch (error) {
    console.error(`[HSS Sync] Error syncing customer ${customer.customerId} to cloud HSS:`, error);
    throw error;
  }
}

/**
 * Remove customer from cloud HSS (disable subscriber)
 */
async function removeCustomerFromCloudHSS(customer, tenantId) {
  try {
    if (!customer.networkInfo?.imsi) {
      return { success: false, reason: 'no_imsi' };
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }

    // Disable subscriber instead of deleting (keep history)
    const result = await db.collection('subscribers').updateOne(
      {
        imsi: customer.networkInfo.imsi,
        tenant_id: tenantId
      },
      {
        $set: {
          enabled: false,
          updated_at: new Date()
        }
      }
    );

    if (result.matchedCount > 0) {
      console.log(`[HSS Sync] Disabled subscriber in cloud HSS for customer ${customer.customerId} (IMSI: ${customer.networkInfo.imsi})`);
      return { success: true, action: 'disabled' };
    } else {
      console.log(`[HSS Sync] Subscriber not found in cloud HSS for customer ${customer.customerId}`);
      return { success: false, reason: 'not_found' };
    }
  } catch (error) {
    console.error(`[HSS Sync] Error removing customer ${customer.customerId} from cloud HSS:`, error);
    throw error;
  }
}

/**
 * Sync customer to all remote HSS instances for tenant
 * Sends subscriber data to each remote EPC's local HSS
 */
async function syncCustomerToRemoteHSSs(customer, tenantId, action = 'update') {
  try {
    // Only sync 4G/5G customers
    if (customer.serviceType !== '4G/5G' || !customer.networkInfo?.imsi) {
      return { success: false, reason: 'not_4g_5g_or_no_imsi', synced: [] };
    }

    // Find all active remote EPCs for this tenant
    const remoteEPCs = await RemoteEPC.find({
      tenant_id: tenantId,
      status: { $in: ['registered', 'online'] },
      deployment_type: { $in: ['epc', 'both'] }
    }).lean();

    if (remoteEPCs.length === 0) {
      console.log(`[HSS Sync] No remote EPCs found for tenant ${tenantId}`);
      return { success: true, reason: 'no_remote_epcs', synced: [] };
    }

    const subscriberData = {
      imsi: customer.networkInfo.imsi,
      msisdn: customer.networkInfo.msisdn || customer.primaryPhone?.replace(/\D/g, '') || '',
      full_name: customer.fullName || `${customer.firstName} ${customer.lastName}`,
      ki: customer.lteAuth?.ki || '',
      opc: customer.lteAuth?.opc || '',
      op: customer.lteAuth?.op || null,
      sqn: customer.lteAuth?.sqn || 0,
      qci: customer.servicePlan?.qci || 9,
      enabled: customer.serviceStatus === 'active' && customer.isActive !== false,
      customer_id: customer._id.toString(),
      customer_customerId: customer.customerId,
      
      profile: {
        apn: 'internet',
        max_bandwidth_dl: customer.servicePlan?.maxBandwidthDl || 
                         (customer.servicePlan?.downloadMbps ? customer.servicePlan.downloadMbps * 1000000 : 100000000),
        max_bandwidth_ul: customer.servicePlan?.maxBandwidthUl || 
                         (customer.servicePlan?.uploadMbps ? customer.servicePlan.uploadMbps * 1000000 : 50000000),
        monthly_quota: customer.servicePlan?.dataQuota || 0
      },
      
      mac_address: customer.macAddress || null,
      cpe_serial_number: customer.installation?.cpeSerialNumber || customer.networkInfo?.cpeSerialNumber || null
    };

    const syncedEPCs = [];
    const failedEPCs = [];

    // Sync to each remote EPC's local HSS
    for (const epc of remoteEPCs) {
      try {
        // Get EPC IP address (from status or config)
        const epcIp = epc.ip_address || epc.location?.address || null;
        if (!epcIp) {
          console.log(`[HSS Sync] Skipping EPC ${epc.epc_id} - no IP address`);
          failedEPCs.push({ epc_id: epc.epc_id, reason: 'no_ip' });
          continue;
        }

        // Use local HSS API endpoint (typically port 3000 on remote EPC)
        const localHssUrl = `http://${epcIp}:3000/api/hss/subscribers/${subscriberData.imsi}`;
        
        // Use EPC's auth for API calls
        const headers = {
          'Content-Type': 'application/json',
          'X-EPC-Auth': epc.auth_code,
          'X-API-Key': epc.api_key
        };

        if (action === 'delete' || action === 'disable') {
          // Disable subscriber on remote HSS
          await axios.delete(localHssUrl, { headers, timeout: 5000 });
        } else {
          // Create or update subscriber on remote HSS
          await axios.put(localHssUrl, subscriberData, { headers, timeout: 5000 });
        }

        syncedEPCs.push(epc.epc_id);
        console.log(`[HSS Sync] ${action === 'delete' ? 'Removed' : 'Synced'} subscriber ${subscriberData.imsi} to remote EPC ${epc.epc_id}`);
      } catch (error) {
        console.error(`[HSS Sync] Failed to sync to remote EPC ${epc.epc_id}:`, error.message);
        failedEPCs.push({ epc_id: epc.epc_id, reason: error.message });
      }
    }

    return {
      success: syncedEPCs.length > 0,
      synced: syncedEPCs,
      failed: failedEPCs,
      total: remoteEPCs.length
    };
  } catch (error) {
    console.error(`[HSS Sync] Error syncing customer ${customer.customerId} to remote HSSs:`, error);
    throw error;
  }
}

/**
 * Sync all active customers for a tenant to cloud and remote HSSs
 */
async function syncAllCustomersToHSS(tenantId) {
  try {
    const customers = await Customer.find({
      tenantId,
      serviceType: '4G/5G',
      'networkInfo.imsi': { $exists: true, $ne: null },
      'lteAuth.ki': { $exists: true, $ne: null },
      'lteAuth.opc': { $exists: true, $ne: null },
      isActive: true
    });

    console.log(`[HSS Sync] Syncing ${customers.length} customers for tenant ${tenantId}`);

    const results = {
      cloud: { success: 0, failed: 0 },
      remote: { success: 0, failed: 0, epcs_synced: [] }
    };

    for (const customer of customers) {
      try {
        // Sync to cloud HSS
        const cloudResult = await syncCustomerToCloudHSS(customer, tenantId);
        if (cloudResult.success) {
          results.cloud.success++;
        } else {
          results.cloud.failed++;
        }

        // Sync to remote HSSs
        const remoteResult = await syncCustomerToRemoteHSSs(customer, tenantId, 'update');
        if (remoteResult.success && remoteResult.synced.length > 0) {
          results.remote.success++;
          results.remote.epcs_synced.push(...remoteResult.synced);
        } else {
          results.remote.failed++;
        }
      } catch (error) {
        console.error(`[HSS Sync] Error syncing customer ${customer.customerId}:`, error);
        results.cloud.failed++;
        results.remote.failed++;
      }
    }

    return results;
  } catch (error) {
    console.error(`[HSS Sync] Error syncing all customers for tenant ${tenantId}:`, error);
    throw error;
  }
}

module.exports = {
  syncCustomerToCloudHSS,
  removeCustomerFromCloudHSS,
  syncCustomerToRemoteHSSs,
  syncAllCustomersToHSS
};
