/**
 * Ping Monitoring Service
 * Pings all deployed devices with IP addresses every 5 minutes
 * Stores ping metrics for uptime graphs and alarms
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const mongoose = require('mongoose');
const { InventoryItem } = require('../models/inventory');
const { NetworkEquipment } = require('../models/network');
const { PingMetrics } = require('../models/ping-metrics-schema');

const execAsync = promisify(exec);

class PingMonitoringService {
  constructor() {
    this.monitoringInterval = null;
    this.isMonitoring = false;
    this.pingIntervalMs = 5 * 60 * 1000; // Ping every 5 minutes
    this.pingTimeoutMs = 3000; // 3 second timeout per ping
    this.alarmThreshold = 3; // Alert after 3 consecutive failures
  }

  /**
   * Start the ping monitoring service
   */
  async start() {
    if (this.monitoringInterval) {
      console.log('[Ping Monitoring] Service already running');
      return;
    }

    console.log('[Ping Monitoring] Starting ping monitoring service...');
    
    // Initial ping after 10 seconds
    setTimeout(() => this.pingAllDevices(), 10000);
    
    // Then ping every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.pingAllDevices();
    }, this.pingIntervalMs);

    console.log(`[Ping Monitoring] Service started - pinging every ${this.pingIntervalMs / 1000}s`);
  }

  /**
   * Stop the ping monitoring service
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[Ping Monitoring] Service stopped');
    }
  }

  /**
   * Ping a single IP address
   * Returns: { success: boolean, responseTime: number (ms) | null, error: string | null }
   */
  async pingIP(ipAddress) {
    if (!ipAddress || typeof ipAddress !== 'string') {
      return { success: false, responseTime: null, error: 'Invalid IP address' };
    }

    // Validate IP address format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
      return { success: false, responseTime: null, error: 'Invalid IP address format' };
    }

    try {
      // Use ping with timeout (works on both Linux and Windows)
      // Linux: ping -c 1 -W 3000
      // Windows: ping -n 1 -w 3000
      const isWindows = process.platform === 'win32';
      const pingCommand = isWindows
        ? `ping -n 1 -w ${this.pingTimeoutMs} ${ipAddress}`
        : `ping -c 1 -W ${Math.floor(this.pingTimeoutMs / 1000)} ${ipAddress}`;

      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(pingCommand, {
        timeout: this.pingTimeoutMs + 1000
      });
      const responseTime = Date.now() - startTime;

      // Check if ping was successful
      // Linux: looks for "1 received" or "1 packets transmitted, 1 received"
      // Windows: looks for "Reply from" or "TTL="
      const isSuccess = isWindows
        ? stdout.includes('Reply from') || stdout.includes('TTL=')
        : stdout.includes('1 received') || stdout.includes('1 packets transmitted, 1 received');

      if (isSuccess) {
        // Try to extract actual response time from output
        let actualResponseTime = responseTime;
        if (isWindows) {
          // Windows format: "Reply from 192.168.1.1: bytes=32 time<1ms TTL=64"
          const timeMatch = stdout.match(/time[<=](\d+)ms/i);
          if (timeMatch) {
            actualResponseTime = parseInt(timeMatch[1], 10);
          }
        } else {
          // Linux format: "64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.234 ms"
          const timeMatch = stdout.match(/time=([\d.]+)\s*ms/i);
          if (timeMatch) {
            actualResponseTime = parseFloat(timeMatch[1]);
          }
        }

        return {
          success: true,
          responseTime: actualResponseTime,
          error: null
        };
      } else {
        return {
          success: false,
          responseTime: null,
          error: 'No reply received'
        };
      }
    } catch (error) {
      return {
        success: false,
        responseTime: null,
        error: error.message || 'Ping failed'
      };
    }
  }

  /**
   * Get or calculate consecutive failures for a device
   */
  async getConsecutiveFailures(deviceId, tenantId) {
    try {
      const lastMetrics = await PingMetrics.find({
        device_id: deviceId,
        tenant_id: tenantId
      })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

      if (lastMetrics.length === 0) {
        return 0;
      }

      // Count consecutive failures from most recent
      let failures = 0;
      for (const metric of lastMetrics) {
        if (!metric.success) {
          failures++;
        } else {
          break; // Stop counting when we hit a success
        }
      }

      return failures;
    } catch (error) {
      console.error(`[Ping Monitoring] Error getting consecutive failures for device ${deviceId}:`, error);
      return 0;
    }
  }

  /**
   * Store ping metric
   */
  async storePingMetric(deviceId, tenantId, ipAddress, pingResult, previousFailures = 0) {
    try {
      const now = new Date();
      const consecutiveFailures = pingResult.success ? 0 : previousFailures + 1;

      const metric = new PingMetrics({
        device_id: deviceId,
        tenant_id: tenantId,
        timestamp: now,
        ip_address: ipAddress,
        success: pingResult.success,
        response_time_ms: pingResult.responseTime || null,
        packet_loss: pingResult.success ? 0 : 100,
        consecutive_failures: consecutiveFailures,
        last_success: pingResult.success ? now : null,
        last_failure: !pingResult.success ? now : null,
        error: pingResult.error || null,
        ping_method: 'icmp'
      });

      await metric.save();

      // Check if we should trigger an alarm
      if (consecutiveFailures >= this.alarmThreshold) {
        await this.triggerAlarm(deviceId, tenantId, ipAddress, consecutiveFailures);
      }

      return metric;
    } catch (error) {
      console.error(`[Ping Monitoring] Error storing ping metric:`, error);
      throw error;
    }
  }

  /**
   * Trigger alarm for device failure
   */
  async triggerAlarm(deviceId, tenantId, ipAddress, consecutiveFailures) {
    try {
      console.warn(`[Ping Monitoring] 🚨 ALARM: Device ${deviceId} (${ipAddress}) has failed ${consecutiveFailures} consecutive pings`);

      // Check if alarm already exists (don't spam)
      const { InventoryItem } = require('../models/inventory');
      const item = await InventoryItem.findOne({ _id: deviceId, tenantId });

      if (item) {
        // Check if we already have an unacknowledged alarm for this
        const existingAlarm = item.alerts?.find(
          alert => alert.type === 'custom' &&
          alert.message?.includes('ping failure') &&
          !alert.acknowledged &&
          (Date.now() - new Date(alert.createdAt).getTime()) < 60 * 60 * 1000 // Within last hour
        );

        if (!existingAlarm) {
          // Add alarm to inventory item
          if (!item.alerts) {
            item.alerts = [];
          }

          item.alerts.push({
            type: 'custom',
            message: `Device ${ipAddress} has failed ${consecutiveFailures} consecutive pings`,
            severity: consecutiveFailures >= 5 ? 'critical' : 'warning',
            createdAt: new Date(),
            acknowledged: false
          });

          await item.save();
          console.log(`[Ping Monitoring] Added alarm to inventory item ${deviceId}`);
        }
      }
    } catch (error) {
      console.error(`[Ping Monitoring] Error triggering alarm:`, error);
    }
  }

  /**
   * Ping all deployed devices with IP addresses
   */
  async pingAllDevices() {
    if (this.isMonitoring) {
      console.log('[Ping Monitoring] Ping cycle already in progress, skipping...');
      return;
    }

    this.isMonitoring = true;
    const startTime = Date.now();

    try {
      // Get ALL inventory items with IP addresses (not just deployed) - ping sweep should check all devices
      const inventoryItems = await InventoryItem.find({
        $or: [
          { ipAddress: { $exists: true, $ne: null, $ne: '' } },
          { 'technicalSpecs.ipAddress': { $exists: true, $ne: null, $ne: '' } }
        ],
        tenantId: { $exists: true } // Ensure tenantId exists
      }).select('_id tenantId ipAddress technicalSpecs.ipAddress').lean();

      // Get all network equipment with IP addresses (same logic as graphs endpoint)
      // Include both deployed and discovered devices without siteId
      const networkEquipment = await NetworkEquipment.find({
        status: 'active'
      }).select('_id tenantId notes').lean();

      console.log(`[Ping Monitoring] Found ${inventoryItems.length} inventory items and ${networkEquipment.length} network equipment to check`);

      const devicesToPing = [];

      // Process inventory items
      for (const item of inventoryItems) {
        const ipAddress = item.ipAddress || item.technicalSpecs?.ipAddress;
        if (ipAddress && ipAddress.trim()) {
          devicesToPing.push({
            deviceId: item._id.toString(),
            tenantId: item.tenantId,
            ipAddress: ipAddress.trim(),
            type: 'inventory'
          });
        }
      }

      // Process network equipment (IP might be in notes JSON)
      // Ping ALL devices with IP addresses - no filtering by graphs or discovery status
      for (const equipment of networkEquipment) {
        try {
          const notes = equipment.notes ? (typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes) : {};
          const ipAddress = notes.management_ip || notes.ip_address || notes.ipAddress;
          
          // Ping ALL devices with valid IP addresses - no filters
          if (ipAddress && ipAddress.trim()) {
            devicesToPing.push({
              deviceId: equipment._id.toString(),
              tenantId: equipment.tenantId,
              ipAddress: ipAddress.trim(),
              type: 'network_equipment'
            });
          }
        } catch (e) {
          // Invalid JSON in notes, skip
          continue;
        }
      }

      console.log(`[Ping Monitoring] Pinging ${devicesToPing.length} devices...`);

      let successCount = 0;
      let failureCount = 0;

      // Ping devices in parallel (batch of 20 at a time to avoid overwhelming)
      const batchSize = 20;
      for (let i = 0; i < devicesToPing.length; i += batchSize) {
        const batch = devicesToPing.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (device) => {
            try {
              const previousFailures = await this.getConsecutiveFailures(device.deviceId, device.tenantId);
              const pingResult = await this.pingIP(device.ipAddress);
              await this.storePingMetric(
                device.deviceId,
                device.tenantId,
                device.ipAddress,
                pingResult,
                previousFailures
              );

              if (pingResult.success) {
                successCount++;
              } else {
                failureCount++;
              }
            } catch (error) {
              failureCount++;
              console.error(`[Ping Monitoring] Error pinging device ${device.deviceId}:`, error.message);
            }
          })
        );

        // Small delay between batches
        if (i + batchSize < devicesToPing.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Ping Monitoring] Completed: ${successCount} successful, ${failureCount} failed in ${duration}s`);
    } catch (error) {
      console.error('[Ping Monitoring] Error in ping cycle:', error);
    } finally {
      this.isMonitoring = false;
    }
  }

  /**
   * Ping a specific device (for manual/on-demand pings)
   */
  async pingDevice(deviceId, tenantId, ipAddress) {
    try {
      const previousFailures = await this.getConsecutiveFailures(deviceId, tenantId);
      const pingResult = await this.pingIP(ipAddress);
      const metric = await this.storePingMetric(deviceId, tenantId, ipAddress, pingResult, previousFailures);
      return metric;
    } catch (error) {
      console.error(`[Ping Monitoring] Error pinging device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get ping statistics for a device
   */
  async getPingStats(deviceId, tenantId, hours = 24) {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      const metrics = await PingMetrics.find({
        device_id: deviceId,
        tenant_id: tenantId,
        timestamp: { $gte: startTime }
      })
      .sort({ timestamp: 1 })
      .lean();

      if (metrics.length === 0) {
        return {
          total: 0,
          successful: 0,
          failed: 0,
          uptime_percent: 0,
          avg_response_time_ms: null,
          current_status: 'unknown'
        };
      }

      const successful = metrics.filter(m => m.success).length;
      const failed = metrics.length - successful;
      const uptimePercent = (successful / metrics.length) * 100;
      
      const responseTimes = metrics
        .filter(m => m.response_time_ms !== null && m.response_time_ms !== undefined)
        .map(m => m.response_time_ms);
      
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => (a || 0) + (b || 0), 0) / responseTimes.length
        : null;

      const lastMetric = metrics[metrics.length - 1];
      const currentStatus = lastMetric.success ? 'online' : 'offline';

      return {
        total: metrics.length,
        successful,
        failed,
        uptime_percent: Math.round(uptimePercent * 100) / 100,
        avg_response_time_ms: avgResponseTime ? Math.round(avgResponseTime * 100) / 100 : null,
        current_status: currentStatus,
        last_ping: lastMetric.timestamp,
        consecutive_failures: lastMetric.consecutive_failures || 0
      };
    } catch (error) {
      console.error(`[Ping Monitoring] Error getting ping stats:`, error);
      throw error;
    }
  }
}

// Singleton instance
let pingMonitoringService = null;

function getPingMonitoringService() {
  if (!pingMonitoringService) {
    pingMonitoringService = new PingMonitoringService();
  }
  return pingMonitoringService;
}

module.exports = {
  PingMonitoringService,
  getPingMonitoringService
};

