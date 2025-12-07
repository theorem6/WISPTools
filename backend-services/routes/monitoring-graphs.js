/**
 * Monitoring Graphs API Routes
 * Provides endpoints for retrieving ping and SNMP metrics for graphing
 */

const express = require('express');
const router = express.Router();
const { PingMetrics } = require('../models/ping-metrics-schema');
const { SNMPMetrics } = require('../models/snmp-metrics-schema');
const { InventoryItem } = require('../models/inventory');
const { NetworkEquipment } = require('../models/network');

// Middleware to extract tenant ID
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(requireTenant);

/**
 * GET /api/monitoring/graphs/ping/:deviceId
 * Get ping metrics for a device (for graphing)
 */
router.get('/ping/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24 } = req.query;
    const hoursNum = parseInt(hours, 10) || 24;

    // Limit hours to reasonable range (1 hour to 30 days)
    const validHours = Math.max(1, Math.min(720, hoursNum));

    const startTime = new Date(Date.now() - validHours * 60 * 60 * 1000);

    console.log(`[Monitoring Graphs] Fetching ping metrics for device ${deviceId}, tenant ${req.tenantId}, hours: ${validHours}`);
    console.log(`[Monitoring Graphs] Query details: startTime=${startTime.toISOString()}, currentTime=${new Date().toISOString()}, timeRange=${validHours}h`);

    // Try query with device_id as string first
    let metrics = await PingMetrics.find({
      device_id: deviceId,
      tenant_id: req.tenantId,
      timestamp: { $gte: startTime }
    })
    .sort({ timestamp: 1 })
    .lean();

    // If no results, try with ObjectId format (in case device_id was stored as ObjectId)
    if (metrics.length === 0) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(deviceId)) {
        const objectIdDeviceId = new mongoose.Types.ObjectId(deviceId);
        metrics = await PingMetrics.find({
          $or: [
            { device_id: deviceId },
            { device_id: objectIdDeviceId }
          ],
          tenant_id: req.tenantId,
          timestamp: { $gte: startTime }
        })
        .sort({ timestamp: 1 })
        .lean();
        
        if (metrics.length > 0) {
          console.log(`[Monitoring Graphs] Found ${metrics.length} metrics using ObjectId format fallback`);
        }
      }
    }

    console.log(`[Monitoring Graphs] Found ${metrics.length} ping metrics for device ${deviceId}`);
    if (metrics.length > 0) {
      console.log(`[Monitoring Graphs] First metric: ${metrics[0].timestamp}, Last metric: ${metrics[metrics.length - 1].timestamp}`);
    } else {
      // Debug: Check if device_id exists at all (try both formats)
      let anyMetrics = await PingMetrics.findOne({ device_id: deviceId, tenant_id: req.tenantId }).lean();
      if (!anyMetrics) {
        const mongoose = require('mongoose');
        if (mongoose.Types.ObjectId.isValid(deviceId)) {
          const objectIdDeviceId = new mongoose.Types.ObjectId(deviceId);
          anyMetrics = await PingMetrics.findOne({ 
            $or: [
              { device_id: deviceId },
              { device_id: objectIdDeviceId }
            ],
            tenant_id: req.tenantId 
          }).lean();
        }
      }
      
      if (anyMetrics) {
        const ageHours = (Date.now() - anyMetrics.timestamp.getTime()) / (1000 * 60 * 60);
        console.log(`[Monitoring Graphs] Device has metrics but outside time range. Most recent: ${ageHours.toFixed(2)}h ago (${anyMetrics.timestamp})`);
        console.log(`[Monitoring Graphs] Stored device_id format: ${typeof anyMetrics.device_id} = "${anyMetrics.device_id}"`);
      } else {
        console.log(`[Monitoring Graphs] No metrics found for device ${deviceId} at all (checked both string and ObjectId formats)`);
      }
    }

    // Always return valid structure, even if empty
    const labels = metrics.length > 0 
      ? metrics.map(m => new Date(m.timestamp).toISOString())
      : [];
    const responseTimes = metrics.length > 0
      ? metrics.map(m => m.response_time_ms || null)
      : [];
    const success = metrics.length > 0
      ? metrics.map(m => m.success ? 1 : 0) // 1 for success, 0 for failure
      : [];

    const response = {
      success: true,
      deviceId,
      hours: validHours,
      data: {
        labels,
        datasets: [
          {
            label: 'Response Time (ms)',
            data: responseTimes,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            yAxisID: 'y'
          },
          {
            label: 'Status',
            data: success,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            yAxisID: 'y1'
          }
        ]
      },
      stats: {
        total: metrics.length,
        successful: metrics.filter(m => m.success).length,
        failed: metrics.filter(m => !m.success).length,
        uptime_percent: metrics.length > 0 
          ? Math.round((metrics.filter(m => m.success).length / metrics.length) * 10000) / 100
          : 0,
        current_status: metrics.length > 0 && metrics[metrics.length - 1]?.success ? 'online' : 'offline',
        avg_response_time_ms: metrics.filter(m => m.response_time_ms).length > 0
          ? Math.round(metrics.filter(m => m.response_time_ms).reduce((sum, m) => sum + m.response_time_ms, 0) / metrics.filter(m => m.response_time_ms).length * 100) / 100
          : null
      }
    };

    console.log(`[Monitoring Graphs] Returning ping data: ${response.data.labels.length} labels, ${response.data.datasets.length} datasets, stats: ${JSON.stringify(response.stats)}`);
    
    // Log sample of device_ids if no metrics found to help debug
    if (metrics.length === 0) {
      const allDeviceIds = await PingMetrics.distinct('device_id', { tenant_id: req.tenantId });
      const sampleDevices = allDeviceIds.slice(0, 10);
      console.log(`[Monitoring Graphs] No metrics found for device ${deviceId}. Looking for device_id: "${deviceId}"`);
      console.log(`[Monitoring Graphs] Sample device_ids in database for tenant ${req.tenantId}:`, sampleDevices.map(id => `"${id}" (type: ${typeof id})`));
      console.log(`[Monitoring Graphs] Total unique device_ids in database: ${allDeviceIds.length}`);
      
      // Check if our deviceId matches any in the database (fuzzy match)
      const matchingIds = allDeviceIds.filter(id => {
        const idStr = String(id);
        const deviceIdStr = String(deviceId);
        return idStr === deviceIdStr || idStr.includes(deviceIdStr) || deviceIdStr.includes(idStr);
      });
      
      if (matchingIds.length > 0) {
        console.log(`[Monitoring Graphs] ⚠️ Found similar device_ids: ${matchingIds.map(id => `"${id}"`).join(', ')}`);
        console.log(`[Monitoring Graphs] ⚠️ This suggests a format mismatch - trying to query with matched IDs...`);
        
        // Try querying with the matched device_ids
        for (const matchedId of matchingIds) {
          const matchedMetrics = await PingMetrics.find({
            device_id: matchedId,
            tenant_id: req.tenantId,
            timestamp: { $gte: startTime }
          })
          .sort({ timestamp: 1 })
          .lean();
          
          if (matchedMetrics.length > 0) {
            console.log(`[Monitoring Graphs] ✅ Found ${matchedMetrics.length} metrics using matched device_id: "${matchedId}"`);
            metrics = matchedMetrics;
            break;
          }
        }
      }
      
      // Also check if there are any metrics at all for this tenant
      const totalMetrics = await PingMetrics.countDocuments({ tenant_id: req.tenantId });
      console.log(`[Monitoring Graphs] Total ping metrics in database for tenant: ${totalMetrics}`);
      
      // Check metrics in the requested time range for any device
      const timeRangeMetrics = await PingMetrics.countDocuments({ 
        tenant_id: req.tenantId,
        timestamp: { $gte: startTime }
      });
      console.log(`[Monitoring Graphs] Ping metrics in last ${validHours}h for tenant (any device): ${timeRangeMetrics}`);
      
      // Check recent metrics (last 24 hours) for any device
      const recentMetrics = await PingMetrics.countDocuments({ 
        tenant_id: req.tenantId,
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      console.log(`[Monitoring Graphs] Ping metrics in last 24 hours for tenant (any device): ${recentMetrics}`);
    }
    
    res.json(response);
  } catch (error) {
    console.error('[Monitoring Graphs] Error getting ping metrics:', error);
    res.status(500).json({
      error: 'Failed to get ping metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/graphs/snmp/:deviceId
 * Get SNMP metrics for a device (for graphing)
 */
router.get('/snmp/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24, metric } = req.query;
    const hoursNum = parseInt(hours, 10) || 24;

    // Limit hours to reasonable range
    const validHours = Math.max(1, Math.min(720, hoursNum));

    const startTime = new Date(Date.now() - validHours * 60 * 60 * 1000);

    const metrics = await SNMPMetrics.find({
      device_id: deviceId,
      tenant_id: req.tenantId,
      timestamp: { $gte: startTime }
    })
    .sort({ timestamp: 1 })
    .lean();

    if (metrics.length === 0) {
      return res.json({
        success: true,
        deviceId,
        hours: validHours,
        data: {
          labels: [],
          datasets: []
        },
        message: 'No SNMP metrics found for this time range'
      });
    }

    // Format for Chart.js
    const labels = metrics.map(m => new Date(m.timestamp).toISOString());

    // If specific metric requested, return just that
    if (metric) {
      let data = [];
      let label = '';
      let borderColor = 'rgb(75, 192, 192)';

      switch (metric) {
        case 'cpu':
          data = metrics.map(m => m.resources?.cpu_percent || null);
          label = 'CPU Usage (%)';
          borderColor = 'rgb(239, 68, 68)';
          break;
        case 'memory':
          data = metrics.map(m => m.resources?.memory_percent || null);
          label = 'Memory Usage (%)';
          borderColor = 'rgb(59, 130, 246)';
          break;
        case 'uptime':
          data = metrics.map(m => m.system?.uptime_seconds ? (m.system.uptime_seconds / 3600) : null);
          label = 'Uptime (hours)';
          borderColor = 'rgb(34, 197, 94)';
          break;
        case 'throughput_in':
          data = metrics.map(m => m.network?.interface_in_octets || null);
          label = 'Throughput In (bytes)';
          borderColor = 'rgb(147, 51, 234)';
          break;
        case 'throughput_out':
          data = metrics.map(m => m.network?.interface_out_octets || null);
          label = 'Throughput Out (bytes)';
          borderColor = 'rgb(236, 72, 153)';
          break;
        default:
          return res.status(400).json({ error: 'Invalid metric. Valid options: cpu, memory, uptime, throughput_in, throughput_out' });
      }

      return res.json({
        success: true,
        deviceId,
        metric,
        hours: validHours,
        data: {
          labels,
          datasets: [{
            label,
            data,
            borderColor,
            backgroundColor: borderColor.replace('rgb', 'rgba').replace(')', ', 0.2)'),
            fill: false
          }]
        }
      });
    }

    // Return all available metrics
    const datasets = [];

    // CPU
    if (metrics.some(m => m.resources?.cpu_percent !== undefined)) {
      datasets.push({
        label: 'CPU Usage (%)',
        data: metrics.map(m => m.resources?.cpu_percent || null),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        yAxisID: 'y'
      });
    }

    // Memory
    if (metrics.some(m => m.resources?.memory_percent !== undefined)) {
      datasets.push({
        label: 'Memory Usage (%)',
        data: metrics.map(m => m.resources?.memory_percent || null),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        yAxisID: 'y'
      });
    }

    // Uptime
    if (metrics.some(m => m.system?.uptime_seconds !== undefined)) {
      datasets.push({
        label: 'Uptime (hours)',
        data: metrics.map(m => m.system?.uptime_seconds ? (m.system.uptime_seconds / 3600) : null),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        yAxisID: 'y1'
      });
    }

    // Network Throughput - Input
    if (metrics.some(m => m.network?.interface_in_octets !== undefined && m.network?.interface_in_octets !== null)) {
      datasets.push({
        label: 'Throughput In (bytes)',
        data: metrics.map(m => m.network?.interface_in_octets || null),
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.2)',
        yAxisID: 'y2'
      });
    }

    // Network Throughput - Output
    if (metrics.some(m => m.network?.interface_out_octets !== undefined && m.network?.interface_out_octets !== null)) {
      datasets.push({
        label: 'Throughput Out (bytes)',
        data: metrics.map(m => m.network?.interface_out_octets || null),
        borderColor: 'rgb(236, 72, 153)',
        backgroundColor: 'rgba(236, 72, 153, 0.2)',
        yAxisID: 'y2'
      });
    }

    res.json({
      success: true,
      deviceId,
      hours: validHours,
      data: {
        labels,
        datasets
      },
      available_metrics: ['cpu', 'memory', 'uptime', 'throughput_in', 'throughput_out']
    });
  } catch (error) {
    console.error('[Monitoring Graphs] Error getting SNMP metrics:', error);
    res.status(500).json({
      error: 'Failed to get SNMP metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/graphs/devices
 * Get list of devices available for graphing
 */
router.get('/devices', async (req, res) => {
  try {
    // Get all deployed inventory items with IP addresses
    const inventoryItems = await InventoryItem.find({
      tenantId: req.tenantId,
      status: 'deployed',
      $or: [
        { ipAddress: { $exists: true, $ne: null, $ne: '' } },
        { 'technicalSpecs.ipAddress': { $exists: true, $ne: null, $ne: '' } }
      ]
    })
    .select('_id assetTag equipmentType manufacturer model ipAddress technicalSpecs.ipAddress currentLocation')
    .lean();

    // Get only deployed network equipment (must have siteId to be considered deployed)
    // Only show graphs for devices that are actually deployed at sites
    const networkEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      status: 'active',
      siteId: { $exists: true, $ne: null } // Only deployed devices (have a siteId)
    })
    .select('_id name type manufacturer model notes siteId')
    .lean();

    const devices = [];

    // Process inventory items
    for (const item of inventoryItems) {
      const ipAddress = item.ipAddress || item.technicalSpecs?.ipAddress;
      if (ipAddress && ipAddress.trim()) {
        devices.push({
          id: item._id.toString(),
          name: item.assetTag || item.equipmentType || 'Unknown',
          type: 'inventory',
          manufacturer: item.manufacturer,
          model: item.model,
          ipAddress: ipAddress.trim(),
          location: item.currentLocation?.siteName || 'Unknown',
          hasPing: true,
          hasSNMP: false
        });
      }
    }

    // Process deployed network equipment (all returned have siteId)
    for (const equipment of networkEquipment) {
      try {
        const notes = equipment.notes ? (typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes) : {};
        const ipAddress = notes.management_ip || notes.ip_address || notes.ipAddress;
        // Default to true if not explicitly set to false (consistent with discovered devices)
        const enableGraphs = notes.enable_graphs !== false;
        
        // All devices returned here are already deployed (have siteId from query filter)
        // Only include if they have an IP address and graphs are enabled
        if (ipAddress && ipAddress.trim()) {
          const hasSNMPConfig = notes.snmp_community || notes.snmp_version || notes.enable_graphs === true;
          
          // Include deployed device if graphs are enabled (default true)
          if (enableGraphs || hasSNMPConfig) {
            devices.push({
              id: equipment._id.toString(),
              name: equipment.name || notes.sysName || notes.sysDescr || ipAddress || 'Unknown',
              type: 'network_equipment',
              manufacturer: equipment.manufacturer || notes.manufacturer_detected_via_oui || notes.oui_detection?.manufacturer || 'Unknown',
              model: equipment.model || notes.mikrotik?.board_name || notes.sysDescr || 'Unknown',
              ipAddress: ipAddress.trim(),
              location: 'Unknown',
              hasPing: true,
              hasSNMP: hasSNMPConfig
            });
          }
        }
      } catch (e) {
        // Invalid JSON in notes, skip
        continue;
      }
    }

    res.json({
      success: true,
      devices,
      count: devices.length
    });
  } catch (error) {
    console.error('[Monitoring Graphs] Error getting devices:', error);
    res.status(500).json({
      error: 'Failed to get devices',
      message: error.message
    });
  }
});

module.exports = router;

