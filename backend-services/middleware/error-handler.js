/**
 * Error Handler Middleware
 * Handles JSON parsing errors and other request errors
 */

function errorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[Body Parser Error]', err.message);
    console.error('[Body Parser Error] Request:', req.method, req.path);
    console.error('[Body Parser Error] Body preview:', req.body ? JSON.stringify(req.body).substring(0, 200) : 'No body');
    
    // For EPC check-in, return a more helpful error
    if (req.path && req.path.includes('/epc/checkin')) {
      return res.status(400).json({ 
        error: 'Invalid JSON in request body', 
        message: 'The check-in payload contains invalid JSON. Please check for control characters or malformed data.',
        details: err.message,
        suggestion: 'Try sanitizing log data and removing control characters before sending.'
      });
    }
    
    return res.status(400).json({ error: 'Invalid JSON in request body', details: err.message });
  }
  next(err);
}

module.exports = errorHandler;

