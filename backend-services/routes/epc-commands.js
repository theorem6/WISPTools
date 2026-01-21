/**
 * EPC Remote Command Management API
 * Allows queuing commands for headless EPCs to execute on check-in
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC, EPCCommand, EPCServiceStatus, EPCAlert } = require('../models/distributed-epc-schema');

// Required services to monitor on remote EPCs
const REQUIRED_SERVICES = [
  'open5gs-mmed',
  'open5gs-sgwcd', 
  'open5gs-sgwud',
  'open5gs-smfd',
  'open5gs-upfd',
  'snmpd'
];

/**
 * POST /api/epc/commands
 * Queue a new command for a remote EPC
 */
router.post('/commands', async (req, res) => {
  try {
    const { 
      epc_id, 
      command_type, 
      action, 
      target_services, 
      script_content,
      script_url,
      config_data,
      priority,
      expires_in_hours,
      notes 
    } = req.body;
    
    const tenant_id = req.headers['x-tenant-id'];
    
    if (!epc_id || !command_type) {
      return res.status(400).json({ error: 'epc_id and command_type are required' });
    }
    
    // Verify EPC exists and belongs to tenant
    const epc = await RemoteEPC.findOne({ epc_id, tenant_id }).lean();
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Create command
    const command = new EPCCommand({
      epc_id,
      tenant_id,
      command_type,
      action,
      target_services: target_services || ['all'],
      script_content,
      script_url,
      config_data,
      priority: priority || 5,
      expires_at: expires_in_hours 
        ? new Date(Date.now() + expires_in_hours * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000),
      notes,
      created_by: req.headers['x-user-id'] || 'system'
    });
    
    await command.save();
    
    console.log(`[EPC Command] Created command ${command._id} for EPC ${epc_id}: ${command_type}/${action}`);
    
    res.json({
      success: true,
      command_id: command._id,
      message: `Command queued for EPC ${epc.site_name}. Will execute on next check-in.`
    });
    
  } catch (error) {
    console.error('[EPC Command] Error creating command:', error);
    res.status(500).json({ error: 'Failed to create command', message: error.message });
  }
});

/**
 * GET /api/epc/:epc_id/commands
 * Get pending commands for an EPC (used by EPC during check-in)
 */
router.get('/:epc_id/commands', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const device_code = req.headers['x-device-code'] || req.query.device_code;
    
    // Verify EPC
    const epc = await RemoteEPC.findOne({ 
      $or: [{ epc_id }, { device_code: device_code?.toUpperCase() }]
    }).lean();
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Get pending commands sorted by priority
    const commands = await EPCCommand.find({
      epc_id: epc.epc_id,
      status: 'pending',
      expires_at: { $gt: new Date() }
    })
    .sort({ priority: 1, created_at: 1 })
    .lean();
    
    // Mark commands as sent
    if (commands.length > 0) {
      await EPCCommand.updateMany(
        { _id: { $in: commands.map(c => c._id) } },
        { status: 'sent', sent_at: new Date() }
      );
    }
    
    res.json({
      epc_id: epc.epc_id,
      commands: commands.map(c => ({
        id: c._id,
        type: c.command_type,
        action: c.action,
        target_services: c.target_services,
        script_content: c.script_content,
        script_url: c.script_url,
        config_data: c.config_data,
        priority: c.priority
      }))
    });
    
  } catch (error) {
    console.error('[EPC Command] Error fetching commands:', error);
    res.status(500).json({ error: 'Failed to fetch commands', message: error.message });
  }
});

/**
 * POST /api/epc/:epc_id/commands/:command_id/result
 * Report command execution result
 */
router.post('/:epc_id/commands/:command_id/result', async (req, res) => {
  try {
    const { epc_id, command_id } = req.params;
    const { success, output, error, exit_code } = req.body;
    
    const command = await EPCCommand.findOneAndUpdate(
      { _id: command_id, epc_id },
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
    
    console.log(`[EPC Command] Command ${command_id} completed for EPC ${epc_id}: ${success ? 'SUCCESS' : 'FAILED'}`);
    
    res.json({ success: true, message: 'Command result recorded' });
    
  } catch (error) {
    console.error('[EPC Command] Error recording result:', error);
    res.status(500).json({ error: 'Failed to record result', message: error.message });
  }
});

// NOTE: Check-in endpoint is handled in server.js at /api/epc/checkin
// This file only handles command result reporting

/**
 * Check for service issues and create alerts
 */
async function checkServiceAlerts(epc, services, system) {
  const alerts = [];
  
  // Check required services
  for (const svc of REQUIRED_SERVICES) {
    const status = services[svc]?.status;
    if (status && status !== 'active' && status !== 'not-found') {
      // Check if alert already exists
      const existingAlert = await EPCAlert.findOne({
        epc_id: epc.epc_id,
        alert_type: 'component_down',
        resolved: false,
        'details.service': svc
      });
      
      if (!existingAlert) {
        alerts.push({
          tenant_id: epc.tenant_id,
          epc_id: epc.epc_id,
          severity: svc.includes('mme') || svc.includes('upf') ? 'critical' : 'error',
          alert_type: 'component_down',
          message: `Service ${svc} is ${status} on ${epc.site_name}`,
          details: { service: svc, status }
        });
      }
    } else if (status === 'active') {
      // Resolve any existing alerts for this service
      await EPCAlert.updateMany(
        { epc_id: epc.epc_id, alert_type: 'component_down', 'details.service': svc, resolved: false },
        { resolved: true, resolved_at: new Date(), resolved_by: 'auto' }
      );
    }
  }
  
  // Check system resources
  if (system) {
    if (system.cpu_percent > 90) {
      alerts.push({
        tenant_id: epc.tenant_id,
        epc_id: epc.epc_id,
        severity: 'warning',
        alert_type: 'high_cpu',
        message: `High CPU usage (${system.cpu_percent}%) on ${epc.site_name}`,
        details: { cpu_percent: system.cpu_percent }
      });
    }
    
    if (system.memory_percent > 90) {
      alerts.push({
        tenant_id: epc.tenant_id,
        epc_id: epc.epc_id,
        severity: 'warning',
        alert_type: 'high_memory',
        message: `High memory usage (${system.memory_percent}%) on ${epc.site_name}`,
        details: { memory_percent: system.memory_percent }
      });
    }
    
    if (system.disk_percent > 90) {
      alerts.push({
        tenant_id: epc.tenant_id,
        epc_id: epc.epc_id,
        severity: 'warning',
        alert_type: 'high_disk',
        message: `High disk usage (${system.disk_percent}%) on ${epc.site_name}`,
        details: { disk_percent: system.disk_percent }
      });
    }
  }
  
  // Save new alerts
  if (alerts.length > 0) {
    await EPCAlert.insertMany(alerts);
    console.log(`[EPC Alert] Created ${alerts.length} alerts for EPC ${epc.epc_id}`);
  }
}

/**
 * GET /api/epc/:epc_id/status
 * Get latest service status for an EPC
 */
router.get('/:epc_id/status', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const tenant_id = req.headers['x-tenant-id'];
    
    const status = await EPCServiceStatus.findOne({ epc_id })
      .sort({ timestamp: -1 })
      .lean();
    
    if (!status) {
      return res.status(404).json({ error: 'No status data found' });
    }
    
    // Synchronize service uptime with system uptime
    // For active services, use system uptime to ensure consistency
    const systemUptime = status.system?.uptime_seconds || 0;
    
    if (status.services && systemUptime > 0) {
      // Handle both Map and plain object formats (Mongoose .lean() converts Maps to objects)
      let servicesObj;
      if (status.services instanceof Map) {
        servicesObj = Object.fromEntries(status.services);
      } else {
        servicesObj = { ...status.services };
      }
      
      // Update active services to use system uptime for consistency
      for (const [serviceName, serviceData] of Object.entries(servicesObj)) {
        if (serviceData && typeof serviceData === 'object' && serviceData.status === 'active') {
          // Always use system uptime for active services to keep them synchronized
          servicesObj[serviceName] = {
            ...serviceData,
            uptime_seconds: systemUptime
          };
        }
      }
      
      // Convert back to the original format
      status.services = servicesObj;
    }
    
    res.json(status);
    
  } catch (error) {
    console.error('[EPC Status] Error:', error);
    res.status(500).json({ error: 'Failed to get status', message: error.message });
  }
});

/**
 * GET /api/epc/:epc_id/status/history
 * Get service status history for graphs
 */
router.get('/:epc_id/status/history', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { hours = 24, limit = 100 } = req.query;
    
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    
    const history = await EPCServiceStatus.find({ 
      epc_id,
      timestamp: { $gte: since }
    })
    .sort({ timestamp: 1 })
    .limit(parseInt(limit))
    .lean();
    
    // Format for charts
    const chartData = history.map(h => ({
      timestamp: h.timestamp,
      cpu: h.system?.cpu_percent ?? null,
      memory: h.system?.memory_percent ?? null,
      disk: parseFloat(h.system?.disk_percent) || null,
      uptime: h.system?.uptime_seconds ?? null,
      load: h.system?.load_average?.[0] ?? null,
      services: Object.fromEntries(
        Object.entries(h.services || {}).map(([k, v]) => [k, v?.status])
      )
    }));
    
    res.json({
      epc_id,
      period_hours: parseInt(hours),
      data_points: chartData.length,
      history: chartData
    });
    
  } catch (error) {
    console.error('[EPC Status History] Error:', error);
    res.status(500).json({ error: 'Failed to get status history', message: error.message });
  }
});

/**
 * GET /api/epc/:epc_id/commands/history
 * Get command history for an EPC
 */
router.get('/:epc_id/commands/history', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { limit = 50 } = req.query;
    
    const commands = await EPCCommand.find({ epc_id })
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json({ commands });
    
  } catch (error) {
    console.error('[EPC Command History] Error:', error);
    res.status(500).json({ error: 'Failed to get command history', message: error.message });
  }
});

/**
 * POST /api/epc/:epc_id/service/:action
 * Quick service control shortcut
 */
router.post('/:epc_id/service/:action', async (req, res) => {
  try {
    const { epc_id, action } = req.params;
    const { services } = req.body;
    const tenant_id = req.headers['x-tenant-id'];
    
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use: start, stop, restart' });
    }
    
    const epc = await RemoteEPC.findOne({ epc_id, tenant_id }).lean();
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    const command = new EPCCommand({
      epc_id,
      tenant_id,
      command_type: 'service_control',
      action,
      target_services: services || ['all'],
      priority: 1, // High priority for service control
      created_by: req.headers['x-user-id'] || 'api'
    });
    
    await command.save();
    
    res.json({
      success: true,
      command_id: command._id,
      message: `${action} command queued for ${services?.join(', ') || 'all services'}`
    });
    
  } catch (error) {
    console.error('[EPC Service Control] Error:', error);
    res.status(500).json({ error: 'Failed to queue service command', message: error.message });
  }
});

/**
 * POST /api/epc/:epc_id/trigger-snmp-discovery
 * Queue a command to trigger SNMP discovery on remote EPC
 */
router.post('/:epc_id/trigger-snmp-discovery', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const tenant_id = req.headers['x-tenant-id'];
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'X-Tenant-ID header is required' });
    }
    
    // Verify EPC exists and belongs to tenant
    const epc = await RemoteEPC.findOne({ epc_id, tenant_id }).lean();
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Create command to run SNMP discovery script
    const script_content = `#!/bin/bash
# Force SNMP discovery
LOG_FILE="/var/log/wisptools-checkin.log"
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [FORCE-SNMP] $1" | tee -a "$LOG_FILE"
}

log "Forcing SNMP discovery scan..."
if [ -f /opt/wisptools/epc-snmp-discovery.sh ]; then
    /opt/wisptools/epc-snmp-discovery.sh
    log "SNMP discovery completed"
else
    log "ERROR: SNMP discovery script not found"
    exit 1
fi
`;
    
    const command = new EPCCommand({
      epc_id,
      tenant_id,
      command_type: 'script_execution',
      priority: 3, // Higher priority to execute quickly
      script_content,
      notes: 'Force SNMP discovery scan',
      created_by: req.headers['x-user-id'] || 'api'
    });
    
    await command.save();
    
    console.log(`[EPC Command] Queued SNMP discovery command ${command._id} for EPC ${epc_id}`);
    
    res.json({
      success: true,
      command_id: command._id.toString(),
      epc_id,
      message: `SNMP discovery command queued for ${epc.site_name}. Will execute on next check-in (within 60 seconds).`
    });
    
  } catch (error) {
    console.error('[EPC Command] Error queuing SNMP discovery:', error);
    res.status(500).json({ error: 'Failed to queue SNMP discovery', message: error.message });
  }
});

module.exports = router;

