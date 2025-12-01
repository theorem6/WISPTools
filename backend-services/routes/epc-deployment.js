/**
 * EPC Deployment Routes
 * 
 * This file now serves as a simple entry point that exports the modular router
 * from routes/deployment/index.js. All route logic has been refactored into separate
 * feature modules for better organization and maintainability.
 * 
 * Modular structure:
 * - routes/deployment/index.js: Main router that combines all modules
 * - routes/deployment/epc-management.js: EPC registration, updates, linking, deletion
 * - routes/deployment/scripts.js: Bootstrap and deployment script endpoints
 * - routes/deployment/iso-generation.js: ISO generation and download endpoints
 */

module.exports = require('./deployment/index');
