/**
 * CBRS Analytics Functions
 * Handles analytics and reporting
 */

import { onCall, onRequest } from 'firebase-functions/v2/https';
import { db } from '../firebaseInit.js';
import cors from 'cors';

const corsHandler = cors({ origin: true });

/**
 * Get CBRS analytics for a tenant
 */
export const getCBRSAnalytics = onCall(async (request) => {
  try {
    const { tenantId, startDate, endDate } = request.data;
    
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }
    
    console.log(`[CBRS Analytics] Getting analytics for tenant ${tenantId}`);
    
    // Get devices
    const devicesSnapshot = await db.collection('cbrs_devices')
      .where('tenantId', '==', tenantId)
      .get();
    
    const totalDevices = devicesSnapshot.size;
    let activeDevices = 0;
    let totalGrants = 0;
    
    devicesSnapshot.forEach(doc => {
      const device = doc.data();
      if (device.state === 'REGISTERED' || device.state === 'AUTHORIZED') {
        activeDevices++;
      }
      if (device.grants && Array.isArray(device.grants)) {
        totalGrants += device.grants.length;
      }
    });
    
    // Get events in date range
    let eventsQuery = db.collection('cbrs_events')
      .where('tenantId', '==', tenantId);
    
    if (startDate) {
      eventsQuery = eventsQuery.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
      eventsQuery = eventsQuery.where('timestamp', '<=', new Date(endDate));
    }
    
    const eventsSnapshot = await eventsQuery.get();
    
    const eventTypes: Record<string, number> = {};
    eventsSnapshot.forEach(doc => {
      const event = doc.data();
      eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
    });
    
    return {
      success: true,
      analytics: {
        devices: {
          total: totalDevices,
          active: activeDevices,
          inactive: totalDevices - activeDevices
        },
        grants: {
          total: totalGrants,
          average_per_device: totalDevices > 0 ? (totalGrants / totalDevices).toFixed(2) : 0
        },
        events: {
          total: eventsSnapshot.size,
          by_type: eventTypes
        },
        date_range: {
          start: startDate || null,
          end: endDate || null
        }
      }
    };
  } catch (error: any) {
    console.error('[CBRS Analytics] Error:', error);
    throw new Error(error.message || 'Failed to get analytics');
  }
});

/**
 * Webhook endpoint for SAS callbacks
 */
export const cbrsWebhook = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { eventType, deviceId, data } = req.body;
      
      console.log(`[CBRS Webhook] Received ${eventType} for device ${deviceId}`);
      
      // Store the webhook event
      await db.collection('cbrs_webhook_events').add({
        eventType,
        deviceId,
        data,
        timestamp: new Date(),
        headers: req.headers,
        source_ip: req.ip
      });
      
      // Process the event based on type
      if (eventType === 'grant_update') {
        // Update device grant status
        if (deviceId && data.grants) {
          await db.collection('cbrs_devices').doc(deviceId).update({
            grants: data.grants,
            updatedAt: new Date()
          });
        }
      }
      
      res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (error: any) {
      console.error('[CBRS Webhook] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

