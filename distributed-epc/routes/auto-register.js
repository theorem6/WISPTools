// Auto-Registration Route for Minimal Boot Disc Systems
// Handles automatic EPC registration from newly deployed systems

const express = require('express');
const { RemoteEPC } = require('../models');
const { requireTenant } = require('../middleware/auth');
const { 
  generateEpcId, 
  generateAuthCode, 
  generateApiKey, 
  generateSecretKey 
} = require('../utils/crypto-utils');

const router = express.Router();

/**
 * Auto-register a new EPC from a boot disc deployment
 * POST /epc/auto-register
 * 
 * This endpoint is called by the wisptools-register.sh script
 * on newly deployed systems with minimal Ubuntu installation
 */
router.post('/auto-register', requireTenant, async (req, res) => {
  try {
    const {
      hardware_id,
      mac_address,
      serial_number,
      system_info,
      network,
      os_info,
      boot_time,
      auto_provision
    } = req.body;
    
    // Validate required fields
    if (!hardware_id || !mac_address) {
      return res.status(400).json({ 
        error: 'Missing required fields: hardware_id and mac_address are required' 
      });
    }
    
    // Check if hardware already registered
    const existingEPC = await RemoteEPC.findOne({
      $or: [
        { 'hardware_info.hardware_id': hardware_id },
        { 'hardware_info.mac_address': mac_address }
      ],
      tenant_id: req.tenantId
    });
    
    if (existingEPC) {
      console.log(`[Auto-Register] Hardware already registered: ${existingEPC.epc_id}`);
      
      // Return existing credentials
      return res.json({
        success: true,
        existing: true,
        epc_id: existingEPC.epc_id,
        auth_code: existingEPC.auth_code,
        api_key: existingEPC.api_key,
        secret_key: existingEPC.secret_key,
        site_name: existingEPC.site_name,
        network_config: existingEPC.network_config,
        deployment_script_url: `/api/epc/${existingEPC.epc_id}/deployment-script`,
        message: 'Hardware already registered. Returning existing credentials.'
      });
    }
    
    // Generate unique identifiers
    const epc_id = generateEpcId();
    const auth_code = generateAuthCode();
    const api_key = generateApiKey();
    const secret_key = generateSecretKey();
    
    // Generate site name from system info
    const hostname = system_info?.hostname || 'unknown';
    const manufacturer = system_info?.manufacturer || '';
    const product = system_info?.product || '';
    const site_name = `Auto-${hostname}`.substring(0, 50);
    
    // Determine location from IP (basic geolocation - can be enhanced)
    let location = {
      address: network?.primary_ip || 'Unknown',
      city: 'Unknown',
      state: 'Unknown',
      country: 'USA',
      coordinates: {
        latitude: 0,
        longitude: 0
      }
    };
    
    // Try to geolocate IP (optional enhancement)
    // This would require a geolocation service/API
    // For now, use placeholder values
    
    // Auto-assign network configuration
    // In production, this might query available MCC/MNC pools
    // or use tenant-specific defaults
    const network_config = {
      mcc: '001', // Test network - should be configured per tenant
      mnc: '01',
      tac: Math.floor(Math.random() * 65535) + 1, // Random TAC
      apn: 'internet',
      dns_primary: '8.8.8.8',
      dns_secondary: '8.8.4.4'
    };
    
    // Create EPC record
    const epc = new RemoteEPC({
      epc_id,
      site_name,
      tenant_id: req.tenantId,
      auth_code,
      api_key,
      secret_key,
      location,
      network_config,
      
      // Hardware information
      hardware_info: {
        hardware_id,
        mac_address,
        serial_number,
        manufacturer: system_info?.manufacturer,
        product: system_info?.product,
        hostname: system_info?.hostname
      },
      
      // Network information
      network_info: {
        primary_ip: network?.primary_ip,
        gateway: network?.gateway,
        interface: network?.interface,
        netmask: network?.netmask,
        dns_servers: network?.dns_servers
      },
      
      // OS information
      os_info: {
        os_version: os_info?.os_version,
        kernel_version: os_info?.kernel_version
      },
      
      // Deployment info
      deployment_info: {
        method: 'auto_provision',
        boot_time: boot_time || new Date(),
        registered_at: new Date()
      },
      
      // Contact info (to be updated later)
      contact: {
        name: 'Auto-Provisioned',
        email: '',
        phone: ''
      },
      
      // Metrics configuration
      metrics_config: {
        interval: 60, // seconds
        enabled: true,
        endpoints: {
          heartbeat: '/api/metrics/heartbeat',
          metrics: '/api/metrics/submit',
          attach: '/api/metrics/attach',
          detach: '/api/metrics/detach'
        }
      },
      
      status: 'registered', // Will become 'online' on first heartbeat
      
      // Tags for auto-provisioned systems
      tags: ['auto-provisioned', 'minimal-boot-disc']
    });
    
    await epc.save();
    
    console.log(`[Auto-Register] New EPC registered: ${epc_id} (${site_name})`);
    console.log(`[Auto-Register] Hardware: ${hardware_id}`);
    console.log(`[Auto-Register] IP: ${network?.primary_ip}`);
    
    res.json({
      success: true,
      existing: false,
      epc_id,
      auth_code,
      api_key,
      secret_key,
      site_name,
      network_config,
      deployment_script_url: `/api/epc/${epc_id}/deployment-script`,
      message: 'EPC auto-registered successfully. Download and execute the deployment script.'
    });
    
  } catch (error) {
    console.error('[Auto-Register] Error:', error);
    res.status(500).json({ 
      error: 'Failed to auto-register EPC', 
      details: error.message 
    });
  }
});

/**
 * Get auto-registered EPCs (for dashboard/monitoring)
 * GET /epc/auto-registered
 */
router.get('/auto-registered', requireTenant, async (req, res) => {
  try {
    const epcs = await RemoteEPC.find({
      tenant_id: req.tenantId,
      tags: 'auto-provisioned'
    }).sort({ created_at: -1 });
    
    res.json({
      success: true,
      count: epcs.length,
      epcs: epcs.map(epc => ({
        epc_id: epc.epc_id,
        site_name: epc.site_name,
        status: epc.status,
        hardware_id: epc.hardware_info?.hardware_id,
        mac_address: epc.hardware_info?.mac_address,
        primary_ip: epc.network_info?.primary_ip,
        registered_at: epc.deployment_info?.registered_at,
        last_heartbeat: epc.last_heartbeat
      }))
    });
    
  } catch (error) {
    console.error('[Auto-Register] List error:', error);
    res.status(500).json({ error: 'Failed to list auto-registered EPCs' });
  }
});

/**
 * Update auto-registered EPC with additional information
 * PATCH /epc/auto-register/:epc_id
 * 
 * Allows updating site name, contact info, location after initial registration
 */
router.patch('/auto-register/:epc_id', requireTenant, async (req, res) => {
  try {
    const { epc_id } = req.params;
    const updates = req.body;
    
    const epc = await RemoteEPC.findOne({
      epc_id,
      tenant_id: req.tenantId
    });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Allow updating certain fields
    const allowedUpdates = ['site_name', 'contact', 'location', 'network_config'];
    
    for (const key of allowedUpdates) {
      if (updates[key]) {
        epc[key] = { ...epc[key], ...updates[key] };
      }
    }
    
    epc.updated_at = new Date();
    await epc.save();
    
    res.json({
      success: true,
      message: 'EPC updated successfully',
      epc_id: epc.epc_id
    });
    
  } catch (error) {
    console.error('[Auto-Register] Update error:', error);
    res.status(500).json({ error: 'Failed to update EPC' });
  }
});

module.exports = router;

