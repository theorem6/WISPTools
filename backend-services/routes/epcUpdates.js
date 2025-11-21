/**
 * EPC Update Management API
 * Handles remote updates for deployed EPCs via APT repository system
 */

const express = require('express');
const aptRepository = require('../services/aptRepository');
const snmpCollector = require('../services/snmpCollector');

const router = express.Router();

/**
 * Get APT repository configuration for tenant
 * GET /api/epc-updates/repository-config
 */
router.get('/repository-config', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const config = await aptRepository.getRepositoryConfig(tenantId);
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    
    const response = {
      repositoryUrl: `${serverUrl}/apt-repos/${tenantId}`,
      sourcesListEntry: aptRepository.generateSourcesListEntry(tenantId, serverUrl),
      gpgKeyUrl: `${serverUrl}/api/epc-updates/gpg-key`,
      packages: await aptRepository.listPackages(tenantId)
    };

    res.json(response);
  } catch (error) {
    console.error('[EPC Updates] Failed to get repository config:', error);
    res.status(500).json({ error: 'Failed to get repository configuration' });
  }
});

/**
 * Get GPG public key for tenant repository
 * GET /api/epc-updates/gpg-key
 */
router.get('/gpg-key', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const publicKey = await aptRepository.getPublicKey(tenantId);
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(publicKey);
  } catch (error) {
    console.error('[EPC Updates] Failed to get GPG key:', error);
    res.status(500).json({ error: 'Failed to get GPG key' });
  }
});

/**
 * Upload package to repository
 * POST /api/epc-updates/upload-package
 */
router.post('/upload-package', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    // Handle file upload (using multer middleware)
    if (!req.file) {
      return res.status(400).json({ error: 'Package file required' });
    }

    const { name, version, description } = req.body;
    const packageInfo = { name, version, description };

    const result = await aptRepository.addPackage(tenantId, req.file.path, packageInfo);
    
    res.json({
      success: true,
      message: 'Package uploaded successfully',
      packagePath: result.packagePath
    });
  } catch (error) {
    console.error('[EPC Updates] Failed to upload package:', error);
    res.status(500).json({ error: 'Failed to upload package' });
  }
});

/**
 * List packages in repository
 * GET /api/epc-updates/packages
 */
router.get('/packages', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const packages = await aptRepository.listPackages(tenantId);
    res.json({ packages });
  } catch (error) {
    console.error('[EPC Updates] Failed to list packages:', error);
    res.status(500).json({ error: 'Failed to list packages' });
  }
});

/**
 * Remove package from repository
 * DELETE /api/epc-updates/packages/:packageName
 */
router.delete('/packages/:packageName', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { packageName } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    await aptRepository.removePackage(tenantId, packageName);
    
    res.json({
      success: true,
      message: 'Package removed successfully'
    });
  } catch (error) {
    console.error('[EPC Updates] Failed to remove package:', error);
    res.status(500).json({ error: 'Failed to remove package' });
  }
});

/**
 * Trigger update on specific EPC
 * POST /api/epc-updates/trigger-update
 */
router.post('/trigger-update', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { epcId, packages, updateType = 'upgrade' } = req.body;
    
    if (!tenantId || !epcId) {
      return res.status(400).json({ error: 'Tenant ID and EPC ID required' });
    }

    // Get EPC device info from SNMP collector
    const device = snmpCollector.getDeviceStatus(epcId);
    if (!device) {
      return res.status(404).json({ error: 'EPC device not found' });
    }

    // Send update command via SNMP (custom OID for update trigger)
    const updateCommand = {
      type: updateType,
      packages: packages || [],
      timestamp: new Date().toISOString()
    };

    // In a real implementation, this would use a custom SNMP OID
    // to trigger the update process on the EPC
    console.log(`[EPC Updates] Triggering ${updateType} on EPC ${epcId}:`, updateCommand);

    res.json({
      success: true,
      message: 'Update triggered successfully',
      epcId,
      updateCommand
    });
  } catch (error) {
    console.error('[EPC Updates] Failed to trigger update:', error);
    res.status(500).json({ error: 'Failed to trigger update' });
  }
});

/**
 * Get update status for EPC
 * GET /api/epc-updates/status/:epcId
 */
router.get('/status/:epcId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { epcId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    // Get device status from SNMP collector
    const device = snmpCollector.getDeviceStatus(epcId);
    if (!device) {
      return res.status(404).json({ error: 'EPC device not found' });
    }

    // In a real implementation, this would query custom OIDs
    // to get update status, installed packages, etc.
    const updateStatus = {
      epcId,
      lastUpdate: device.lastPoll,
      status: device.status,
      installedPackages: [], // Would be populated from SNMP data
      availableUpdates: [], // Would be populated by comparing with repository
      updateInProgress: false
    };

    res.json(updateStatus);
  } catch (error) {
    console.error('[EPC Updates] Failed to get update status:', error);
    res.status(500).json({ error: 'Failed to get update status' });
  }
});

/**
 * Initialize APT repository for tenant
 * POST /api/epc-updates/initialize-repository
 */
router.post('/initialize-repository', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { tenantName } = req.body;
    
    if (!tenantId || !tenantName) {
      return res.status(400).json({ error: 'Tenant ID and name required' });
    }

    const repoConfig = await aptRepository.createTenantRepository(tenantId, tenantName);
    
    res.json({
      success: true,
      message: 'Repository initialized successfully',
      config: repoConfig
    });
  } catch (error) {
    console.error('[EPC Updates] Failed to initialize repository:', error);
    res.status(500).json({ error: 'Failed to initialize repository' });
  }
});

module.exports = router;
