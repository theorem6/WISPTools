/**
 * Internal API - called only by trusted callers (e.g. Cloud Functions) with INTERNAL_API_KEY.
 * No Firebase token verification; used when the caller has already verified the user.
 */

const express = require('express');
const tenantService = require('../services/tenant-service');

const router = express.Router();

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-key'] || req.headers['X-Internal-Key'];
  if (!INTERNAL_API_KEY || key !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing internal key' });
  }
  next();
}

router.use(requireInternalKey);

/**
 * GET /api/internal/user-tenants/:userId
 * Returns tenants for the given userId. Caller (Cloud Function) must have verified the user token.
 */
router.get('/user-tenants/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'Bad Request', message: 'userId is required' });
    }
    const tenants = await tenantService.getUserTenants(userId);
    res.json(tenants);
  } catch (error) {
    console.error('[internal] getUserTenants error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'Failed to get user tenants'
      });
    }
  }
});

module.exports = router;
