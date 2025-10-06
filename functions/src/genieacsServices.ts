// GenieACS Core Services as Firebase Functions
// Implements GenieACS CWMP, NBI, FS, and UI services

import { onRequest } from 'firebase-functions/v2/https';
// import { MongoClient } from 'mongodb';
import cors from 'cors';

const corsHandler = cors({ origin: true });
// let mongoClient: MongoClient | null = null;

// Initialize MongoDB connection for GenieACS (disabled for now)
// async function getGenieACSMongoClient(): Promise<MongoClient> {
//   if (!mongoClient) {
//     const connectionUrl = process.env.MONGODB_CONNECTION_URL || 'mongodb://localhost:27017/genieacs';
//     mongoClient = new MongoClient(connectionUrl);
//     await mongoClient.connect();
//   }
//   return mongoClient;
// }

// GenieACS CWMP Service (TR-069 Protocol) - disabled for now
// export const genieacsCWMP = onRequest({
  region: 'us-central1',
  memory: '1GiB',
  timeoutSeconds: 30
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      console.log('GenieACS CWMP request:', req.method, req.url);
      
      // Set GenieACS headers
      res.setHeader('GenieACS-Version', '1.2.13');
      res.setHeader('Content-Type', 'application/xml');
      
      // Handle TR-069 requests
      if (req.method === 'POST') {
        // Process TR-069 SOAP request
        const soapResponse = await processTR069Request(req.body);
        res.status(200).send(soapResponse);
      } else {
        res.status(405).send('Method not allowed');
      }
      
    } catch (error) {
      console.error('GenieACS CWMP error:', error);
      res.status(500).send('Internal server error');
    }
  });
});

// GenieACS Northbound Interface (REST API)
export const genieacsNBI = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 30
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      console.log('GenieACS NBI request:', req.method, req.url);
      
      // Set GenieACS headers
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
      
      // Route NBI requests
      const url = new URL(req.url, `http://localhost${req.url}`);
      const path = url.pathname;
      
      if (path.startsWith('/devices')) {
        await handleDevicesAPI(req, res, collections);
      } else if (path.startsWith('/tasks')) {
        await handleTasksAPI(req, res, collections);
      } else if (path.startsWith('/faults')) {
        await handleFaultsAPI(req, res, collections);
      } else if (path.startsWith('/presets')) {
        await handlePresetsAPI(req, res, collections);
      } else if (path.startsWith('/ping')) {
        await handlePingAPI(req, res, collections);
      } else {
        res.status(404).json({ error: 'Endpoint not found' });
      }
      
    } catch (error) {
      console.error('GenieACS NBI error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// GenieACS File Server
export const genieacsFS = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 60
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      console.log('GenieACS FS request:', req.method, req.url);
      
      // Set GenieACS headers
      res.setHeader('GenieACS-Version', '1.2.13');
      
      const client = await getGenieACSMongoClient();
      const db = client.db('genieacs');
      const gridFSBucket = new (require('mongodb').GridFSBucket)(db);
      
      const url = new URL(req.url, `http://localhost${req.url}`);
      const filename = decodeURIComponent(url.pathname.substring(1));
      
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
        const uploadStream = gridFSBucket.openUploadStream(filename);
        
        uploadStream.on('error', (error: any) => {
          console.error('File upload error:', error);
          res.status(500).send('Upload error');
        });
        
        uploadStream.on('finish', () => {
          res.status(200).json({ success: true, filename });
        });
        
        req.pipe(uploadStream);
        
      } else {
        res.status(405).send('Method not allowed');
      }
      
    } catch (error) {
      console.error('GenieACS FS error:', error);
      res.status(500).send('Internal server error');
    }
  });
});

// GenieACS Web UI
export const genieacsUI = onRequest({
  region: 'us-central1',
  memory: '512MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      console.log('GenieACS UI request:', req.method, req.url);
      
      // For now, redirect to the main PCI Mapper UI
      // In a full implementation, you would serve the GenieACS web interface
      res.redirect('/');
      
    } catch (error) {
      console.error('GenieACS UI error:', error);
      res.status(500).send('Internal server error');
    }
  });
});

// Handle TR-069 SOAP requests
async function processTR069Request(body: string): Promise<string> {
  // This is a simplified implementation
  // In a full implementation, you would parse the SOAP XML and handle TR-069 operations
  
  const soapResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap-enc="http://schemas.xmlsoap.org/soap/encoding/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap:Header>
    <cwmp:ID soap:mustUnderstand="1">1</cwmp:ID>
  </soap:Header>
  <soap:Body>
    <cwmp:InformResponse/>
  </soap:Body>
</soap:Envelope>`;
  
  return soapResponse;
}

// Handle devices API endpoints
async function handleDevicesAPI(req: any, res: any, collections: any) {
  const url = new URL(req.url, `http://localhost${req.url}`);
  const path = url.pathname;
  
  if (req.method === 'GET') {
    // Get devices
    const query = url.searchParams.get('query') ? JSON.parse(url.searchParams.get('query')) : {};
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const skip = parseInt(url.searchParams.get('skip') || '0');
    
    const devices = await collections.devices
      .find(query)
      .limit(limit)
      .skip(skip)
      .toArray();
    
    res.json(devices);
    
  } else if (req.method === 'DELETE') {
    // Delete device
    const deviceId = path.split('/')[2];
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }
    
    await collections.devices.deleteOne({ _id: deviceId });
    res.status(200).json({ success: true });
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handle tasks API endpoints
async function handleTasksAPI(req: any, res: any, collections: any) {
  const url = new URL(req.url, `http://localhost${req.url}`);
  const path = url.pathname;
  
  if (req.method === 'GET') {
    // Get tasks
    const query = url.searchParams.get('query') ? JSON.parse(url.searchParams.get('query')) : {};
    const tasks = await collections.tasks.find(query).toArray();
    res.json(tasks);
    
  } else if (req.method === 'POST') {
    // Create task
    const task = req.body;
    const result = await collections.tasks.insertOne(task);
    res.status(201).json({ _id: result.insertedId });
    
  } else if (req.method === 'DELETE') {
    // Delete task
    const taskId = path.split('/')[2];
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID required' });
    }
    
    await collections.tasks.deleteOne({ _id: taskId });
    res.status(200).json({ success: true });
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handle faults API endpoints
async function handleFaultsAPI(req: any, res: any, collections: any) {
  const url = new URL(req.url, `http://localhost${req.url}`);
  const path = url.pathname;
  
  if (req.method === 'GET') {
    // Get faults
    const query = url.searchParams.get('query') ? JSON.parse(url.searchParams.get('query')) : {};
    const faults = await collections.faults.find(query).toArray();
    res.json(faults);
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handle presets API endpoints
async function handlePresetsAPI(req: any, res: any, collections: any) {
  const url = new URL(req.url, `http://localhost${req.url}`);
  const path = url.pathname;
  
  if (req.method === 'GET') {
    // Get presets
    const presets = await collections.presets.find({}).toArray();
    res.json(presets);
    
  } else if (req.method === 'PUT') {
    // Create or update preset
    const presetName = path.split('/')[2];
    const preset = req.body;
    preset._id = presetName;
    
    await collections.presets.replaceOne({ _id: presetName }, preset, { upsert: true });
    res.status(200).json({ success: true });
    
  } else if (req.method === 'DELETE') {
    // Delete preset
    const presetName = path.split('/')[2];
    await collections.presets.deleteOne({ _id: presetName });
    res.status(200).json({ success: true });
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handle ping API endpoints
async function handlePingAPI(req: any, res: any, collections: any) {
  const url = new URL(req.url, `http://localhost${req.url}`);
  const path = url.pathname;
  
  if (req.method === 'POST') {
    // Ping device
    const deviceId = path.split('/')[2];
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }
    
    // Simulate ping (in real implementation, you would actually ping the device)
    const success = Math.random() > 0.1; // 90% success rate for demo
    const latency = Math.floor(Math.random() * 100) + 10; // 10-110ms
    
    res.json({
      success,
      latency: success ? latency : null
    });
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Cleanup MongoDB connection on function termination
process.on('SIGTERM', async () => {
  if (mongoClient) {
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
