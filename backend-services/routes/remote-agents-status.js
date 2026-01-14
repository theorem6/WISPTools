/**
 * Remote Agents Status API
 * GET /api/remote-agents/status
 * Lists all remote EPC/SNMP units checking in and their hardware linking status
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC, EPCServiceStatus } = require('../models/distributed-epc-schema');
const { NetworkEquipment, HardwareDeployment } = require('../models/network');
const { InventoryItem } = require('../models/inventory');

// Middleware to extract tenant ID (optional - system-wide queries allowed)
const extractTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  req.tenantId = tenantId || null;
  next();
};

router.use(extractTenant);

/**
 * GET /api/remote-agents/status
 * Get all remote EPC/SNMP units with check-in status and hardware linking info
 * System-wide endpoint - no tenant required. Shows all agents (assigned and unassigned)
 * 
 * Query params:
 * - tenant_id: Filter by specific tenant (optional - if not provided, returns ALL agents)
 * - include_offline: Include offline devices (default: true)
 * - include_unlinked: Include devices not linked to hardware (default: true)
 */
router.get('/status', async (req, res) => {
  try {
    const requestedTenantId = req.query.tenant_id || req.tenantId;
    const includeOffline = req.query.include_offline !== 'false';
    const includeUnlinked = req.query.include_unlinked !== 'false';

    // If tenant_id is provided, filter to that tenant + unassigned
    // If no tenant_id, return ALL agents (system-wide view)
    const isSystemWideQuery = !requestedTenantId;

    console.log(`[Remote Agents Status] ${isSystemWideQuery ? 'System-wide query (all agents)' : `Tenant-specific query: ${requestedTenantId}`}`);

    // Build EPC query - system-wide or tenant-specific
    const epcQuery = {};
    if (isSystemWideQuery) {
      // System-wide: fetch ALL agents (assigned and unassigned)
      // No filter needed - will get everything
    } else {
      // Tenant-specific: fetch agents for this tenant AND unassigned
      epcQuery.$or = [
        { tenant_id: requestedTenantId },
        { tenant_id: { $exists: false } },
        { tenant_id: null },
        { tenant_id: '' }
      ];
    }
    
    if (!includeOffline) {
      if (epcQuery.$or) {
        epcQuery.$and = [{ $or: epcQuery.$or }, { status: { $in: ['online', 'registered'] } }];
        delete epcQuery.$or;
      } else {
        epcQuery.status = { $in: ['online', 'registered'] };
      }
    }

    const epcAgents = await RemoteEPC.find(epcQuery)
      .sort({ last_heartbeat: -1 })
      .lean();

    console.log(`[Remote Agents Status] Found ${epcAgents.length} EPC agents`);

    // Build SNMP query - system-wide or tenant-specific
    const snmpQuery = { discovery_source: 'epc_snmp_agent' };
    if (isSystemWideQuery) {
      // System-wide: fetch ALL devices (assigned and unassigned)
      // No filter needed - will get everything
    } else {
      // Tenant-specific: fetch devices for this tenant AND unassigned
      snmpQuery.$or = [
        { tenantId: requestedTenantId },
        { tenantId: { $exists: false } },
        { tenantId: null },
        { tenantId: '' }
      ];
    }

    const snmpDevices = await NetworkEquipment.find(snmpQuery)
      .sort({ discovered_at: -1 })
      .lean();

    console.log(`[Remote Agents Status] Found ${snmpDevices.length} SNMP discovered devices`);

    // Process EPC agents
    const epcStatusList = await Promise.all(epcAgents.map(async (epc) => {
      // Check if linked to hardware
      let hardwareLink = null;
      let hardwareLinkType = null;

      // Check 1: Has hardware_id field
      if (epc.hardware_id) {
        hardwareLink = epc.hardware_id;
        hardwareLinkType = 'hardware_id';
      }

      // Check 2: Linked to inventory item
      if (!hardwareLink) {
        const inventoryQuery = {
          $or: [
            { 'epcConfig.device_code': epc.device_code },
            { 'epcConfig.epc_id': epc.epc_id },
            { serialNumber: epc.epc_id }
          ]
        };
        // Filter by tenant if agent has a tenant (for efficiency)
        if (epc.tenant_id) {
          inventoryQuery.tenantId = epc.tenant_id;
        }
        const inventoryItem = await InventoryItem.findOne(inventoryQuery).lean();

        if (inventoryItem) {
          hardwareLink = inventoryItem._id.toString();
          hardwareLinkType = 'inventory';
        }
      }

      // Check 3: Linked to hardware deployment
      if (!hardwareLink && epc.site_id) {
        const deploymentQuery = {
          siteId: epc.site_id,
          hardware_type: 'epc'
        };
        // Only filter by tenant if agent has a tenant
        if (epc.tenant_id) {
          deploymentQuery.tenantId = epc.tenant_id;
        }
        const deployment = await HardwareDeployment.findOne(deploymentQuery).lean();

        if (deployment) {
          hardwareLink = deployment._id.toString();
          hardwareLinkType = 'hardware_deployment';
        }
      }

      // Get latest service status
      const serviceStatus = await EPCServiceStatus.findOne({
        epc_id: epc.epc_id
      })
        .sort({ timestamp: -1 })
        .lean();

      // Calculate time since last check-in
      const lastCheckin = epc.last_heartbeat || epc.last_seen;
      const timeSinceCheckin = lastCheckin 
        ? Math.floor((Date.now() - new Date(lastCheckin).getTime()) / 1000)
        : null;

      // Determine check-in status
      let checkinStatus = 'unknown';
      if (!lastCheckin) {
        checkinStatus = 'never';
      } else if (timeSinceCheckin < 300) { // Less than 5 minutes
        checkinStatus = 'active';
      } else if (timeSinceCheckin < 1800) { // Less than 30 minutes
        checkinStatus = 'recent';
      } else if (timeSinceCheckin < 3600) { // Less than 1 hour
        checkinStatus = 'stale';
      } else {
        checkinStatus = 'offline';
      }

      return {
        type: 'epc_agent',
        epc_id: epc.epc_id,
        site_name: epc.site_name,
        device_code: epc.device_code,
        deployment_type: epc.deployment_type || 'both',
        status: epc.status,
        checkin_status: checkinStatus,
        last_checkin: lastCheckin,
        time_since_checkin: timeSinceCheckin,
        ip_address: epc.ip_address,
        hardware_id: epc.hardware_id,
        hardware_linked: !!hardwareLink,
        hardware_link_type: hardwareLinkType,
        hardware_link_id: hardwareLink,
        site_id: epc.site_id,
        tenant_id: epc.tenant_id || null,
        location: epc.location,
        version: epc.version,
        metrics: {
          system_uptime_seconds: serviceStatus?.system?.uptime_seconds || epc.metrics?.system_uptime_seconds,
          cpu_percent: serviceStatus?.system?.cpu_percent,
          memory_percent: serviceStatus?.system?.memory_percent
        },
        created_at: epc.created_at,
        updated_at: epc.updated_at
      };
    }));

    // Process SNMP discovered devices
    const snmpStatusList = await Promise.all(snmpDevices.map(async (device) => {
      // Check if linked to hardware
      let hardwareLink = null;
      let hardwareLinkType = null;

      // Check 1: Has siteId (linked to site)
      if (device.siteId) {
        hardwareLink = device.siteId.toString();
        hardwareLinkType = 'site';
      }

      // Check 2: Linked to hardware deployment via notes
      if (!hardwareLink && device.notes) {
        try {
          const notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
          if (notes.deploymentId) {
            const deploymentQuery = { _id: notes.deploymentId };
            // Only filter by tenant if device has a tenant
            if (device.tenantId) {
              deploymentQuery.tenantId = device.tenantId;
            }
            const deployment = await HardwareDeployment.findOne(deploymentQuery).lean();

            if (deployment) {
              hardwareLink = deployment._id.toString();
              hardwareLinkType = 'hardware_deployment';
            }
          }
        } catch (e) {
          // Notes not JSON, ignore
        }
      }

      // Check 3: Check by IP/MAC matching inventory
      if (!hardwareLink && device.ip_address) {
        const inventoryQuery = {
          $or: [
            { 'networkConfig.management_ip': device.ip_address },
            { 'networkConfig.mac_address': device.mac_address }
          ]
        };
        // Only filter by tenant if device has a tenant
        if (device.tenantId) {
          inventoryQuery.tenantId = device.tenantId;
        }
        const inventoryItem = await InventoryItem.findOne(inventoryQuery).lean();

        if (inventoryItem) {
          hardwareLink = inventoryItem._id.toString();
          hardwareLinkType = 'inventory';
        }
      }

      // Get discovering EPC info
      let discoveringEPC = null;
      if (device.discovered_by_epc) {
        const epcQuery = { epc_id: device.discovered_by_epc };
        // Only filter by tenant if device has a tenant
        if (device.tenantId) {
          epcQuery.tenant_id = device.tenantId;
        }
        const epc = await RemoteEPC.findOne(epcQuery).select('epc_id site_name device_code').lean();

        if (epc) {
          discoveringEPC = {
            epc_id: epc.epc_id,
            site_name: epc.site_name,
            device_code: epc.device_code
          };
        }
      }

      // Calculate time since discovery
      const discoveredAt = device.discovered_at || device.createdAt;
      const timeSinceDiscovery = discoveredAt
        ? Math.floor((Date.now() - new Date(discoveredAt).getTime()) / 1000)
        : null;

      return {
        type: 'snmp_device',
        device_id: device._id.toString(),
        name: device.name || device.sysName || device.ip_address,
        ip_address: device.ip_address,
        mac_address: device.mac_address,
        device_type: device.device_type,
        manufacturer: device.manufacturer,
        model: device.model,
        status: device.status || 'discovered',
        hardware_linked: !!hardwareLink,
        hardware_link_type: hardwareLinkType,
        hardware_link_id: hardwareLink,
        site_id: device.siteId?.toString(),
        tenant_id: device.tenantId || null,
        discovered_at: discoveredAt,
        time_since_discovery: timeSinceDiscovery,
        discovered_by_epc: discoveringEPC,
        snmp_config: {
          community: device.snmp_community,
          version: device.snmp_version,
          enabled: device.enable_graphs || false
        },
        created_at: device.createdAt,
        updated_at: device.updatedAt
      };
    }));

    // Filter unlinked if requested
    let allAgents = [...epcStatusList, ...snmpStatusList];
    if (!includeUnlinked) {
      allAgents = allAgents.filter(agent => agent.hardware_linked);
    }

    // Summary statistics
    const summary = {
      total_agents: allAgents.length,
      epc_agents: epcStatusList.length,
      snmp_devices: snmpStatusList.length,
      linked_count: allAgents.filter(a => a.hardware_linked).length,
      unlinked_count: allAgents.filter(a => !a.hardware_linked).length,
      active_checkins: epcStatusList.filter(e => e.checkin_status === 'active').length,
      offline_checkins: epcStatusList.filter(e => e.checkin_status === 'offline').length,
      by_link_type: {
        hardware_id: epcStatusList.filter(e => e.hardware_link_type === 'hardware_id').length,
        inventory: allAgents.filter(a => a.hardware_link_type === 'inventory').length,
        hardware_deployment: allAgents.filter(a => a.hardware_link_type === 'hardware_deployment').length,
        site: snmpStatusList.filter(s => s.hardware_link_type === 'site').length
      }
    };

    res.json({
      success: true,
      summary,
      agents: allAgents,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Remote Agents Status] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch remote agents status', 
      message: error.message 
    });
  }
});

/**
 * GET /api/remote-agents/status/unlinked
 * Get only unlinked agents (convenience endpoint)
 */
router.get('/status/unlinked', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    // Get all EPC agents
    const epcAgents = await RemoteEPC.find({ tenant_id: tenantId }).lean();
    
    // Get all SNMP discovered devices
    const snmpDevices = await NetworkEquipment.find({
      tenantId: tenantId,
      discovery_source: 'epc_snmp_agent'
    }).lean();

    // Process and filter to only unlinked
    const unlinkedAgents = [];
    
    // Check EPC agents
    for (const epc of epcAgents) {
      let hardwareLinked = false;
      
      if (epc.hardware_id) hardwareLinked = true;
      
      if (!hardwareLinked) {
        const inventoryItem = await InventoryItem.findOne({
          tenantId: tenantId,
          $or: [
            { 'epcConfig.device_code': epc.device_code },
            { 'epcConfig.epc_id': epc.epc_id }
          ]
        }).lean();
        if (inventoryItem) hardwareLinked = true;
      }
      
      if (!hardwareLinked) {
        unlinkedAgents.push({
          type: 'epc_agent',
          epc_id: epc.epc_id,
          site_name: epc.site_name,
          device_code: epc.device_code,
          status: epc.status,
          last_checkin: epc.last_heartbeat || epc.last_seen
        });
      }
    }
    
    // Check SNMP devices
    for (const device of snmpDevices) {
      let hardwareLinked = false;
      
      if (device.siteId) hardwareLinked = true;
      
      if (!hardwareLinked && device.notes) {
        try {
          const notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
          if (notes.deploymentId) hardwareLinked = true;
        } catch (e) {}
      }
      
      if (!hardwareLinked) {
        unlinkedAgents.push({
          type: 'snmp_device',
          device_id: device._id.toString(),
          name: device.name || device.ip_address,
          ip_address: device.ip_address,
          discovered_at: device.discovered_at || device.createdAt
        });
      }
    }

    res.json({
      success: true,
      count: unlinkedAgents.length,
      agents: unlinkedAgents,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Remote Agents Status] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unlinked agents', 
      message: error.message 
    });
  }
});

module.exports = router;

/**
 * Remote Agents Status API
 * GET /api/remote-agents/status
 * Lists all remote EPC/SNMP units checking in and their hardware linking status
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC, EPCServiceStatus } = require('../models/distributed-epc-schema');
const { NetworkEquipment, HardwareDeployment } = require('../models/network');
const { InventoryItem } = require('../models/inventory');

// Middleware to extract tenant ID (optional - system-wide queries allowed)
const extractTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  req.tenantId = tenantId || null;
  next();
};

router.use(extractTenant);

/**
 * GET /api/remote-agents/status
 * Get all remote EPC/SNMP units with check-in status and hardware linking info
 * System-wide endpoint - no tenant required. Shows all agents (assigned and unassigned)
 * 
 * Query params:
 * - tenant_id: Filter by specific tenant (optional - if not provided, returns ALL agents)
 * - include_offline: Include offline devices (default: true)
 * - include_unlinked: Include devices not linked to hardware (default: true)
 */
router.get('/status', async (req, res) => {
  try {
    const requestedTenantId = req.query.tenant_id || req.tenantId;
    const includeOffline = req.query.include_offline !== 'false';
    const includeUnlinked = req.query.include_unlinked !== 'false';

    // If tenant_id is provided, filter to that tenant + unassigned
    // If no tenant_id, return ALL agents (system-wide view)
    const isSystemWideQuery = !requestedTenantId;

    console.log(`[Remote Agents Status] ${isSystemWideQuery ? 'System-wide query (all agents)' : `Tenant-specific query: ${requestedTenantId}`}`);

    // Build EPC query - system-wide or tenant-specific
    const epcQuery = {};
    if (isSystemWideQuery) {
      // System-wide: fetch ALL agents (assigned and unassigned)
      // No filter needed - will get everything
    } else {
      // Tenant-specific: fetch agents for this tenant AND unassigned
      epcQuery.$or = [
        { tenant_id: requestedTenantId },
        { tenant_id: { $exists: false } },
        { tenant_id: null },
        { tenant_id: '' }
      ];
    }
    
    if (!includeOffline) {
      if (epcQuery.$or) {
        epcQuery.$and = [{ $or: epcQuery.$or }, { status: { $in: ['online', 'registered'] } }];
        delete epcQuery.$or;
      } else {
        epcQuery.status = { $in: ['online', 'registered'] };
      }
    }

    const epcAgents = await RemoteEPC.find(epcQuery)
      .sort({ last_heartbeat: -1 })
      .lean();

    console.log(`[Remote Agents Status] Found ${epcAgents.length} EPC agents`);

    // Build SNMP query - system-wide or tenant-specific
    const snmpQuery = { discovery_source: 'epc_snmp_agent' };
    if (isSystemWideQuery) {
      // System-wide: fetch ALL devices (assigned and unassigned)
      // No filter needed - will get everything
    } else {
      // Tenant-specific: fetch devices for this tenant AND unassigned
      snmpQuery.$or = [
        { tenantId: requestedTenantId },
        { tenantId: { $exists: false } },
        { tenantId: null },
        { tenantId: '' }
      ];
    }

    const snmpDevices = await NetworkEquipment.find(snmpQuery)
      .sort({ discovered_at: -1 })
      .lean();

    console.log(`[Remote Agents Status] Found ${snmpDevices.length} SNMP discovered devices`);

    // Process EPC agents
    const epcStatusList = await Promise.all(epcAgents.map(async (epc) => {
      // Check if linked to hardware
      let hardwareLink = null;
      let hardwareLinkType = null;

      // Check 1: Has hardware_id field
      if (epc.hardware_id) {
        hardwareLink = epc.hardware_id;
        hardwareLinkType = 'hardware_id';
      }

      // Check 2: Linked to inventory item
      if (!hardwareLink) {
        const inventoryQuery = {
          $or: [
            { 'epcConfig.device_code': epc.device_code },
            { 'epcConfig.epc_id': epc.epc_id },
            { serialNumber: epc.epc_id }
          ]
        };
        // Filter by tenant if agent has a tenant (for efficiency)
        if (epc.tenant_id) {
          inventoryQuery.tenantId = epc.tenant_id;
        }
        const inventoryItem = await InventoryItem.findOne(inventoryQuery).lean();

        if (inventoryItem) {
          hardwareLink = inventoryItem._id.toString();
          hardwareLinkType = 'inventory';
        }
      }

      // Check 3: Linked to hardware deployment
      if (!hardwareLink && epc.site_id) {
        const deploymentQuery = {
          siteId: epc.site_id,
          hardware_type: 'epc'
        };
        // Only filter by tenant if agent has a tenant
        if (epc.tenant_id) {
          deploymentQuery.tenantId = epc.tenant_id;
        }
        const deployment = await HardwareDeployment.findOne(deploymentQuery).lean();

        if (deployment) {
          hardwareLink = deployment._id.toString();
          hardwareLinkType = 'hardware_deployment';
        }
      }

      // Get latest service status
      const serviceStatus = await EPCServiceStatus.findOne({
        epc_id: epc.epc_id
      })
        .sort({ timestamp: -1 })
        .lean();

      // Calculate time since last check-in
      const lastCheckin = epc.last_heartbeat || epc.last_seen;
      const timeSinceCheckin = lastCheckin 
        ? Math.floor((Date.now() - new Date(lastCheckin).getTime()) / 1000)
        : null;

      // Determine check-in status
      let checkinStatus = 'unknown';
      if (!lastCheckin) {
        checkinStatus = 'never';
      } else if (timeSinceCheckin < 300) { // Less than 5 minutes
        checkinStatus = 'active';
      } else if (timeSinceCheckin < 1800) { // Less than 30 minutes
        checkinStatus = 'recent';
      } else if (timeSinceCheckin < 3600) { // Less than 1 hour
        checkinStatus = 'stale';
      } else {
        checkinStatus = 'offline';
      }

      return {
        type: 'epc_agent',
        epc_id: epc.epc_id,
        site_name: epc.site_name,
        device_code: epc.device_code,
        deployment_type: epc.deployment_type || 'both',
        status: epc.status,
        checkin_status: checkinStatus,
        last_checkin: lastCheckin,
        time_since_checkin: timeSinceCheckin,
        ip_address: epc.ip_address,
        hardware_id: epc.hardware_id,
        hardware_linked: !!hardwareLink,
        hardware_link_type: hardwareLinkType,
        hardware_link_id: hardwareLink,
        site_id: epc.site_id,
        tenant_id: epc.tenant_id || null,
        location: epc.location,
        version: epc.version,
        metrics: {
          system_uptime_seconds: serviceStatus?.system?.uptime_seconds || epc.metrics?.system_uptime_seconds,
          cpu_percent: serviceStatus?.system?.cpu_percent,
          memory_percent: serviceStatus?.system?.memory_percent
        },
        created_at: epc.created_at,
        updated_at: epc.updated_at
      };
    }));

    // Process SNMP discovered devices
    const snmpStatusList = await Promise.all(snmpDevices.map(async (device) => {
      // Check if linked to hardware
      let hardwareLink = null;
      let hardwareLinkType = null;

      // Check 1: Has siteId (linked to site)
      if (device.siteId) {
        hardwareLink = device.siteId.toString();
        hardwareLinkType = 'site';
      }

      // Check 2: Linked to hardware deployment via notes
      if (!hardwareLink && device.notes) {
        try {
          const notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
          if (notes.deploymentId) {
            const deploymentQuery = { _id: notes.deploymentId };
            // Only filter by tenant if device has a tenant
            if (device.tenantId) {
              deploymentQuery.tenantId = device.tenantId;
            }
            const deployment = await HardwareDeployment.findOne(deploymentQuery).lean();

            if (deployment) {
              hardwareLink = deployment._id.toString();
              hardwareLinkType = 'hardware_deployment';
            }
          }
        } catch (e) {
          // Notes not JSON, ignore
        }
      }

      // Check 3: Check by IP/MAC matching inventory
      if (!hardwareLink && device.ip_address) {
        const inventoryQuery = {
          $or: [
            { 'networkConfig.management_ip': device.ip_address },
            { 'networkConfig.mac_address': device.mac_address }
          ]
        };
        // Only filter by tenant if device has a tenant
        if (device.tenantId) {
          inventoryQuery.tenantId = device.tenantId;
        }
        const inventoryItem = await InventoryItem.findOne(inventoryQuery).lean();

        if (inventoryItem) {
          hardwareLink = inventoryItem._id.toString();
          hardwareLinkType = 'inventory';
        }
      }

      // Get discovering EPC info
      let discoveringEPC = null;
      if (device.discovered_by_epc) {
        const epcQuery = { epc_id: device.discovered_by_epc };
        // Only filter by tenant if device has a tenant
        if (device.tenantId) {
          epcQuery.tenant_id = device.tenantId;
        }
        const epc = await RemoteEPC.findOne(epcQuery).select('epc_id site_name device_code').lean();

        if (epc) {
          discoveringEPC = {
            epc_id: epc.epc_id,
            site_name: epc.site_name,
            device_code: epc.device_code
          };
        }
      }

      // Calculate time since discovery
      const discoveredAt = device.discovered_at || device.createdAt;
      const timeSinceDiscovery = discoveredAt
        ? Math.floor((Date.now() - new Date(discoveredAt).getTime()) / 1000)
        : null;

      return {
        type: 'snmp_device',
        device_id: device._id.toString(),
        name: device.name || device.sysName || device.ip_address,
        ip_address: device.ip_address,
        mac_address: device.mac_address,
        device_type: device.device_type,
        manufacturer: device.manufacturer,
        model: device.model,
        status: device.status || 'discovered',
        hardware_linked: !!hardwareLink,
        hardware_link_type: hardwareLinkType,
        hardware_link_id: hardwareLink,
        site_id: device.siteId?.toString(),
        tenant_id: device.tenantId || null,
        discovered_at: discoveredAt,
        time_since_discovery: timeSinceDiscovery,
        discovered_by_epc: discoveringEPC,
        snmp_config: {
          community: device.snmp_community,
          version: device.snmp_version,
          enabled: device.enable_graphs || false
        },
        created_at: device.createdAt,
        updated_at: device.updatedAt
      };
    }));

    // Filter unlinked if requested
    let allAgents = [...epcStatusList, ...snmpStatusList];
    if (!includeUnlinked) {
      allAgents = allAgents.filter(agent => agent.hardware_linked);
    }

    // Summary statistics
    const summary = {
      total_agents: allAgents.length,
      epc_agents: epcStatusList.length,
      snmp_devices: snmpStatusList.length,
      linked_count: allAgents.filter(a => a.hardware_linked).length,
      unlinked_count: allAgents.filter(a => !a.hardware_linked).length,
      active_checkins: epcStatusList.filter(e => e.checkin_status === 'active').length,
      offline_checkins: epcStatusList.filter(e => e.checkin_status === 'offline').length,
      by_link_type: {
        hardware_id: epcStatusList.filter(e => e.hardware_link_type === 'hardware_id').length,
        inventory: allAgents.filter(a => a.hardware_link_type === 'inventory').length,
        hardware_deployment: allAgents.filter(a => a.hardware_link_type === 'hardware_deployment').length,
        site: snmpStatusList.filter(s => s.hardware_link_type === 'site').length
      }
    };

    res.json({
      success: true,
      summary,
      agents: allAgents,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Remote Agents Status] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch remote agents status', 
      message: error.message 
    });
  }
});

/**
 * GET /api/remote-agents/status/unlinked
 * Get only unlinked agents (convenience endpoint)
 */
router.get('/status/unlinked', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    // Get all EPC agents
    const epcAgents = await RemoteEPC.find({ tenant_id: tenantId }).lean();
    
    // Get all SNMP discovered devices
    const snmpDevices = await NetworkEquipment.find({
      tenantId: tenantId,
      discovery_source: 'epc_snmp_agent'
    }).lean();

    // Process and filter to only unlinked
    const unlinkedAgents = [];
    
    // Check EPC agents
    for (const epc of epcAgents) {
      let hardwareLinked = false;
      
      if (epc.hardware_id) hardwareLinked = true;
      
      if (!hardwareLinked) {
        const inventoryItem = await InventoryItem.findOne({
          tenantId: tenantId,
          $or: [
            { 'epcConfig.device_code': epc.device_code },
            { 'epcConfig.epc_id': epc.epc_id }
          ]
        }).lean();
        if (inventoryItem) hardwareLinked = true;
      }
      
      if (!hardwareLinked) {
        unlinkedAgents.push({
          type: 'epc_agent',
          epc_id: epc.epc_id,
          site_name: epc.site_name,
          device_code: epc.device_code,
          status: epc.status,
          last_checkin: epc.last_heartbeat || epc.last_seen
        });
      }
    }
    
    // Check SNMP devices
    for (const device of snmpDevices) {
      let hardwareLinked = false;
      
      if (device.siteId) hardwareLinked = true;
      
      if (!hardwareLinked && device.notes) {
        try {
          const notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
          if (notes.deploymentId) hardwareLinked = true;
        } catch (e) {}
      }
      
      if (!hardwareLinked) {
        unlinkedAgents.push({
          type: 'snmp_device',
          device_id: device._id.toString(),
          name: device.name || device.ip_address,
          ip_address: device.ip_address,
          discovered_at: device.discovered_at || device.createdAt
        });
      }
    }

    res.json({
      success: true,
      count: unlinkedAgents.length,
      agents: unlinkedAgents,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Remote Agents Status] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unlinked agents', 
      message: error.message 
    });
  }
});

module.exports = router;

/**
 * Remote Agents Status API
 * GET /api/remote-agents/status
 * Lists all remote EPC/SNMP units checking in and their hardware linking status
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC, EPCServiceStatus } = require('../models/distributed-epc-schema');
const { NetworkEquipment, HardwareDeployment } = require('../models/network');
const { InventoryItem } = require('../models/inventory');

// Middleware to extract tenant ID (optional - system-wide queries allowed)
const extractTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  req.tenantId = tenantId || null;
  next();
};

router.use(extractTenant);

/**
 * GET /api/remote-agents/status
 * Get all remote EPC/SNMP units with check-in status and hardware linking info
 * System-wide endpoint - no tenant required. Shows all agents (assigned and unassigned)
 * 
 * Query params:
 * - tenant_id: Filter by specific tenant (optional - if not provided, returns ALL agents)
 * - include_offline: Include offline devices (default: true)
 * - include_unlinked: Include devices not linked to hardware (default: true)
 */
router.get('/status', async (req, res) => {
  try {
    const requestedTenantId = req.query.tenant_id || req.tenantId;
    const includeOffline = req.query.include_offline !== 'false';
    const includeUnlinked = req.query.include_unlinked !== 'false';

    // If tenant_id is provided, filter to that tenant + unassigned
    // If no tenant_id, return ALL agents (system-wide view)
    const isSystemWideQuery = !requestedTenantId;

    console.log(`[Remote Agents Status] ${isSystemWideQuery ? 'System-wide query (all agents)' : `Tenant-specific query: ${requestedTenantId}`}`);

    // Build EPC query - system-wide or tenant-specific
    const epcQuery = {};
    if (isSystemWideQuery) {
      // System-wide: fetch ALL agents (assigned and unassigned)
      // No filter needed - will get everything
    } else {
      // Tenant-specific: fetch agents for this tenant AND unassigned
      epcQuery.$or = [
        { tenant_id: requestedTenantId },
        { tenant_id: { $exists: false } },
        { tenant_id: null },
        { tenant_id: '' }
      ];
    }
    
    if (!includeOffline) {
      if (epcQuery.$or) {
        epcQuery.$and = [{ $or: epcQuery.$or }, { status: { $in: ['online', 'registered'] } }];
        delete epcQuery.$or;
      } else {
        epcQuery.status = { $in: ['online', 'registered'] };
      }
    }

    const epcAgents = await RemoteEPC.find(epcQuery)
      .sort({ last_heartbeat: -1 })
      .lean();

    console.log(`[Remote Agents Status] Found ${epcAgents.length} EPC agents`);

    // Build SNMP query - system-wide or tenant-specific
    const snmpQuery = { discovery_source: 'epc_snmp_agent' };
    if (isSystemWideQuery) {
      // System-wide: fetch ALL devices (assigned and unassigned)
      // No filter needed - will get everything
    } else {
      // Tenant-specific: fetch devices for this tenant AND unassigned
      snmpQuery.$or = [
        { tenantId: requestedTenantId },
        { tenantId: { $exists: false } },
        { tenantId: null },
        { tenantId: '' }
      ];
    }

    const snmpDevices = await NetworkEquipment.find(snmpQuery)
      .sort({ discovered_at: -1 })
      .lean();

    console.log(`[Remote Agents Status] Found ${snmpDevices.length} SNMP discovered devices`);

    // Process EPC agents
    const epcStatusList = await Promise.all(epcAgents.map(async (epc) => {
      // Check if linked to hardware
      let hardwareLink = null;
      let hardwareLinkType = null;

      // Check 1: Has hardware_id field
      if (epc.hardware_id) {
        hardwareLink = epc.hardware_id;
        hardwareLinkType = 'hardware_id';
      }

      // Check 2: Linked to inventory item
      if (!hardwareLink) {
        const inventoryQuery = {
          $or: [
            { 'epcConfig.device_code': epc.device_code },
            { 'epcConfig.epc_id': epc.epc_id },
            { serialNumber: epc.epc_id }
          ]
        };
        // Filter by tenant if agent has a tenant (for efficiency)
        if (epc.tenant_id) {
          inventoryQuery.tenantId = epc.tenant_id;
        }
        const inventoryItem = await InventoryItem.findOne(inventoryQuery).lean();

        if (inventoryItem) {
          hardwareLink = inventoryItem._id.toString();
          hardwareLinkType = 'inventory';
        }
      }

      // Check 3: Linked to hardware deployment
      if (!hardwareLink && epc.site_id) {
        const deploymentQuery = {
          siteId: epc.site_id,
          hardware_type: 'epc'
        };
        // Only filter by tenant if agent has a tenant
        if (epc.tenant_id) {
          deploymentQuery.tenantId = epc.tenant_id;
        }
        const deployment = await HardwareDeployment.findOne(deploymentQuery).lean();

        if (deployment) {
          hardwareLink = deployment._id.toString();
          hardwareLinkType = 'hardware_deployment';
        }
      }

      // Get latest service status
      const serviceStatus = await EPCServiceStatus.findOne({
        epc_id: epc.epc_id
      })
        .sort({ timestamp: -1 })
        .lean();

      // Calculate time since last check-in
      const lastCheckin = epc.last_heartbeat || epc.last_seen;
      const timeSinceCheckin = lastCheckin 
        ? Math.floor((Date.now() - new Date(lastCheckin).getTime()) / 1000)
        : null;

      // Determine check-in status
      let checkinStatus = 'unknown';
      if (!lastCheckin) {
        checkinStatus = 'never';
      } else if (timeSinceCheckin < 300) { // Less than 5 minutes
        checkinStatus = 'active';
      } else if (timeSinceCheckin < 1800) { // Less than 30 minutes
        checkinStatus = 'recent';
      } else if (timeSinceCheckin < 3600) { // Less than 1 hour
        checkinStatus = 'stale';
      } else {
        checkinStatus = 'offline';
      }

      return {
        type: 'epc_agent',
        epc_id: epc.epc_id,
        site_name: epc.site_name,
        device_code: epc.device_code,
        deployment_type: epc.deployment_type || 'both',
        status: epc.status,
        checkin_status: checkinStatus,
        last_checkin: lastCheckin,
        time_since_checkin: timeSinceCheckin,
        ip_address: epc.ip_address,
        hardware_id: epc.hardware_id,
        hardware_linked: !!hardwareLink,
        hardware_link_type: hardwareLinkType,
        hardware_link_id: hardwareLink,
        site_id: epc.site_id,
        tenant_id: epc.tenant_id || null,
        location: epc.location,
        version: epc.version,
        metrics: {
          system_uptime_seconds: serviceStatus?.system?.uptime_seconds || epc.metrics?.system_uptime_seconds,
          cpu_percent: serviceStatus?.system?.cpu_percent,
          memory_percent: serviceStatus?.system?.memory_percent
        },
        created_at: epc.created_at,
        updated_at: epc.updated_at
      };
    }));

    // Process SNMP discovered devices
    const snmpStatusList = await Promise.all(snmpDevices.map(async (device) => {
      // Check if linked to hardware
      let hardwareLink = null;
      let hardwareLinkType = null;

      // Check 1: Has siteId (linked to site)
      if (device.siteId) {
        hardwareLink = device.siteId.toString();
        hardwareLinkType = 'site';
      }

      // Check 2: Linked to hardware deployment via notes
      if (!hardwareLink && device.notes) {
        try {
          const notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
          if (notes.deploymentId) {
            const deploymentQuery = { _id: notes.deploymentId };
            // Only filter by tenant if device has a tenant
            if (device.tenantId) {
              deploymentQuery.tenantId = device.tenantId;
            }
            const deployment = await HardwareDeployment.findOne(deploymentQuery).lean();

            if (deployment) {
              hardwareLink = deployment._id.toString();
              hardwareLinkType = 'hardware_deployment';
            }
          }
        } catch (e) {
          // Notes not JSON, ignore
        }
      }

      // Check 3: Check by IP/MAC matching inventory
      if (!hardwareLink && device.ip_address) {
        const inventoryQuery = {
          $or: [
            { 'networkConfig.management_ip': device.ip_address },
            { 'networkConfig.mac_address': device.mac_address }
          ]
        };
        // Only filter by tenant if device has a tenant
        if (device.tenantId) {
          inventoryQuery.tenantId = device.tenantId;
        }
        const inventoryItem = await InventoryItem.findOne(inventoryQuery).lean();

        if (inventoryItem) {
          hardwareLink = inventoryItem._id.toString();
          hardwareLinkType = 'inventory';
        }
      }

      // Get discovering EPC info
      let discoveringEPC = null;
      if (device.discovered_by_epc) {
        const epcQuery = { epc_id: device.discovered_by_epc };
        // Only filter by tenant if device has a tenant
        if (device.tenantId) {
          epcQuery.tenant_id = device.tenantId;
        }
        const epc = await RemoteEPC.findOne(epcQuery).select('epc_id site_name device_code').lean();

        if (epc) {
          discoveringEPC = {
            epc_id: epc.epc_id,
            site_name: epc.site_name,
            device_code: epc.device_code
          };
        }
      }

      // Calculate time since discovery
      const discoveredAt = device.discovered_at || device.createdAt;
      const timeSinceDiscovery = discoveredAt
        ? Math.floor((Date.now() - new Date(discoveredAt).getTime()) / 1000)
        : null;

      return {
        type: 'snmp_device',
        device_id: device._id.toString(),
        name: device.name || device.sysName || device.ip_address,
        ip_address: device.ip_address,
        mac_address: device.mac_address,
        device_type: device.device_type,
        manufacturer: device.manufacturer,
        model: device.model,
        status: device.status || 'discovered',
        hardware_linked: !!hardwareLink,
        hardware_link_type: hardwareLinkType,
        hardware_link_id: hardwareLink,
        site_id: device.siteId?.toString(),
        tenant_id: device.tenantId || null,
        discovered_at: discoveredAt,
        time_since_discovery: timeSinceDiscovery,
        discovered_by_epc: discoveringEPC,
        snmp_config: {
          community: device.snmp_community,
          version: device.snmp_version,
          enabled: device.enable_graphs || false
        },
        created_at: device.createdAt,
        updated_at: device.updatedAt
      };
    }));

    // Filter unlinked if requested
    let allAgents = [...epcStatusList, ...snmpStatusList];
    if (!includeUnlinked) {
      allAgents = allAgents.filter(agent => agent.hardware_linked);
    }

    // Summary statistics
    const summary = {
      total_agents: allAgents.length,
      epc_agents: epcStatusList.length,
      snmp_devices: snmpStatusList.length,
      linked_count: allAgents.filter(a => a.hardware_linked).length,
      unlinked_count: allAgents.filter(a => !a.hardware_linked).length,
      active_checkins: epcStatusList.filter(e => e.checkin_status === 'active').length,
      offline_checkins: epcStatusList.filter(e => e.checkin_status === 'offline').length,
      by_link_type: {
        hardware_id: epcStatusList.filter(e => e.hardware_link_type === 'hardware_id').length,
        inventory: allAgents.filter(a => a.hardware_link_type === 'inventory').length,
        hardware_deployment: allAgents.filter(a => a.hardware_link_type === 'hardware_deployment').length,
        site: snmpStatusList.filter(s => s.hardware_link_type === 'site').length
      }
    };

    res.json({
      success: true,
      summary,
      agents: allAgents,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Remote Agents Status] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch remote agents status', 
      message: error.message 
    });
  }
});

/**
 * GET /api/remote-agents/status/unlinked
 * Get only unlinked agents (convenience endpoint)
 */
router.get('/status/unlinked', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    // Get all EPC agents
    const epcAgents = await RemoteEPC.find({ tenant_id: tenantId }).lean();
    
    // Get all SNMP discovered devices
    const snmpDevices = await NetworkEquipment.find({
      tenantId: tenantId,
      discovery_source: 'epc_snmp_agent'
    }).lean();

    // Process and filter to only unlinked
    const unlinkedAgents = [];
    
    // Check EPC agents
    for (const epc of epcAgents) {
      let hardwareLinked = false;
      
      if (epc.hardware_id) hardwareLinked = true;
      
      if (!hardwareLinked) {
        const inventoryItem = await InventoryItem.findOne({
          tenantId: tenantId,
          $or: [
            { 'epcConfig.device_code': epc.device_code },
            { 'epcConfig.epc_id': epc.epc_id }
          ]
        }).lean();
        if (inventoryItem) hardwareLinked = true;
      }
      
      if (!hardwareLinked) {
        unlinkedAgents.push({
          type: 'epc_agent',
          epc_id: epc.epc_id,
          site_name: epc.site_name,
          device_code: epc.device_code,
          status: epc.status,
          last_checkin: epc.last_heartbeat || epc.last_seen
        });
      }
    }
    
    // Check SNMP devices
    for (const device of snmpDevices) {
      let hardwareLinked = false;
      
      if (device.siteId) hardwareLinked = true;
      
      if (!hardwareLinked && device.notes) {
        try {
          const notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
          if (notes.deploymentId) hardwareLinked = true;
        } catch (e) {}
      }
      
      if (!hardwareLinked) {
        unlinkedAgents.push({
          type: 'snmp_device',
          device_id: device._id.toString(),
          name: device.name || device.ip_address,
          ip_address: device.ip_address,
          discovered_at: device.discovered_at || device.createdAt
        });
      }
    }

    res.json({
      success: true,
      count: unlinkedAgents.length,
      agents: unlinkedAgents,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Remote Agents Status] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unlinked agents', 
      message: error.message 
    });
  }
});

module.exports = router;







