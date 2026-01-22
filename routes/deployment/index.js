/**
 * Deployment Routes - Main Router
 * Combines all deployment route modules
 */

const express = require('express');
const router = express.Router();

// Import route modules
const epcManagementRoutes = require('./epc-management');
const scriptsRoutes = require('./scripts');
const isoGenerationRoutes = require('./iso-generation');

// Mount route modules
router.use('/', epcManagementRoutes);
router.use('/', scriptsRoutes);
router.use('/', isoGenerationRoutes);

module.exports = router;

