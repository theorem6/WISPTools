// Firebase Functions for GenieACS Integration
// Provides API bridge between GenieACS (MongoDB) and PCI Mapper (Firestore)
// Uses MongoDB Node.js Driver v6.x: https://www.mongodb.com/docs/drivers/node/current/

// Import shared Firebase initialization (must be first)
import { db } from './firebaseInit.js';

// Import MongoDB connection handler
import { getGenieACSCollections, closeMongoConnection } from './mongoConnection.js';

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue } from 'firebase-admin/firestore';
import cors from 'cors';

const corsHandler = cors({ origin: true });

// Sync CPE devices from GenieACS MongoDB to Firestore
export const syncCPEDevices = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 60
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      console.log('Starting CPE device sync from GenieACS...');
      
      const collections = await getGenieACSCollections();
      
      // Get all devices from GenieACS
      const genieacsDevices = await collections.devices.find({}).toArray();
      
      console.log(`Found ${genieacsDevices.length} devices in GenieACS`);
      
      let syncedCount = 0;
      let errorCount = 0;
      
      // Process each device
      for (const device of genieacsDevices) {
        try {
          // Convert GenieACS device to CPE format
          const cpeDevice = await convertGenieACSDeviceToCPE(device);
          
          if (cpeDevice) {
            // Store in Firestore
            await db.collection('cpe_devices').doc(cpeDevice.id).set({
              ...cpeDevice,
              lastSync: FieldValue.serverTimestamp(),
              source: 'genieacs',
              genieacsDeviceId: device._id.toString()
            }, { merge: true });
            
            syncedCount++;
          }
        } catch (error) {
          console.error(`Error processing device ${device._id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`Sync completed: ${syncedCount} synced, ${errorCount} errors`);
      
      return res.json({
        success: true,
        synced: syncedCount,
        errors: errorCount,
        total: genieacsDevices.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('CPE device sync failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Get CPE devices from Firestore (for PCI Mapper)
export const getCPEDevices = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { status, withGPS, limit } = req.query;
      
      let query: any = db.collection('cpe_devices');
      
      // Apply filters
      if (status) {
        query = query.where('status', '==', status);
      }
      
      if (withGPS === 'true') {
        query = query.where('location.latitude', '>', 0);
      }
      
      // Apply limit
      if (limit) {
        query = query.limit(parseInt(limit as string));
      }
      
      const snapshot = await query.get();
      const devices = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return res.json({
        success: true,
        devices,
        count: devices.length
      });
      
    } catch (error) {
      console.error('Failed to get CPE devices:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Get CPE device by ID
export const getCPEDevice = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { deviceId } = req.params;
      
      if (!deviceId) {
        return res.status(400).json({
          success: false,
          error: 'Device ID is required'
        });
      }
      
      const doc = await db.collection('cpe_devices').doc(deviceId).get();
      
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Device not found'
        });
      }
      
      return res.json({
        success: true,
        device: {
          id: doc.id,
          ...doc.data()
        }
      });
      
    } catch (error) {
      console.error('Failed to get CPE device:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Update CPE device location
export const updateCPELocation = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { deviceId } = req.params;
      const { latitude, longitude, accuracy } = req.body;
      
      if (!deviceId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Device ID, latitude, and longitude are required'
        });
      }
      
      await db.collection('cpe_devices').doc(deviceId).update({
        'location.latitude': latitude,
        'location.longitude': longitude,
        'location.accuracy': accuracy || null,
        'location.lastUpdate': FieldValue.serverTimestamp(),
        lastSync: FieldValue.serverTimestamp()
      });
      
      return res.json({
        success: true,
        message: 'Location updated successfully'
      });
      
    } catch (error) {
      console.error('Failed to update CPE location:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Get CPE performance metrics
export const getCPEPerformanceMetrics = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { deviceId } = req.params;
      
      if (!deviceId) {
        return res.status(400).json({
          success: false,
          error: 'Device ID is required'
        });
      }
      
      // Get recent performance data
      const snapshot = await db.collection('cpe_performance')
        .where('deviceId', '==', deviceId)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
      
      const metrics = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return res.json({
        success: true,
        deviceId,
        metrics,
        count: metrics.length
      });
      
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Scheduled sync (runs every 5 minutes)
export const scheduledCPESync = onSchedule({
  schedule: 'every 5 minutes',
  region: 'us-central1',
  memory: '512MiB'
}, async (event) => {
  try {
    console.log('Starting scheduled CPE sync...');
    
    const collections = await getGenieACSCollections();
    
    // Get devices that need syncing (last contact within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentDevices = await collections.devices.find({
      '_lastInform': { $gte: tenMinutesAgo }
    }).toArray();
    
    console.log(`Found ${recentDevices.length} devices to sync`);
    
    let syncedCount = 0;
    
    for (const device of recentDevices) {
      try {
        const cpeDevice = await convertGenieACSDeviceToCPE(device);
        
        if (cpeDevice) {
          await db.collection('cpe_devices').doc(cpeDevice.id).set({
            ...cpeDevice,
            lastSync: FieldValue.serverTimestamp(),
            source: 'genieacs',
            genieacsDeviceId: device._id.toString()
          }, { merge: true });
          
          syncedCount++;
        }
      } catch (error) {
        console.error(`Error syncing device ${device._id}:`, error);
      }
    }
    
    console.log(`Scheduled sync completed: ${syncedCount} devices synced`);
    
  } catch (error) {
    console.error('Scheduled CPE sync failed:', error);
  }
});

// Convert GenieACS device to CPE format
async function convertGenieACSDeviceToCPE(genieacsDevice: any): Promise<any> {
  try {
    const deviceId = genieacsDevice._deviceId || {};
    
    // Extract location information
    const location = {
      latitude: genieacsDevice['Device.GPS.Latitude'] || 0,
      longitude: genieacsDevice['Device.GPS.Longitude'] || 0,
      accuracy: genieacsDevice['Device.GPS.Accuracy'] || null,
      lastUpdate: genieacsDevice['Device.GPS.LastUpdate'] || genieacsDevice._lastInform || new Date(),
      source: 'gps'
    };
    
    // Extract network information
    const networkInfo = {
      ipAddress: genieacsDevice['Device.IP.Interface.1.IPAddress'] || '0.0.0.0',
      macAddress: genieacsDevice['Device.Ethernet.Interface.1.MACAddress'] || '00:00:00:00:00:00',
      connectionType: genieacsDevice['Device.WiFi.Radio.1.SSID'] ? 'wifi' : 'ethernet',
      wifiSSID: genieacsDevice['Device.WiFi.Radio.1.SSID'] || null,
      wifiChannel: genieacsDevice['Device.WiFi.Radio.1.Channel'] || null,
      wifiFrequency: genieacsDevice['Device.WiFi.Radio.1.Frequency'] || null,
      signalStrength: genieacsDevice['Device.WiFi.Radio.1.SignalStrength'] || null
    };
    
    // Extract performance metrics
    const performanceMetrics = {
      signalStrength: genieacsDevice['Device.WiFi.Radio.1.SignalStrength'] || -100,
      bandwidth: 0, // TODO: Calculate from traffic stats
      latency: 0, // TODO: Implement ping-based measurement
      packetLoss: 0, // TODO: Calculate from error stats
      uptime: genieacsDevice['Device.DeviceInfo.Uptime'] || 0,
      lastUpdate: new Date()
    };
    
    // Determine device status
    const status = determineDeviceStatus(genieacsDevice);
    
    const cpeDevice = {
      id: generateDeviceId(deviceId),
      deviceId: {
        manufacturer: deviceId.Manufacturer || 'Unknown',
        oui: deviceId.OUI || '000000',
        productClass: deviceId.ProductClass || 'Unknown',
        serialNumber: deviceId.SerialNumber || genieacsDevice._id
      },
      location,
      networkInfo,
      performanceMetrics,
      lastContact: genieacsDevice._lastInform || new Date(),
      status,
      connectionRequestURL: genieacsDevice['Device.ManagementServer.ConnectionRequestURL'] || null,
      softwareVersion: genieacsDevice['Device.DeviceInfo.SoftwareVersion'] || null,
      hardwareVersion: genieacsDevice['Device.DeviceInfo.HardwareVersion'] || null,
      createdAt: genieacsDevice._registered || new Date(),
      updatedAt: new Date(),
      tags: genieacsDevice._tags || []
    };
    
    return cpeDevice;
    
  } catch (error) {
    console.error('Error converting GenieACS device:', error);
    return null;
  }
}

// Generate device ID from TR-069 device identification
function generateDeviceId(deviceId: any): string {
  return `${deviceId.OUI || '000000'}-${deviceId.SerialNumber || 'unknown'}`;
}

// Determine device status based on last contact
function determineDeviceStatus(genieacsDevice: any): string {
  if (!genieacsDevice._lastInform) return 'unknown';
  
  const timeSinceLastInform = Date.now() - genieacsDevice._lastInform.getTime();
  const timeoutMs = 5 * 60 * 1000; // 5 minutes
  
  if (timeSinceLastInform < timeoutMs) {
    return 'online';
  } else {
    return 'offline';
  }
}

// Cleanup MongoDB connection on function termination
process.on('SIGTERM', async () => {
  console.log('Closing MongoDB connection...');
  await closeMongoConnection();
});

process.on('SIGINT', async () => {
  await closeMongoConnection();
});
