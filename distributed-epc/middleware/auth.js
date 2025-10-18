// EPC Authentication Middleware
const crypto = require('crypto');
const { RemoteEPC } = require('../models');

// Middleware to verify EPC authentication
function authenticateEPC(req, res, next) {
  const authCode = req.headers['x-epc-auth-code'];
  const apiKey = req.headers['x-epc-api-key'];
  const signature = req.headers['x-epc-signature'];
  
  if (!authCode || !apiKey) {
    return res.status(401).json({ error: 'Missing authentication headers' });
  }
  
  RemoteEPC.findOne({ auth_code: authCode, api_key: apiKey, enabled: true })
    .then(epc => {
      if (!epc) {
        return res.status(401).json({ error: 'Invalid authentication' });
      }
      
      // Verify signature if provided
      if (signature) {
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
          .createHmac('sha256', epc.secret_key)
          .update(payload)
          .digest('hex');
        
        if (signature !== expectedSignature) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }
      
      req.epc = epc;
      next();
    })
    .catch(err => {
      console.error('[EPC Auth] Error:', err);
      res.status(500).json({ error: 'Authentication error' });
    });
}

// Middleware for tenant-based access
function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant ID' });
  }
  
  req.tenantId = tenantId;
  next();
}

module.exports = {
  authenticateEPC,
  requireTenant
};

