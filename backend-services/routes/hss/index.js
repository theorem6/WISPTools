/**
 * HSS Management Routes - Main Router
 * Combines all HSS route modules
 */

const express = require('express');
const router = express.Router();

// Import route modules
const statsRoutes = require('./hss-stats');
const subscribersRoutes = require('./hss-subscribers');
const groupsRoutes = require('./hss-groups');
const bandwidthPlansRoutes = require('./hss-bandwidth-plans');
const epcRoutes = require('./hss-epc');
const epcsLegacyRoutes = require('./hss-epcs-legacy');
const mmeRoutes = require('./hss-mme');
const bulkRoutes = require('./hss-bulk');

// Mount route modules
router.use('/', statsRoutes);
router.use('/', subscribersRoutes);
router.use('/', groupsRoutes);
router.use('/', bandwidthPlansRoutes);
router.use('/', epcRoutes);
router.use('/', epcsLegacyRoutes);
router.use('/', mmeRoutes);
router.use('/', bulkRoutes);

module.exports = router;
