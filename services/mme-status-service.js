/**
 * MME Status Service
 * Tracks customer online/offline status reported by remote HSS/MME instances
 * Maintains live customer counts per EPC
 */

const mongoose = require('mongoose');
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { Customer } = require('../models/customer');

/**
 * Schema for tracking subscriber online/offline status
 */
const SubscriberStatusSchema = new mongoose.Schema({
  imsi: { type: String, required: true, index: true },
  tenant_id: { type: String, required: true, index: true },
  epc_id: { type: String, required: true, index: true },
  customer_id: { type: String, index: true },
  status: { 
    type: String, 
    enum: ['online', 'offline'],
    required: true,
    index: true
  },
  mme_id: String,
  cell_id: String,
  ip_address: String,
  last_attach: Date,
  last_detach: Date,
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

// Compound index for efficient queries
SubscriberStatusSchema.index({ epc_id: 1, status: 1, timestamp: -1 });
SubscriberStatusSchema.index({ tenant_id: 1, epc_id: 1, status: 1 });
SubscriberStatusSchema.index({ imsi: 1, epc_id: 1, timestamp: -1 }, { unique: false });

let SubscriberStatus;
try {
  SubscriberStatus = mongoose.model('SubscriberStatus');
} catch {
  SubscriberStatus = mongoose.model('SubscriberStatus', SubscriberStatusSchema);
}

/**
 * Report subscriber online/offline status from remote HSS/MME
 */
async function reportSubscriberStatus(epcId, tenantId, statusData) {
  try {
    const { imsi, status, mme_id, cell_id, ip_address } = statusData;

    if (!imsi || !status || !['online', 'offline'].includes(status)) {
      throw new Error('Invalid status data: imsi and status (online/offline) are required');
    }

    // Find customer by IMSI
    const customer = await Customer.findOne({
      tenantId,
      'networkInfo.imsi': imsi,
      isActive: true
    });

    // Record status change
    const statusRecord = new SubscriberStatus({
      imsi,
      tenant_id: tenantId,
      epc_id: epcId,
      customer_id: customer?._id?.toString() || null,
      status,
      mme_id: mme_id || null,
      cell_id: cell_id || null,
      ip_address: ip_address || null,
      last_attach: status === 'online' ? new Date() : null,
      last_detach: status === 'offline' ? new Date() : null,
      timestamp: new Date()
    });

    await statusRecord.save();

    // Update customer's last online timestamp if online
    if (status === 'online' && customer) {
      await Customer.findByIdAndUpdate(customer._id, {
        $set: {
          'networkInfo.lastOnline': new Date(),
          'networkInfo.ipAddress': ip_address || customer.networkInfo?.ipAddress
        }
      });
    }

    // Update EPC customer count (aggregate from recent status records)
    await updateEPCCustomerCount(epcId, tenantId);

    console.log(`[MME Status] ${status.toUpperCase()}: IMSI ${imsi} on EPC ${epcId}`);
    return { success: true, status };
  } catch (error) {
    console.error(`[MME Status] Error reporting subscriber status:`, error);
    throw error;
  }
}

/**
 * Batch report multiple subscriber statuses
 */
async function reportBatchSubscriberStatus(epcId, tenantId, statuses) {
  try {
    const results = [];
    for (const statusData of statuses) {
      try {
        const result = await reportSubscriberStatus(epcId, tenantId, statusData);
        results.push({ ...result, imsi: statusData.imsi });
      } catch (error) {
        results.push({ success: false, imsi: statusData.imsi, error: error.message });
      }
    }
    return { success: true, results };
  } catch (error) {
    console.error(`[MME Status] Error in batch status report:`, error);
    throw error;
  }
}

/**
 * Update EPC customer count based on current online subscribers
 */
async function updateEPCCustomerCount(epcId, tenantId) {
  try {
    // Get count of currently online subscribers for this EPC
    // Consider subscribers online if they have a status record in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const onlineCount = await SubscriberStatus.countDocuments({
      epc_id: epcId,
      tenant_id: tenantId,
      status: 'online',
      timestamp: { $gte: fiveMinutesAgo }
    });

    const totalCount = await SubscriberStatus.distinct('imsi', {
      epc_id: epcId,
      tenant_id: tenantId,
      timestamp: { $gte: fiveMinutesAgo }
    }).then(imsis => imsis.length);

    // Update RemoteEPC with customer counts
    await RemoteEPC.findOneAndUpdate(
      { epc_id: epcId, tenant_id: tenantId },
      {
        $set: {
          'metrics.customer_count': {
            online: onlineCount,
            total: totalCount,
            updated_at: new Date()
          }
        }
      }
    );

    return { online: onlineCount, total: totalCount };
  } catch (error) {
    console.error(`[MME Status] Error updating EPC customer count:`, error);
    throw error;
  }
}

/**
 * Get current customer count for an EPC
 */
async function getEPCCustomerCount(epcId, tenantId) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const onlineCount = await SubscriberStatus.countDocuments({
      epc_id: epcId,
      tenant_id: tenantId,
      status: 'online',
      timestamp: { $gte: fiveMinutesAgo }
    });

    const totalUnique = await SubscriberStatus.distinct('imsi', {
      epc_id: epcId,
      tenant_id: tenantId,
      timestamp: { $gte: fiveMinutesAgo }
    }).then(imsis => imsis.length);

    return { online: onlineCount, total: totalUnique };
  } catch (error) {
    console.error(`[MME Status] Error getting EPC customer count:`, error);
    throw error;
  }
}

/**
 * Get subscriber status history
 */
async function getSubscriberStatusHistory(imsi, epcId = null, limit = 100) {
  try {
    const query = { imsi };
    if (epcId) {
      query.epc_id = epcId;
    }

    const history = await SubscriberStatus.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return history;
  } catch (error) {
    console.error(`[MME Status] Error getting subscriber status history:`, error);
    throw error;
  }
}

/**
 * Get all online subscribers for an EPC
 */
async function getOnlineSubscribers(epcId, tenantId) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const onlineSubscribers = await SubscriberStatus.find({
      epc_id: epcId,
      tenant_id: tenantId,
      status: 'online',
      timestamp: { $gte: fiveMinutesAgo }
    })
      .sort({ timestamp: -1 })
      .lean();

    // Get unique IMSIs with latest status
    const uniqueSubscribers = new Map();
    for (const record of onlineSubscribers) {
      if (!uniqueSubscribers.has(record.imsi) || 
          uniqueSubscribers.get(record.imsi).timestamp < record.timestamp) {
        uniqueSubscribers.set(record.imsi, record);
      }
    }

    return Array.from(uniqueSubscribers.values());
  } catch (error) {
    console.error(`[MME Status] Error getting online subscribers:`, error);
    throw error;
  }
}

module.exports = {
  reportSubscriberStatus,
  reportBatchSubscriberStatus,
  updateEPCCustomerCount,
  getEPCCustomerCount,
  getSubscriberStatusHistory,
  getOnlineSubscribers,
  SubscriberStatus
};
