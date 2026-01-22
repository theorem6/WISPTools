/**
 * Request Logger Middleware
 * Logs all incoming requests for debugging and monitoring
 */

function requestLogger(req, res, next) {
  console.log('[REQUEST]', {
    method: req.method,
    path: req.path,
    url: req.url,
    ip: req.ip,
    headers: Object.keys(req.headers),
    hasAuth: !!(req.headers.authorization || req.headers.Authorization),
    authLength: (req.headers.authorization || req.headers.Authorization || '').length,
    timestamp: new Date().toISOString()
  });
  next();
}

module.exports = requestLogger;

