// Distributed EPC Management API - Modular Entry Point
// Handles EPC registration, metrics collection, and monitoring

const express = require('express');

// Import route modules
const registrationRoutes = require('./routes/registration');
const autoRegisterRoutes = require('./routes/auto-register');
const managementRoutes = require('./routes/management');
const metricsRoutes = require('./routes/metrics');
const monitoringRoutes = require('./routes/monitoring');

const router = express.Router();

/**
 * Mount all EPC-related routes
 * 
 * Routes:
 * - /epc/register - Register new EPC sites (manual)
 * - /epc/auto-register - Auto-register from boot disc (minimal Ubuntu)
 * - /epc/auto-registered - List auto-registered EPCs
 * - /epc/list - List all EPCs for a tenant
 * - /epc/:epc_id - Get/Update/Delete specific EPC
 * - /epc/:epc_id/deployment-script - Download deployment script
 * - /metrics/heartbeat - Simple status updates
 * - /metrics/submit - Comprehensive metrics
 * - /metrics/attach - Attach events
 * - /metrics/detach - Detach events
 * - /dashboard - Dashboard data
 * - /metrics/history - Historical metrics
 * - /subscribers/roster - Active subscribers
 * - /events/attach-detach - Attach/detach events
 */

// Mount route modules
router.use('/epc', registrationRoutes);
router.use('/epc', autoRegisterRoutes);
router.use('/epc', managementRoutes);
router.use('/metrics', metricsRoutes);
router.use('/', monitoringRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'distributed-epc-api',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

