/**
 * SNMP Monitoring API
 * Handles SNMP device registration, configuration, and data retrieval
 */

const express = require('express');
const snmpCollector = require('../services/snmpCollector');

const router = express.Router();

/**
 * Register EPC device for SNMP monitoring
 * POST /api/snmp/register-device
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

    const result = await snmpCollector.registerDevice(deviceConfig);
    
    res.json({
      success: true,
      message: 'Device registered successfully',
      deviceId: result.deviceId
    });
  } catch (error) {
    console.error('[SNMP Monitoring] Failed to register device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

/**
 * Unregister SNMP device
 * DELETE /api/snmp/devices/:deviceId
 */
router.delete('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    await snmpCollector.unregisterDevice(deviceId);
    
    res.json({
      success: true,
      message: 'Device unregistered successfully'
    });
  } catch (error) {
    console.error('[SNMP Monitoring] Failed to unregister device:', error);
    res.status(500).json({ error: 'Failed to unregister device' });
  }
});

/**
 * Get device status and metrics
 * GET /api/snmp/devices/:deviceId
 */
router.get('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const status = snmpCollector.getDeviceStatus(deviceId);
    if (!status) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json(status);
  } catch (error) {
    console.error('[SNMP Monitoring] Failed to get device status:', error);
    res.status(500).json({ error: 'Failed to get device status' });
  }
});

/**
 * Get all devices for tenant
 * GET /api/snmp/devices
 */
router.get('/devices', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const devices = snmpCollector.getTenantDevices(tenantId);
    res.json({ devices });
  } catch (error) {
    console.error('[SNMP Monitoring] Failed to get devices:', error);
    res.status(500).json({ error: 'Failed to get devices' });
  }
});

/**
 * Update device configuration
 * PUT /api/snmp/devices/:deviceId
 */
router.put('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const updates = req.body;
    
    await snmpCollector.updateDeviceConfig(deviceId, updates);
    
    res.json({
      success: true,
      message: 'Device configuration updated successfully'
    });
  } catch (error) {
    console.error('[SNMP Monitoring] Failed to update device:', error);
    res.status(500).json({ error: 'Failed to update device configuration' });
  }
});

/**
 * Get historical metrics for device
 * GET /api/snmp/devices/:deviceId/metrics
 */
router.get('/devices/:deviceId/metrics', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startTime, endTime, metric } = req.query;
    
    // In a real implementation, this would query the time-series database
    // For now, return mock data structure
    const metrics = {
      deviceId,
      timeRange: { startTime, endTime },
      data: {
        timestamps: [],
        values: {}
      }
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('[SNMP Monitoring] Failed to get metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * Get uptime statistics for device
 * GET /api/snmp/devices/:deviceId/uptime
 */
router.get('/devices/:deviceId/uptime', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { period = '24h' } = req.query;
    
    const device = snmpCollector.getDeviceStatus(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Calculate uptime statistics
    const uptimeStats = {
      deviceId,
      period,
      currentUptime: device.metrics?.sysUpTime?.value || 0,
      uptimePercentage: 99.5, // Mock data - would be calculated from historical data
      downtimeEvents: [], // Mock data - would be from historical data
      lastSeen: device.lastPoll,
      status: device.status
    };
    
    res.json(uptimeStats);
  } catch (error) {
    console.error('[SNMP Monitoring] Failed to get uptime stats:', error);
    res.status(500).json({ error: 'Failed to get uptime statistics' });
  }
});

/**
 * Get network latency data for device
 * GET /api/snmp/devices/:deviceId/latency
 */
router.get('/devices/:deviceId/latency', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { period = '1h' } = req.query;
    
    // Mock latency data - in real implementation would come from ping tests or SNMP data
    const latencyData = {
      deviceId,
      period,
      averageLatency: 15.2, // ms
      minLatency: 8.1,
      maxLatency: 45.3,
      packetLoss: 0.1, // percentage
      measurements: [] // Array of timestamp/latency pairs
    };
    
    res.json(latencyData);
  } catch (error) {
    console.error('[SNMP Monitoring] Failed to get latency data:', error);
    res.status(500).json({ error: 'Failed to get latency data' });
  }
});

/**
 * Get performance metrics summary
 * GET /api/snmp/devices/:deviceId/performance
 */
router.get('/devices/:deviceId/performance', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = snmpCollector.getDeviceStatus(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Extract performance metrics from current device data
    const performance = {
      deviceId,
      timestamp: device.lastPoll,
      cpu: {
        user: device.metrics?.cpuUser?.value || 0,
        system: device.metrics?.cpuSystem?.value || 0,
        idle: device.metrics?.cpuIdle?.value || 100
      },
      memory: {
        total: device.metrics?.memTotalReal?.value || 0,
        available: device.metrics?.memAvailReal?.value || 0,
        used: 0 // Calculated
      },
      network: {
        interfaces: [], // Would be populated from interface table data
        totalInOctets: 0,
        totalOutOctets: 0
      },
      disk: {
        usage: [], // Would be populated from disk table data
        totalSpace: 0,
        freeSpace: 0
      },
      load: {
        load1: parseFloat(device.metrics?.laLoad1?.value) || 0,
        load5: parseFloat(device.metrics?.laLoad5?.value) || 0,
        load15: parseFloat(device.metrics?.laLoad15?.value) || 0
      }
    };

    // Calculate derived metrics
    if (performance.memory.total > 0) {
      performance.memory.used = performance.memory.total - performance.memory.available;
    }
    
    res.json(performance);
  } catch (error) {
    console.error('[SNMP Monitoring] Failed to get performance data:', error);
    res.status(500).json({ error: 'Failed to get performance data' });
  }
});

/**
 * Test SNMP connectivity to device
 * POST /api/snmp/test-connection
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { ipAddress, snmpVersion, community, username, authKey, privKey } = req.body;
    
    // Create temporary SNMP session for testing
    let session;
    if (snmpVersion === '3') {
      const user = {
        name: username,
        level: require('net-snmp').SecurityLevel.authPriv,
        authProtocol: require('net-snmp').AuthProtocols.sha,
        authKey: authKey,
        privProtocol: require('net-snmp').PrivProtocols.aes,
        privKey: privKey
      };
      session = require('net-snmp').createV3Session(ipAddress, user);
    } else {
      session = require('net-snmp').createSession(ipAddress, community);
    }

    // Test with system description OID
    session.get(['1.3.6.1.2.1.1.1.0'], (error, varbinds) => {
      session.close();
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Connection failed',
          details: error.message
        });
      }

      res.json({
        success: true,
        message: 'Connection successful',
        systemDescription: varbinds[0].value.toString()
      });
    });
  } catch (error) {
    console.error('[SNMP Monitoring] Connection test failed:', error);
    res.status(500).json({ error: 'Connection test failed' });
  }
});

module.exports = router;
