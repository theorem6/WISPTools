/**
 * Agent Management Routes
 * Handles agent manifest and version information
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/agent/manifest
 * Returns the current agent manifest (public - no auth required)
 */
router.get('/manifest', async (req, res) => {
  try {
    const agentVersionManager = require('../utils/agent-version-manager');
    const manifest = await agentVersionManager.getCurrentManifest();

    if (!manifest) {
      return res.status(500).json({ error: 'Manifest not available' });
    }

    res.json(manifest);
  } catch (error) {
    console.error('[Agent Manifest] Error:', error);
    res.status(500).json({ error: 'Failed to load manifest', message: error.message });
  }
});

module.exports = router;

