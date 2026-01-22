/**
 * SNMP Routes - Main Router
 * Combines all SNMP route modules
 */

const express = require('express');
const router = express.Router();

// Import route modules
const devicesRoutes = require('./snmp-devices');
const metricsRoutes = require('./snmp-metrics');
const statusRoutes = require('./snmp-status');
const discoveryRoutes = require('./snmp-discovery');
const managementRoutes = require('./snmp-management');

// Mount route modules
router.use('/', devicesRoutes);
router.use('/', metricsRoutes);
router.use('/', statusRoutes);
router.use('/', discoveryRoutes);
router.use('/', managementRoutes);

module.exports = router;
