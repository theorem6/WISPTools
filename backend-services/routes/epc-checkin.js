/**
 * EPC Check-in Routes
 * Handles check-in requests from remote EPC devices
 * MUST be defined BEFORE /api/epc routes (no tenant ID required)
 */

const express = require('express');
const router = express.Router();
const checkinService = require('../services/epc-checkin-service');

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

module.exports = router;

