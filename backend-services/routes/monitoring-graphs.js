/**
 * Monitoring Graphs API Routes
 * Provides endpoints for retrieving ping and SNMP metrics for graphing
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { PingMetrics } = require('../models/ping-metrics-schema');
const { SNMPMetrics } = require('../models/snmp-metrics-schema');
const { InventoryItem } = require('../models/inventory');
const { NetworkEquipment } = require('../models/network');
const { RemoteEPC, EPCServiceStatus } = require('../models/distributed-epc-schema');

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
    
    // If still no results, try to find device by IP address (fallback for devices where device_id might not match)
    if (metrics.length === 0) {
      // Get device info to find IP address
      const { NetworkEquipment } = require('../models/network');
      const { InventoryItem } = require('../models/inventory');
      
      let deviceIP = null;
      
      // Try NetworkEquipment first
      if (mongoose.Types.ObjectId.isValid(deviceId)) {
        const deviceObjId = new mongoose.Types.ObjectId(deviceId);
        const equipment = await NetworkEquipment.findOne({ _id: deviceObjId, tenantId: req.tenantId }).lean();
        if (equipment && equipment.notes) {
          try {
            const notes = typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes;
            deviceIP = notes.management_ip || notes.ip_address || notes.ipAddress;
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      // Try InventoryItem if not found
      if (!deviceIP && mongoose.Types.ObjectId.isValid(deviceId)) {
        const deviceObjId = new mongoose.Types.ObjectId(deviceId);
        const item = await InventoryItem.findOne({ _id: deviceObjId, tenantId: req.tenantId }).lean();
        if (item) {
          deviceIP = item.ipAddress || item.technicalSpecs?.ipAddress;
        }
      }
      
      // If we found an IP, query by IP address
      if (deviceIP) {
        console.log(`[Monitoring Graphs] No metrics found by device_id, trying IP address fallback: ${deviceIP}`);
        metrics = await PingMetrics.find({
          ip_address: deviceIP.trim(),
          tenant_id: req.tenantId,
          timestamp: { $gte: startTime }
        })
        .sort({ timestamp: 1 })
        .lean();
        
        if (metrics.length > 0) {
          console.log(`[Monitoring Graphs] Found ${metrics.length} metrics using IP address fallback: ${deviceIP}`);
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

    // Convert to ECharts format (time series data)
    const timestamps = metrics.length > 0 
      ? metrics.map(m => new Date(m.timestamp).getTime())
      : [];
    const responseTimes = metrics.length > 0
      ? metrics.map(m => m.response_time_ms || null)
      : [];
    const success = metrics.length > 0
      ? metrics.map(m => {
          // A ping is successful if success === true OR if it has a response_time (got a response)
          // Also consider it successful if response_time_ms > 0 (even if success flag is wrong)
          const isSuccessful = m.success === true || 
                              (m.response_time_ms !== null && m.response_time_ms !== undefined && m.response_time_ms > 0);
          return isSuccessful ? 1 : 0;
        })
      : [];
    
    // Debug: Log first few success values to understand what we're working with
    if (metrics.length > 0) {
      console.log(`[Monitoring Graphs] Sample ping data (first 5):`, metrics.slice(0, 5).map(m => ({
        timestamp: m.timestamp,
        success: m.success,
        response_time_ms: m.response_time_ms,
        computed_success: (m.success === true || (m.response_time_ms !== null && m.response_time_ms !== undefined && m.response_time_ms > 0)) ? 1 : 0
      })));
      console.log(`[Monitoring Graphs] Success array summary: total=${success.length}, successful=${success.filter(s => s === 1).length}, failed=${success.filter(s => s === 0).length}`);
    }

    // Build ECharts option format
    const echartsOption = {
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLabel: {
          color: '#9ca3af',
          fontSize: 10,
          rotate: 45
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Response Time (ms)',
          position: 'left',
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          nameLocation: 'middle',
          nameGap: 50,
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        {
          type: 'value',
          name: 'Status',
          position: 'right',
          min: 0,
          max: 1,
          interval: 1,
          axisLabel: {
            color: '#9ca3af',
            fontSize: 11
            // Note: formatter functions cannot be serialized in JSON, will be handled by frontend
          },
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          nameLocation: 'middle',
          nameGap: 50,
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        }
      ],
      series: [
        {
          name: 'Response Time',
          type: 'line',
          yAxisIndex: 0,
          data: timestamps.map((time, idx) => [time, responseTimes[idx]]),
          itemStyle: { color: '#4bc0c0' },
          areaStyle: { color: 'rgba(75, 192, 192, 0.2)' },
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 2 }
        },
        {
          name: 'Status',
          type: 'line',
          yAxisIndex: 1,
          data: timestamps.map((time, idx) => [time, success[idx]]),
          itemStyle: { 
            // Color will be set per-point in frontend based on success array
            color: '#22c55e'
          },
          areaStyle: { 
            // Color will be set per-point in frontend based on success array
            color: 'rgba(34, 197, 94, 0.2)'
          },
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 2 }
        }
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(59, 130, 246, 0.3)',
        borderWidth: 1,
        textStyle: { color: '#cbd5e1' },
        axisPointer: { lineStyle: { color: 'rgba(59, 130, 246, 0.5)' } }
      },
      grid: { top: 20, right: 30, bottom: 40, left: 50 }
    };

    // Also provide Chart.js compatible format for backward compatibility
    const chartjsFormat = {
      labels: metrics.length > 0 
        ? metrics.map(m => new Date(m.timestamp).toISOString())
        : [],
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
      ],
      raw_metrics_count: metrics.length
    };

    // Calculate current_status based on recent successful pings (last 15 minutes)
    // A ping is considered successful if:
    // 1. success === true, OR
    // 2. response_time_ms exists (got a response, even if success flag is wrong)
    let current_status = 'offline';
    if (metrics.length > 0) {
      const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
      const recentMetrics = metrics.filter(m => new Date(m.timestamp).getTime() >= fifteenMinutesAgo);
      
      if (recentMetrics.length > 0) {
        // Check if any recent ping was successful (success === true OR has response_time > 0)
        const recentSuccessful = recentMetrics.filter(m => 
          m.success === true || (m.response_time_ms !== null && m.response_time_ms !== undefined && m.response_time_ms > 0)
        );
        if (recentSuccessful.length > 0) {
          current_status = 'online';
        } else {
          // No successful pings in last 15 minutes, but check if last metric was recent
          const lastMetric = metrics[metrics.length - 1];
          const lastMetricAge = Date.now() - new Date(lastMetric.timestamp).getTime();
          if (lastMetricAge < 15 * 60 * 1000 && 
              (lastMetric.success === true || (lastMetric.response_time_ms !== null && lastMetric.response_time_ms !== undefined && lastMetric.response_time_ms > 0))) {
            current_status = 'online';
          }
        }
      } else {
        // No recent metrics, check last metric
        const lastMetric = metrics[metrics.length - 1];
        const lastMetricAge = Date.now() - new Date(lastMetric.timestamp).getTime();
        // If last metric is within 30 minutes and was successful (or has response_time > 0), consider online
        if (lastMetricAge < 30 * 60 * 1000 && 
            (lastMetric.success === true || (lastMetric.response_time_ms !== null && lastMetric.response_time_ms !== undefined && lastMetric.response_time_ms > 0))) {
          current_status = 'online';
        }
      }
    }

    const response = {
      success: true,
      deviceId,
      hours: validHours,
      // Primary format: ECharts option
      echarts: echartsOption,
      // Backward compatibility: Chart.js format
      data: chartjsFormat,
      stats: {
        total: metrics.length,
        successful: metrics.filter(m => m.success === true || (m.response_time_ms !== null && m.response_time_ms !== undefined && m.response_time_ms > 0)).length,
        failed: metrics.filter(m => !(m.success === true || (m.response_time_ms !== null && m.response_time_ms !== undefined && m.response_time_ms > 0))).length,
        uptime_percent: metrics.length > 0 
          ? Math.round((metrics.filter(m => m.success === true || (m.response_time_ms !== null && m.response_time_ms !== undefined && m.response_time_ms > 0)).length / metrics.length) * 10000) / 100
          : 0,
        current_status: current_status,
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

    // First, try to get SNMP metrics from SNMPMetrics collection
    let metrics = await SNMPMetrics.find({
      device_id: deviceId,
      tenant_id: req.tenantId,
      timestamp: { $gte: startTime }
    })
    .sort({ timestamp: 1 })
    .lean();

    // If no SNMP metrics found, check if this is a RemoteEPC and convert EPCServiceStatus to SNMP format
    if (metrics.length === 0) {
      // Check if deviceId is a RemoteEPC _id
      let epc = null;
      if (mongoose.Types.ObjectId.isValid(deviceId)) {
        epc = await RemoteEPC.findOne({ _id: deviceId, tenant_id: req.tenantId }).lean();
      }
      
      // If not found by _id, try by epc_id
      if (!epc) {
        epc = await RemoteEPC.findOne({ epc_id: deviceId, tenant_id: req.tenantId }).lean();
      }
      
      if (epc) {
        // Get EPCServiceStatus records and convert to SNMPMetrics format
        const epcStatuses = await EPCServiceStatus.find({
          epc_id: epc.epc_id,
          tenant_id: req.tenantId,
          timestamp: { $gte: startTime }
        })
        .sort({ timestamp: 1 })
        .lean();
        
        // Convert EPCServiceStatus to SNMPMetrics format
        metrics = epcStatuses.map(status => ({
          device_id: epc._id.toString(),
          tenant_id: req.tenantId,
          timestamp: status.timestamp,
          system: {
            uptime_seconds: status.system?.uptime_seconds || null,
            hostname: status.system?.hostname || epc.site_name || null,
            sys_descr: `Remote EPC: ${epc.site_name || epc.epc_id}`,
            sys_location: epc.location?.address || null
          },
          resources: {
            cpu_percent: status.system?.cpu_percent || null,
            memory_percent: status.system?.memory_percent || null,
            memory_total_mb: status.system?.memory_total_mb || null,
            memory_used_mb: status.system?.memory_used_mb || null,
            memory_free_mb: status.system?.memory_free_mb || null,
            disk_percent: status.system?.disk_percent || null,
            disk_total_gb: status.system?.disk_total_gb || null,
            disk_used_gb: status.system?.disk_used_gb || null,
            load_average: status.system?.load_average || null
          },
          network: {
            interface_name: status.network?.primary_interface || status.network?.interfaces?.[0]?.name || 'eth0',
            interface_in_octets: status.network?.interface_in_octets || null,
            interface_out_octets: status.network?.interface_out_octets || null,
            interface_in_errors: status.network?.interface_in_errors || null,
            interface_out_errors: status.network?.interface_out_errors || null,
            interface_speed: status.network?.interface_speed || null,
            interface_status: status.network?.interface_status || status.network?.interfaces?.[0]?.status || 'up'
          },
          collection_method: 'epc_checkin'
        }));
        
        console.log(`[Monitoring Graphs] Converted ${metrics.length} EPCServiceStatus records to SNMPMetrics format for EPC ${epc.epc_id}`);
      }
    }

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

    // Get network equipment with IP addresses (can be monitored)
    // Include ALL network equipment - we'll filter by IP address in processing
    // This ensures discovered devices (even without siteId) are included
    const networkEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      $or: [
        { status: 'active' },
        { status: 'deployed' },
        { status: { $exists: false } }, // Devices without status field
        // Include devices with notes (might have IP addresses)
        { notes: { $exists: true, $ne: null } }
      ]
    })
    .select('_id name type manufacturer model notes siteId status')
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
        
        // If device has an IP address, include it (can show ping uptime graphs)
        // Don't require enableGraphs or SNMP config - ping monitoring should work for all devices with IPs
        if (ipAddress && ipAddress.trim()) {
          const hasSNMPConfig = !!(notes.snmp_community || notes.snmp_version);
          
          // Always include devices with IP addresses - they can show ping uptime even without SNMP
          devices.push({
            id: equipment._id.toString(),
            name: equipment.name || notes.sysName || notes.sysDescr || ipAddress || 'Unknown',
            type: 'network_equipment',
            manufacturer: equipment.manufacturer || notes.manufacturer_detected_via_oui || notes.oui_detection?.manufacturer || 'Unknown',
            model: equipment.model || notes.mikrotik?.board_name || notes.sysDescr || 'Unknown',
            ipAddress: ipAddress.trim(),
            location: 'Unknown',
            hasPing: true, // All devices with IPs can be pinged
            hasSNMP: hasSNMPConfig // Only true if SNMP is configured
          });
        }
      } catch (e) {
        // Invalid JSON in notes, skip
        continue;
      }
    }

    // Add RemoteEPC devices (EPCs send system metrics via check-in)
    const remoteEPCs = await RemoteEPC.find({
      tenant_id: req.tenantId
    })
    .select('_id epc_id site_name site_id ip_address location status')
    .lean();

    for (const epc of remoteEPCs) {
      const ipAddress = epc.ip_address;
      if (ipAddress && ipAddress.trim()) {
        devices.push({
          id: epc._id.toString(),
          name: epc.site_name || epc.epc_id || 'Remote EPC',
          type: 'remote_epc',
          manufacturer: 'EPC',
          model: 'Remote EPC',
          ipAddress: ipAddress.trim(),
          location: epc.location?.address || epc.site_name || 'Unknown',
          siteId: epc.site_id ? (typeof epc.site_id === 'object' ? epc.site_id.toString() : epc.site_id) : null,
          hasPing: true, // EPCs can be pinged
          hasSNMP: true  // EPCs send system metrics via check-in (converted to SNMP format)
        });
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

