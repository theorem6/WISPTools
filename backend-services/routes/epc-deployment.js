// EPC Deployment - ISO Generation and Download
// Hosted on GCE server (136.112.111.167)
// Generates small bootable ISOs with unique EPC credentials

const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Tenant } = require('../models/tenant');
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { generateCloudInitConfig } = require('../utils/iso-helpers');
const { generateBootstrapScript } = require('../utils/bootstrap-helpers');
const { generateFullDeploymentScript } = require('../utils/deployment-helpers');

const execAsync = promisify(exec);
const router = express.Router();

// Configuration
const ISO_BUILD_DIR = '/opt/epc-iso-builder';
// ISO output directory - must match nginx configuration
// If symlink exists: /var/www/html/downloads/isos -> /tmp/iso-downloads
// Otherwise: use /var/www/html/downloads/isos directly
const ISO_OUTPUT_DIR = '/var/www/html/downloads/isos';
// Minimal boot assets (holding folder). Pre-stage these once on the VM.
// Required files:
//  - /opt/base-images/minimal/vmlinuz
//  - /opt/base-images/minimal/initrd
const MINIMAL_DIR = '/opt/base-images/minimal';
const KERNEL_PATH = `${MINIMAL_DIR}/vmlinuz`;
const INITRD_PATH = `${MINIMAL_DIR}/initrd`;
const appConfig = require('../config/app');

// Hosted on GCE server (136.112.111.167)
// Use centralized configuration
const GCE_PUBLIC_IP = appConfig.externalServices.hss.ipAddress;
const HSS_PORT = appConfig.externalServices.hss.port;

/**
 * Register EPC for deployment (new approach - uses generic ISO)
 * POST /api/deploy/register-epc
 * Creates EPC record and returns generic ISO download URL
 */
router.post('/register-epc', async (req, res) => {
  try {
    const { siteName, location, networkConfig, contact, hssConfig, deploymentType, snmpConfig, aptConfig } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'unknown';
    
    console.log('[EPC Registration] Registering EPC for site:', siteName);
    
    if (!siteName) {
      return res.status(400).json({ error: 'siteName is required' });
    }
    
    // Generate unique EPC ID and credentials
    const epc_id = `epc_${crypto.randomBytes(16).toString('hex')}`;
    const auth_code = crypto.randomBytes(16).toString('hex');
    const api_key = crypto.randomBytes(32).toString('hex');
    const secret_key = crypto.randomBytes(32).toString('hex');
    const checkin_token = crypto.randomBytes(32).toString('hex');
    
    // Device code is optional - will be added later in device configuration
    // const { device_code } = req.body; // Not required in wizard
    
    // Fetch tenant domain
    let tenantDomain = 'wisptools.io';
    if (Tenant) {
      try {
        const tenant = await Tenant.findById(tenant_id);
        if (tenant && tenant.subdomain) {
          tenantDomain = `${tenant.subdomain}.wisptools.io`;
        }
      } catch (tenantError) {
        console.warn('[EPC Registration] Could not fetch tenant domain:', tenantError.message);
      }
    }
    
    // Generate Origin-Host FQDN
    const mmeUniqueId = `mme-${epc_id.substring(4, 12)}`;
    const originHostFQDN = `${mmeUniqueId}.${tenantDomain}`;
    
    // Create EPC record in database (device_code will be added later via device configuration)
    // Don't include device_code in the document if it's null (allows sparse unique index to work)
    const epcData = {
      epc_id,
      site_name: siteName,
      tenant_id,
      auth_code,
      api_key,
      secret_key,
      checkin_token, // Token for hardware check-in
      // device_code omitted - will be added when user enters device code in device configuration
      // hardware_id omitted - will be set when hardware checks in
      location: location || {},
      network_config: networkConfig || {},
      hss_config: hssConfig || {},
      deployment_type: deploymentType || 'both',
      snmp_config: snmpConfig || {},
      apt_config: aptConfig || {},
      status: 'registered',
      origin_host_fqdn: originHostFQDN
    };
    
    const epc = new RemoteEPC(epcData);
    await epc.save();
    
    console.log(`[EPC Registration] EPC registered: ${epc_id}`);
    
    // Return generic ISO download URL (frontend will proxy through /api/deploy/download-iso)
    // This avoids exposing the GCE IP directly to the client
    const genericIsoUrl = `/api/deploy/download-iso?url=${encodeURIComponent(`http://${GCE_PUBLIC_IP}/downloads/isos/wisptools-epc-generic-netinstall.iso`)}`;
    
    res.json({
      success: true,
      epc_id,
      checkin_token,
      iso_download_url: genericIsoUrl,
      message: `EPC configuration created. Download the generic ISO and boot hardware. Enter the device code in the device configuration page to link hardware to this EPC.`
    });
    
  } catch (error) {
    console.error('[EPC Registration] Error:', error);
    res.status(500).json({ 
      error: 'Failed to register EPC', 
      message: error.message 
    });
  }
});

/**
 * Hardware Check-in Endpoint
 * POST /api/epc/checkin
 * Called by wisptools-epc-installer package when hardware boots
 */
router.post('/checkin', async (req, res) => {
  try {
    const { device_code, hardware_id } = req.body;
    
    if (!device_code) {
      return res.status(400).json({ 
        error: 'device_code is required',
        message: 'Device code must be provided. It should be displayed on the device or available at http://<device-ip>/device-status.html'
      });
    }
    
    console.log(`[Check-in] Hardware check-in: device_code=${device_code}, hardware_id=${hardware_id}`);
    
    // Find EPC by device_code (device code must be linked via device configuration page)
    const epc = await RemoteEPC.findOne({ 
      device_code,
      status: { $in: ['registered', 'online'] }
    }).lean();
    
    if (!epc) {
      // Device code not linked yet - return waiting status
      return res.status(202).json({ 
        status: 'waiting',
        message: `Device code ${device_code} is not yet linked to an EPC configuration. Please enter this device code in the device configuration page to link it to an EPC.`,
        device_code,
        help: 'Go to the EPC device configuration page and enter this device code to link the hardware to an EPC configuration.'
      });
    }
    
    // Update EPC with hardware information
    await RemoteEPC.updateOne(
      { epc_id: epc.epc_id },
      { 
        hardware_id: hardware_id || epc.hardware_id,
        status: 'online',
        last_seen: new Date(),
        last_heartbeat: new Date()
      }
    );
    
    console.log(`[Check-in] Matched device code ${device_code} to EPC ${epc.epc_id}`);
    
    // Generate check-in token if not present
    if (!epc.checkin_token) {
      epc.checkin_token = crypto.randomBytes(32).toString('hex');
      await RemoteEPC.updateOne(
        { epc_id: epc.epc_id },
        { checkin_token: epc.checkin_token }
      );
    }
    
    // Get apt repository URL
    const aptRepoUrl = `http://${GCE_PUBLIC_IP}:${HSS_PORT}/apt-repos/main`;
    
    res.json({
      epc_id: epc.epc_id,
      checkin_token: epc.checkin_token,
      apt_repo_url: aptRepoUrl,
      gce_server: GCE_PUBLIC_IP,
      hss_port: HSS_PORT,
      origin_host_fqdn: epc.origin_host_fqdn
    });
    
  } catch (error) {
    console.error('[Check-in] Error:', error);
    res.status(500).json({ 
      error: 'Check-in failed', 
      message: error.message 
    });
  }
});

/**
 * Get EPC Deployment Script
 * GET /api/epc/:epc_id/deploy?checkin_token=xxx
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
 * Link device code to EPC configuration
 * POST /api/epc/:epc_id/link-device
 * Called from device configuration page to link device code to EPC
 */
router.post('/:epc_id/link-device', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { device_code } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'unknown';
    
    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }
    
    // Validate device code format
    const deviceCodePattern = /^[A-Z]{4}[0-9]{4}$/;
    if (!deviceCodePattern.test(device_code.toUpperCase())) {
      return res.status(400).json({ 
        error: 'Invalid device code format',
        message: 'Device code must be 8 characters: 4 uppercase letters followed by 4 digits (e.g., ABCD1234)'
      });
    }
    
    // Find EPC
    const epc = await RemoteEPC.findOne({ 
      epc_id,
      tenant_id
    }).lean();
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Check if device code is already linked to another EPC
    const existingEPC = await RemoteEPC.findOne({ 
      device_code: device_code.toUpperCase(),
      epc_id: { $ne: epc_id }
    }).lean();
    
    if (existingEPC) {
      return res.status(400).json({ 
        error: 'Device code already linked',
        message: `Device code ${device_code} is already linked to EPC ${existingEPC.epc_id} (${existingEPC.site_name})`
      });
    }
    
    // Link device code to EPC
    await RemoteEPC.updateOne(
      { epc_id },
      { 
        device_code: device_code.toUpperCase(),
        status: 'registered' // Reset to registered, will become online when device checks in
      }
    );
    
    console.log(`[Link Device] Device code ${device_code} linked to EPC ${epc_id}`);
    
    res.json({
      success: true,
      epc_id,
      device_code: device_code.toUpperCase(),
      message: `Device code ${device_code} linked to EPC ${epc.site_name}. Hardware will automatically check in and configure when it boots.`
    });
    
  } catch (error) {
    console.error('[Link Device] Error:', error);
    res.status(500).json({ 
      error: 'Failed to link device code', 
      message: error.message 
    });
  }
});

/**
 * Update EPC Device Configuration
 * PUT /api/epc/:epc_id
 * Updates deployment_type, hss_config, snmp_config, and network_config
 */
router.put('/:epc_id', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { deployment_type, hss_config, snmp_config, network_config } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'unknown';
    
    console.log(`[Update EPC] Updating EPC ${epc_id} for tenant ${tenant_id}`);
    
    // Find the EPC
    const epc = await RemoteEPC.findOne({ 
      epc_id,
      tenant_id
    });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Build update object
    const updateFields = {
      updated_at: new Date()
    };
    
    if (deployment_type) {
      if (!['epc', 'snmp', 'both'].includes(deployment_type)) {
        return res.status(400).json({ error: 'Invalid deployment_type. Must be epc, snmp, or both' });
      }
      updateFields.deployment_type = deployment_type;
    }
    
    if (hss_config) {
      updateFields.hss_config = {
        ...epc.hss_config,
        ...hss_config
      };
    }
    
    if (snmp_config) {
      updateFields.snmp_config = {
        ...epc.snmp_config,
        ...snmp_config
      };
    }
    
    if (network_config) {
      updateFields.network_config = {
        ...epc.network_config,
        ...network_config
      };
    }
    
    // Update the EPC
    await RemoteEPC.updateOne(
      { epc_id, tenant_id },
      { $set: updateFields }
    );
    
    console.log(`[Update EPC] Updated EPC ${epc_id}`);
    
    // Fetch updated record
    const updatedEPC = await RemoteEPC.findOne({ epc_id, tenant_id }).lean();
    
    res.json({
      success: true,
      epc_id,
      message: 'EPC configuration updated successfully',
      epc: updatedEPC
    });
    
  } catch (error) {
    console.error('[Update EPC] Error:', error);
    res.status(500).json({ 
      error: 'Failed to update EPC', 
      message: error.message 
    });
  }
});

/**
 * Proxy ISO Download (internal use - frontend downloads through this)
 * GET /api/deploy/download-iso?url=<iso-url>
 * Proxies the ISO download to avoid exposing GCE IP directly
 * 
 * For large files (ISOs), we serve directly from the filesystem instead of proxying
 * through HTTP to avoid memory issues and timeouts.
 */
router.get('/download-iso', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'url parameter is required' });
    }
    
    // Validate URL is for our ISO file
    const isoUrl = decodeURIComponent(url);
    if (!isoUrl.includes('wisptools-epc-generic-netinstall.iso')) {
      return res.status(400).json({ error: 'Invalid ISO URL' });
    }
    
    // Serve directly from filesystem (much more efficient than proxying)
    const isoPath = '/var/www/html/downloads/isos/wisptools-epc-generic-netinstall.iso';
    
    console.log(`[ISO Download Proxy] Serving file directly: ${isoPath}`);
    
    try {
      const stats = await fs.stat(isoPath);
      
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="wisptools-epc-generic-netinstall.iso"');
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Stream the file directly
      const { createReadStream } = require('fs');
      const fileStream = createReadStream(isoPath);
      
      fileStream.on('error', (err) => {
        console.error('[ISO Download Proxy] Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream ISO file' });
        }
      });
      
      fileStream.pipe(res);
      
    } catch (statError) {
      console.error('[ISO Download Proxy] File not found:', statError);
      return res.status(404).json({ 
        error: 'ISO file not found',
        message: 'Please build the generic ISO first'
      });
    }
    
  } catch (error) {
    console.error('[ISO Download Proxy] Error:', error);
    res.status(500).json({ 
      error: 'Failed to serve ISO download',
      details: error.message 
    });
  }
});

/**
 * Get Generic ISO Download URL
 * GET /api/deploy/generic-iso
 */
router.get('/generic-iso', async (req, res) => {
  try {
    // Return proxy URL instead of direct URL to avoid exposing GCE IP
    const directIsoUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/wisptools-epc-generic-netinstall.iso`;
    const isoUrl = `/api/deploy/download-iso?url=${encodeURIComponent(directIsoUrl)}`;
    const checksumUrl = `${directIsoUrl}.sha256`; // Checksum can be direct as it's small
    
    // Check if ISO exists
    try {
      const isoPath = path.join(ISO_OUTPUT_DIR, 'wisptools-epc-generic-netinstall.iso');
      const stats = await fs.stat(isoPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      res.json({
        success: true,
        iso_download_url: isoUrl,
        iso_checksum_url: checksumUrl,
        iso_size_mb: sizeMB,
        message: 'Generic ISO available. Use this ISO for all EPC deployments.'
      });
    } catch (statError) {
      res.status(404).json({
        error: 'Generic ISO not found',
        message: 'Please build the generic ISO first using build-generic-netinstall-iso.sh'
      });
    }
  } catch (error) {
    console.error('[Generic ISO] Error:', error);
    res.status(500).json({ error: 'Failed to get generic ISO URL' });
  }
});

/**
 * Generate EPC ISO from frontend deployment modal (DEPRECATED - use /register-epc instead)
 * POST /api/deploy/generate-epc-iso
 */
router.post('/generate-epc-iso', async (req, res) => {
  try {
    console.log('[ISO Generator] Request received:', {
      method: req.method,
      path: req.path,
      body: req.body,
      headers: Object.keys(req.headers),
      contentType: req.headers['content-type'],
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : []
    });
    
    const { siteName, location, networkConfig, contact, hssConfig, deploymentType, snmpConfig, aptConfig } = req.body;
    
    console.log('[ISO Generator] Creating ISO for site:', siteName);
    console.log('[ISO Generator] Deployment type:', deploymentType);
    
    if (!siteName) {
      console.error('[ISO Generator] Missing siteName in request body');
      return res.status(400).json({ error: 'siteName is required', receivedBody: req.body });
    }
    
    // Generate unique EPC ID
    const epc_id = `epc_${crypto.randomBytes(16).toString('hex')}`;
    const tenant_id = req.headers['x-tenant-id'] || 'unknown';
    
    // Fetch tenant to get domain/subdomain for Origin-Host AVP
    let tenantDomain = 'wisptools.io'; // Default domain
    if (Tenant) {
      try {
        const tenant = await Tenant.findById(tenant_id);
        if (tenant && tenant.subdomain) {
          // Use tenant subdomain as domain: {subdomain}.wisptools.io
          tenantDomain = `${tenant.subdomain}.wisptools.io`;
          console.log('[ISO Generator] Tenant domain:', tenantDomain);
        }
      } catch (tenantError) {
        console.warn('[ISO Generator] Could not fetch tenant domain, using default:', tenantError.message);
      }
    } else {
      console.warn('[ISO Generator] Tenant model not available, using default domain');
    }
    
    // Generate Origin-Host AVP FQDN: mme-{epc-id}.{tenant-domain}
    // Format: mme-{unique-id}.{tenant-subdomain}.wisptools.io
    const mmeUniqueId = `mme-${epc_id.substring(4, 12)}`; // Use first 8 chars of epc_id for shorter FQDN
    const originHostFQDN = `${mmeUniqueId}.${tenantDomain}`;
    console.log('[ISO Generator] Origin-Host FQDN:', originHostFQDN);
    
    // Generate credentials
    const auth_code = crypto.randomBytes(16).toString('hex');
    const api_key = crypto.randomBytes(32).toString('hex');
    const secret_key = crypto.randomBytes(32).toString('hex');
    
    // Generate unique ISO filename
    const timestamp = Date.now();
    const iso_filename = `wisptools-epc-${siteName.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.iso`;
    const iso_path = path.join(ISO_OUTPUT_DIR, iso_filename);
    
    // Create output directory if it doesn't exist
    // Check if it's a symlink first
    try {
      const stats = await fs.lstat(ISO_OUTPUT_DIR);
      if (!stats.isDirectory() && !stats.isSymbolicLink()) {
        throw new Error(`${ISO_OUTPUT_DIR} exists but is not a directory or symlink`);
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Directory doesn't exist, create it
    await fs.mkdir(ISO_OUTPUT_DIR, { recursive: true });
        console.log(`[ISO Generator] Created output directory: ${ISO_OUTPUT_DIR}`);
      } else {
        throw err;
      }
    }
    await fs.mkdir(ISO_BUILD_DIR, { recursive: true });
    
    // Create temporary build directory
    const buildDir = path.join(ISO_BUILD_DIR, `build-${epc_id}-${timestamp}`);
    await fs.mkdir(buildDir, { recursive: true });
    
    // Generate cloud-init config
    const cloudInitUserData = generateCloudInitConfig({
      epc_id,
      tenant_id,
      auth_code,
      api_key,
      secret_key,
      site_name: siteName,
      gce_ip: GCE_PUBLIC_IP,
      hss_port: HSS_PORT,
      origin_host_fqdn: originHostFQDN
    });
    
    // Create autoinstall directory
    const autoinstallDir = path.join(buildDir, 'autoinstall');
    await fs.mkdir(autoinstallDir, { recursive: true });
    await fs.writeFile(path.join(autoinstallDir, 'user-data'), cloudInitUserData);
    await fs.writeFile(path.join(autoinstallDir, 'meta-data'), 
      `instance-id: epc-${epc_id}\nlocal-hostname: ${siteName.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}\n`);
    
    // Create a minimal bootable ISO with the cloud-init data
    // Since we don't have a base Ubuntu ISO, we'll create a simple data ISO
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    console.log('[ISO Generator] Creating ISO with mkisofs...');
    
    // Build a bootable ISO using a base Ubuntu image; download tools/base ISO if missing
    const buildScript = path.join(buildDir, 'build.sh');
    const buildScriptContent = `#!/bin/bash
set -e

BUILD_DIR="${buildDir}"
ISO_PATH="${iso_path}"
KERNEL_PATH="${KERNEL_PATH}"
INITRD_PATH="${INITRD_PATH}"

    echo "[Build] Starting bootable ISO creation (Ubuntu 22.04 LTS netboot)..."
    echo "[Build] Output: $ISO_PATH"

    MIN_DIR_FOR_KERNEL="$(dirname "$KERNEL_PATH")"
    mkdir -p "$MIN_DIR_FOR_KERNEL"

    # Use pre-staged Ubuntu 22.04 LTS netboot kernel/initrd from GCE server (Open5GS compatible)
    # Files should be pre-staged at /opt/base-images/minimal/ by deployment scripts
    echo "[Build] Checking for pre-staged Ubuntu 22.04 LTS netboot files..."
    
    KERNEL_DOWNLOADED=0
    INITRD_DOWNLOADED=0
    
    # Check if pre-staged kernel exists and is valid
    if [ -f "$KERNEL_PATH" ] && [ -s "$KERNEL_PATH" ]; then
      KERNEL_SIZE=$(wc -c < "$KERNEL_PATH" 2>/dev/null || echo "0")
      if [ "$KERNEL_SIZE" -gt 1048576 ]; then
        KERNEL_DOWNLOADED=1
        echo "[Build] Using pre-staged kernel: $KERNEL_PATH ($(du -h "$KERNEL_PATH" | cut -f1))"
      else
        echo "[Build] Pre-staged kernel is too small, will re-download"
        rm -f "$KERNEL_PATH" 2>/dev/null || true
      fi
    fi
    
    # Check if pre-staged initrd exists and is valid
    if [ -f "$INITRD_PATH" ] && [ -s "$INITRD_PATH" ]; then
      INITRD_SIZE=$(wc -c < "$INITRD_PATH" 2>/dev/null || echo "0")
      if [ "$INITRD_SIZE" -gt 5242880 ]; then
        INITRD_DOWNLOADED=1
        echo "[Build] Using pre-staged initrd: $INITRD_PATH ($(du -h "$INITRD_PATH" | cut -f1))"
      else
        echo "[Build] Pre-staged initrd is too small, will re-download"
        rm -f "$INITRD_PATH" 2>/dev/null || true
      fi
    fi
    
    # Only download if files are missing or invalid
    if [ $KERNEL_DOWNLOADED -eq 0 ] || [ $INITRD_DOWNLOADED -eq 0 ]; then
      echo "[Build] Pre-staged files not found or invalid, downloading from Ubuntu archive..."
      
      # Try multiple Ubuntu netboot URLs (fallback if one fails)
      UBUNTU_NETBOOT_URLS=(
        "http://archive.ubuntu.com/ubuntu/dists/jammy/main/installer-amd64/current/images/netboot/ubuntu-installer/amd64"
        "http://archive.ubuntu.com/ubuntu/dists/jammy/main/installer-amd64/current/legacy-images/netboot/ubuntu-installer/amd64"
        "http://archive.ubuntu.com/ubuntu/dists/jammy-updates/main/installer-amd64/current/images/netboot/ubuntu-installer/amd64"
      )
      
      for UBUNTU_NETBOOT_BASE in "\${UBUNTU_NETBOOT_URLS[@]}"; do
        echo "[Build] Trying URL: $UBUNTU_NETBOOT_BASE"
        
        # Try to download kernel if needed
        if [ $KERNEL_DOWNLOADED -eq 0 ]; then
          if wget -q --timeout=30 --tries=2 -O "$KERNEL_PATH" "$UBUNTU_NETBOOT_BASE/linux" 2>/dev/null; then
            if [ -s "$KERNEL_PATH" ]; then
              KERNEL_SIZE=$(wc -c < "$KERNEL_PATH" 2>/dev/null || echo "0")
              if [ "$KERNEL_SIZE" -gt 1048576 ]; then
                KERNEL_DOWNLOADED=1
                echo "[Build] Kernel downloaded successfully from $UBUNTU_NETBOOT_BASE"
              else
                rm -f "$KERNEL_PATH" 2>/dev/null || true
              fi
            else
              rm -f "$KERNEL_PATH" 2>/dev/null || true
            fi
          fi
        fi
        
        # Try to download initrd if needed
        if [ $INITRD_DOWNLOADED -eq 0 ]; then
          if wget -q --timeout=30 --tries=2 -O "$INITRD_PATH" "$UBUNTU_NETBOOT_BASE/initrd.gz" 2>/dev/null; then
            if [ -s "$INITRD_PATH" ]; then
              INITRD_SIZE=$(wc -c < "$INITRD_PATH" 2>/dev/null || echo "0")
              if [ "$INITRD_SIZE" -gt 5242880 ]; then
                INITRD_DOWNLOADED=1
                echo "[Build] Initrd downloaded successfully from $UBUNTU_NETBOOT_BASE"
              else
                rm -f "$INITRD_PATH" 2>/dev/null || true
              fi
            else
              rm -f "$INITRD_PATH" 2>/dev/null || true
            fi
          fi
        fi
        
        # If both downloaded, break
        if [ $KERNEL_DOWNLOADED -eq 1 ] && [ $INITRD_DOWNLOADED -eq 1 ]; then
          break
        fi
      done

    # Verify downloads succeeded
    if [ ! -s "$KERNEL_PATH" ] || [ ! -s "$INITRD_PATH" ]; then
      echo "[Build] ERROR: Failed to get Ubuntu netboot files (pre-staged or downloaded)"
      echo "[Build] Kernel file: $([ -f "$KERNEL_PATH" ] && echo "exists ($(du -h "$KERNEL_PATH" | cut -f1))" || echo "missing")"
      echo "[Build] Initrd file: $([ -f "$INITRD_PATH" ] && echo "exists ($(du -h "$INITRD_PATH" | cut -f1))" || echo "missing")"
      echo "[Build] Expected location: $KERNEL_PATH and $INITRD_PATH"
      echo "[Build] Attempted URLs:"
      for url in "\${UBUNTU_NETBOOT_URLS[@]}"; do
        echo "[Build]   - \$url"
      done
      exit 1
    fi
    
    # Final verification of file sizes
    KERNEL_SIZE=$(wc -c < "$KERNEL_PATH" 2>/dev/null || echo "0")
    INITRD_SIZE=$(wc -c < "$INITRD_PATH" 2>/dev/null || echo "0")
    
    if [ "$KERNEL_SIZE" -lt 1048576 ]; then
      echo "[Build] ERROR: Kernel file too small ($KERNEL_SIZE bytes)"
      exit 1
    fi
    
    if [ "$INITRD_SIZE" -lt 5242880 ]; then
      echo "[Build] ERROR: Initrd file too small ($INITRD_SIZE bytes)"
      exit 1
    fi
    
    echo "[Build] Ubuntu 22.04 LTS netboot files ready"
    echo "[Build] Kernel: $KERNEL_PATH ($(du -h "$KERNEL_PATH" | cut -f1))"
    echo "[Build] Initrd: $INITRD_PATH ($(du -h "$INITRD_PATH" | cut -f1))"

    # Clean up old build directories and old autoinstall files before starting
    echo "[Build] Cleaning up old build artifacts..."
    rm -rf "$BUILD_DIR" 2>/dev/null || true
    NETBOOT_DIR="/var/www/html/downloads/netboot"
    mkdir -p "$NETBOOT_DIR"
    # Clean up autoinstall directories older than 1 day
    find "$NETBOOT_DIR" -type d -name "epc_*" -mtime +1 -exec rm -rf {} + 2>/dev/null || true

    # Generate unique autoinstall config for this EPC build (Ubuntu 22.04 uses autoinstall)
    # Ubuntu autoinstall expects user-data and meta-data files in a subdirectory
    AUTOINSTALL_DIR="${epc_id}-$(date +%s)"
    AUTOINSTALL_BASE="$NETBOOT_DIR/$AUTOINSTALL_DIR"
    mkdir -p "$AUTOINSTALL_BASE"
    EPC_ID_VAL="${epc_id}"
    TENANT_ID_VAL="${tenant_id}"
    AUTH_CODE_VAL="${auth_code}"
    API_KEY_VAL="${api_key}"
    SECRET_KEY_VAL="${secret_key}"
    GCE_PUBLIC_IP_VAL="${GCE_PUBLIC_IP}"
    HSS_PORT_VAL="${HSS_PORT}"
    ORIGIN_HOST_VAL="${originHostFQDN}"
    SITE_NAME="${siteName}"
    echo "[Build] Creating autoinstall config in: $AUTOINSTALL_DIR/"
    
    # Write user-data file using printf to avoid heredoc issues
    printf '#cloud-config\n' > "$AUTOINSTALL_BASE/user-data"
    printf 'autoinstall:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '  version: 1\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '  locale: en_US\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '  keyboard:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    layout: us\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '  network:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    network:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '      version: 2\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '      ethernets:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '        any:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '          match:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '            name: "en*"\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '          dhcp4: true\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '  storage:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    layout:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '      name: direct\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '  packages:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    - curl\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    - wget\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    - ca-certificates\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    - jq\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    - gnupg\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    - lsb-release\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    - openssh-server\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '  user-data:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    users:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '      - name: wisp\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '        groups: [adm, sudo]\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '        shell: /bin/bash\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '        lock-passwd: false\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '        passwd: $6$rounds=4096$saltsalt$hBHuZm7adhEYRKKp7oSfFkFq8C5L5CfLXqJ3qvQZQBfVZb9kCL3HH8wJOhZ8L5nKkTRqy8FqKLMnLmKMnLM8.\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    runcmd:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '      - mkdir -p /etc/wisptools /opt/wisptools\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '      - |\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '        cat > /etc/wisptools/credentials.env << '\''CREDS'\''\n' >> "$AUTOINSTALL_BASE/user-data"
    printf 'EPC_ID=%s\n' "$EPC_ID_VAL" >> "$AUTOINSTALL_BASE/user-data"
    printf 'TENANT_ID=%s\n' "$TENANT_ID_VAL" >> "$AUTOINSTALL_BASE/user-data"
    printf 'EPC_AUTH_CODE=%s\n' "$AUTH_CODE_VAL" >> "$AUTOINSTALL_BASE/user-data"
    printf 'EPC_API_KEY=%s\n' "$API_KEY_VAL" >> "$AUTOINSTALL_BASE/user-data"
    printf 'EPC_SECRET_KEY=%s\n' "$SECRET_KEY_VAL" >> "$AUTOINSTALL_BASE/user-data"
    printf 'GCE_SERVER=%s\n' "$GCE_PUBLIC_IP_VAL" >> "$AUTOINSTALL_BASE/user-data"
    printf 'HSS_PORT=%s\n' "$HSS_PORT_VAL" >> "$AUTOINSTALL_BASE/user-data"
    printf 'ORIGIN_HOST_FQDN=%s\n' "$ORIGIN_HOST_VAL" >> "$AUTOINSTALL_BASE/user-data"
    printf 'CREDS\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '      - chmod 600 /etc/wisptools/credentials.env\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '      - wget -O /opt/wisptools/bootstrap.sh http://%s:%s/api/epc/%s/bootstrap?auth_code=%s\n' "$GCE_PUBLIC_IP_VAL" "$HSS_PORT_VAL" "$EPC_ID_VAL" "$AUTH_CODE_VAL" >> "$AUTOINSTALL_BASE/user-data"
    printf '      - chmod +x /opt/wisptools/bootstrap.sh\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '      - |\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '        cat > /etc/systemd/system/wisptools-bootstrap.service << '\''UNIT'\''\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '[Unit]\n' >> "$AUTOINSTALL_BASE/user-data"
    printf 'Description=WISPTools EPC Bootstrap\n' >> "$AUTOINSTALL_BASE/user-data"
    printf 'After=network-online.target\n' >> "$AUTOINSTALL_BASE/user-data"
    printf 'Wants=network-online.target\n' >> "$AUTOINSTALL_BASE/user-data"
    printf 'ConditionPathExists=!/var/lib/wisptools/.bootstrapped\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '[Service]\n' >> "$AUTOINSTALL_BASE/user-data"
    printf 'Type=oneshot\n' >> "$AUTOINSTALL_BASE/user-data"
    printf 'ExecStart=/opt/wisptools/bootstrap.sh\n' >> "$AUTOINSTALL_BASE/user-data"
    printf 'RemainAfterExit=yes\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '[Install]\n' >> "$AUTOINSTALL_BASE/user-data"
    printf 'WantedBy=multi-user.target\n' >> "$AUTOINSTALL_BASE/user-data"
    printf 'UNIT\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '      - systemctl enable wisptools-bootstrap.service\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '  late-commands:\n' >> "$AUTOINSTALL_BASE/user-data"
    printf '    - curtin in-target --target=/target -- systemctl enable ssh\n' >> "$AUTOINSTALL_BASE/user-data"

    # Create meta-data file for cloud-init (Ubuntu autoinstall requirement)
    SITE_HOSTNAME=$(echo "$SITE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
    echo "instance-id: epc-$EPC_ID_VAL" > "$AUTOINSTALL_BASE/meta-data"
    echo "local-hostname: $SITE_HOSTNAME" >> "$AUTOINSTALL_BASE/meta-data"
    echo "[Build] Created user-data and meta-data in $AUTOINSTALL_DIR/"

    # Build tiny ISO containing only netboot kernel/initrd and GRUB
    # Clean ISO root directory to ensure fresh build
    ISO_ROOT="$BUILD_DIR/iso_root"
    rm -rf "$ISO_ROOT" 2>/dev/null || true
    mkdir -p "$ISO_ROOT/ubuntu" "$ISO_ROOT/boot/grub"
    echo "[Build] Copying Ubuntu 22.04 LTS netboot files to ISO root..."
    cp "$KERNEL_PATH" "$ISO_ROOT/ubuntu/vmlinuz" || { echo "[Build] ERROR: Failed to copy kernel"; exit 1; }
    cp "$INITRD_PATH" "$ISO_ROOT/ubuntu/initrd.gz" || { echo "[Build] ERROR: Failed to copy initrd"; exit 1; }
    chmod 0644 "$ISO_ROOT/ubuntu/vmlinuz" "$ISO_ROOT/ubuntu/initrd.gz" || true
    echo "[Build] Verified ISO root contains: $(ls -lh "$ISO_ROOT/ubuntu/")"

    cat > "$ISO_ROOT/boot/grub/grub.cfg" << GRUBCFG
    set timeout=0
    set default=auto
    insmod gzio

    menuentry "Ubuntu 22.04 LTS Server (Automated - Open5GS Compatible)" --id auto {
      linux /ubuntu/vmlinuz autoinstall ds=nocloud-net\\;s=http://\${GCE_PUBLIC_IP}/downloads/netboot/\${AUTOINSTALL_DIR}/ ip=dhcp net.ifnames=0 biosdevname=0 ---
      initrd /ubuntu/initrd.gz
    }

    menuentry "Ubuntu 22.04 LTS Server (Manual)" {
      linux /ubuntu/vmlinuz ---
      initrd /ubuntu/initrd.gz
    }
GRUBCFG


# Remove any existing ISO with same name to avoid conflicts
rm -f "$ISO_PATH" 2>/dev/null || true

apt-get update -y >/dev/null 2>&1 || true
apt-get install -y grub-pc-bin grub-efi-amd64-bin xorriso mtools >/dev/null 2>&1 || true

echo "[Build] Building ISO with grub-mkrescue..."
grub-mkrescue -o "$ISO_PATH" "$ISO_ROOT" >/dev/null 2>&1 || { echo "[Build] ERROR: grub-mkrescue failed"; exit 1; }

if [ ! -s "$ISO_PATH" ]; then
  echo "[Build] ERROR: Generated ISO is empty or missing"
  exit 1
fi
echo "[Build] ISO created successfully: $(du -h "$ISO_PATH" | cut -f1)"

# Create checksum for ISO
if [ -f "$ISO_PATH" ]; then
  (cd "${ISO_OUTPUT_DIR}" && sha256sum "${iso_filename}" > "${iso_filename}.sha256") || true
  echo "[Build] ISO checksum created: ${iso_filename}.sha256"
fi
`;

    await fs.writeFile(buildScript, buildScriptContent);
    await fs.chmod(buildScript, 0o755);
    
    // Verify script was created and is executable
    try {
      const scriptStats = await fs.stat(buildScript);
      console.log(`[ISO Generator] Build script created: ${buildScript} (${scriptStats.size} bytes, mode: ${scriptStats.mode.toString(8)})`);
    } catch (statError) {
      throw new Error(`Failed to create build script: ${statError.message}`);
    }
    
    console.log('[ISO Generator] Executing build script:', buildScript);
    console.log('[ISO Generator] Output directory:', ISO_OUTPUT_DIR);
    console.log('[ISO Generator] ISO path:', iso_path);
    
    try {
      const { stdout, stderr } = await execAsync(`sudo ${buildScript}`, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large output
        timeout: 600000 // 10 minutes timeout
      });
      console.log('[ISO Generator] Build output:', stdout);
      if (stderr) {
        console.warn('[ISO Generator] Build warnings:', stderr);
      }
    } catch (isoError) {
      console.error('[ISO Generator] ISO creation failed:', isoError);
      console.error('[ISO Generator] Error code:', isoError.code);
      console.error('[ISO Generator] Error signal:', isoError.signal);
      console.error('[ISO Generator] Error stdout:', isoError.stdout);
      console.error('[ISO Generator] Error stderr:', isoError.stderr);
      
      // Check if ISO file exists despite error (sometimes warnings cause non-zero exit)
      let isoExists = false;
      try {
        await fs.access(iso_path);
        const stats = await fs.stat(iso_path);
        isoExists = true;
        console.log(`[ISO Generator] ISO file exists despite error, continuing... (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
      } catch (accessError) {
        // ISO doesn't exist, check if output directory exists
        let outputDirExists = false;
        try {
          await fs.access(ISO_OUTPUT_DIR);
          outputDirExists = true;
        } catch (dirError) {
          // Directory doesn't exist
        }
        
        const errorDetails = [
          `Build script exit code: ${isoError.code}`,
          `Build script signal: ${isoError.signal || 'none'}`,
          `Build script stdout: ${isoError.stdout || '(empty)'}`,
          `Build script stderr: ${isoError.stderr || '(empty)'}`,
          `Expected ISO path: ${iso_path}`,
          `Output directory exists: ${outputDirExists ? 'yes' : 'no'}`
        ].join('\n');
        throw new Error(`ISO generation failed: ${isoError.message}\n${errorDetails}`);
      }
    }
    
    // Verify ISO was created
    let stats;
    try {
      stats = await fs.stat(iso_path);
    } catch (statError) {
      throw new Error(`ISO file was not created at ${iso_path}: ${statError.message}`);
    }
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    const isoDownloadUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${iso_filename}`;
    const isoChecksumUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${iso_filename}.sha256`;
    
    console.log(`[ISO Generator] ISO ready: ${iso_filename} (${sizeMB}MB)`);
    console.log(`[ISO Generator] Download URL: ${isoDownloadUrl}`);
    
    res.json({
      success: true,
      epc_id,
      iso_filename,
      iso_download_url: isoDownloadUrl,
      iso_checksum_url: isoChecksumUrl,
      iso_size_mb: sizeMB,
      download_url: isoDownloadUrl,
      checksum_url: isoChecksumUrl,
      size_mb: sizeMB,
      origin_host_fqdn: originHostFQDN,
      message: 'ISO generated successfully!'
    });
    
  } catch (error) {
    console.error('[ISO Generator] Error:', error);
    console.error('[ISO Generator] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate ISO', 
      message: error.message,
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Generate a minimal bootable ISO for a specific EPC
 * The ISO contains:
 * - EPC credentials (unique code)
 * - Tenant ID
 * - Bootstrap script that downloads full deployment from GCE
 * 
 * POST /api/epc/:epc_id/generate-iso
 */
router.post('/:epc_id/generate-iso', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { tenant_id, auth_code, api_key, secret_key, site_name } = req.body;
    
    if (!tenant_id || !auth_code || !api_key || !secret_key || !site_name) {
      return res.status(400).json({ error: 'Missing required EPC credentials for ISO generation' });
    }
    
    console.log(`[ISO Generator] Creating ISO for EPC: ${epc_id} (Tenant: ${tenant_id})`);
    
    // Generate unique ISO filename
    const timestamp = Date.now();
    const iso_filename = `wisptools-epc-${epc_id}-${timestamp}.iso`;
    const iso_path = path.join(ISO_OUTPUT_DIR, iso_filename);
    
    // Create ISO build directory
    const buildDir = path.join(ISO_BUILD_DIR, `build-${epc_id}-${timestamp}`);
    await fs.mkdir(buildDir, { recursive: true });
    
    // Generate cloud-init config
    const cloudInitUserData = generateCloudInitConfig({
      epc_id,
      tenant_id,
      auth_code,
      api_key,
      secret_key,
      site_name,
      gce_ip: GCE_PUBLIC_IP,
      hss_port: HSS_PORT
    });
    
    // Create autoinstall directory
    const autoinstallDir = path.join(buildDir, 'autoinstall');
    await fs.mkdir(autoinstallDir, { recursive: true });
    await fs.writeFile(path.join(autoinstallDir, 'user-data'), cloudInitUserData);
    await fs.writeFile(path.join(autoinstallDir, 'meta-data'), `instance-id: epc-${epc_id}\nlocal-hostname: ${site_name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}\n`);
    
    // Build script that will actually create the ISO
    const buildScript = path.join(buildDir, 'build.sh');
    const buildScriptContent = `#!/bin/bash
set -e

BUILD_DIR="${buildDir}"
ISO_PATH="${iso_path}"
AUTOINSTALL_DIR="${autoinstallDir}"
BASE_ISO="${BASE_ISO_PATH}"

echo "[Build] Starting ISO creation..."
echo "[Build] EPC ID: ${epc_id}"
echo "[Build] Output: \$ISO_PATH"

# Extract base Ubuntu ISO
echo "[Build] Extracting base Ubuntu ISO..."
EXTRACT_DIR="\${BUILD_DIR}/iso_extract"
mkdir -p "\${EXTRACT_DIR}"
7z x "\${BASE_ISO}" -o"\${EXTRACT_DIR}" > /dev/null 2>&1

# Copy autoinstall files
echo "[Build] Copying autoinstall configuration..."
cp -r "\${AUTOINSTALL_DIR}" "\${EXTRACT_DIR}/"

# Update GRUB config for autoinstall
echo "[Build] Configuring GRUB..."
GRUB_CFG="\${EXTRACT_DIR}/boot/grub/grub.cfg"
if [ -f "\${GRUB_CFG}" ]; then
    cat > "\${GRUB_CFG}" << 'GRUBEOF'
set timeout=5
set default=0

menuentry "WISPTools.io EPC - Autoinstall" {
    set gfxpayload=keep
    linux   /casper/vmlinuz autoinstall ds=nocloud\\\\;s=/cdrom/autoinstall/ ---
    initrd  /casper/initrd
}

menuentry "Ubuntu Server (Manual)" {
    set gfxpayload=keep
    linux   /casper/vmlinuz ---
    initrd  /casper/initrd
}

menuentry "Boot from first hard disk" {
    set root=(hd0)
    chainloader +1
}
GRUBEOF
fi

# Update ISOLINUX config for BIOS boot
echo "[Build] Configuring ISOLINUX..."
ISOLINUX_CFG="\${EXTRACT_DIR}/isolinux/txt.cfg"
if [ -f "\${ISOLINUX_CFG}" ]; then
    cat > "\${ISOLINUX_CFG}" << 'ISOLINUXEOF'
default autoinstall
label autoinstall
  menu label ^WISPTools.io EPC - Autoinstall
  kernel /casper/vmlinuz
  append initrd=/casper/initrd autoinstall ds=nocloud;s=/cdrom/autoinstall/ ---
label manual
  menu label ^Ubuntu Server (Manual)
  kernel /casper/vmlinuz
  append initrd=/casper/initrd ---
ISOLINUXEOF
fi

# Build ISO with xorriso
echo "[Build] Building ISO image (this may take a few minutes)..."
xorriso -as mkisofs \\
  -r -V "WISP-EPC-${epc_id.substring(4, 12)}" \\
  -o "\${ISO_PATH}" \\
  -J -l \\
  -b isolinux/isolinux.bin \\
  -c isolinux/boot.cat \\
  -no-emul-boot \\
  -boot-load-size 4 \\
  -boot-info-table \\
  -eltorito-alt-boot \\
  -e boot/grub/efi.img \\
  -no-emul-boot \\
  -isohybrid-gpt-basdat \\
  -isohybrid-mbr /usr/lib/ISOLINUX/isohdpfx.bin \\
  "\${EXTRACT_DIR}" \\
  2>&1 | grep -v "FAILURE"

# Calculate checksum
if [ -f "\${ISO_PATH}" ]; then
    echo "[Build] Calculating checksum..."
    cd "$ISO_OUTPUT_DIR"
    sha256sum "${iso_filename}" > "${iso_filename}.sha256"
    echo "[Build] ISO created successfully: ${iso_filename}"
    echo "[Build] Size: \$(du -h \${ISO_PATH} | cut -f1)"
else
    echo "[Build] ERROR: ISO creation failed"
    exit 1
fi

echo "[Build] Cleaning up temporary files..."
rm -rf "\${BUILD_DIR}"

echo "[Build] Complete!"
`;
    
    await fs.writeFile(buildScript, buildScriptContent);
    await fs.chmod(buildScript, 0o755);
    
    // Execute build script
    console.log(`[ISO Generator] Executing build script...`);
    try {
      const { stdout, stderr } = await execAsync(`sudo ${buildScript}`);
      console.log('[ISO Generator] Build output:', stdout);
      if (stderr) console.error('[ISO Generator] Build warnings:', stderr);
    } catch (buildError) {
      console.error('[ISO Generator] Build failed:', buildError);
      // Still return success if ISO file exists
      try {
        await fs.access(iso_path);
      } catch {
        throw new Error(`Build failed: ${buildError.message}`);
      }
    }
    
    // Verify ISO was created
    const stats = await fs.stat(iso_path);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    const downloadUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${iso_filename}`;
    const checksumUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${iso_filename}.sha256`;
    
    console.log(`[ISO Generator] ISO created: ${iso_filename} (${sizeMB}MB)`);
    
    res.json({
      success: true,
      epc_id,
      iso_filename,
      download_url: downloadUrl,
      checksum_url: checksumUrl,
      size_mb: sizeMB,
      message: 'ISO generated successfully!'
    });
    
  } catch (error) {
    console.error('[ISO Generator] Error:', error);
    console.error('[ISO Generator] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate ISO', 
      message: error.message,
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Download EPC deployment script
 * This is called by the ISO during first boot
 * 
 * GET /api/epc/:epc_id/bootstrap
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
 * GET /api/epc/:epc_id/full-deployment
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
    const epcRoute = require('./epc');
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

/**
 * List available ISOs for a tenant
 * GET /api/epc/isos
 */
router.get('/isos', async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    // List ISOs in output directory
    const files = await fs.readdir(ISO_OUTPUT_DIR);
    const isos = files.filter(f => f.endsWith('.iso'));
    
    const isoList = await Promise.all(isos.map(async (filename) => {
      const stat = await fs.stat(path.join(ISO_OUTPUT_DIR, filename));
      return {
        filename,
        size_mb: Math.round(stat.size / 1024 / 1024),
        created: stat.mtime,
        download_url: `http://${GCE_PUBLIC_IP}/downloads/isos/${filename}`
      };
    }));
    
    res.json({
      success: true,
      isos: isoList
    });
    
  } catch (error) {
    console.error('[ISO List] Error:', error);
    res.status(500).json({ error: 'Failed to list ISOs' });
  }
});

module.exports = router;

