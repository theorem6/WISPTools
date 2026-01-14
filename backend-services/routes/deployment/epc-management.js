/**
 * EPC Management Routes
 * Handles EPC registration, updates, linking, and deletion
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { Tenant } = require('../../models/tenant');
const { RemoteEPC } = require('../../models/distributed-epc-schema');
const { InventoryItem } = require('../../models/inventory');
const { HardwareDeployment } = require('../../models/network');
const { UnifiedSite } = require('../../models/network');
const { generateSiteNameWithSuffix } = require('../../utils/site-naming');
const appConfig = require('../../config/app');

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
    
    // Generate site_name with suffix if needed (based on siteName or epc_id)
    const siteBase = siteName || epc_id;
    const finalSiteName = await generateSiteNameWithSuffix(siteBase, tenant_id);
    
    // Create EPC record in database (device_code will be added later via device configuration)
    const epcData = {
      epc_id,
      site_name: finalSiteName,
      site_id: siteBase, // Store base site identifier
      tenant_id,
      auth_code,
      api_key,
      secret_key,
      checkin_token, // Token for hardware check-in
      location: location || {},
      network_config: networkConfig || {},
      hss_config: hssConfig || {},
      deployment_type: deploymentType || 'both',
      snmp_config: snmpConfig || {},
      apt_config: aptConfig || {},
      installed_components: {
        nodejs_npm: false,
        snmp_discovery_enhanced: false,
        mikrotik_discovery: true
      },
      status: 'registered',
      origin_host_fqdn: originHostFQDN
    };
    
    const epc = new RemoteEPC(epcData);
    await epc.save();
    
    console.log(`[EPC Registration] EPC registered: ${epc_id}`);
    
    // Also create an inventory item for this device
    try {
      const inventoryItem = new InventoryItem({
        tenantId: tenant_id,
        category: 'EPC Equipment',
        subcategory: deploymentType === 'epc' ? 'LTE Core' : (deploymentType === 'snmp' ? 'SNMP Agent' : 'LTE Core + SNMP'),
        equipmentType: 'EPC/SNMP Server',
        status: 'reserved', // Reserved until deployed
        condition: 'new',
        currentLocation: {
          type: 'warehouse',
          siteName: siteName,
          address: location?.address || ''
        },
        notes: JSON.stringify({
          epc_id: epc_id,
          deployment_type: deploymentType,
          site_name: siteName
        }),
        // Link to EPC module
        modules: {
          hss: {
            epcId: epc_id,
            lastSync: new Date()
          }
        }
      });
      await inventoryItem.save();
      console.log(`[EPC Registration] Inventory item created for EPC: ${epc_id}`);
    } catch (invError) {
      console.warn(`[EPC Registration] Could not create inventory item:`, invError.message);
      // Don't fail the registration if inventory creation fails
    }
    
    // Return generic ISO download URL (frontend will proxy through /api/deploy/download-iso)
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
 * POST /api/deploy/checkin
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
    
    // Get IP address from request body or headers
    const ip_address = req.body.ip_address || req.ip || req.connection?.remoteAddress;
    
    // Update EPC with hardware information
    await RemoteEPC.updateOne(
      { epc_id: epc.epc_id },
      { 
        hardware_id: hardware_id || epc.hardware_id,
        ip_address: ip_address,
        status: 'online',
        last_seen: new Date(),
        last_heartbeat: new Date()
      }
    );
    
    console.log(`[Check-in] Matched device code ${device_code} to EPC ${epc.epc_id}, IP: ${ip_address}`);
    
    // Update inventory item if it exists
    try {
      const inventoryUpdate = await InventoryItem.findOneAndUpdate(
        { 
          $or: [
            { 'epcConfig.device_code': device_code.toUpperCase() },
            { 'epcConfig.epc_id': epc.epc_id },
            { serialNumber: epc.epc_id }
          ]
        },
        {
          status: 'deployed',
          condition: 'good',
          'networkConfig.management_ip': ip_address,
          'networkConfig.hardware_id': hardware_id,
          notes: `Device online. Last seen: ${new Date().toISOString()}. IP: ${ip_address}`,
          updatedAt: new Date()
        },
        { new: true }
      );
      if (inventoryUpdate) {
        console.log(`[Check-in] Updated inventory item ${inventoryUpdate._id} for EPC ${epc.epc_id}`);
      }
    } catch (invError) {
      console.warn(`[Check-in] Could not update inventory:`, invError.message);
    }
    
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
 * Update EPC Device Configuration
 * PUT /api/deploy/:epc_id
 * Updates deployment_type, hss_config, snmp_config, and network_config
 */
router.put('/:epc_id', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { site_name, deployment_type, hss_config, snmp_config, network_config } = req.body;
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
    
    // Allow updating site_name
    if (site_name) {
      updateFields.site_name = site_name;
    }
    
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
      epc: updatedEPC,
      message: 'EPC configuration updated successfully'
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
 * Delete an EPC device
 * DELETE /api/deploy/delete-epc/:epc_id
 */
router.delete('/delete-epc/:epc_id', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const tenant_id = req.headers['x-tenant-id'] || 'unknown';
    
    console.log(`[Delete EPC] Deleting EPC ${epc_id} for tenant ${tenant_id}`);
    
    // Find and delete the RemoteEPC
    const epc = await RemoteEPC.findOneAndDelete({
      $or: [
        { epc_id: epc_id },
        { _id: epc_id }
      ],
      tenant_id: tenant_id
    });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Also delete associated inventory item if exists
    await InventoryItem.deleteMany({
      $or: [
        { 'epcConfig.epc_id': epc_id },
        { 'epcConfig.device_code': epc.device_code },
        { serialNumber: epc_id }
      ],
      tenantId: tenant_id
    });
    
    console.log(`[Delete EPC] Successfully deleted EPC ${epc_id} (${epc.site_name})`);
    
    res.json({
      success: true,
      message: `EPC "${epc.site_name || epc_id}" deleted successfully`,
      deleted_epc_id: epc_id
    });
  } catch (error) {
    console.error('[Delete EPC] Error:', error);
    res.status(500).json({ error: 'Failed to delete EPC', message: error.message });
  }
});

/**
 * Link device code to new EPC configuration (from wizard)
 * POST /api/deploy/link-device
 * Called from the deployment wizard when user enters a device code
 * Creates new EPC and links device code in one step
 */
router.post('/link-device', async (req, res) => {
  try {
    const { device_code, tenant_id, config } = req.body;
    
    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }
    
    // Validate device code format (8 alphanumeric characters)
    const deviceCodePattern = /^[A-Z0-9]{8}$/;
    if (!deviceCodePattern.test(device_code.toUpperCase())) {
      return res.status(400).json({ 
        error: 'Invalid device code format',
        message: 'Device code must be 8 alphanumeric characters'
      });
    }
    
    // Check if device code is already linked to another EPC
    const existingEPC = await RemoteEPC.findOne({ 
      device_code: device_code.toUpperCase()
    }).lean();
    
    if (existingEPC) {
      // Device already linked - update tenant_id if it's 'unknown' or doesn't match current tenant
      if (tenant_id && (existingEPC.tenant_id === 'unknown' || !existingEPC.tenant_id || existingEPC.tenant_id !== tenant_id)) {
        console.log(`[Link Device] Updating tenant_id for EPC ${existingEPC.epc_id} from ${existingEPC.tenant_id} to ${tenant_id}`);
        await RemoteEPC.updateOne(
          { _id: existingEPC._id },
          { $set: { tenant_id: tenant_id, updated_at: new Date() } }
        );
        existingEPC.tenant_id = tenant_id;
      }
      
      // Site ID is REQUIRED for linking/deploying remotes
      const site_id = config?.site_id;
      if (!site_id) {
        return res.status(400).json({ 
          error: 'Site ID is required',
          message: 'A site must be selected to link/deploy remote EPC/SNMP agents. Please select a site from the dropdown.'
        });
      }
      
      // Update site_id if it's different or missing
      if (existingEPC.site_id !== site_id) {
        console.log(`[Link Device] Updating site_id for EPC ${existingEPC.epc_id} from ${existingEPC.site_id} to ${site_id}`);
        await RemoteEPC.updateOne(
          { _id: existingEPC._id },
          { $set: { site_id: site_id, updated_at: new Date() } }
        );
        existingEPC.site_id = site_id;
      }
      
      // Ensure HardwareDeployment record exists for this EPC at this site
      const { HardwareDeployment } = require('../../models/network');
      let hardwareDeployment = await HardwareDeployment.findOne({
        tenantId: tenant_id || existingEPC.tenant_id,
        hardware_type: 'epc',
        'config.epc_id': existingEPC.epc_id,
        'config.device_code': device_code.toUpperCase()
      });
      
      if (!hardwareDeployment) {
        // Create HardwareDeployment if it doesn't exist
        console.log(`[Link Device] Creating missing HardwareDeployment for existing EPC ${existingEPC.epc_id}`);
        hardwareDeployment = new HardwareDeployment({
          siteId: site_id,
          tenantId: tenant_id || existingEPC.tenant_id,
          hardware_type: 'epc',
          name: `${existingEPC.site_name || 'EPC'} - ${device_code.toUpperCase()}`,
          config: {
            epc_id: existingEPC.epc_id,
            device_code: device_code.toUpperCase(),
            deployment_type: existingEPC.deployment_type || 'both',
            ip_address: existingEPC.ip_address || null,
            management_ip: existingEPC.ip_address || null
          },
          epc_config: {
            epc_id: existingEPC.epc_id,
            device_code: device_code.toUpperCase(),
            deployment_type: existingEPC.deployment_type || 'both',
            network_config: existingEPC.network_config || {},
            hss_config: existingEPC.hss_config || {},
            snmp_config: existingEPC.snmp_config || {}
          },
          deployedAt: existingEPC.created_at || new Date(),
          status: 'deployed'
        });
        await hardwareDeployment.save();
        console.log(`[Link Device] Created hardware deployment for existing EPC ${existingEPC.epc_id} at site ${site_id}`);
      } else if (hardwareDeployment.siteId?.toString() !== site_id.toString()) {
        // Update siteId if it's different
        console.log(`[Link Device] Updating HardwareDeployment siteId for EPC ${existingEPC.epc_id} from ${hardwareDeployment.siteId} to ${site_id}`);
        await HardwareDeployment.updateOne(
          { _id: hardwareDeployment._id },
          { $set: { siteId: site_id, updatedAt: new Date() } }
        );
      }
      
      console.log(`[Link Device] Device code ${device_code} already linked to EPC ${existingEPC.epc_id}`);
      return res.json({
        success: true,
        already_linked: true,
        epc_id: existingEPC.epc_id,
        site_name: existingEPC.site_name,
        device_code: device_code.toUpperCase(),
        tenant_id: existingEPC.tenant_id,
        site_id: site_id,
        message: `Device code ${device_code} is already linked to EPC ${existingEPC.site_name}`
      });
    }
    
    // Generate new EPC ID and authentication credentials
    const epc_id = `EPC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const checkin_token = crypto.randomBytes(32).toString('hex');
    const auth_code = crypto.randomBytes(8).toString('hex').toUpperCase();
    const api_key = crypto.randomBytes(16).toString('hex');
    const secret_key = crypto.randomBytes(32).toString('hex');
    
    // Site ID is REQUIRED for linking/deploying remotes
    const site_id = config?.site_id;
    if (!site_id) {
      return res.status(400).json({ 
        error: 'Site ID is required',
        message: 'A site must be selected to link/deploy remote EPC/SNMP agents. Please select a site from the dropdown.'
      });
    }
    
    // Generate site name with suffix based on site_id
    let site_name = config?.site_name || 'New EPC Device';
    
    if (site_id) {
      // Use site_id as base and generate name with suffix
      site_name = await generateSiteNameWithSuffix(site_id, tenant_id || 'unknown');
    }
    
    // Create new EPC record with device code
    const newEPC = new RemoteEPC({
      epc_id,
      tenant_id: tenant_id || 'unknown',
      site_id: site_id || null,
      device_code: device_code.toUpperCase(),
      site_name: site_name,
      status: 'registered',
      deployment_type: config?.deployment_type || 'both',
      checkin_token,
      auth_code,
      api_key,
      secret_key,
      hss_config: config?.hss_config || {
        hss_host: 'hss.wisptools.io',
        hss_port: 3001,
        diameter_realm: 'wisptools.io'
      },
      snmp_config: config?.enable_snmp ? {
        enabled: true,
        version: config?.snmp_config?.version || '2c',
        community: config?.snmp_config?.community || 'public',
        port: config?.snmp_config?.port || 161
      } : { enabled: false },
      network_config: config?.network_config || {},
      location: config?.location || {},
      contact: config?.contact || {},
      apt_config: config?.apt_config || { enabled: true },
      installed_components: config?.installedComponents || {
        nodejs_npm: false,
        snmp_discovery_enhanced: false,
        mikrotik_discovery: true
      },
      created_at: new Date()
    });
    
    await newEPC.save();
    
    console.log(`[Link Device] Created EPC ${epc_id} and linked device code ${device_code}`);
    
    // Also create an inventory item for this device so it appears in inventory
    const inventoryItem = new InventoryItem({
      tenantId: tenant_id || 'unknown',
      assetTag: `EPC-${device_code.toUpperCase()}`,
      category: 'Network Equipment',
      subcategory: 'EPC Server',
      equipmentType: config?.deployment_type === 'snmp' ? 'SNMP Monitoring Server' : 
                     config?.deployment_type === 'both' ? 'EPC + SNMP Server' : 'EPC Core Server',
      manufacturer: 'WISPTools',
      model: 'EPC-Generic',
      serialNumber: epc_id,
      physicalDescription: `WISPTools EPC Device - ${config?.site_name || 'New Device'}`,
      status: 'pending_deployment',
      condition: 'new',
      currentLocation: {
        type: 'datacenter',
        address: {
          street: config?.location?.address || '',
          city: config?.location?.city || '',
          state: config?.location?.state || '',
          country: config?.location?.country || 'USA'
        },
        latitude: config?.location?.coordinates?.latitude || 0,
        longitude: config?.location?.coordinates?.longitude || 0
      },
      ownership: 'owned',
      networkConfig: {
        management_ip: null, // Will be updated on first check-in
        snmp_enabled: config?.enable_snmp || config?.deployment_type === 'snmp' || config?.deployment_type === 'both',
        snmp_community: config?.snmp_config?.community || 'public',
        snmp_version: config?.snmp_config?.version || '2c'
      },
      epcConfig: {
        epc_id: epc_id,
        device_code: device_code.toUpperCase(),
        deployment_type: config?.deployment_type || 'both',
        mcc: config?.network_config?.mcc || '001',
        mnc: config?.network_config?.mnc || '01',
        tac: config?.network_config?.tac || '1'
      },
      notes: `Linked via device code ${device_code}. Waiting for device to check in.`,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    let inventoryItemId = null;
    try {
      await inventoryItem.save();
      inventoryItemId = inventoryItem._id.toString();
      console.log(`[Link Device] Created inventory item for EPC ${epc_id}`);
    } catch (invError) {
      console.warn(`[Link Device] Could not create inventory item:`, invError.message);
      // Continue even if inventory creation fails
    }
    
    // Also create a HardwareDeployment record so it appears in site hardware lists
    let hardwareDeploymentId = null;
    try {
      const hardwareDeployment = new HardwareDeployment({
        siteId: site_id, // REQUIRED: Site ID for hardware to appear at site
        tenantId: tenant_id || 'unknown',
        hardware_type: 'epc',
        name: `${config?.site_name || 'EPC'} - ${device_code.toUpperCase()}`,
        config: {
          epc_id: epc_id,
          device_code: device_code.toUpperCase(),
          deployment_type: config?.deployment_type || 'both',
          ip_address: null, // Will be updated on check-in
          management_ip: null
        },
        epc_config: {
          epc_id: epc_id,
          device_code: device_code.toUpperCase(),
          deployment_type: config?.deployment_type || 'both',
          network_config: config?.network_config || {},
          hss_config: config?.hss_config || {},
          snmp_config: config?.snmp_config || {}
        },
        inventory_item_id: inventoryItemId,
        deployedAt: new Date(),
        status: 'deployed'
      });
      
      await hardwareDeployment.save();
      hardwareDeploymentId = hardwareDeployment._id.toString();
      console.log(`[Link Device] Created hardware deployment for EPC ${epc_id} at site ${site_id}`);
    } catch (hwError) {
      console.warn(`[Link Device] Could not create hardware deployment:`, hwError.message);
      // Continue even if hardware deployment creation fails
    }
    
    res.json({
      success: true,
      epc_id,
      site_name: newEPC.site_name,
      device_code: device_code.toUpperCase(),
      inventory_id: inventoryItem?._id?.toString() || null,
      status: 'registered',
      message: `Device code ${device_code} linked successfully! The device will configure automatically when it checks in.`,
      next_steps: [
        'Device will check in automatically every 60 seconds',
        'Once connected, device status will change to "online"',
        'Device will appear in Hardware Inventory and Monitoring'
      ]
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
 * Link device code to existing EPC configuration
 * POST /api/deploy/:epc_id/link-device
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
    const deviceCodePattern = /^[A-Z0-9]{8}$/;
    if (!deviceCodePattern.test(device_code.toUpperCase())) {
      return res.status(400).json({ 
        error: 'Invalid device code format',
        message: 'Device code must be 8 alphanumeric characters'
      });
    }
    
    // Check if device code is already linked to a different EPC
    const existingEPC = await RemoteEPC.findOne({ 
      device_code: device_code.toUpperCase(),
      epc_id: { $ne: epc_id }
    }).lean();
    
    if (existingEPC) {
      return res.status(400).json({ 
        error: 'Device code already in use',
        message: `Device code ${device_code} is already linked to EPC ${existingEPC.epc_id} (${existingEPC.site_name})`
      });
    }
    
    // Find the EPC
    const epc = await RemoteEPC.findOne({ 
      epc_id,
      tenant_id
    });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Link device code to EPC
    epc.device_code = device_code.toUpperCase();
    epc.updated_at = new Date();
    await epc.save();
    
    console.log(`[Link Device] Linked device code ${device_code} to EPC ${epc_id}`);
    
    res.json({
      success: true,
      epc_id,
      device_code: device_code.toUpperCase(),
      site_name: epc.site_name,
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
 * Backfill missing HardwareDeployment records for existing EPCs
 * POST /api/deploy/backfill-hardware-deployments
 * Creates HardwareDeployment records for EPCs that don't have them
 */
router.post('/backfill-hardware-deployments', async (req, res) => {
  try {
    const tenant_id = req.headers['x-tenant-id'] || req.body.tenant_id;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    console.log(`[Backfill] Starting hardware deployment backfill for tenant ${tenant_id}`);
    
    // Get all EPCs for this tenant that have a site_id
    const epcs = await RemoteEPC.find({
      tenant_id: tenant_id,
      site_id: { $exists: true, $ne: null }
    }).lean();
    
    console.log(`[Backfill] Found ${epcs.length} EPCs with site_id for tenant ${tenant_id}`);
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    
    for (const epc of epcs) {
      try {
        // Check if HardwareDeployment already exists
        let hardwareDeployment = await HardwareDeployment.findOne({
          tenantId: tenant_id,
          hardware_type: 'epc',
          'config.epc_id': epc.epc_id
        });
        
        if (hardwareDeployment) {
          // Update siteId if it's different
          const currentSiteId = hardwareDeployment.siteId?.toString();
          const epcSiteId = epc.site_id?.toString();
          
          if (currentSiteId !== epcSiteId) {
            console.log(`[Backfill] Updating HardwareDeployment siteId for EPC ${epc.epc_id} from ${currentSiteId} to ${epcSiteId}`);
            await HardwareDeployment.updateOne(
              { _id: hardwareDeployment._id },
              { $set: { siteId: epc.site_id, updatedAt: new Date() } }
            );
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new HardwareDeployment
          console.log(`[Backfill] Creating HardwareDeployment for EPC ${epc.epc_id} at site ${epc.site_id}`);
          
          hardwareDeployment = new HardwareDeployment({
            siteId: epc.site_id,
            tenantId: tenant_id,
            hardware_type: 'epc',
            name: `${epc.site_name || 'EPC'} - ${epc.device_code || epc.epc_id}`,
            config: {
              epc_id: epc.epc_id,
              device_code: epc.device_code || null,
              deployment_type: epc.deployment_type || 'both',
              ip_address: epc.ip_address || null,
              management_ip: epc.ip_address || null
            },
            epc_config: {
              epc_id: epc.epc_id,
              device_code: epc.device_code || null,
              deployment_type: epc.deployment_type || 'both',
              network_config: epc.network_config || {},
              hss_config: epc.hss_config || {},
              snmp_config: epc.snmp_config || {}
            },
            deployedAt: epc.created_at || new Date(),
            status: 'deployed'
          });
          
          await hardwareDeployment.save();
          created++;
        }
      } catch (error) {
        console.error(`[Backfill] Error processing EPC ${epc.epc_id}:`, error);
        errors.push({
          epc_id: epc.epc_id,
          error: error.message
        });
      }
    }
    
    console.log(`[Backfill] Completed: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} errors`);
    
    res.json({
      success: true,
      summary: {
        total_epcs: epcs.length,
        created,
        updated,
        skipped,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Backfill] Error:', error);
    res.status(500).json({ 
      error: 'Failed to backfill hardware deployments', 
      message: error.message 
    });
  }
});

module.exports = router;


          device_code: device_code.toUpperCase(),
          deployment_type: config?.deployment_type || 'both',
          ip_address: null, // Will be updated on check-in
          management_ip: null
        },
        epc_config: {
          epc_id: epc_id,
          device_code: device_code.toUpperCase(),
          deployment_type: config?.deployment_type || 'both',
          network_config: config?.network_config || {},
          hss_config: config?.hss_config || {},
          snmp_config: config?.snmp_config || {}
        },
        inventory_item_id: inventoryItemId,
        deployedAt: new Date(),
        status: 'deployed'
      });
      
      await hardwareDeployment.save();
      hardwareDeploymentId = hardwareDeployment._id.toString();
      console.log(`[Link Device] Created hardware deployment for EPC ${epc_id} at site ${site_id}`);
    } catch (hwError) {
      console.warn(`[Link Device] Could not create hardware deployment:`, hwError.message);
      // Continue even if hardware deployment creation fails
    }
    
    res.json({
      success: true,
      epc_id,
      site_name: newEPC.site_name,
      device_code: device_code.toUpperCase(),
      inventory_id: inventoryItem?._id?.toString() || null,
      status: 'registered',
      message: `Device code ${device_code} linked successfully! The device will configure automatically when it checks in.`,
      next_steps: [
        'Device will check in automatically every 60 seconds',
        'Once connected, device status will change to "online"',
        'Device will appear in Hardware Inventory and Monitoring'
      ]
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
 * Link device code to existing EPC configuration
 * POST /api/deploy/:epc_id/link-device
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
    const deviceCodePattern = /^[A-Z0-9]{8}$/;
    if (!deviceCodePattern.test(device_code.toUpperCase())) {
      return res.status(400).json({ 
        error: 'Invalid device code format',
        message: 'Device code must be 8 alphanumeric characters'
      });
    }
    
    // Check if device code is already linked to a different EPC
    const existingEPC = await RemoteEPC.findOne({ 
      device_code: device_code.toUpperCase(),
      epc_id: { $ne: epc_id }
    }).lean();
    
    if (existingEPC) {
      return res.status(400).json({ 
        error: 'Device code already in use',
        message: `Device code ${device_code} is already linked to EPC ${existingEPC.epc_id} (${existingEPC.site_name})`
      });
    }
    
    // Find the EPC
    const epc = await RemoteEPC.findOne({ 
      epc_id,
      tenant_id
    });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Link device code to EPC
    epc.device_code = device_code.toUpperCase();
    epc.updated_at = new Date();
    await epc.save();
    
    console.log(`[Link Device] Linked device code ${device_code} to EPC ${epc_id}`);
    
    res.json({
      success: true,
      epc_id,
      device_code: device_code.toUpperCase(),
      site_name: epc.site_name,
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
 * Backfill missing HardwareDeployment records for existing EPCs
 * POST /api/deploy/backfill-hardware-deployments
 * Creates HardwareDeployment records for EPCs that don't have them
 */
router.post('/backfill-hardware-deployments', async (req, res) => {
  try {
    const tenant_id = req.headers['x-tenant-id'] || req.body.tenant_id;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    console.log(`[Backfill] Starting hardware deployment backfill for tenant ${tenant_id}`);
    
    // Get all EPCs for this tenant that have a site_id
    const epcs = await RemoteEPC.find({
      tenant_id: tenant_id,
      site_id: { $exists: true, $ne: null }
    }).lean();
    
    console.log(`[Backfill] Found ${epcs.length} EPCs with site_id for tenant ${tenant_id}`);
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    
    for (const epc of epcs) {
      try {
        // Check if HardwareDeployment already exists
        let hardwareDeployment = await HardwareDeployment.findOne({
          tenantId: tenant_id,
          hardware_type: 'epc',
          'config.epc_id': epc.epc_id
        });
        
        if (hardwareDeployment) {
          // Update siteId if it's different
          const currentSiteId = hardwareDeployment.siteId?.toString();
          const epcSiteId = epc.site_id?.toString();
          
          if (currentSiteId !== epcSiteId) {
            console.log(`[Backfill] Updating HardwareDeployment siteId for EPC ${epc.epc_id} from ${currentSiteId} to ${epcSiteId}`);
            await HardwareDeployment.updateOne(
              { _id: hardwareDeployment._id },
              { $set: { siteId: epc.site_id, updatedAt: new Date() } }
            );
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new HardwareDeployment
          console.log(`[Backfill] Creating HardwareDeployment for EPC ${epc.epc_id} at site ${epc.site_id}`);
          
          hardwareDeployment = new HardwareDeployment({
            siteId: epc.site_id,
            tenantId: tenant_id,
            hardware_type: 'epc',
            name: `${epc.site_name || 'EPC'} - ${epc.device_code || epc.epc_id}`,
            config: {
              epc_id: epc.epc_id,
              device_code: epc.device_code || null,
              deployment_type: epc.deployment_type || 'both',
              ip_address: epc.ip_address || null,
              management_ip: epc.ip_address || null
            },
            epc_config: {
              epc_id: epc.epc_id,
              device_code: epc.device_code || null,
              deployment_type: epc.deployment_type || 'both',
              network_config: epc.network_config || {},
              hss_config: epc.hss_config || {},
              snmp_config: epc.snmp_config || {}
            },
            deployedAt: epc.created_at || new Date(),
            status: 'deployed'
          });
          
          await hardwareDeployment.save();
          created++;
        }
      } catch (error) {
        console.error(`[Backfill] Error processing EPC ${epc.epc_id}:`, error);
        errors.push({
          epc_id: epc.epc_id,
          error: error.message
        });
      }
    }
    
    console.log(`[Backfill] Completed: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} errors`);
    
    res.json({
      success: true,
      summary: {
        total_epcs: epcs.length,
        created,
        updated,
        skipped,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Backfill] Error:', error);
    res.status(500).json({ 
      error: 'Failed to backfill hardware deployments', 
      message: error.message 
    });
  }
});

module.exports = router;


          device_code: device_code.toUpperCase(),
          deployment_type: config?.deployment_type || 'both',
          ip_address: null, // Will be updated on check-in
          management_ip: null
        },
        epc_config: {
          epc_id: epc_id,
          device_code: device_code.toUpperCase(),
          deployment_type: config?.deployment_type || 'both',
          network_config: config?.network_config || {},
          hss_config: config?.hss_config || {},
          snmp_config: config?.snmp_config || {}
        },
        inventory_item_id: inventoryItemId,
        deployedAt: new Date(),
        status: 'deployed'
      });
      
      await hardwareDeployment.save();
      hardwareDeploymentId = hardwareDeployment._id.toString();
      console.log(`[Link Device] Created hardware deployment for EPC ${epc_id} at site ${site_id}`);
    } catch (hwError) {
      console.warn(`[Link Device] Could not create hardware deployment:`, hwError.message);
      // Continue even if hardware deployment creation fails
    }
    
    res.json({
      success: true,
      epc_id,
      site_name: newEPC.site_name,
      device_code: device_code.toUpperCase(),
      inventory_id: inventoryItem?._id?.toString() || null,
      status: 'registered',
      message: `Device code ${device_code} linked successfully! The device will configure automatically when it checks in.`,
      next_steps: [
        'Device will check in automatically every 60 seconds',
        'Once connected, device status will change to "online"',
        'Device will appear in Hardware Inventory and Monitoring'
      ]
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
 * Link device code to existing EPC configuration
 * POST /api/deploy/:epc_id/link-device
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
    const deviceCodePattern = /^[A-Z0-9]{8}$/;
    if (!deviceCodePattern.test(device_code.toUpperCase())) {
      return res.status(400).json({ 
        error: 'Invalid device code format',
        message: 'Device code must be 8 alphanumeric characters'
      });
    }
    
    // Check if device code is already linked to a different EPC
    const existingEPC = await RemoteEPC.findOne({ 
      device_code: device_code.toUpperCase(),
      epc_id: { $ne: epc_id }
    }).lean();
    
    if (existingEPC) {
      return res.status(400).json({ 
        error: 'Device code already in use',
        message: `Device code ${device_code} is already linked to EPC ${existingEPC.epc_id} (${existingEPC.site_name})`
      });
    }
    
    // Find the EPC
    const epc = await RemoteEPC.findOne({ 
      epc_id,
      tenant_id
    });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Link device code to EPC
    epc.device_code = device_code.toUpperCase();
    epc.updated_at = new Date();
    await epc.save();
    
    console.log(`[Link Device] Linked device code ${device_code} to EPC ${epc_id}`);
    
    res.json({
      success: true,
      epc_id,
      device_code: device_code.toUpperCase(),
      site_name: epc.site_name,
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
 * Backfill missing HardwareDeployment records for existing EPCs
 * POST /api/deploy/backfill-hardware-deployments
 * Creates HardwareDeployment records for EPCs that don't have them
 */
router.post('/backfill-hardware-deployments', async (req, res) => {
  try {
    const tenant_id = req.headers['x-tenant-id'] || req.body.tenant_id;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    console.log(`[Backfill] Starting hardware deployment backfill for tenant ${tenant_id}`);
    
    // Get all EPCs for this tenant that have a site_id
    const epcs = await RemoteEPC.find({
      tenant_id: tenant_id,
      site_id: { $exists: true, $ne: null }
    }).lean();
    
    console.log(`[Backfill] Found ${epcs.length} EPCs with site_id for tenant ${tenant_id}`);
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    
    for (const epc of epcs) {
      try {
        // Check if HardwareDeployment already exists
        let hardwareDeployment = await HardwareDeployment.findOne({
          tenantId: tenant_id,
          hardware_type: 'epc',
          'config.epc_id': epc.epc_id
        });
        
        if (hardwareDeployment) {
          // Update siteId if it's different
          const currentSiteId = hardwareDeployment.siteId?.toString();
          const epcSiteId = epc.site_id?.toString();
          
          if (currentSiteId !== epcSiteId) {
            console.log(`[Backfill] Updating HardwareDeployment siteId for EPC ${epc.epc_id} from ${currentSiteId} to ${epcSiteId}`);
            await HardwareDeployment.updateOne(
              { _id: hardwareDeployment._id },
              { $set: { siteId: epc.site_id, updatedAt: new Date() } }
            );
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new HardwareDeployment
          console.log(`[Backfill] Creating HardwareDeployment for EPC ${epc.epc_id} at site ${epc.site_id}`);
          
          hardwareDeployment = new HardwareDeployment({
            siteId: epc.site_id,
            tenantId: tenant_id,
            hardware_type: 'epc',
            name: `${epc.site_name || 'EPC'} - ${epc.device_code || epc.epc_id}`,
            config: {
              epc_id: epc.epc_id,
              device_code: epc.device_code || null,
              deployment_type: epc.deployment_type || 'both',
              ip_address: epc.ip_address || null,
              management_ip: epc.ip_address || null
            },
            epc_config: {
              epc_id: epc.epc_id,
              device_code: epc.device_code || null,
              deployment_type: epc.deployment_type || 'both',
              network_config: epc.network_config || {},
              hss_config: epc.hss_config || {},
              snmp_config: epc.snmp_config || {}
            },
            deployedAt: epc.created_at || new Date(),
            status: 'deployed'
          });
          
          await hardwareDeployment.save();
          created++;
        }
      } catch (error) {
        console.error(`[Backfill] Error processing EPC ${epc.epc_id}:`, error);
        errors.push({
          epc_id: epc.epc_id,
          error: error.message
        });
      }
    }
    
    console.log(`[Backfill] Completed: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} errors`);
    
    res.json({
      success: true,
      summary: {
        total_epcs: epcs.length,
        created,
        updated,
        skipped,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Backfill] Error:', error);
    res.status(500).json({ 
      error: 'Failed to backfill hardware deployments', 
      message: error.message 
    });
  }
});

module.exports = router;

