/**
 * Debug Utility for Backend
 * Provides conditional logging based on debug flag from request headers
 * Debug mode should only be enabled when working with WISPTools.io engineers
 */

/**
 * Check if debug mode is enabled from request
 * Checks X-Debug-Mode header (set by frontend when debug is enabled)
 */
function isDebugEnabled(req) {
  return req.headers['x-debug-mode'] === 'true' || 
         req.headers['x-debug-mode'] === '1' ||
         process.env.DEBUG_MODE === 'true';
}

/**
 * Debug logger - only logs if debug mode is enabled
 */
function createDebugLogger(req) {
  const enabled = isDebugEnabled(req);
  
  return {
    log: (...args) => {
      if (enabled) {
        console.log('[DEBUG]', ...args);
      }
    },
    error: (...args) => {
      // Always log errors, but prefix with [DEBUG] if debug mode is on
      if (enabled) {
        console.error('[DEBUG]', ...args);
      } else {
        console.error(...args);
      }
    },
    warn: (...args) => {
      // Always log warnings, but prefix with [DEBUG] if debug mode is on
      if (enabled) {
        console.warn('[DEBUG]', ...args);
      } else {
        console.warn(...args);
      }
    },
    info: (...args) => {
      if (enabled) {
        console.info('[DEBUG]', ...args);
      }
    },
    group: (label) => {
      if (enabled) {
        console.group('[DEBUG]', label);
      }
    },
    groupEnd: () => {
      if (enabled) {
        console.groupEnd();
      }
    },
    table: (data) => {
      if (enabled) {
        console.table(data);
      }
    }
  };
}

module.exports = {
  isDebugEnabled,
  createDebugLogger
};
