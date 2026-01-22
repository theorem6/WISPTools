/**
 * SNMP Management API Routes
 * 
 * This file now serves as a simple entry point that exports the modular router
 * from routes/snmp-routes/index.js. All route logic has been refactored into separate
 * feature modules for better organization and maintainability.
 * 
 * Modular structure:
 * - routes/snmp-routes/index.js: Main router that combines all modules
 * - routes/snmp-routes/snmp-devices.js: Device listing and details
 * - routes/snmp-routes/snmp-metrics.js: Metrics retrieval and polling
 * - routes/snmp-routes/snmp-status.js: Status and configuration
 * - routes/snmp-routes/snmp-discovery.js: Discovery endpoints
 * - routes/snmp-routes/snmp-management.js: Device pairing and hardware creation
 * - routes/snmp-routes/snmp-helpers.js: Shared helper functions
 */

module.exports = require('./snmp-routes/index');
