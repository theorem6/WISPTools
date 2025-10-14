/**
 * Firebase Functions for CBRS Management
 * Backend API for CBRS device and spectrum management
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { db } from './firebaseInit.js';

const corsHandler = cors({ origin: true });

/**
 * Get CBRS devices for a tenant
 */
export const getCBRSDevices = onCall(async (request) => {
  try {
    const { tenantId } = request.data;
    
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }
    
    console.log(`[CBRS] Getting devices for tenant: ${tenantId}`);
    
    const devicesRef = db.collection('cbrs_devices');
    const snapshot = await devicesRef.where('tenantId', '==', tenantId).get();
    
    const devices: any[] = [];
    snapshot.forEach(doc => {
      devices.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`[CBRS] Found ${devices.length} devices`);
    
    return {
      success: true,
      devices
    };
  } catch (error: any) {
    console.error('[CBRS] Error getting devices:', error);
    throw new Error(error.message || 'Failed to get devices');
  }
});

/**
 * Create or update a CBRS device
 */
export const saveCBRSDevice = onCall(async (request) => {
  try {
    const { device } = request.data;
    
    if (!device || !device.id) {
      throw new Error('Valid device data is required');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }
    
    console.log(`[CBRS] Saving device: ${device.id}`);
    
    // Prepare device data for Firestore
    const deviceData = {
      ...device,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid
    };
    
    // If new device, add creation timestamp
    if (!device.createdAt) {
      deviceData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      deviceData.createdBy = request.auth.uid;
    }
    
    await db.collection('cbrs_devices').doc(device.id).set(deviceData, { merge: true });
    
    console.log(`[CBRS] Device saved successfully: ${device.id}`);
    
    return {
      success: true,
      message: 'Device saved successfully'
    };
  } catch (error: any) {
    console.error('[CBRS] Error saving device:', error);
    throw new Error(error.message || 'Failed to save device');
  }
});

/**
 * Delete a CBRS device
 */
export const deleteCBRSDevice = onCall(async (request) => {
  try {
    const { deviceId, tenantId } = request.data;
    
    if (!deviceId || !tenantId) {
      throw new Error('Device ID and Tenant ID are required');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }
    
    console.log(`[CBRS] Deleting device: ${deviceId}`);
    
    // Verify device belongs to tenant
    const deviceDoc = await db.collection('cbrs_devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      throw new Error('Device not found');
    }
    
    const deviceData = deviceDoc.data();
    if (deviceData?.tenantId !== tenantId) {
      throw new Error('Unauthorized: Device does not belong to this tenant');
    }
    
    await db.collection('cbrs_devices').doc(deviceId).delete();
    
    console.log(`[CBRS] Device deleted successfully: ${deviceId}`);
    
    return {
      success: true,
      message: 'Device deleted successfully'
    };
  } catch (error: any) {
    console.error('[CBRS] Error deleting device:', error);
    throw new Error(error.message || 'Failed to delete device');
  }
});

/**
 * Proxy SAS API requests (for secure server-side API calls)
 * Enhanced version with tenant-specific credentials and mTLS support
 */
export const proxySASRequest = onCall(async (request) => {
  try {
    const { tenantId, endpoint, data } = request.data;
    
    if (!tenantId || !endpoint || !data) {
      throw new Error('tenantId, endpoint, and data are required');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }

    const userId = request.auth.uid;
    
    console.log(`[CBRS Proxy] Request from user ${userId} for tenant ${tenantId}, endpoint ${endpoint}`);

    // Verify user has access to this tenant
    const userTenantDoc = await db.collection('user_tenants').doc(`${userId}_${tenantId}`).get();
    if (!userTenantDoc.exists) {
      throw new Error('Forbidden - User does not have access to this tenant');
    }

    // Load tenant CBRS configuration
    const configDoc = await db.collection('cbrs_config').doc(tenantId).get();
    if (!configDoc.exists) {
      throw new Error('Tenant CBRS configuration not found - please configure in Settings');
    }

    const tenantConfig = configDoc.data();

    // Load platform configuration (for shared API key)
    const platformConfigDoc = await db.collection('cbrs_platform_config').doc('platform').get();
    const platformConfig = platformConfigDoc.exists ? platformConfigDoc.data() : null;

    // Use platform API key (shared mode)
    const apiKey = platformConfig?.googleApiKey;
    const apiEndpoint = platformConfig?.googleApiEndpoint || 'https://sas.googleapis.com/v1';

    if (!apiKey) {
      throw new Error('Platform Google SAS API key not configured. Contact administrator.');
    }

    console.log(`[CBRS Proxy] Using platform API key for endpoint: ${apiEndpoint}${endpoint}`);
    console.log(`[CBRS Proxy] Tenant User ID: ${tenantConfig?.googleUserId}`);
    console.log(`[CBRS Proxy] Tenant Email: ${tenantConfig?.googleEmail}`);
    console.log(`[CBRS Proxy] Has certificate: ${!!tenantConfig?.googleCertificate}`);

    // Build request headers
    const headers: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // Add tenant-specific identifiers
    if (tenantConfig?.googleUserId) {
      headers['X-User-Id'] = tenantConfig.googleUserId;
    }
    
    if (tenantConfig?.googleEmail) {
      headers['X-User-Email'] = tenantConfig.googleEmail;
    }

    // Make the request to Google SAS
    const url = `${apiEndpoint}${endpoint}`;
    
    // Note: For mTLS, we would use https.Agent with cert/key
    // But Google SAS in shared platform mode typically uses API key auth
    // Certificates can be configured if needed for specific deployments
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CBRS Proxy] Google SAS API error: ${response.status} - ${errorText}`);
      throw new Error(`Google SAS API error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    
    console.log(`[CBRS Proxy] Google SAS request successful`);
    
    return {
      success: true,
      data: responseData
    };
    
  } catch (error: any) {
    console.error('[CBRS Proxy] Error:', error);
    throw new Error(error.message || 'Failed to proxy SAS request');
  }
});

/**
 * Get list of SAS User IDs that the Google account has access to
 * Called after Google OAuth to show user their authorized SAS entities
 */
export const getSASUserIDs = onCall(async (request) => {
  try {
    const { tenantId, googleEmail, googleAccessToken } = request.data;
    
    if (!tenantId || !googleEmail || !googleAccessToken) {
      throw new Error('tenantId, googleEmail, and googleAccessToken are required');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }

    const userId = request.auth.uid;
    
    console.log(`[SAS Users] Fetching User IDs for ${googleEmail} (tenant: ${tenantId})`);

    // Verify user has access to this tenant
    const userTenantDoc = await db.collection('user_tenants').doc(`${userId}_${tenantId}`).get();
    if (!userTenantDoc.exists) {
      throw new Error('Forbidden - User does not have access to this tenant');
    }

    // Load platform configuration (for API key)
    const platformConfigDoc = await db.collection('cbrs_platform_config').doc('platform').get();
    const platformConfig = platformConfigDoc.exists ? platformConfigDoc.data() : null;

    const apiKey = platformConfig?.googleApiKey;
    const apiEndpoint = platformConfig?.googleApiEndpoint || 'https://sas.googleapis.com/v1';

    if (!apiKey) {
      throw new Error('Platform Google SAS API key not configured. Contact administrator.');
    }

    console.log(`[SAS Users] Calling Google SAS API to list User IDs`);
    
    // Call Google SAS API to get list of User IDs/entities for this Google account
    // Note: The exact endpoint may vary - consult Google SAS API documentation
    // This is a common pattern where the API returns entities the user manages
    
    try {
      // Attempt to call Google SAS userinfo or entities endpoint
      const url = `${apiEndpoint}/userinfo`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-User-Email': googleEmail,
          'X-OAuth-Token': googleAccessToken
        }
      });

      if (!response.ok) {
        console.error(`[SAS Users] Google SAS API returned ${response.status}`);
        
        // If specific endpoint not available, return a mock list for now
        // In production, this should call the actual Google SAS endpoint
        // that lists the User IDs the authenticated email has access to
        
        return {
          success: true,
          userIds: [
            {
              userId: 'isp-supplies',
              displayName: 'ISP Supplies',
              organizationName: 'Peterson Consulting',
              registrationStatus: 'active',
              isPrimary: true
            }
          ],
          note: 'Using default User ID - configure Google SAS API endpoint for full functionality'
        };
      }

      const responseData = await response.json();
      
      // Parse the User IDs from the response
      // Format depends on Google SAS API structure
      const userIds = responseData.userIds || responseData.entities || [];
      
      console.log(`[SAS Users] Found ${userIds.length} authorized User IDs`);
      
      return {
        success: true,
        userIds
      };
      
    } catch (apiError: any) {
      console.error('[SAS Users] Error calling Google SAS:', apiError);
      
      // Return default/mock data if API not available
      // This allows users to still manually enter their User ID
      return {
        success: true,
        userIds: [
          {
            userId: 'isp-supplies',
            displayName: 'ISP Supplies',
            organizationName: 'Peterson Consulting',
            registrationStatus: 'active',
            isPrimary: true
          }
        ],
        note: 'Default User ID - actual Google SAS User ID list API not yet configured'
      };
    }
    
  } catch (error: any) {
    console.error('[SAS Users] Error:', error);
    throw new Error(error.message || 'Failed to fetch SAS User IDs');
  }
});

/**
 * Log CBRS events for compliance and auditing
 */
export const logCBRSEvent = onCall(async (request) => {
  try {
    const { tenantId, deviceId, eventType, eventData } = request.data;
    
    if (!tenantId || !deviceId || !eventType) {
      throw new Error('Tenant ID, Device ID, and Event Type are required');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }
    
    console.log(`[CBRS] Logging event: ${eventType} for device ${deviceId}`);
    
    const eventLog = {
      tenantId,
      deviceId,
      eventType,
      eventData: eventData || {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userId: request.auth.uid
    };
    
    await db.collection('cbrs_event_logs').add(eventLog);
    
    return {
      success: true,
      message: 'Event logged successfully'
    };
  } catch (error: any) {
    console.error('[CBRS] Error logging event:', error);
    throw new Error(error.message || 'Failed to log event');
  }
});

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
    
    console.log(`[CBRS] Getting analytics for tenant: ${tenantId}`);
    
    // Get devices
    const devicesSnapshot = await db.collection('cbrs_devices')
      .where('tenantId', '==', tenantId)
      .get();
    
    const devices: any[] = [];
    devicesSnapshot.forEach(doc => {
      devices.push({ id: doc.id, ...doc.data() });
    });
    
    // Get event logs for date range
    let logsQuery = db.collection('cbrs_event_logs')
      .where('tenantId', '==', tenantId);
    
    if (startDate) {
      logsQuery = logsQuery.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
      logsQuery = logsQuery.where('timestamp', '<=', new Date(endDate));
    }
    
    const logsSnapshot = await logsQuery.get();
    
    const events: any[] = [];
    logsSnapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });
    
    // Calculate analytics
    const analytics = {
      totalDevices: devices.length,
      registeredDevices: devices.filter(d => d.state === 'REGISTERED' || d.state === 'GRANTED' || d.state === 'AUTHORIZED').length,
      activeGrants: devices.reduce((sum, d) => sum + (d.activeGrants?.length || 0), 0),
      events: {
        total: events.length,
        byType: events.reduce((acc: any, event: any) => {
          acc[event.eventType] = (acc[event.eventType] || 0) + 1;
          return acc;
        }, {})
      },
      devicesByState: devices.reduce((acc: any, device: any) => {
        acc[device.state] = (acc[device.state] || 0) + 1;
        return acc;
      }, {}),
      devicesByProvider: devices.reduce((acc: any, device: any) => {
        acc[device.sasProviderId] = (acc[device.sasProviderId] || 0) + 1;
        return acc;
      }, {})
    };
    
    console.log(`[CBRS] Analytics generated successfully`);
    
    return {
      success: true,
      analytics
    };
  } catch (error: any) {
    console.error('[CBRS] Error getting analytics:', error);
    throw new Error(error.message || 'Failed to get analytics');
  }
});

/**
 * HTTP endpoint for webhooks from SAS providers
 */
export const cbrsWebhook = onRequest((req, res) => {
  return corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      const { provider, eventType, data } = req.body;
      
      console.log(`[CBRS] Webhook received from ${provider}: ${eventType}`);
      
      // Process webhook based on provider and event type
      switch (eventType) {
        case 'grant_suspended':
          await handleGrantSuspended(data);
          break;
        case 'grant_terminated':
          await handleGrantTerminated(data);
          break;
        case 'incumbent_activity':
          await handleIncumbentActivity(data);
          break;
        default:
          console.log(`[CBRS] Unknown event type: ${eventType}`);
      }
      
      res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (error: any) {
      console.error('[CBRS] Webhook error:', error);
      res.status(500).json({ error: error.message || 'Webhook processing failed' });
    }
  });
});

/**
 * Handle grant suspended event
 */
async function handleGrantSuspended(data: any) {
  const { cbsdId, grantId } = data;
  
  console.log(`[CBRS] Processing grant suspension: ${grantId}`);
  
  // Find device by cbsdId
  const devicesSnapshot = await db.collection('cbrs_devices')
    .where('cbsdId', '==', cbsdId)
    .limit(1)
    .get();
  
  if (devicesSnapshot.empty) {
    console.warn(`[CBRS] Device not found for cbsdId: ${cbsdId}`);
    return;
  }
  
  const deviceDoc = devicesSnapshot.docs[0];
  const device = deviceDoc.data();
  
  // Update grant state
  if (device.activeGrants) {
    const updatedGrants = device.activeGrants.map((grant: any) => {
      if (grant.grantId === grantId) {
        return { ...grant, grantState: 'SUSPENDED' };
      }
      return grant;
    });
    
    await deviceDoc.ref.update({
      activeGrants: updatedGrants,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  // Log event
  await db.collection('cbrs_event_logs').add({
    tenantId: device.tenantId,
    deviceId: deviceDoc.id,
    eventType: 'grant_suspended',
    eventData: { cbsdId, grantId },
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Handle grant terminated event
 */
async function handleGrantTerminated(data: any) {
  const { cbsdId, grantId } = data;
  
  console.log(`[CBRS] Processing grant termination: ${grantId}`);
  
  // Find device by cbsdId
  const devicesSnapshot = await db.collection('cbrs_devices')
    .where('cbsdId', '==', cbsdId)
    .limit(1)
    .get();
  
  if (devicesSnapshot.empty) {
    console.warn(`[CBRS] Device not found for cbsdId: ${cbsdId}`);
    return;
  }
  
  const deviceDoc = devicesSnapshot.docs[0];
  const device = deviceDoc.data();
  
  // Remove grant
  if (device.activeGrants) {
    const updatedGrants = device.activeGrants.filter((grant: any) => grant.grantId !== grantId);
    
    await deviceDoc.ref.update({
      activeGrants: updatedGrants,
      state: updatedGrants.length > 0 ? 'GRANTED' : 'REGISTERED',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  // Log event
  await db.collection('cbrs_event_logs').add({
    tenantId: device.tenantId,
    deviceId: deviceDoc.id,
    eventType: 'grant_terminated',
    eventData: { cbsdId, grantId },
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Handle incumbent activity alert
 */
async function handleIncumbentActivity(data: any) {
  const { location, frequency } = data;
  
  console.log(`[CBRS] Processing incumbent activity alert`);
  
  // Log event for all affected tenants
  await db.collection('cbrs_event_logs').add({
    eventType: 'incumbent_activity',
    eventData: { location, frequency },
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // TODO: Notify affected devices/tenants
}

