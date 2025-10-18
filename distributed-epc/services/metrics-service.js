// Metrics Processing and Alert Generation Service
const { EPCAlert } = require('../models');

/**
 * Process metrics and perform analysis
 * @param {Object} metrics - Metrics data from remote EPC
 * @param {Object} epc - EPC configuration
 * @returns {Object} - Processed metrics with analysis
 */
async function processMetrics(metrics, epc) {
  // Calculate derived metrics
  const processed = {
    ...metrics,
    analysis: {
      cpu_status: getCpuStatus(metrics.system?.cpu_percent),
      memory_status: getMemoryStatus(metrics.system?.memory?.percent),
      disk_status: getDiskStatus(metrics.system?.disk?.percent),
      service_health: getServiceHealth(metrics.services)
    }
  };
  
  return processed;
}

/**
 * Generate alerts based on metrics
 * @param {Object} metrics - Metrics data
 * @param {Object} epc - EPC configuration
 * @returns {Array} - Array of alert objects
 */
async function generateAlerts(metrics, epc) {
  const alerts = [];
  
  // Check CPU usage
  if (metrics.system && metrics.system.cpu_percent > 80) {
    alerts.push({
      tenant_id: epc.tenant_id,
      epc_id: epc.epc_id,
      severity: 'warning',
      alert_type: 'high_cpu',
      message: `High CPU usage: ${metrics.system.cpu_percent}%`,
      details: { cpu_percent: metrics.system.cpu_percent }
    });
  }
  
  // Check memory usage
  if (metrics.system && metrics.system.memory_percent > 90) {
    alerts.push({
      tenant_id: epc.tenant_id,
      epc_id: epc.epc_id,
      severity: 'warning',
      alert_type: 'high_memory',
      message: `High memory usage: ${metrics.system.memory_percent}%`,
      details: { memory_percent: metrics.system.memory_percent }
    });
  }
  
  // Check IP pool exhaustion
  if (metrics.ogstun_pool && metrics.ogstun_pool.utilization_percent > 90) {
    alerts.push({
      tenant_id: epc.tenant_id,
      epc_id: epc.epc_id,
      severity: 'critical',
      alert_type: 'pool_exhausted',
      message: `IP pool nearly exhausted: ${metrics.ogstun_pool.utilization_percent}%`,
      details: metrics.ogstun_pool
    });
  }
  
  // Check component status
  if (metrics.components) {
    for (const [component, status] of Object.entries(metrics.components)) {
      if (status === 'stopped' || status === 'error') {
        alerts.push({
          tenant_id: epc.tenant_id,
          epc_id: epc.epc_id,
          severity: 'error',
          alert_type: 'component_down',
          message: `Component ${component} is ${status}`,
          details: { component, status }
        });
      }
    }
  }
  
  // Save new alerts
  if (alerts.length > 0) {
    await EPCAlert.insertMany(alerts);
  }
  
  return alerts;
}

/**
 * Helper functions for status classification
 */
function getCpuStatus(cpuPercent) {
  if (!cpuPercent) return 'unknown';
  if (cpuPercent < 50) return 'normal';
  if (cpuPercent < 80) return 'elevated';
  return 'critical';
}

function getMemoryStatus(memoryPercent) {
  if (!memoryPercent) return 'unknown';
  if (memoryPercent < 70) return 'normal';
  if (memoryPercent < 90) return 'elevated';
  return 'critical';
}

function getDiskStatus(diskPercent) {
  if (!diskPercent) return 'unknown';
  if (diskPercent < 80) return 'normal';
  if (diskPercent < 95) return 'elevated';
  return 'critical';
}

function getServiceHealth(services) {
  if (!services) return 'unknown';
  
  const serviceArray = Object.values(services);
  const activeCount = serviceArray.filter(s => s.status === 'active' || s === true).length;
  const totalCount = serviceArray.length;
  
  if (activeCount === totalCount) return 'healthy';
  if (activeCount > totalCount / 2) return 'degraded';
  return 'critical';
}

module.exports = {
  processMetrics,
  generateAlerts
};

