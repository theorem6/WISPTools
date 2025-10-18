/**
 * CBRS Device Management Functions
 * Handles device CRUD operations
 */

import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { db } from '../firebaseInit.js';

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
    
    // Verify device belongs to tenant before deleting
    const deviceDoc = await db.collection('cbrs_devices').doc(deviceId).get();
    
    if (!deviceDoc.exists) {
      throw new Error('Device not found');
    }
    
    const deviceData = deviceDoc.data();
    if (deviceData?.tenantId !== tenantId) {
      throw new Error('Device does not belong to this tenant');
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
 * Log CBRS event
 */
export const logCBRSEvent = onCall(async (request) => {
  try {
    const { tenantId, deviceId, eventType, eventData } = request.data;
    
    if (!tenantId || !deviceId || !eventType) {
      throw new Error('Missing required fields');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }
    
    const event = {
      tenantId,
      deviceId,
      eventType,
      eventData,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userId: request.auth.uid
    };
    
    await db.collection('cbrs_events').add(event);
    
    return { success: true };
  } catch (error: any) {
    console.error('[CBRS] Error logging event:', error);
    throw new Error(error.message || 'Failed to log event');
  }
});

