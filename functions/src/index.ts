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
import { FUNCTIONS_CONFIG } from './config.js';

const corsHandler = cors({ origin: [...FUNCTIONS_CONFIG.cors.origins] });

// PCI Analysis Function (existing)
export const analyzePCI = onRequest({
  region: FUNCTIONS_CONFIG.functions.defaultOptions.region,
  memory: FUNCTIONS_CONFIG.functions.defaultOptions.memory,
  timeoutSeconds: FUNCTIONS_CONFIG.functions.defaultOptions.timeoutSeconds
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

// Main API Proxy - Provides HTTPS endpoint for unified backend API (Port 3001)
// Handles all API routes: customers, work-orders, inventory, plans, HSS, billing, etc.
// Updated: Improved path handling for Firebase Hosting rewrites
export const apiProxy = onRequest({
  region: FUNCTIONS_CONFIG.functions.apiProxy.region,
  memory: FUNCTIONS_CONFIG.functions.apiProxy.memory,
  timeoutSeconds: FUNCTIONS_CONFIG.functions.apiProxy.timeoutSeconds,
  cors: true
}, async (req, res) => {
  // Set CORS headers explicitly and reflect origin
  // Allow all authorized Firebase Hosting domains (from centralized config)
  const allowedOrigins: string[] = [...FUNCTIONS_CONFIG.cors.origins];
  
  const origin = (req.headers.origin as string) || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*');
  
  res.set('Access-Control-Allow-Origin', allowedOrigin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id, X-Tenant-ID');
  res.set('Access-Control-Max-Age', '3600');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Vary', 'Origin');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  // Build the full path from originalUrl (falls back to url/path) and strip the function mount if present
  // When called via direct Cloud Function URL, path may be: /apiProxy/api/customers
  // When called via Firebase Hosting rewrite, the original path is preserved in req.url
  // When called via Cloud Run service directly, path is: /api/customers
  // For Firebase Functions v2 onRequest, req.url contains the full path including query string
  // req.path may be just '/' for rewrites, so we prioritize req.url
  let incoming = '';
  
  // Priority order for getting the path:
  // 1. req.url (Firebase Hosting rewrites preserve the original URL here)
  // 2. originalUrl (if available)
  // 3. req.path (fallback)
  if (req.url && req.url !== '/') {
    incoming = req.url;
  } else if ((req as any).originalUrl && (req as any).originalUrl !== '/') {
    incoming = (req as any).originalUrl;
  } else if (req.path && req.path !== '/') {
    incoming = req.path;
  }
  
  // Strip /apiProxy prefix if present (when called directly via Cloud Function URL)
  if (incoming.startsWith('/apiProxy')) {
    incoming = incoming.substring('/apiProxy'.length);
  } else if (incoming.startsWith('apiProxy/')) {
    incoming = incoming.substring('apiProxy/'.length);
  }
  
  // For Firebase Hosting rewrites, the path might include query string
  // Extract just the pathname if query string is present
  if (incoming.includes('?')) {
    incoming = incoming.split('?')[0];
  }
  
  // Ensure path starts with / for backend URL construction
  const proxiedPath = incoming.startsWith('/') ? incoming : `/${incoming}`;

  // Backend Service Architecture:
  // - Port 3001: Unified Main API Server (backend-services/server.js)
  //   Handles ALL routes: /api/customers, /api/work-orders, /api/hss, /api/inventory,
  //   /api/plans, /api/maintain, /api/billing, /admin/** etc.
  // - Port 3002: EPC/ISO Generation API (min-epc-server.js) - Handles /api/deploy/**
  // Note: Port 3000 is available for separate HSS service if needed in future
  const backendIp = process.env.BACKEND_HOST_IP || '136.112.111.167';
  
  // Route all API requests to the unified main API server on port 3001
  const backendHost = `http://${backendIp}:3001`;
  const url = `${backendHost}${proxiedPath}`;
  
  // Log request details for debugging
  console.log('[apiProxy] Request details:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: (req as any).originalUrl,
    rawRequestUrl: (req as any).rawRequest?.url,
    processedPath: proxiedPath,
    finalUrl: url,
    headers: Object.keys(req.headers || {}),
    authHeaders: {
      authorization: req.headers['authorization'] ? 'present' : 'missing',
      Authorization: req.headers['Authorization'] ? 'present' : 'missing',
      allAuthKeys: Object.keys(req.headers || {}).filter(h => h.toLowerCase().includes('auth'))
    },
    bodyType: typeof req.body,
    bodyKeys: req.body ? Object.keys(req.body) : 'null/undefined'
  });
  
  // Validate that we have a valid path
  if (!proxiedPath || proxiedPath === '/') {
    console.error('[apiProxy] ERROR: Empty or invalid path after processing:', {
      incoming,
      proxiedPath,
      originalUrl: (req as any).originalUrl,
      url: req.url,
      path: req.path
    });
    res.set('Access-Control-Allow-Origin', origin).status(400).json({
      error: 'Invalid request path',
      message: 'No valid API path found in request',
      details: {
        originalUrl: (req as any).originalUrl,
        url: req.url,
        path: req.path
      }
    });
    return;
  }
  
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    // Forward x-tenant-id if present (check both lowercase and camelCase)
    const tenantId = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
    if (tenantId) {
      headers['x-tenant-id'] = tenantId as string;
      console.log('[apiProxy] Forwarding tenant ID:', tenantId);
    } else {
      console.warn('[apiProxy] No tenant ID header found. Available headers:', Object.keys(req.headers).filter(h => h.toLowerCase().includes('tenant')));
    }
    
    // Forward Authorization header if present (check both cases - Firebase Functions normalizes to lowercase)
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader) {
      const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      headers['Authorization'] = authValue as string;
      console.log('[apiProxy] Forwarding Authorization header (length:', authValue.length, 'starts with:', authValue.substring(0, 20) + '...)');
    } else {
      console.error('[apiProxy] ❌ No Authorization header found! Available headers:', Object.keys(req.headers));
      console.error('[apiProxy] All header keys:', JSON.stringify(Object.keys(req.headers || {})));
    }
    
    const options: RequestInit = {
      method: req.method,
      headers
    };
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Firebase Functions v2 onRequest with cors: true automatically parses JSON bodies
      // req.body is already a parsed object, so we need to stringify it for the backend
      if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
        // Empty body
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          options.body = '{}';
        }
      } else if (typeof req.body === 'string') {
        // If body is already a string, use it directly (rare case)
        options.body = req.body;
        console.log('[apiProxy] Body is already string, length:', req.body.length);
      } else {
        // Body is an object - stringify it
        options.body = JSON.stringify(req.body);
        console.log('[apiProxy] Body stringified, length:', options.body.length, 'first 100 chars:', options.body.substring(0, 100));
      }
    }
    
    const response = await fetch(url, options);
    
    // Log response status for debugging
    console.log('[apiProxy] Backend response:', {
      status: response.status,
      statusText: response.statusText,
      url: url,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // Check content type to determine how to handle response
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      
      // Log error responses with full details
      if (!response.ok) {
        console.error('[apiProxy] Backend returned error:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          errorData: data
        });
      }
      
      res.set('Access-Control-Allow-Origin', origin).status(response.status).json(data);
    } else if (contentType.includes('text/') || url.includes('deployment-script')) {
      // Handle text responses (like shell scripts)
      const text = await response.text();
      
      // Log error responses
      if (!response.ok) {
        console.error('[apiProxy] Backend returned text error:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          text: text.substring(0, 500) // First 500 chars
        });
      }
      
      res.set('Access-Control-Allow-Origin', origin).status(response.status).set('Content-Type', contentType || 'text/plain').send(text);
    } else {
      // Fallback: try JSON, then text
      try {
        const data = await response.json();
        
        if (!response.ok) {
          console.error('[apiProxy] Backend returned error (fallback JSON):', {
            status: response.status,
            statusText: response.statusText,
            url: url,
            errorData: data
          });
        }
        
        res.set('Access-Control-Allow-Origin', origin).status(response.status).json(data);
      } catch {
        const text = await response.text();
        
        if (!response.ok) {
          console.error('[apiProxy] Backend returned error (fallback text):', {
            status: response.status,
            statusText: response.statusText,
            url: url,
            text: text.substring(0, 500)
          });
        }
        
        res.set('Access-Control-Allow-Origin', origin).status(response.status).send(text);
      }
    }
  } catch (error: any) {
    console.error('[apiProxy] Proxy fetch error:', {
      message: error.message,
      stack: error.stack,
      url: url,
      errorType: error.constructor?.name,
      code: (error as any).code,
      errno: (error as any).errno
    });
    
    // Check if it's a connection error
    const isConnectionError = 
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('ENOTFOUND') ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT';
    
    res.set('Access-Control-Allow-Origin', origin).status(500).json({ 
      error: isConnectionError ? 'Backend service unavailable' : 'Proxy error',
      message: error.message,
      details: error.toString(),
      url: url,
      errorType: error.constructor?.name
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
  // CRITICAL: Log immediately to verify function is being invoked
  console.log('[isoProxy] Function invoked!', {
    method: req.method,
    url: req.url,
    path: (req as any).path,
    originalUrl: (req as any).originalUrl,
    baseUrl: (req as any).baseUrl,
    headers: {
      host: req.headers.host,
      'content-type': req.headers['content-type'],
      'x-tenant-id': req.headers['x-tenant-id']
    }
  });
  
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
  
  // Port 3002 (ISO API) - The /api/deploy/generate-epc-iso route exists here
  // Two services may run on 3002: epc-api (PM2, min-epc-server.js) or gce-backend.service (systemd, gce-backend/server.js)
  // Both have the /api/deploy route. Route to port 3002 where ISO generation service runs.
  const backendUrl = `http://${process.env.BACKEND_HOST_IP || '136.112.111.167'}:3002`;  // ISO Generation API port
  
  // Extract path from request - SIMPLIFIED APPROACH
  // Firebase Functions 2nd gen with Hosting rewrites:
  // - Hosting rewrite: req.url = /api/deploy/generate-epc-iso (full path preserved)
  // - Direct call: req.url = /isoProxy/api/deploy/generate-epc-iso
  
  // Try multiple sources, prefer req.url (most reliable for Functions 2nd gen)
  let path = (req.url || (req as any).originalUrl || (req as any).path || '').split('?')[0];
  
  // Remove /isoProxy prefix if present (direct Cloud Function calls)
  if (path.startsWith('/isoProxy')) {
    path = path.substring('/isoProxy'.length);
  }
  
  // Ensure path starts with /
  if (!path || path === '/') {
    // Default to /api/deploy if no path (shouldn't happen but handle gracefully)
    path = '/api/deploy';
    console.warn('[isoProxy] No path in request, using default:', path);
  } else if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  // CRITICAL: For Firebase Hosting rewrites, the path should already be /api/deploy/...
  // For direct calls, it might be /isoProxy/api/deploy/... which we've already stripped
  // If somehow we get just /generate-epc-iso, we need to add the prefix
  if (!path.startsWith('/api/deploy') && !path.startsWith('/api/epc')) {
    if (path.startsWith('/generate-epc-iso')) {
      // Missing /api/deploy prefix
      path = '/api/deploy' + path;
      console.log('[isoProxy] Restored /api/deploy prefix, new path:', path);
    } else {
      // Unknown path, assume it needs /api/deploy
      path = '/api/deploy' + path;
      console.log('[isoProxy] Added /api/deploy prefix for unknown path, new path:', path);
    }
  }
  
  // Final validation log
  console.log('[isoProxy] Extracted path:', {
    originalReqUrl: req.url,
    finalPath: path,
    willCallBackend: `${backendUrl}${path}`
  });
  
  const url = `${backendUrl}${path}`;
  
  // Debug logging - log ALL request details to understand path extraction
  console.log('[isoProxy] Request details:', {
    method: req.method,
    reqUrl: req.url,
    reqPath: (req as any).path,
    originalUrl: (req as any).originalUrl,
    extractedPath: path,
    finalBackendUrl: url
  });
  
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    // Forward x-tenant-id if present
    if (req.headers['x-tenant-id']) {
      headers['x-tenant-id'] = req.headers['x-tenant-id'] as string;
    }
    
    // Forward Authorization header if present (check both cases - Firebase Functions normalizes to lowercase)
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader) {
      headers['Authorization'] = authHeader as string;
      console.log('[apiProxy] Forwarding Authorization header');
    } else {
      console.warn('[apiProxy] No Authorization header found. Available headers:', Object.keys(req.headers).filter(h => h.toLowerCase().includes('auth')));
    }
    
    const options: RequestInit = {
      method: req.method,
      headers
    };
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(url, options);
    
    // Log response details for debugging
    console.log('[isoProxy] Backend response:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      url: url
    });
    
    // Check content type to determine how to handle response
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      // Fallback for other content types
      const text = await response.text();
      
      // If we got an error response, try to parse it as JSON first
      if (!response.ok) {
        try {
          const errorData = JSON.parse(text);
          res.status(response.status).json(errorData);
        } catch {
          // If not JSON, send as text
          res.status(response.status).set('Content-Type', contentType || 'text/plain').send(text);
        }
      } else {
        res.status(response.status).set('Content-Type', contentType || 'text/plain').send(text);
      }
    }
  } catch (error: any) {
    console.error('[isoProxy] Error details:', {
      message: error.message,
      stack: error.stack,
      url: url,
      path: path
    });
    
    // Provide more detailed error information
    let errorMessage = error.message || 'Unknown error';
    if (error.code === 'ECONNREFUSED') {
      errorMessage = `Backend server not reachable at ${url}. Please verify the backend is running on port 3002.`;
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = `Backend server timeout at ${url}. The request took too long.`;
    }
    
    res.status(500).json({ 
      error: 'ISO proxy error', 
      message: errorMessage,
      details: error.toString(),
      url: url,
      path: path
    });
  }
});
