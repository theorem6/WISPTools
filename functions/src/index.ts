// Firebase Functions - Main Entry Point
// Combines PCI analysis and GenieACS integration

// Import shared Firebase initialization (must be first)
import { db } from './firebaseInit.js';

// Export notification functions
export { onWorkOrderAssigned } from './notifications.js';

// Export admin setup function
export { setupAdmin } from './setupAdmin.js';

import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { FieldValue } from 'firebase-admin/firestore';

const corsHandler = cors({ origin: true });

// PCI Analysis Function (existing)
export const analyzePCI = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 30
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { cells } = req.body;
      
      if (!cells || !Array.isArray(cells)) {
        return res.status(400).json({ error: 'Invalid cells data' });
      }

      // Analyze PCI conflicts (simplified version)
      const conflicts = analyzeConflictsSimple(cells);
      
      // Save analysis to Firestore
      const analysisRef = await db.collection('pci_analyses').add({
        cells: cells,
        conflicts: conflicts,
        timestamp: FieldValue.serverTimestamp(),
        cellCount: cells.length,
        conflictCount: conflicts.length
      });

      return res.json({
        analysisId: analysisRef.id,
        conflicts: conflicts,
        summary: {
          totalCells: cells.length,
          totalConflicts: conflicts.length,
          criticalConflicts: conflicts.filter(c => c.severity === 'CRITICAL').length
        }
      });
    } catch (error) {
      console.error('PCI Analysis Error:', error);
      return res.status(500).json({ error: 'Analysis failed' });
    }
  });
});

// Export GenieACS bridge functions (connects to real GenieACS)
export {
  proxyGenieACSNBI,
  syncGenieACSDevices,
  getDeviceParameters,
  executeDeviceTask,
  getDevicePerformanceMetrics
} from './genieacsBridge.js';

// Export simplified GenieACS integration functions (Firestore only - fallback)
export {
  syncCPEDevices,
  getCPEDevices,
  getCPEDevice,
  updateCPELocation,
  getCPEPerformanceMetrics
} from './simpleGenieacsIntegration.js';

// Export simplified GenieACS core services (placeholders)
export {
  genieacsCWMP,
  genieacsNBI,
  genieacsFS,
  genieacsUI
} from './simpleGenieacsServices.js';

// Export Multi-Tenant GenieACS functions
export {
  proxyGenieACSNBIMultitenant,
  syncGenieACSDevicesMultitenant,
  handleCWMPMultitenant,
  getDeviceParametersMultitenant,
  executeDeviceTaskMultitenant
} from './genieacsBridgeMultitenant.js';

export {
  genieacsNBIMultitenant,
  genieacsFSMultitenant
} from './genieacsServicesMultitenant.js';


// Export Firestore-based presets management (legacy - fallback)
export {
  getPresets,
  createPreset,
  deletePreset,
  initializeSamplePresets
} from './cleanPresetsManagement.js';

// Export Firestore-based faults management (legacy - fallback)
export {
  getFaults,
  getFault,
  createFault,
  resolveFault,
  initializeSampleFaults
} from './faultsManagement.js';

// Export MongoDB-backed presets management (primary)
export {
  getMongoPresets,
  createMongoPreset,
  updateMongoPreset,
  deleteMongoPreset,
  toggleMongoPreset
} from './mongoPresetsManagement.js';

// Export MongoDB-backed faults management (primary)
export {
  getMongoFaults,
  getMongoFault,
  acknowledgeMongoFault,
  deleteMongoFault,
  createMongoFault,
  deleteResolvedMongoFaults
} from './mongoFaultsManagement.js';

// Export MongoDB initialization and health check functions
export {
  checkMongoHealth,
  initializeMongoPresets,
  initializeMongoFaults,
  initializeMongoDatabase
} from './mongoInitialization.js';

// Export CBRS Management functions (modular)
export {
  getCBRSDevices,
  saveCBRSDevice,
  deleteCBRSDevice,
  logCBRSEvent,
  proxySASRequest,
  getSASUserIDs,
  getSASInstallations,
  getCBRSAnalytics,
  cbrsWebhook
} from './cbrs/index.js';

// Simple PCI conflict detection function (existing)
function analyzeConflictsSimple(cells: any[]) {
  const conflicts: any[] = [];
  
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cell1 = cells[i];
      const cell2 = cells[j];
      
      // Check for PCI conflicts
      if (cell1.pci === cell2.pci) {
        conflicts.push({
          type: 'COLLISION',
          severity: 'CRITICAL',
          cell1: cell1,
          cell2: cell2,
          distance: calculateDistance(cell1, cell2)
        });
      }
      
      // Check for Mod3 conflicts
      if (cell1.pci % 3 === cell2.pci % 3) {
        conflicts.push({
          type: 'MOD3',
          severity: 'HIGH',
          cell1: cell1,
          cell2: cell2,
          distance: calculateDistance(cell1, cell2)
        });
      }
    }
  }
  
  return conflicts;
}

// Calculate distance between two cells
function calculateDistance(cell1: any, cell2: any): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(cell2.latitude - cell1.latitude);
  const dLon = toRadians(cell2.longitude - cell1.longitude);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(cell1.latitude)) * Math.cos(toRadians(cell2.latitude)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// HSS API Proxy - Provides HTTPS endpoint for HTTP backend (Port 3001)
export const hssProxy = onRequest({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60,
  cors: true
}, async (req, res) => {
  // Set CORS headers explicitly
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
  res.set('Access-Control-Max-Age', '3600');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  const backendUrl = 'https://hss.wisptools.io';
  
  // Build the full path from originalUrl (falls back to url/path) and strip the function mount if present
  // When called via direct Cloud Function URL, path may be: /hssProxy/api/deploy/...
  // When called via Firebase Hosting rewrite, path is: /api/deploy/...
  // When called via Cloud Run service directly, path is: /api/deploy/...
  let incoming = (req as any).originalUrl || req.url || req.path || '';
  
  // Strip /hssProxy prefix if present (when called directly via Cloud Function URL)
  if (incoming.startsWith('/hssProxy')) {
    incoming = incoming.substring('/hssProxy'.length);
  } else if (incoming.startsWith('hssProxy/')) {
    incoming = incoming.substring('hssProxy/'.length);
  }
  
  // Ensure path starts with / for backend URL construction
  const proxiedPath = incoming.startsWith('/') ? incoming : `/${incoming}`;
  const url = `${backendUrl}${proxiedPath}`;
  
  // Log request details for debugging
  console.log('[hssProxy] Request details:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: (req as any).originalUrl,
    processedPath: proxiedPath,
    finalUrl: url,
    headers: Object.keys(req.headers || {})
  });
  
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    // Forward x-tenant-id if present
    if (req.headers['x-tenant-id']) {
      headers['x-tenant-id'] = req.headers['x-tenant-id'] as string;
    }
    
    // Forward Authorization header if present
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'] as string;
    }
    
    const options: RequestInit = {
      method: req.method,
      headers
    };
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(url, options);
    
    // Check content type to determine how to handle response
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else if (contentType.includes('text/') || url.includes('deployment-script')) {
      // Handle text responses (like shell scripts)
      const text = await response.text();
      res.status(response.status).set('Content-Type', contentType || 'text/plain').send(text);
    } else {
      // Fallback: try JSON, then text
      try {
        const data = await response.json();
        res.status(response.status).json(data);
      } catch {
        const text = await response.text();
        res.status(response.status).send(text);
      }
    }
  } catch (error: any) {
    console.error('HSS Proxy Error:', error);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message,
      details: error.toString()
    });
  }
});

// ISO Generation API Proxy - Provides HTTPS endpoint for ISO API (Port 3002)
export const isoProxy = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 300,  // 5 minutes for ISO generation
  cors: true
}, async (req, res) => {
  // Set CORS headers explicitly
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
  res.set('Access-Control-Max-Age', '3600');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  const backendUrl = 'http://136.112.111.167:3002';  // ISO API port
  const path = req.path || '';
  const url = `${backendUrl}${path}`;
  
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    // Forward x-tenant-id if present
    if (req.headers['x-tenant-id']) {
      headers['x-tenant-id'] = req.headers['x-tenant-id'] as string;
    }
    
    // Forward Authorization header if present
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'] as string;
    }
    
    const options: RequestInit = {
      method: req.method,
      headers
    };
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(url, options);
    
    // Check content type to determine how to handle response
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      // Fallback for other content types
      const text = await response.text();
      res.status(response.status).set('Content-Type', contentType || 'text/plain').send(text);
    }
  } catch (error: any) {
    console.error('ISO Proxy Error:', error);
    res.status(500).json({ 
      error: 'ISO proxy error', 
      message: error.message,
      details: error.toString()
    });
  }
});