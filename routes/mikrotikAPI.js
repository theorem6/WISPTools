/**
 * Mikrotik RouterOS API Management
 * Handles Mikrotik device configuration, monitoring, and management
 */

const express = require('express');
const mikrotikManager = require('../services/mikrotikManager');
const snmpCollector = require('../services/snmpCollector');
const mikrotikOIDs = require('../config/mikrotikOIDs');

const router = express.Router();

/**
 * Register Mikrotik device for management
 * POST /api/mikrotik/register-device
 */
router.post('/register-device', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const deviceConfig = {
      ...req.body,
      tenantId
    };

    const result = await mikrotikManager.registerDevice(deviceConfig);
    
    res.json({
      success: true,
      message: 'Mikrotik device registered successfully',
      device: result
    });
  } catch (error) {
    console.error('[Mikrotik API] Failed to register device:', error);
    res.status(500).json({ error: 'Failed to register device', details: error.message });
  }
});

/**
 * Register Mikrotik device for SNMP monitoring
 * POST /api/mikrotik/register-snmp
 */
router.post('/register-snmp', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { deviceType = 'router', customOids = [] } = req.body;
    
    // Get appropriate OID set based on device type
    let oids = mikrotikOIDs.getDefaultMikrotikOIDs();
    
    if (deviceType === 'ap' || deviceType === 'cpe') {
      oids = [...oids, ...mikrotikOIDs.getWirelessOIDs()];
    }
    
    if (deviceType === 'lte') {
      oids = [...oids, ...mikrotikOIDs.getLTEOIDs()];
    }
    
    // Add custom OIDs if provided
    if (customOids.length > 0) {
      oids = [...oids, ...customOids];
    }

    const snmpConfig = {
      ...req.body,
      tenantId,
      oids
    };

    const result = await snmpCollector.registerDevice(snmpConfig);
    
    res.json({
      success: true,
      message: 'Mikrotik SNMP monitoring registered successfully',
      deviceId: result.deviceId,
      oidsCount: oids.length
    });
  } catch (error) {
    console.error('[Mikrotik API] Failed to register SNMP:', error);
    res.status(500).json({ error: 'Failed to register SNMP monitoring', details: error.message });
  }
});

/**
 * Get Mikrotik device status
 * GET /api/mikrotik/devices/:deviceId
 */
router.get('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = mikrotikManager.getDeviceStatus(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json(device);
  } catch (error) {
    console.error('[Mikrotik API] Failed to get device status:', error);
    res.status(500).json({ error: 'Failed to get device status' });
  }
});

/**
 * Get all Mikrotik devices for tenant
 * GET /api/mikrotik/devices
 */
router.get('/devices', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const devices = mikrotikManager.getTenantDevices(tenantId);
    res.json({ devices });
  } catch (error) {
    console.error('[Mikrotik API] Failed to get devices:', error);
    res.status(500).json({ error: 'Failed to get devices' });
  }
});

/**
 * Execute RouterOS command on device
 * POST /api/mikrotik/devices/:deviceId/execute
 */
router.post('/devices/:deviceId/execute', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command, params = {} } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command required' });
    }

    const result = await mikrotikManager.executeCommand(deviceId, command, params);
    
    res.json({
      success: true,
      command,
      result
    });
  } catch (error) {
    console.error('[Mikrotik API] Command execution failed:', error);
    res.status(500).json({ error: 'Command execution failed', details: error.message });
  }
});

/**
 * Apply configuration template to device
 * POST /api/mikrotik/devices/:deviceId/configure
 */
router.post('/devices/:deviceId/configure', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { configTemplate } = req.body;
    
    if (!configTemplate || !configTemplate.commands) {
      return res.status(400).json({ error: 'Configuration template with commands required' });
    }

    const result = await mikrotikManager.applyConfiguration(deviceId, configTemplate);
    
    res.json({
      success: true,
      message: 'Configuration applied successfully',
      results: result.results
    });
  } catch (error) {
    console.error('[Mikrotik API] Configuration failed:', error);
    res.status(500).json({ error: 'Configuration failed', details: error.message });
  }
});

/**
 * Backup device configuration
 * POST /api/mikrotik/devices/:deviceId/backup
 */
router.post('/devices/:deviceId/backup', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const result = await mikrotikManager.backupConfiguration(deviceId);
    
    res.json({
      success: true,
      message: 'Configuration backed up successfully',
      backup: result
    });
  } catch (error) {
    console.error('[Mikrotik API] Backup failed:', error);
    res.status(500).json({ error: 'Backup failed', details: error.message });
  }
});

/**
 * Get wireless client information
 * GET /api/mikrotik/devices/:deviceId/wireless-clients
 */
router.get('/devices/:deviceId/wireless-clients', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const result = await mikrotikManager.executeCommand(
      deviceId, 
      '/interface/wireless/registration-table/print'
    );
    
    const clients = result.map(client => ({
      macAddress: client['mac-address'],
      interface: client.interface,
      signalStrength: parseInt(client['signal-strength']) || 0,
      txRate: client['tx-rate'],
      rxRate: client['rx-rate'],
      uptime: client.uptime,
      txBytes: parseInt(client['tx-bytes']) || 0,
      rxBytes: parseInt(client['rx-bytes']) || 0,
      txPackets: parseInt(client['tx-packets']) || 0,
      rxPackets: parseInt(client['rx-packets']) || 0
    }));
    
    res.json({
      success: true,
      clientCount: clients.length,
      clients
    });
  } catch (error) {
    console.error('[Mikrotik API] Failed to get wireless clients:', error);
    res.status(500).json({ error: 'Failed to get wireless clients', details: error.message });
  }
});

/**
 * Get interface statistics
 * GET /api/mikrotik/devices/:deviceId/interfaces
 */
router.get('/devices/:deviceId/interfaces', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const interfaces = await mikrotikManager.executeCommand(deviceId, '/interface/print');
    
    const interfaceStats = [];
    for (const iface of interfaces) {
      try {
        const stats = await mikrotikManager.executeCommand(
          deviceId, 
          '/interface/monitor-traffic',
          { interface: iface.name, duration: '1' }
        );
        
        interfaceStats.push({
          name: iface.name,
          type: iface.type,
          running: iface.running === 'true',
          disabled: iface.disabled === 'true',
          mtu: parseInt(iface.mtu) || 0,
          rxBytesPerSecond: parseInt(stats[0]?.['rx-bytes-per-second']) || 0,
          txBytesPerSecond: parseInt(stats[0]?.['tx-bytes-per-second']) || 0,
          rxPacketsPerSecond: parseInt(stats[0]?.['rx-packets-per-second']) || 0,
          txPacketsPerSecond: parseInt(stats[0]?.['tx-packets-per-second']) || 0
        });
      } catch (error) {
        // If monitoring fails, use basic interface info
        interfaceStats.push({
          name: iface.name,
          type: iface.type,
          running: iface.running === 'true',
          disabled: iface.disabled === 'true',
          mtu: parseInt(iface.mtu) || 0,
          rxBytesPerSecond: 0,
          txBytesPerSecond: 0,
          rxPacketsPerSecond: 0,
          txPacketsPerSecond: 0
        });
      }
    }
    
    res.json({
      success: true,
      interfaces: interfaceStats
    });
  } catch (error) {
    console.error('[Mikrotik API] Failed to get interfaces:', error);
    res.status(500).json({ error: 'Failed to get interfaces', details: error.message });
  }
});

/**
 * Get system resources
 * GET /api/mikrotik/devices/:deviceId/resources
 */
router.get('/devices/:deviceId/resources', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const result = await mikrotikManager.executeCommand(deviceId, '/system/resource/print');
    const resource = result[0] || {};
    
    res.json({
      success: true,
      resources: {
        uptime: resource.uptime || '0s',
        version: resource.version || 'Unknown',
        architecture: resource.architecture || 'Unknown',
        boardName: resource['board-name'] || 'Unknown',
        cpuLoad: parseInt(resource['cpu-load']) || 0,
        freeMemory: parseInt(resource['free-memory']) || 0,
        totalMemory: parseInt(resource['total-memory']) || 0,
        freeHddSpace: parseInt(resource['free-hdd-space']) || 0,
        totalHddSpace: parseInt(resource['total-hdd-space']) || 0,
        cpuTemperature: parseInt(resource['cpu-temperature']) || 0,
        voltage: parseFloat(resource.voltage) || 0
      }
    });
  } catch (error) {
    console.error('[Mikrotik API] Failed to get resources:', error);
    res.status(500).json({ error: 'Failed to get resources', details: error.message });
  }
});

/**
 * Get DHCP leases
 * GET /api/mikrotik/devices/:deviceId/dhcp-leases
 */
router.get('/devices/:deviceId/dhcp-leases', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const result = await mikrotikManager.executeCommand(
      deviceId, 
      '/ip/dhcp-server/lease/print',
      { '?status': 'bound' }
    );
    
    const leases = result.map(lease => ({
      address: lease.address,
      macAddress: lease['mac-address'],
      hostName: lease['host-name'] || 'Unknown',
      server: lease.server,
      leaseTime: lease['lease-time'],
      status: lease.status,
      comment: lease.comment || ''
    }));
    
    res.json({
      success: true,
      leaseCount: leases.length,
      leases
    });
  } catch (error) {
    console.error('[Mikrotik API] Failed to get DHCP leases:', error);
    res.status(500).json({ error: 'Failed to get DHCP leases', details: error.message });
  }
});

/**
 * Get queue statistics
 * GET /api/mikrotik/devices/:deviceId/queues
 */
router.get('/devices/:deviceId/queues', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const result = await mikrotikManager.executeCommand(deviceId, '/queue/simple/print');
    
    const queues = result.map(queue => ({
      name: queue.name,
      target: queue.target,
      maxLimit: queue['max-limit'],
      burstLimit: queue['burst-limit'],
      burstThreshold: queue['burst-threshold'],
      burstTime: queue['burst-time'],
      disabled: queue.disabled === 'true',
      bytes: parseInt(queue.bytes) || 0,
      packets: parseInt(queue.packets) || 0,
      dropped: parseInt(queue.dropped) || 0,
      rate: queue.rate || '0bps/0bps'
    }));
    
    res.json({
      success: true,
      queueCount: queues.length,
      queues
    });
  } catch (error) {
    console.error('[Mikrotik API] Failed to get queues:', error);
    res.status(500).json({ error: 'Failed to get queues', details: error.message });
  }
});

/**
 * Test connection to Mikrotik device
 * POST /api/mikrotik/test-connection
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { ipAddress, username, password, port = 8728, useSSL = false } = req.body;
    
    if (!ipAddress || !username || !password) {
      return res.status(400).json({ error: 'IP address, username, and password required' });
    }

    // Create temporary connection for testing
    const connection = await mikrotikManager.createConnection({
      host: ipAddress,
      user: username,
      password: password,
      port: useSSL ? 8729 : port,
      timeout: 10000
    });

    // Get device identity and system info
    const [identity, systemInfo] = await Promise.all([
      mikrotikManager.getDeviceIdentity(connection),
      mikrotikManager.getSystemInfo(connection)
    ]);

    // Close test connection
    connection.close();
    
    res.json({
      success: true,
      message: 'Connection successful',
      identity,
      systemInfo
    });
  } catch (error) {
    console.error('[Mikrotik API] Connection test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Connection failed',
      details: error.message
    });
  }
});

/**
 * Unregister Mikrotik device
 * DELETE /api/mikrotik/devices/:deviceId
 */
router.delete('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    await mikrotikManager.unregisterDevice(deviceId);
    
    res.json({
      success: true,
      message: 'Device unregistered successfully'
    });
  } catch (error) {
    console.error('[Mikrotik API] Failed to unregister device:', error);
    res.status(500).json({ error: 'Failed to unregister device', details: error.message });
  }
});

/**
 * Get available Mikrotik SNMP OIDs
 * GET /api/mikrotik/snmp-oids
 */
router.get('/snmp-oids', async (req, res) => {
  try {
    const { deviceType = 'router' } = req.query;
    
    let oids = mikrotikOIDs.getDefaultMikrotikOIDs();
    
    if (deviceType === 'ap' || deviceType === 'cpe') {
      oids = [...oids, ...mikrotikOIDs.getWirelessOIDs()];
    }
    
    if (deviceType === 'lte') {
      oids = [...oids, ...mikrotikOIDs.getLTEOIDs()];
    }
    
    res.json({
      success: true,
      deviceType,
      oidsCount: oids.length,
      oids
    });
  } catch (error) {
    console.error('[Mikrotik API] Failed to get OIDs:', error);
    res.status(500).json({ error: 'Failed to get OIDs' });
  }
});

module.exports = router;
