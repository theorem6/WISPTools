/**
 * Plans Routes
 * 
 * This file now serves as a simple entry point that exports the modular router
 * from routes/plans/index.js. All route logic has been refactored into separate
 * feature modules for better organization and maintainability.
 * 
 * Modular structure:
 * - routes/plans/index.js: Main router that combines all modules
 * - routes/plans/plans-core.js: Core CRUD operations
 * - routes/plans/plans-marketing.js: Marketing discovery routes
 * - routes/plans/plans-approval.js: Approval/authorization routes
 * - routes/plans/plans-features.js: Plan layer features routes
 * - routes/plans/plans-mobile.js: Mobile API routes
 * - routes/plans/plans-hardware.js: Hardware requirements routes
 * - routes/plans/plans-helpers.js: Shared helper functions
 * - routes/plans/plans-middleware.js: Shared middleware
 */

module.exports = require('./plans/index');
