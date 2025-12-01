/**
 * Error Handler Middleware
 * Handles JSON parsing errors and other request errors
 */

function errorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[Body Parser Error]', err.message);
    console.error('[Body Parser Error] Request:', req.method, req.path);
    return res.status(400).json({ error: 'Invalid JSON in request body', details: err.message });
  }
  next(err);
}

module.exports = errorHandler;

