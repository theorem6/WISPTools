/**
 * REST API for HSS and User Management
 * 
 * Firebase Functions implementation that integrates with existing platform
 * Can also be deployed as standalone Express.js server
 */

import { onRequest } from 'firebase-functions/v2/https';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import UserManagementService from '../services/user-management';
import epcManagementRouter from './epc-management';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Mount EPC Management routes
app.use('/epc', epcManagementRouter);

// Initialize services
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const ENCRYPTION_KEY = process.env.HSS_ENCRYPTION_KEY || '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF';
const GENIEACS_API_URL = process.env.GENIEACS_API_URL || 'http://localhost:7557';

let userManagementService: UserManagementService;

// Initialize service
(async () => {
  try {
    userManagementService = new UserManagementService(
      MONGODB_URI,
      ENCRYPTION_KEY,
      GENIEACS_API_URL
    );
    console.log('✅ HSS User Management Service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize HSS service:', error);
  }
})();

// Middleware: Authentication (integrate with Firebase Auth)
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Verify Firebase Auth token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract user info from token
    // const token = authHeader.substring(7);
    // const decodedToken = await admin.auth().verifyIdToken(token);
    // req.user = decodedToken;
    
    // For now, pass through (TODO: implement proper auth)
    (req as any).user = { uid: 'test-user', email: 'admin@test.com' };
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Middleware: Tenant validation
const validateTenant = (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.headers['x-tenant-id'] || req.body.tenantId || req.query.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  (req as any).tenantId = tenantId;
  next();
};

// ============================================================================
// SUBSCRIBER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /subscribers
 * Create new subscriber
 */
app.post('/subscribers', authenticateUser, validateTenant, async (req: Request, res: Response) => {
  try {
    const { imsi, ki, opc, msisdn, profile, metadata } = req.body;
    const tenantId = (req as any).tenantId;
    const performedBy = (req as any).user.email;

    const result = await userManagementService.createSubscriber({
      tenantId,
      imsi,
      ki,
      opc,
      msisdn,
      profile,
      metadata
    }, performedBy);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error: any) {
    console.error('Error creating subscriber:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscribers/bulk-import
 * Bulk import subscribers
 */
app.post('/subscribers/bulk-import', authenticateUser, validateTenant, async (req: Request, res: Response) => {
  try {
    const { subscribers } = req.body;
    const tenantId = (req as any).tenantId;
    const performedBy = (req as any).user.email;

    if (!Array.isArray(subscribers)) {
      return res.status(400).json({ error: 'subscribers must be an array' });
    }

    const result = await userManagementService.bulkImportSubscribers(
      tenantId,
      subscribers,
      performedBy
    );

    res.json(result);

  } catch (error: any) {
    console.error('Error bulk importing:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscribers
 * List all subscribers with optional filters
 */
app.get('/subscribers', authenticateUser, validateTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { status, cpe_online, imsi, msisdn, serial_number } = req.query;

    const subscribers = await userManagementService.searchSubscribers(tenantId, {
      imsi: imsi as string,
      msisdn: msisdn as string,
      serial_number: serial_number as string,
      status: status as any,
      cpe_online: cpe_online === 'true'
    });

    res.json({
      count: subscribers.length,
      subscribers
    });

  } catch (error: any) {
    console.error('Error listing subscribers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscribers/:imsi
 * Get subscriber details including CPE and network status
 */
app.get('/subscribers/:imsi', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { imsi } = req.params;

    const subscriber = await userManagementService.getSubscriberDetails(imsi);

    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    res.json(subscriber);

  } catch (error: any) {
    console.error('Error getting subscriber:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /subscribers/:imsi
 * Update subscriber profile
 */
app.put('/subscribers/:imsi', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { imsi } = req.params;
    const { msisdn, apn, max_bandwidth_dl, max_bandwidth_ul, notes } = req.body;
    const performedBy = (req as any).user.email;

    const result = await userManagementService.updateSubscriberProfile(
      imsi,
      { msisdn, apn, max_bandwidth_dl, max_bandwidth_ul, notes },
      performedBy
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error: any) {
    console.error('Error updating subscriber:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscribers/:imsi/enable
 * Enable/activate subscriber
 */
app.post('/subscribers/:imsi/enable', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { imsi } = req.params;
    const performedBy = (req as any).user.email;

    const result = await userManagementService.enableSubscriber(imsi, performedBy);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error: any) {
    console.error('Error enabling subscriber:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscribers/:imsi/disable
 * Disable/deactivate subscriber
 */
app.post('/subscribers/:imsi/disable', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { imsi } = req.params;
    const { reason } = req.body;
    const performedBy = (req as any).user.email;

    const result = await userManagementService.disableSubscriber(
      imsi,
      reason || 'Manual disable',
      performedBy
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error: any) {
    console.error('Error disabling subscriber:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscribers/:imsi/suspend
 * Suspend subscriber temporarily
 */
app.post('/subscribers/:imsi/suspend', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { imsi } = req.params;
    const { reason } = req.body;
    const performedBy = (req as any).user.email;

    const result = await userManagementService.suspendSubscriber(
      imsi,
      reason || 'Manual suspension',
      performedBy
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error: any) {
    console.error('Error suspending subscriber:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /subscribers/:imsi
 * Delete subscriber permanently
 */
app.delete('/subscribers/:imsi', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { imsi } = req.params;
    const performedBy = (req as any).user.email;

    const result = await userManagementService.deleteSubscriber(imsi, performedBy);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error: any) {
    console.error('Error deleting subscriber:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscribers/:imsi/audit-log
 * Get audit log for subscriber
 */
app.get('/subscribers/:imsi/audit-log', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { imsi } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const auditLog = await userManagementService.getAuditLog(imsi, limit);

    res.json({
      imsi,
      count: auditLog.length,
      log: auditLog
    });

  } catch (error: any) {
    console.error('Error getting audit log:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscribers/:imsi/validate-attach
 * Validate if subscriber can attach to network
 */
app.post('/subscribers/:imsi/validate-attach', async (req: Request, res: Response) => {
  try {
    const { imsi } = req.params;

    const validation = await userManagementService.validateAttach(imsi);

    res.json(validation);

  } catch (error: any) {
    console.error('Error validating attach:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ACS INTEGRATION ENDPOINTS
// ============================================================================

/**
 * POST /acs/sync
 * Sync CPE devices from GenieACS
 */
app.post('/acs/sync', authenticateUser, validateTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const result = await userManagementService.syncACSDevices(tenantId);

    res.json({
      message: 'Sync completed',
      ...result
    });

  } catch (error: any) {
    console.error('Error syncing ACS devices:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /acs/webhook
 * Webhook endpoint for GenieACS events
 */
app.post('/acs/webhook', async (req: Request, res: Response) => {
  try {
    const { type, deviceId, timestamp } = req.body;

    // TODO: Trigger sync for specific device
    console.log(`ACS Webhook: ${type} for device ${deviceId}`);

    res.json({ message: 'Webhook received' });

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DASHBOARD & STATISTICS
// ============================================================================

/**
 * GET /dashboard/stats
 * Get dashboard statistics
 */
app.get('/dashboard/stats', authenticateUser, validateTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const stats = await userManagementService.getDashboardStats(tenantId);

    res.json(stats);

  } catch (error: any) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /export/subscribers
 * Export subscribers to CSV or JSON
 */
app.get('/export/subscribers', authenticateUser, validateTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const format = (req.query.format as 'csv' | 'json') || 'csv';

    const data = await userManagementService.exportSubscribers(tenantId, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="subscribers_${Date.now()}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="subscribers_${Date.now()}.json"`);
    }

    res.send(data);

  } catch (error: any) {
    console.error('Error exporting subscribers:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'HSS User Management API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Export as Firebase Function
export const hssApi = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 60
}, app);

// Export Express app for standalone deployment
export default app;

