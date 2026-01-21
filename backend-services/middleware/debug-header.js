/**
 * Debug Header Middleware
 * Adds debug flag to request object for use in routes
 */
module.exports = (req, res, next) => {
  req.isDebugMode = req.headers['x-debug-mode'] === 'true' || 
                    req.headers['x-debug-mode'] === '1' ||
                    process.env.DEBUG_MODE === 'true';
  next();
};
