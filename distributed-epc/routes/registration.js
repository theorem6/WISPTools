// EPC Registration Routes
const express = require('express');
const { RemoteEPC } = require('../models');
const { requireTenant } = require('../middleware/auth');
const { generateDeploymentScript } = require('../utils/script-generator');
const { 
  generateEpcId, 
  generateAuthCode, 
  generateApiKey, 
  generateSecretKey 
} = require('../utils/crypto-utils');

const router = express.Router();

/**
 * Register a new EPC site
 * POST /epc/register
 */
router.post('/register', requireTenant, async (req, res) => {
  try {
    const {
      site_name,
      location,
      network_config,
      contact,
      metrics_config
    } = req.body;
    
    // Generate unique identifiers
    const epc_id = generateEpcId();
    const auth_code = generateAuthCode();
    const api_key = generateApiKey();
    const secret_key = generateSecretKey();
    
    const epc = new RemoteEPC({
      epc_id,
      site_name,
      tenant_id: req.tenantId,
      auth_code,
      api_key,
      secret_key,
      location,
      network_config,
      contact,
      metrics_config: metrics_config || {},
      status: 'registered' // Starts as 'registered', becomes 'online' on first heartbeat
    });
    
    await epc.save();
    
    res.json({
      success: true,
      epc_id,
      auth_code,
      api_key,
      secret_key,
      deployment_script_url: `/api/epc/${epc_id}/deployment-script`,
      message: 'EPC registered successfully. Download the deployment script and run it on your Ubuntu server.'
    });
  } catch (error) {
    console.error('[EPC Registration] Error:', error);
    res.status(500).json({ error: 'Failed to register EPC' });
  }
});

/**
 * Get deployment script for an EPC
 * GET /epc/:epc_id/deployment-script
 */
router.get('/:epc_id/deployment-script', requireTenant, async (req, res) => {
  try {
    const { epc_id } = req.params;
    
    const epc = await RemoteEPC.findOne({ epc_id, tenant_id: req.tenantId });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    console.log('[Deployment Script] Generating for:', epc_id);
    
    const script = generateDeploymentScript(epc);
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="deploy-${epc.site_name.replace(/[^a-zA-Z0-9]/g, '-')}.sh"`);
    res.send(script);
  } catch (error) {
    console.error('[Deployment Script] Error:', error);
    res.status(500).json({ error: 'Failed to generate deployment script' });
  }
});

module.exports = router;

