// Firebase Functions Bridge to GenieACS Services
// Connects Firebase Functions to running GenieACS instance

import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import cors from 'cors';

// Firebase Admin is initialized in index.ts
const corsHandler = cors({ origin: true });
const db = getFirestore();

// Configuration - Update these URLs to point to your GenieACS server
const GENIEACS_CONFIG = {
  NBI_URL: process.env.GENIEACS_NBI_URL || 'http://localhost:7557',
  UI_URL: process.env.GENIEACS_UI_URL || 'http://localhost:8080',
  CWMP_URL: process.env.GENIEACS_CWMP_URL || 'http://localhost:7547',
  FS_URL: process.env.GENIEACS_FS_URL || 'http://localhost:7567'
};

// Proxy requests to GenieACS NBI
export const proxyGenieACSNBI = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { deviceId, ...queryParams } = req.query;
      const path = req.path.replace('/proxy/nbi', '');
      
      // Build query string
      const queryString = new URLSearchParams(queryParams as any).toString();
      const url = `${GENIEACS_CONFIG.NBI_URL}${path}${queryString ? '?' + queryString : ''}`;
      
      console.log(`Proxying to GenieACS NBI: ${req.method} ${url}`);
      
      const response = await fetch(url, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json'
        } as HeadersInit,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
      });
      
      const data = await response.json();
      
      return res.status(response.status).json({
        success: response.ok,
        data: data,
        source: 'genieacs-nbi'
      });
      
    } catch (error) {
      console.error('GenieACS NBI proxy error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: 'firebase-proxy'
      });
    }
  });
});

// Get devices from GenieACS and sync to Firestore
export const syncGenieACSDevices = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      console.log('Syncing devices from GenieACS...');
      
      // Get devices from GenieACS NBI
      const response = await fetch(`${GENIEACS_CONFIG.NBI_URL}/devices`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`GenieACS NBI error: ${response.status} ${response.statusText}`);
      }
      
      const genieacsDevices = await response.json();
      console.log(`Retrieved ${genieacsDevices.length} devices from GenieACS`);
      
      let syncedCount = 0;
      let errorCount = 0;
      
      // Sync each device to Firestore
      for (const device of genieacsDevices) {
        try {
          const cpeDevice = convertGenieACSDeviceToCPE(device);
          
          await db.collection('cpe_devices').doc(cpeDevice.id).set({
            ...cpeDevice,
            lastSync: FieldValue.serverTimestamp(),
            syncedFrom: 'genieacs'
          }, { merge: true });
          
          syncedCount++;
        } catch (error) {
          console.error(`Error syncing device ${device._id}:`, error);
          errorCount++;
        }
      }
      
      return res.json({
        success: true,
        message: `Synced ${syncedCount} devices from GenieACS`,
        synced: syncedCount,
        errors: errorCount,
        total: genieacsDevices.length
      });
      
    } catch (error) {
      console.error('GenieACS sync error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Get device parameters from GenieACS
export const getDeviceParameters = onRequest({
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
      
      // Get device parameters from GenieACS
      const response = await fetch(`${GENIEACS_CONFIG.NBI_URL}/devices/${deviceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`GenieACS NBI error: ${response.status} ${response.statusText}`);
      }
      
      const deviceData = await response.json();
      
      return res.json({
        success: true,
        device: convertGenieACSDeviceToCPE(deviceData),
        parameters: deviceData.parameters || {},
        source: 'genieacs'
      });
      
    } catch (error) {
      console.error('Get device parameters error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Execute task on GenieACS device
export const executeDeviceTask = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { deviceId } = req.params;
      const { name, parameter, value, object } = req.body;
      
      if (!deviceId || !name) {
        return res.status(400).json({
          success: false,
          error: 'Device ID and task name are required'
        });
      }
      
      // Create task in GenieACS
      const taskData = {
        device: deviceId,
        name: name,
        parameter: parameter,
        value: value,
        object: object
      };
      
      const response = await fetch(`${GENIEACS_CONFIG.NBI_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });
      
      if (!response.ok) {
        throw new Error(`GenieACS NBI error: ${response.status} ${response.statusText}`);
      }
      
      const taskResult = await response.json();
      
      return res.json({
        success: true,
        task: taskResult,
        message: `Task '${name}' created for device ${deviceId}`,
        source: 'genieacs'
      });
      
    } catch (error) {
      console.error('Execute device task error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Get device performance metrics from GenieACS
export const getDevicePerformanceMetrics = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { deviceId } = req.params;
      // const { hours = 24 } = req.query; // Unused for now
      
      if (!deviceId) {
        return res.status(400).json({
          success: false,
          error: 'Device ID is required'
        });
      }
      
      // Get device parameters that indicate performance
      const response = await fetch(`${GENIEACS_CONFIG.NBI_URL}/devices/${deviceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`GenieACS NBI error: ${response.status} ${response.statusText}`);
      }
      
      const deviceData = await response.json();
      
      // Extract performance metrics from device parameters
      const metrics = {
        deviceId: deviceId,
        timestamp: new Date(),
        signalStrength: deviceData.parameters?.['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.LinkUpstreamMaxBitRate'] || 'Unknown',
        bandwidth: deviceData.parameters?.['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.LinkDownstreamMaxBitRate'] || 'Unknown',
        uptime: deviceData.parameters?.['InternetGatewayDevice.DeviceInfo.UpTime'] || 'Unknown',
        lastInform: deviceData.parameters?.['InternetGatewayDevice.DeviceInfo.LastInform'] || 'Unknown',
        softwareVersion: deviceData.parameters?.['InternetGatewayDevice.DeviceInfo.SoftwareVersion'] || 'Unknown',
        hardwareVersion: deviceData.parameters?.['InternetGatewayDevice.DeviceInfo.HardwareVersion'] || 'Unknown'
      };
      
      return res.json({
        success: true,
        metrics: metrics,
        source: 'genieacs'
      });
      
    } catch (error) {
      console.error('Get device performance metrics error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Helper function to convert GenieACS device format to CPE format
function convertGenieACSDeviceToCPE(genieacsDevice: any): any {
  return {
    id: genieacsDevice._id || `device-${Date.now()}`,
    manufacturer: genieacsDevice.parameters?.['InternetGatewayDevice.DeviceInfo.Manufacturer'] || 'Unknown',
    model: genieacsDevice.parameters?.['InternetGatewayDevice.DeviceInfo.ModelName'] || 'Unknown',
    status: genieacsDevice.parameters?.['InternetGatewayDevice.ManagementServer.ConnectionRequestURL'] ? 'Online' : 'Offline',
    location: {
      latitude: parseFloat(genieacsDevice.parameters?.['InternetGatewayDevice.DeviceInfo.Location']?.split(',')[0]) || 0,
      longitude: parseFloat(genieacsDevice.parameters?.['InternetGatewayDevice.DeviceInfo.Location']?.split(',')[1]) || 0,
      address: genieacsDevice.parameters?.['InternetGatewayDevice.DeviceInfo.Location'] || 'Unknown'
    },
    lastContact: genieacsDevice.parameters?.['InternetGatewayDevice.DeviceInfo.LastInform'] ? 
      new Date(genieacsDevice.parameters['InternetGatewayDevice.DeviceInfo.LastInform'] * 1000) : new Date(),
    parameters: genieacsDevice.parameters || {},
    tags: ['genieacs', 'tr069'],
    genieacsId: genieacsDevice._id
  };
}
