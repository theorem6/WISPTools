/**
 * Deployment Script Routes
 * Handles bootstrap and deployment script generation
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC } = require('../../models/distributed-epc-schema');
const { generateBootstrapScript } = require('../../utils/bootstrap-helpers');
const { generateFullDeploymentScript } = require('../../utils/deployment-helpers');
const appConfig = require('../../config/app');
const epcRoute = require('../epc');

const GCE_PUBLIC_IP = appConfig.externalServices.hss.ipAddress;
const HSS_PORT = appConfig.externalServices.hss.port;

/**
 * Get EPC Deployment Script
 * GET /api/deploy/:epc_id/deploy?checkin_token=xxx
 * Called by wisptools-epc-installer after check-in
 */
router.get('/:epc_id/deploy', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { checkin_token } = req.query;
    
    if (!checkin_token) {
      return res.status(401).json({ error: 'checkin_token required' });
    }
    
    // Verify EPC and token
    const epc = await RemoteEPC.findOne({
      epc_id,
      checkin_token,
      enabled: true
    }).lean();
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found or invalid token' });
    }
    
    // Generate deployment script using existing helper
    const deploymentScript = generateFullDeploymentScript(epc);
    
    res.setHeader('Content-Type', 'text/x-shellscript');
    res.setHeader('Content-Disposition', `attachment; filename="deploy-${epc.site_name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.sh"`);
    res.send(deploymentScript);
    
  } catch (error) {
    console.error('[Deploy] Error:', error);
    res.status(500).json({ error: 'Failed to generate deployment script' });
  }
});

/**
 * Download EPC deployment script
 * This is called by the ISO during first boot
 * 
 * GET /api/deploy/:epc_id/bootstrap
 */
router.get('/:epc_id/bootstrap', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { auth_code } = req.query;
    
    console.log(`[Bootstrap] Request for EPC: ${epc_id}`);
    
    // Verify auth_code (in production, check database)
    if (!auth_code) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Generate bootstrap script that downloads full deployment
    const bootstrapScript = generateBootstrapScript(epc_id, GCE_PUBLIC_IP, HSS_PORT);
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="bootstrap-${epc_id}.sh"`);
    res.send(bootstrapScript);
    
  } catch (error) {
    console.error('[Bootstrap] Error:', error);
    res.status(500).json({ error: 'Failed to generate bootstrap script' });
  }
});

/**
 * Download full deployment script
 * Called by bootstrap script after authentication
 * 
 * GET /api/deploy/:epc_id/full-deployment
 */
router.get('/:epc_id/full-deployment', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { auth_code } = req.query;
    
    console.log(`[Full Deployment] Request for EPC: ${epc_id}`);
    
    // Verify auth_code (in production, check database)
    if (!auth_code) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Fetch EPC config from database
    const epc = await RemoteEPC.findOne({
      epc_id: epc_id,
      auth_code: auth_code,
      enabled: true
    }).lean();
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found or authentication failed' });
    }
    
    // Generate full deployment script using the script generator from epc.js
    const deploymentScript = epcRoute.generateDeploymentScript(epc);
    
    // Set headers with Ubuntu 22.04 requirement note
    res.setHeader('Content-Type', 'text/x-shellscript');
    res.setHeader('Content-Disposition', `attachment; filename="deploy-${epc.site_name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.sh"`);
    res.setHeader('X-Requirement-Note', 'This script requires Ubuntu 22.04 LTS Server');
    
    res.send(deploymentScript);
    
  } catch (error) {
    console.error('[Full Deployment] Error:', error);
    res.status(500).json({ error: 'Failed to generate deployment script' });
  }
});

module.exports = router;

