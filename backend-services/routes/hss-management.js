/**
 * HSS Management Routes
 * 
 * This file now serves as a simple entry point that exports the modular router
 * from routes/hss/index.js. All route logic has been refactored into separate
 * feature modules for better organization and maintainability.
 * 
 * Modular structure:
 * - routes/hss/index.js: Main router that combines all modules
 * - routes/hss/hss-stats.js: Stats endpoint
 * - routes/hss/hss-subscribers.js: Subscriber CRUD operations
 * - routes/hss/hss-groups.js: Group management
 * - routes/hss/hss-bandwidth-plans.js: Bandwidth plan management
 * - routes/hss/hss-epc.js: Remote EPC device management
 * - routes/hss/hss-epcs-legacy.js: Legacy EPC collection endpoints
 * - routes/hss/hss-mme.js: MME connections
 * - routes/hss/hss-bulk.js: Bulk import operations
 * - routes/hss/hss-middleware.js: Shared middleware
 */

module.exports = require('./hss/index');
