// Multi-Tenant GenieACS Bridge
// Connects Firebase Functions to GenieACS with tenant isolation

import { db } from './firebaseInit.js';
import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import cors from 'cors';
import {
  withTenantContext,
  extractTenantFromCWMPUrl,
  addTenantFilter,
  addTenantToDocument
} from './tenantMiddleware.js';

const corsHandler = cors({ origin: true });

// Configuration
const GENIEACS_CONFIG = {
  NBI_URL: process.env.GENIEACS_NBI_URL || 'http://localhost:7557',
  UI_URL: process.env.GENIEACS_UI_URL || 'http://localhost:8080',
  CWMP_URL: process.env.GENIEACS_CWMP_URL || 'http://localhost:7547',
  FS_URL: process.env.GENIEACS_FS_URL || 'http://localhost:7567'
};

/**
 * Proxy requests to GenieACS NBI with tenant filtering
 */
export const proxyGenieACSNBIMultitenant = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    return withTenantContext(async (req, res, context) => {
      try {
        const { deviceId, ...queryParams } = req.query;
        const path = req.path.replace('/proxy/nbi', '');
        
        // Add tenant filter to query
        const tenantQuery = addTenantFilter(queryParams, context.tenantId);
        
        // Build query string
        const queryString = new URLSearchParams(tenantQuery as any).toString();
        const url = `${GENIEACS_CONFIG.NBI_URL}${path}${queryString ? '?' + queryString : ''}`;
        
        console.log(`[Tenant: ${context.tenantId}] Proxying to GenieACS NBI: ${req.method} ${url}`);
        
        const response = await fetch(url, {
          method: req.method,
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': context.tenantId
          } as HeadersInit,
          body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });
        
        let data = await response.json();
        
        // Filter response data by tenant if it's an array
        if (Array.isArray(data)) {
          data = data.filter((item: any) => item._tenantId === context.tenantId);
        } else if (data._tenantId && data._tenantId !== context.tenantId) {
          // Single item doesn't belong to this tenant
          return res.status(403).json({
            success: false,
            error: 'Access denied to this resource',
            source: 'tenant-filter'
          });
        }
        
        return res.status(response.status).json({
          success: response.ok,
          data: data,
          source: 'genieacs-nbi',
          tenantId: context.tenantId
        });
        
      } catch (error) {
        console.error('GenieACS NBI proxy error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          source: 'firebase-proxy'
        });
      }
    })(req, res);
  });
});

/**
 * Get devices from GenieACS and sync to Firestore (tenant-specific)
 */
export const syncGenieACSDevicesMultitenant = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    return withTenantContext(async (req, res, context) => {
      try {
        console.log(`[Tenant: ${context.tenantId}] Syncing devices from GenieACS...`);
        
        // Get devices from GenieACS NBI with tenant filter
        const tenantQuery = { _tenantId: context.tenantId };
        const queryString = new URLSearchParams({ 
          query: JSON.stringify(tenantQuery) 
        }).toString();
        
        const response = await fetch(`${GENIEACS_CONFIG.NBI_URL}/devices?${queryString}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': context.tenantId
          }
        });
        
        if (!response.ok) {
          throw new Error(`GenieACS NBI error: ${response.status} ${response.statusText}`);
        }
        
        const genieacsDevices = await response.json();
        console.log(`[Tenant: ${context.tenantId}] Retrieved ${genieacsDevices.length} devices from GenieACS`);
        
        let syncedCount = 0;
        let errorCount = 0;
        
        // Sync each device to Firestore with tenant context
        for (const device of genieacsDevices) {
          try {
            const cpeDevice = convertGenieACSDeviceToCPE(device);
            
            // Add tenant ID to device
            const tenantDevice = {
              ...cpeDevice,
              tenantId: context.tenantId,
              lastSync: FieldValue.serverTimestamp(),
              syncedFrom: 'genieacs',
              syncedBy: context.userId
            };
            
            // Store in tenant-specific collection
            await db
              .collection('tenants')
              .doc(context.tenantId)
              .collection('cpe_devices')
              .doc(cpeDevice.id)
              .set(tenantDevice, { merge: true });
            
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
          total: genieacsDevices.length,
          tenantId: context.tenantId
        });
        
      } catch (error) {
        console.error('GenieACS sync error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })(req, res);
  });
});

/**
 * Handle CWMP requests with tenant routing
 */
export const handleCWMPMultitenant = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 30
}, async (req: any, res: any) => {
  try {
    // Extract tenant from URL (no authentication needed for device connections)
    const tenantId = await extractTenantFromCWMPUrl(req.url || '');
    
    if (!tenantId) {
      console.error('No tenant found in CWMP URL:', req.url);
      return res.status(404).send('Tenant not found');
    }
    
    console.log(`[Tenant: ${tenantId}] CWMP request from device`);
    
    // Get tenant configuration
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      console.error('Tenant not found:', tenantId);
      return res.status(404).send('Tenant not found');
    }
    
    const tenant = tenantDoc.data();
    
    // Forward to GenieACS CWMP with tenant header
    const response = await fetch(GENIEACS_CONFIG.CWMP_URL, {
      method: req.method,
      headers: {
        ...req.headers,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/xml'
      } as HeadersInit,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
    });
    
    const responseText = await response.text();
    
    // Log CWMP activity
    await db.collection('tenants').doc(tenantId).collection('cwmp_logs').add({
      timestamp: FieldValue.serverTimestamp(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      responseStatus: response.status,
      tenantSettings: tenant?.settings
    });
    
    res.status(response.status).send(responseText);
    
  } catch (error) {
    console.error('CWMP handler error:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * Get device parameters with tenant filtering
 */
export const getDeviceParametersMultitenant = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    return withTenantContext(async (req, res, context) => {
      try {
        const { deviceId } = req.params;
        
        if (!deviceId) {
          return res.status(400).json({
            success: false,
            error: 'Device ID is required'
          });
        }
        
        // Verify device belongs to tenant
        const deviceQuery = { _id: deviceId, _tenantId: context.tenantId };
        const queryString = new URLSearchParams({ 
          query: JSON.stringify(deviceQuery) 
        }).toString();
        
        const response = await fetch(`${GENIEACS_CONFIG.NBI_URL}/devices?${queryString}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': context.tenantId
          }
        });
        
        if (!response.ok) {
          throw new Error(`GenieACS NBI error: ${response.status} ${response.statusText}`);
        }
        
        const devices = await response.json();
        if (devices.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Device not found or access denied'
          });
        }
        
        const deviceData = devices[0];
        
        return res.json({
          success: true,
          device: convertGenieACSDeviceToCPE(deviceData),
          parameters: deviceData.parameters || {},
          source: 'genieacs',
          tenantId: context.tenantId
        });
        
      } catch (error) {
        console.error('Get device parameters error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })(req, res);
  });
});

/**
 * Execute task on device with tenant validation
 */
export const executeDeviceTaskMultitenant = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    return withTenantContext(async (req, res, context) => {
      try {
        const { deviceId } = req.params;
        const { name, parameter, value, object } = req.body;
        
        if (!deviceId || !name) {
          return res.status(400).json({
            success: false,
            error: 'Device ID and task name are required'
          });
        }
        
        // Check permission
        if (!context.permissions.canManageDevices) {
          return res.status(403).json({
            success: false,
            error: 'Permission denied: Cannot manage devices'
          });
        }
        
        // Create task with tenant context
        const taskData = addTenantToDocument({
          device: deviceId,
          name: name,
          parameter: parameter,
          value: value,
          object: object,
          createdBy: context.userId
        }, context.tenantId);
        
        const response = await fetch(`${GENIEACS_CONFIG.NBI_URL}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': context.tenantId
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
          source: 'genieacs',
          tenantId: context.tenantId
        });
        
      } catch (error) {
        console.error('Execute device task error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })(req, res);
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
    genieacsId: genieacsDevice._id,
    tenantId: genieacsDevice._tenantId
  };
}

