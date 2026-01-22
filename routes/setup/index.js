/**
 * Setup Admin Endpoint
 * Simple endpoint to create user-tenant owner records
 * Call this once to grant yourself access
 */

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { UserTenant } = require('../users/user-schema');

/**
 * POST /setup-admin
 * Creates owner records for the authenticated user in all tenants
 */
router.post('/', async (req, res) => {
  try {
    // Verify auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.substring(7);
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    console.log(`Setting up admin for: ${userEmail} (${userId})`);

    // For now, hardcode your tenant IDs or get from query param
    const tenantIds = req.body.tenantIds || [];
    
    if (tenantIds.length === 0) {
      return res.status(400).json({ 
        error: 'No tenants specified',
        message: 'Provide tenantIds in request body: {"tenantIds": ["tenant-id-1", "tenant-id-2"]}'
      });
    }

    const results = [];

    for (const tenantId of tenantIds) {
      // Check if already exists
      const existing = await UserTenant.findOne({ userId, tenantId });

      if (existing) {
        results.push({
          tenantId,
          status: 'already_exists',
          role: existing.role
        });
        continue;
      }

      // Create owner record
      const userTenant = new UserTenant({
        userId,
        tenantId,
        role: 'owner',
        status: 'active',
        invitedBy: userId,
        invitedAt: new Date(),
        acceptedAt: new Date(),
        addedAt: new Date()
      });

      await userTenant.save();

      results.push({
        tenantId,
        status: 'created',
        role: 'owner'
      });

      console.log(`✅ Created owner record for tenant: ${tenantId}`);
    }

    res.json({
      success: true,
      message: `Set up ${userEmail} as owner of ${results.length} tenant(s)`,
      user: { email: userEmail, userId },
      tenants: results
    });

  } catch (error) {
    console.error('Setup admin error:', error);
    res.status(500).json({ error: 'Internal error', message: error.message });
  }
});

module.exports = router;

