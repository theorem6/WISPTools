// Multi-Tenant GenieACS Core Services
// Implements tenant-isolated GenieACS functionality

import { onRequest } from 'firebase-functions/v2/https';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import {
  withTenantContext,
  extractTenantFromCWMPUrl,
  addTenantFilter,
  addTenantToDocument,
  type TenantContext
} from './tenantMiddleware';

const corsHandler = cors({ origin: true });
let mongoClient: MongoClient | null = null;

// Initialize MongoDB connection for GenieACS
async function getGenieACSMongoClient(): Promise<MongoClient> {
  if (!mongoClient) {
    const connectionUrl = process.env.MONGODB_CONNECTION_URL || 
      'mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0';
    mongoClient = new MongoClient(connectionUrl);
    await mongoClient.connect();
    console.log('✅ GenieACS MongoDB connection established');
  }
  return mongoClient;
}

/**
 * GenieACS Northbound Interface with Multi-Tenancy
 */
export const genieacsNBIMultitenant = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 30
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    return withTenantContext(async (req, res, context) => {
      try {
        console.log(`[Tenant: ${context.tenantId}] GenieACS NBI request:`, req.method, req.url);
        
        res.setHeader('GenieACS-Version', '1.2.13');
        
        const client = await getGenieACSMongoClient();
        const db = client.db('genieacs');
        const collections = {
          devices: db.collection('devices'),
          tasks: db.collection('tasks'),
          faults: db.collection('faults'),
          presets: db.collection('presets'),
          operations: db.collection('operations')
        };
        
        const url = new URL(req.url, `http://localhost${req.url}`);
        const path = url.pathname;
        
        if (path.startsWith('/devices')) {
          await handleDevicesAPIMultitenant(req, res, collections, context);
        } else if (path.startsWith('/tasks')) {
          await handleTasksAPIMultitenant(req, res, collections, context);
        } else if (path.startsWith('/faults')) {
          await handleFaultsAPIMultitenant(req, res, collections, context);
        } else if (path.startsWith('/presets')) {
          await handlePresetsAPIMultitenant(req, res, collections, context);
        } else if (path.startsWith('/ping')) {
          await handlePingAPIMultitenant(req, res, collections, context);
        } else {
          res.status(404).json({ error: 'Endpoint not found' });
        }
        
      } catch (error) {
        console.error(`[Tenant: ${context.tenantId}] GenieACS NBI error:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    })(req, res);
  });
});

/**
 * Handle devices API with tenant filtering
 */
async function handleDevicesAPIMultitenant(
  req: any,
  res: any,
  collections: any,
  context: TenantContext
) {
  const url = new URL(req.url, `http://localhost${req.url}`);
  const path = url.pathname;
  
  if (req.method === 'GET') {
    // Get devices for this tenant only
    const queryParam = url.searchParams.get('query');
    let query = queryParam ? JSON.parse(queryParam) : {};
    
    // Add tenant filter
    query = addTenantFilter(query, context.tenantId);
    
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const skip = parseInt(url.searchParams.get('skip') || '0');
    
    const devices = await collections.devices
      .find(query)
      .limit(limit)
      .skip(skip)
      .toArray();
    
    console.log(`[Tenant: ${context.tenantId}] Found ${devices.length} devices`);
    res.json(devices);
    
  } else if (req.method === 'DELETE') {
    // Delete device (check permission)
    if (!context.permissions.canManageDevices) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const deviceId = path.split('/')[2];
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }
    
    // Ensure device belongs to tenant
    const result = await collections.devices.deleteOne({ 
      _id: deviceId,
      _tenantId: context.tenantId
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Device not found or access denied' });
    }
    
    res.status(200).json({ success: true });
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle tasks API with tenant filtering
 */
async function handleTasksAPIMultitenant(
  req: any,
  res: any,
  collections: any,
  context: TenantContext
) {
  const url = new URL(req.url, `http://localhost${req.url}`);
  const path = url.pathname;
  
  if (req.method === 'GET') {
    // Get tasks for this tenant only
    const queryParam = url.searchParams.get('query');
    let query = queryParam ? JSON.parse(queryParam) : {};
    query = addTenantFilter(query, context.tenantId);
    
    const tasks = await collections.tasks.find(query).toArray();
    res.json(tasks);
    
  } else if (req.method === 'POST') {
    // Create task (check permission)
    if (!context.permissions.canManageDevices) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const task = addTenantToDocument(req.body, context.tenantId);
    task.createdBy = context.userId;
    task.createdAt = new Date();
    
    const result = await collections.tasks.insertOne(task);
    res.status(201).json({ _id: result.insertedId });
    
  } else if (req.method === 'DELETE') {
    // Delete task (check permission)
    if (!context.permissions.canManageDevices) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const taskId = path.split('/')[2];
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID required' });
    }
    
    const result = await collections.tasks.deleteOne({ 
      _id: taskId,
      _tenantId: context.tenantId
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }
    
    res.status(200).json({ success: true });
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle faults API with tenant filtering
 */
async function handleFaultsAPIMultitenant(
  req: any,
  res: any,
  collections: any,
  context: TenantContext
) {
  const url = new URL(req.url, `http://localhost${req.url}`);
  
  if (req.method === 'GET') {
    // Get faults for this tenant only
    const queryParam = url.searchParams.get('query');
    let query = queryParam ? JSON.parse(queryParam) : {};
    query = addTenantFilter(query, context.tenantId);
    
    const faults = await collections.faults.find(query).toArray();
    res.json(faults);
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle presets API with tenant filtering
 */
async function handlePresetsAPIMultitenant(
  req: any,
  res: any,
  collections: any,
  context: TenantContext
) {
  const url = new URL(req.url, `http://localhost${req.url}`);
  const path = url.pathname;
  
  if (req.method === 'GET') {
    // Get presets for this tenant only
    const presets = await collections.presets
      .find({ _tenantId: context.tenantId })
      .toArray();
    res.json(presets);
    
  } else if (req.method === 'PUT') {
    // Create or update preset (check permission)
    if (!context.permissions.canManagePresets) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const presetName = path.split('/')[2];
    const preset = addTenantToDocument(req.body, context.tenantId);
    preset._id = presetName;
    preset.updatedBy = context.userId;
    preset.updatedAt = new Date();
    
    await collections.presets.replaceOne(
      { _id: presetName, _tenantId: context.tenantId },
      preset,
      { upsert: true }
    );
    res.status(200).json({ success: true });
    
  } else if (req.method === 'DELETE') {
    // Delete preset (check permission)
    if (!context.permissions.canManagePresets) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const presetName = path.split('/')[2];
    const result = await collections.presets.deleteOne({ 
      _id: presetName,
      _tenantId: context.tenantId
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Preset not found or access denied' });
    }
    
    res.status(200).json({ success: true });
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle ping API
 */
async function handlePingAPIMultitenant(
  req: any,
  res: any,
  collections: any,
  context: TenantContext
) {
  const url = new URL(req.url, `http://localhost${req.url}`);
  const path = url.pathname;
  
  if (req.method === 'POST') {
    const deviceId = path.split('/')[2];
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }
    
    // Verify device belongs to tenant
    const device = await collections.devices.findOne({
      _id: deviceId,
      _tenantId: context.tenantId
    });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found or access denied' });
    }
    
    // Simulate ping
    const success = Math.random() > 0.1;
    const latency = Math.floor(Math.random() * 100) + 10;
    
    res.json({
      success,
      latency: success ? latency : null,
      tenantId: context.tenantId
    });
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * GenieACS File Server with tenant isolation
 */
export const genieacsFSMultitenant = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 60
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    // For file uploads from devices, extract tenant from URL
    const tenantId = await extractTenantFromCWMPUrl(req.url || '');
    
    if (!tenantId) {
      return res.status(404).send('Tenant not found');
    }
    
    try {
      console.log(`[Tenant: ${tenantId}] GenieACS FS request:`, req.method, req.url);
      
      res.setHeader('GenieACS-Version', '1.2.13');
      
      const client = await getGenieACSMongoClient();
      const db = client.db('genieacs');
      const GridFSBucket = require('mongodb').GridFSBucket;
      
      // Use tenant-specific bucket
      const bucketName = `fs_${tenantId}`;
      const gridFSBucket = new GridFSBucket(db, { bucketName });
      
      const url = new URL(req.url, `http://localhost${req.url}`);
      const filename = decodeURIComponent(url.pathname.substring(1).split('/').slice(1).join('/'));
      
      if (req.method === 'GET') {
        // Download file
        const downloadStream = gridFSBucket.openDownloadStreamByName(filename);
        
        downloadStream.on('error', (error: any) => {
          if (error.code === 'ENOENT') {
            res.status(404).send('File not found');
          } else {
            console.error('File download error:', error);
            res.status(500).send('Download error');
          }
        });
        
        downloadStream.pipe(res);
        
      } else if (req.method === 'PUT') {
        // Upload file
        const uploadStream = gridFSBucket.openUploadStream(filename, {
          metadata: { tenantId, uploadedAt: new Date() }
        });
        
        uploadStream.on('error', (error: any) => {
          console.error('File upload error:', error);
          res.status(500).send('Upload error');
        });
        
        uploadStream.on('finish', () => {
          res.status(200).json({ success: true, filename, tenantId });
        });
        
        req.pipe(uploadStream);
        
      } else {
        res.status(405).send('Method not allowed');
      }
      
    } catch (error) {
      console.error(`[Tenant: ${tenantId}] GenieACS FS error:`, error);
      res.status(500).send('Internal server error');
    }
  });
});

// Cleanup MongoDB connection on function termination
process.on('SIGTERM', async () => {
  if (mongoClient) {
    console.log('Closing GenieACS MongoDB connection...');
    await mongoClient.close();
    mongoClient = null;
  }
});

process.on('SIGINT', async () => {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
  }
});

