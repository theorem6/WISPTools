/**
 * EPC Check-in Routes
 * Handles check-in requests from remote EPC devices
 * MUST be defined BEFORE /api/epc routes (no tenant ID required)
 */

const express = require('express');
const router = express.Router();
const checkinService = require('../services/epc-checkin-service');
const { PingMetrics } = require('../models/ping-metrics-schema');
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { NetworkEquipment } = require('../models/network');
const { InventoryItem } = require('../models/inventory');

/**
 * POST /api/epc/checkin
 * Main check-in endpoint for remote EPC devices
 */
router.post('/checkin', async (req, res) => {
  try {
    const { device_code, hardware_id, ip_address, services, system, network, versions, logs } = req.body;

    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    console.log(`[EPC Check-in] Device ${device_code} checking in from ${ip_address}`);
    console.log(`[EPC Check-in] Payload received:`, {
      hasServices: !!services,
      hasSystem: !!system,
      hasNetwork: !!network,
      hasVersions: !!versions,
      hasLogs: !!(logs && Array.isArray(logs) && logs.length > 0),
      systemKeys: system ? Object.keys(system) : [],
      systemUptime: system?.uptime_seconds,
      systemCPU: system?.cpu_percent,
      systemMemory: system?.memory_percent
    });

    if (versions?.scripts) {
      console.log(`[EPC Check-in] Script versions reported:`, JSON.stringify(versions.scripts));
    } else {
      console.log(`[EPC Check-in] No script versions reported (old agent version?)`);
    }

    // Find EPC by device code
    const epc = await checkinService.findEPCByDeviceCode(device_code);

    if (!epc) {
      return res.status(202).json({
        status: 'unregistered',
        message: `Device ${device_code} is not registered. Enter this code in the management portal.`,
        device_code: device_code.toUpperCase()
      });
    }

    // Update EPC with latest status and uptime
    const updateData = {
      status: 'online',
      last_seen: new Date(),
      last_heartbeat: new Date(),
      ip_address,
      hardware_id: hardware_id || epc.hardware_id,
      'version.os': versions?.os,
      'version.open5gs': versions?.open5gs
    };

    // Update system uptime if provided
    if (system?.uptime_seconds !== undefined && system?.uptime_seconds !== null) {
      updateData['metrics.system_uptime_seconds'] = system.uptime_seconds;
    }

    await checkinService.updateEPCStatus(epc, updateData);

    // Store logs if provided
    await checkinService.storeLogs(epc, logs, ip_address, device_code);

    // Save service status and check health
    await checkinService.saveServiceStatus(epc, services, system, network, versions);
    await checkinService.checkServiceHealth(epc, services);

    // Check for agent script updates (TEMPORARILY DISABLED - commands have wrong hashes)
    // TODO: Re-enable once manifest hashes are verified and commands use correct hashes
    console.log(`[EPC Check-in] UPDATE CHECK: Temporarily disabled - automatic update generation skipped`);

    // Fetch pending commands
    const commands = await checkinService.getPendingCommands(epc.epc_id);

    console.log(`[EPC Check-in] Found ${commands.length} pending command(s) for ${epc.epc_id}:`,
      commands.map(c => `${c.command_type} (${c.notes || 'no notes'})`).join(', '));

    // Mark commands as sent
    await checkinService.markCommandsAsSent(commands.map(c => c._id));

    // Build and return response
    const config = checkinService.buildCheckinConfig(epc);
    const response = checkinService.buildCheckinResponse(epc, commands, config);

    res.json(response);
  } catch (error) {
    console.error('[EPC Check-in] Error:', error);
    res.status(500).json({ error: 'Check-in failed', message: error.message });
  }
});

/**
 * POST /api/epc/checkin/commands/:command_id/result
 * Record command execution result
 */
router.post('/checkin/commands/:command_id/result', async (req, res) => {
  try {
    const { command_id } = req.params;
    const { success, output, error, exit_code } = req.body;

    const { EPCCommand } = require('../models/distributed-epc-schema');

    const command = await EPCCommand.findByIdAndUpdate(
      command_id,
      {
        status: success ? 'completed' : 'failed',
        completed_at: new Date(),
        result: { success, output, error, exit_code }
      },
      { new: true }
    );

    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }

    console.log(`[EPC Command] Command ${command_id} completed: ${success ? 'SUCCESS' : 'FAILED'}`);
    res.json({ success: true, message: 'Command result recorded' });
  } catch (error) {
    console.error('[EPC Command Result] Error:', error);
    res.status(500).json({ error: 'Failed to record result', message: error.message });
  }
});

/**
 * POST /api/epc/checkin/ping-metrics
 * Receive ping metrics from remote EPC agents
 * Remote agents ping devices on their local network and send results here
 */
router.post('/checkin/ping-metrics', async (req, res) => {
  try {
    const { device_code, ping_metrics } = req.body;

    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    if (!Array.isArray(ping_metrics)) {
      return res.status(400).json({ error: 'ping_metrics must be an array' });
    }

    // Find EPC by device code to get tenant_id
    const epc = await checkinService.findEPCByDeviceCode(device_code);

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found for device_code' });
    }

    const tenantId = epc.tenant_id;
    let storedCount = 0;

    // Store each ping metric
    for (const metric of ping_metrics) {
      try {
        const { device_id, ip_address, success, response_time_ms, error } = metric;

        if (!device_id || !ip_address) {
          console.warn(`[Ping Metrics] Skipping invalid metric: missing device_id or ip_address`);
          continue;
        }

        const pingMetric = new PingMetrics({
          device_id,
          tenant_id: tenantId,
          timestamp: new Date(),
          ip_address,
          success: success !== false, // Default to true if not specified
          response_time_ms: response_time_ms || null,
          packet_loss: success === false ? 100 : 0,
          error: error || null,
          ping_method: 'icmp',
          source: 'remote_epc_agent',
          epc_id: epc.epc_id
        });

        await pingMetric.save();
        storedCount++;
      } catch (metricError) {
        console.error(`[Ping Metrics] Error storing metric:`, metricError);
        // Continue with next metric
      }
    }

    console.log(`[Ping Metrics] Received ${ping_metrics.length} metrics from ${device_code}, stored ${storedCount}`);

    res.json({
      success: true,
      received: ping_metrics.length,
      stored: storedCount
    });
  } catch (error) {
    console.error('[Ping Metrics] Error:', error);
    res.status(500).json({ error: 'Failed to process ping metrics', message: error.message });
  }
});

/**
 * GET /api/epc/checkin/monitoring-devices
 * Get list of devices this EPC should ping/monitor
 * Returns devices on the EPC's network (discovered via SNMP or configured)
 */
router.get('/checkin/monitoring-devices', async (req, res) => {
  try {
    const device_code = req.query.device_code || req.headers['x-device-code'];

    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    // Find EPC by device code
    const epc = await checkinService.findEPCByDeviceCode(device_code);

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found for device_code' });
    }

    const tenantId = epc.tenant_id;
    const epcId = epc.epc_id;
    const devices = [];

    // Get network equipment discovered by this EPC or associated with it
    const networkEquipment = await NetworkEquipment.find({
      tenantId,
      status: 'active',
      $or: [
        { 'notes.discovered_by_epc': epcId },
        { 'notes.epc_id': epcId }
      ]
    })
    .select('_id name type notes status')
    .lean();

    for (const equipment of networkEquipment) {
      try {
        const notes = equipment.notes ? (typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes) : {};
        const ipAddress = notes.management_ip || notes.ip_address || notes.ipAddress;
        
        if (ipAddress && ipAddress.trim()) {
          devices.push({
            device_id: equipment._id.toString(),
            name: equipment.name || 'Unknown Device',
            type: equipment.type || 'other',
            ip_address: ipAddress.trim(),
            source: 'network_equipment'
          });
        }
      } catch (e) {
        continue;
      }
    }

    // Get inventory items associated with this EPC's location/site
    // For now, we'll skip inventory items as they're typically managed differently
    // But could be added if needed

    console.log(`[Monitoring Devices] Returning ${devices.length} devices for EPC ${epcId} to monitor`);

    res.json({
      success: true,
      epc_id: epcId,
      devices,
      count: devices.length
    });
  } catch (error) {
    console.error('[Monitoring Devices] Error:', error);
    res.status(500).json({ error: 'Failed to get monitoring devices', message: error.message });
  }
});

module.exports = router;

