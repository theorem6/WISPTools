/**
 * Plans Routes Index
 * Main entry point that combines all plan route modules
 * 
 * This modular structure allows each feature area to be:
 * - Developed independently
 * - Tested in isolation
 * - Refactored without affecting others
 */

const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../users/role-auth-middleware');
const { requireTenant } = require('./plans-middleware');

// Apply middleware to all plan routes
router.use(verifyAuth);
router.use(requireTenant);

// Import and mount all plan route modules (deployment-photos before mobile so GET /deployment-photos/... matches first)
router.use(require('./plans-core'));          // Core CRUD operations
router.use(require('./plans-marketing'));     // Marketing discovery routes
router.use(require('./plans-approval'));      // Approval/authorization routes
router.use(require('./plans-features'));      // Plan layer features routes
router.use(require('./plans-deployment-photos')); // Deployment photo upload/serve (GridFS or Firebase)
router.use(require('./plans-mobile'));        // Mobile API routes
router.use(require('./plans-hardware'));      // Hardware requirements routes

module.exports = router;

