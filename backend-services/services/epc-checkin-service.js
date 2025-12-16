/**
 * EPC Check-in Service
 * Handles all check-in related business logic for remote EPC devices
 * This service is used by the check-in route handlers
 */

const { RemoteEPC, EPCCommand, EPCServiceStatus, EPCAlert, EPCLog } = require('../models/distributed-epc-schema');

const REQUIRED_SERVICES = ['open5gs-mmed', 'open5gs-sgwcd', 'open5gs-sgwud', 'open5gs-smfd', 'open5gs-upfd', 'snmpd'];

/**
 * Find EPC by device code
 */
async function findEPCByDeviceCode(deviceCode) {
  return await RemoteEPC.findOne({ device_code: deviceCode.toUpperCase() });
}

/**
 * Update EPC status and metadata
 */
async function updateEPCStatus(epc, updateData) {
  return await RemoteEPC.updateOne(
    { epc_id: epc.epc_id },
    { $set: updateData }
  );
}

/**
 * Parse and store logs from check-in
 */
async function storeLogs(epc, logs, ipAddress, deviceCode) {
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return;
  }

  try {
    // Filter logs to only store ERROR and WARNING level logs to reduce database growth
    // INFO and DEBUG logs are too verbose and not critical for troubleshooting
    const importantLogs = logs.filter(log => {
      const level = log.level || (log.message && log.message.toLowerCase().includes('error') ? 'error' : 
                                  log.message && log.message.toLowerCase().includes('warn') ? 'warning' : 'info');
      return level === 'error' || level === 'warning';
    });
    
    // Limit to last 20 important log entries to prevent excessive storage
    const logsToStore = importantLogs.slice(-20);
    
    if (logsToStore.length === 0) {
      return; // No important logs to store
    }
    
    console.log(`[EPC Check-in Service] Storing ${logsToStore.length} important log entries (filtered from ${logs.length} total)`);
    
    for (const logEntry of logsToStore) {
      // Parse log message if it's a pipe-separated string
      if (logEntry.message && typeof logEntry.message === 'string' && logEntry.message.includes('|')) {
        const logLines = logEntry.message.split('|').filter(l => l && l.trim());
        for (const line of logLines) {
          if (line.trim()) {
            // Extract timestamp and message from log line format: "YYYY-MM-DD HH:MM:SS [SOURCE] MESSAGE"
            const logMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[([^\]]+)\]\s*(.+)$/);
            if (logMatch) {
              await new EPCLog({
                epc_id: epc.epc_id,
                tenant_id: epc.tenant_id,
                log_type: 'checkin',
                source: logMatch[2] || 'epc-checkin-agent',
                level: line.toLowerCase().includes('error') ? 'error' : line.toLowerCase().includes('warn') ? 'warning' : 'info',
                message: logMatch[3] || line.trim(),
                details: { ip_address: ipAddress, device_code: deviceCode, timestamp: logMatch[1] }
              }).save();
            } else {
              await new EPCLog({
                epc_id: epc.epc_id,
                tenant_id: epc.tenant_id,
                log_type: 'checkin',
                source: logEntry.source || 'epc-checkin-agent',
                level: logEntry.level || 'info',
                message: line.trim(),
                details: { ip_address: ipAddress, device_code: deviceCode }
              }).save();
            }
          }
        }
      } else if (logEntry.message) {
        await new EPCLog({
          epc_id: epc.epc_id,
          tenant_id: epc.tenant_id,
          log_type: logEntry.log_type || 'checkin',
          source: logEntry.source || 'epc-checkin-agent',
          level: logEntry.level || 'info',
          message: typeof logEntry.message === 'string' ? logEntry.message : JSON.stringify(logEntry.message),
          details: { ip_address: ipAddress, device_code: deviceCode, ...logEntry.details }
        }).save();
      }
    }
  } catch (logError) {
    console.warn(`[EPC Check-in Service] Error storing logs:`, logError.message);
    // Don't fail check-in if log storage fails
  }
}

/**
 * Save service status from check-in
 */
async function saveServiceStatus(epc, services, system, network, versions) {
  if (!services && !system && !network && !versions) {
    return;
  }

  await new EPCServiceStatus({
    epc_id: epc.epc_id,
    tenant_id: epc.tenant_id,
    services: services || {},
    system: system || {},
    network: network || {},
    versions: versions || {}
  }).save();

  console.log(`[EPC Check-in Service] Saved service status for ${epc.epc_id}`, {
    hasServices: !!services,
    hasSystem: !!system,
    hasNetwork: !!network,
    hasVersions: !!versions,
    systemUptime: system?.uptime_seconds,
    cpuPercent: system?.cpu_percent,
    memoryPercent: system?.memory_percent
  });
}

/**
 * Check service health and create/update alerts
 */
async function checkServiceHealth(epc, services) {
  if (!services) return;

  for (const svc of REQUIRED_SERVICES) {
    const status = services[svc]?.status;
    if (status && status !== 'active' && status !== 'not-found') {
      const existingAlert = await EPCAlert.findOne({
        epc_id: epc.epc_id,
        alert_type: 'component_down',
        resolved: false,
        'details.service': svc
      });

      if (!existingAlert) {
        await new EPCAlert({
          tenant_id: epc.tenant_id,
          epc_id: epc.epc_id,
          severity: svc.includes('mme') || svc.includes('upf') ? 'critical' : 'error',
          alert_type: 'component_down',
          message: `Service ${svc} is ${status} on ${epc.site_name}`,
          details: { service: svc, status }
        }).save();
      }
    } else if (status === 'active') {
      await EPCAlert.updateMany(
        {
          epc_id: epc.epc_id,
          alert_type: 'component_down',
          'details.service': svc,
          resolved: false
        },
        {
          resolved: true,
          resolved_at: new Date(),
          resolved_by: 'auto'
        }
      );
    }
  }
}

/**
 * Get pending commands for EPC
 * Only returns commands with status 'pending' (not 'sent' or 'completed')
 * This prevents the same command from being returned multiple times
 */
async function getPendingCommands(epcId) {
  return await EPCCommand.find({
    epc_id: epcId,
    status: 'pending',  // Only pending - sent/completed commands should not be returned again
    expires_at: { $gt: new Date() }
  })
    .sort({ priority: 1, created_at: 1 })
    .lean();
}

/**
 * Mark commands as sent
 */
async function markCommandsAsSent(commandIds) {
  if (!commandIds || commandIds.length === 0) return;

  await EPCCommand.updateMany(
    { _id: { $in: commandIds } },
    { status: 'sent', sent_at: new Date() }
  );
}

/**
 * Build check-in response configuration
 */
function buildCheckinConfig(epc) {
  return {
    site_name: epc.site_name,
    site_id: epc.site_id,
    central_hss: 'hss.wisptools.io',
    hss_port: 3868,
    hss_config: epc.hss_config || {},
    snmp_config: epc.snmp_config || {},
    network_config: epc.network_config || {},
    deployment_type: epc.deployment_type || 'both'
  };
}

/**
 * Build check-in response
 */
function buildCheckinResponse(epc, commands, config) {
  return {
    status: 'ok',
    epc_id: epc.epc_id,
    tenant_id: epc.tenant_id,
    site_name: epc.site_name,
    checkin_interval: epc.metrics_config?.update_interval_seconds || 600, // Default 10 minutes (600 seconds) - best practice for production systems
    commands: commands.map(c => ({
      id: c._id.toString(),
      type: c.command_type,
      action: c.action,
      target_services: c.target_services,
      script_content: c.script_content,
      script_url: c.script_url,
      config_data: c.config_data
    })),
    config: config
  };
}

module.exports = {
  findEPCByDeviceCode,
  updateEPCStatus,
  storeLogs,
  saveServiceStatus,
  checkServiceHealth,
  getPendingCommands,
  markCommandsAsSent,
  buildCheckinConfig,
  buildCheckinResponse,
  REQUIRED_SERVICES
};

