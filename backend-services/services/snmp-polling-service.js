/**
 * SNMP Polling Service
 * Polls deployed SNMP devices and stores metrics for graphing
 */

const snmp = require('net-snmp');
const mongoose = require('mongoose');
const { NetworkEquipment } = require('../models/network');
const { SNMPMetrics } = require('../models/snmp-metrics-schema');

class SNMPPollingService {
  constructor() {
    this.pollingInterval = null;
    this.isPolling = false;
    this.pollIntervalMs = 5 * 60 * 1000; // Poll every 5 minutes
  }

  /**
   * Start the polling service
   */
  async start() {
    if (this.pollingInterval) {
      console.log('[SNMP Polling] Service already running');
      return;
    }

    console.log('[SNMP Polling] Starting polling service...');
    
    // Initial poll after 10 seconds
    setTimeout(() => this.pollAllDevices(), 10000);
    
    // Then poll every 5 minutes
    this.pollingInterval = setInterval(() => {
      this.pollAllDevices();
    }, this.pollIntervalMs);

    console.log(`[SNMP Polling] Service started - polling every ${this.pollIntervalMs / 1000}s`);
  }

  /**
   * Stop the polling service
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[SNMP Polling] Service stopped');
    }
  }

  /**
   * Poll all deployed devices with graphs enabled
   */
  async pollAllDevices() {
    if (this.isPolling) {
      console.log('[SNMP Polling] Poll already in progress, skipping...');
      return;
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      // Find all devices with graphs enabled (same logic as graphs endpoint)
      // Include both deployed and discovered devices without siteId
      const devices = await NetworkEquipment.find({
        status: 'active'
      }).lean();

      console.log(`[SNMP Polling] Found ${devices.length} deployed devices to check`);

      let polledCount = 0;
      let errorCount = 0;

      // Process devices in parallel (batch of 10 at a time)
      const batchSize = 10;
      for (let i = 0; i < devices.length; i += batchSize) {
        const batch = devices.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(device => this.pollDevice(device))
        ).then(results => {
          results.forEach((result, idx) => {
            if (result.status === 'fulfilled' && result.value) {
              polledCount++;
            } else {
              errorCount++;
              console.error(`[SNMP Polling] Failed to poll device ${batch[idx]._id}:`, result.reason?.message || 'Unknown error');
            }
          });
        });

        // Small delay between batches to avoid overwhelming the system
        if (i + batchSize < devices.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[SNMP Polling] Completed: ${polledCount} polled, ${errorCount} errors in ${duration}s`);
    } catch (error) {
      console.error('[SNMP Polling] Error during polling cycle:', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Poll a single device
   */
  async pollDevice(device) {
    try {
      // Parse notes to get SNMP config
      let notes = {};
      if (device.notes) {
        try {
          notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
        } catch (e) {
          notes = {};
        }
      }

      // Check if graphs are enabled (default true, same logic as graphs endpoint)
      const enableGraphs = notes.enable_graphs !== false;
      
      // Check if this is a discovered device (from EPC agents)
      const isDiscovered = notes.discovery_source === 'epc_snmp_agent' || 
                          (typeof device.notes === 'string' && device.notes.includes('epc_snmp_agent'));
      
      // Include device if graphs enabled OR if it's a discovered device (always poll discovered devices)
      if (!enableGraphs && !isDiscovered) {
        return false; // Skip devices with graphs explicitly disabled
      }

      // Get SNMP configuration (same logic as graphs endpoint)
      const ipAddress = notes.management_ip || notes.ip_address || notes.ipAddress || device.serialNumber;
      if (!ipAddress || !/^\d+\.\d+\.\d+\.\d+$/.test(ipAddress)) {
        return false; // Skip if no valid IP
      }
      
      // Check if device has SNMP capability (has SNMP community or is discovered)
      const hasSNMPConfig = notes.snmp_community || notes.snmp_version || isDiscovered;
      if (!hasSNMPConfig) {
        return false; // Skip devices without SNMP configuration
      }

      const snmpVersion = notes.snmp_version || '2c';
      const communities = notes.snmp_communities || [notes.snmp_community || 'public'];
      const community = Array.isArray(communities) ? communities[0] : communities;

      // Determine device type for OID selection
      const deviceType = device.type || notes.device_type || 'generic';

      // Perform SNMP poll
      const pollStartTime = Date.now();
      const metrics = await this.performSNMPPoll(ipAddress, community, snmpVersion, deviceType);
      const pollDuration = Date.now() - pollStartTime;

      if (!metrics) {
        return false; // Poll failed
      }

      // Save metrics to database
      const metricDoc = new SNMPMetrics({
        device_id: device._id.toString(),
        tenant_id: device.tenantId,
        timestamp: new Date(),
        system: metrics.system || {},
        resources: metrics.resources || {},
        network: metrics.network || {},
        temperature: metrics.temperature || null,
        raw_oids: metrics.rawOids || {},
        collection_method: 'poll',
        poll_duration_ms: pollDuration
      });

      await metricDoc.save();

      return true;
    } catch (error) {
      console.error(`[SNMP Polling] Error polling device ${device._id}:`, error.message);
      return false;
    }
  }

  /**
   * Perform SNMP poll on a device
   */
  async performSNMPPoll(ipAddress, community, version, deviceType) {
    return new Promise((resolve) => {
      try {
        const session = snmp.createSession(ipAddress, community, {
          port: 161,
          retries: 1,
          timeout: 5000,
          transport: 'udp4'
        });

        // Get standard OIDs based on device type
        const oids = this.getOIDsForDeviceType(deviceType);
        const oidStrings = oids.map(o => o.oid);

        session.get(oidStrings, (error, varbinds) => {
          session.close();

          if (error || !varbinds) {
            console.warn(`[SNMP Polling] Failed to poll ${ipAddress}:`, error?.message || 'No response');
            resolve(null);
            return;
          }

          // Parse varbinds into metrics
          const metrics = this.parseVarbinds(varbinds, oids, deviceType);
          resolve(metrics);
        });

        // Timeout handler
        setTimeout(() => {
          session.close();
          resolve(null);
        }, 10000);
      } catch (error) {
        console.error(`[SNMP Polling] Error creating session for ${ipAddress}:`, error.message);
        resolve(null);
      }
    });
  }

  /**
   * Get OIDs to poll based on device type
   */
  getOIDsForDeviceType(deviceType) {
    const baseOIDs = [
      { oid: '1.3.6.1.2.1.1.1.0', name: 'sysDescr' }, // System description
      { oid: '1.3.6.1.2.1.1.3.0', name: 'sysUpTime' }, // System uptime
      { oid: '1.3.6.1.2.1.1.5.0', name: 'sysName' },   // System name
      { oid: '1.3.6.1.2.1.1.6.0', name: 'sysLocation' }, // System location
    ];

    // CPU and Memory (HR-MIB)
    const resourceOIDs = [
      { oid: '1.3.6.1.4.1.2021.11.9.0', name: 'cpuUser' },
      { oid: '1.3.6.1.4.1.2021.11.10.0', name: 'cpuSystem' },
      { oid: '1.3.6.1.4.1.2021.11.11.0', name: 'cpuIdle' },
      { oid: '1.3.6.1.4.1.2021.4.5.0', name: 'memTotalReal' },
      { oid: '1.3.6.1.4.1.2021.4.6.0', name: 'memAvailReal' },
      { oid: '1.3.6.1.4.1.2021.10.1.3.1', name: 'laLoad1' },
      { oid: '1.3.6.1.4.1.2021.10.1.3.2', name: 'laLoad5' },
      { oid: '1.3.6.1.4.1.2021.10.1.3.3', name: 'laLoad15' },
    ];

    // Interface OIDs (primary interface - index 1)
    const interfaceOIDs = [
      { oid: '1.3.6.1.2.1.2.2.1.2.1', name: 'ifDescr' },
      { oid: '1.3.6.1.2.1.2.2.1.5.1', name: 'ifSpeed' },
      { oid: '1.3.6.1.2.1.2.2.1.8.1', name: 'ifOperStatus' },
      { oid: '1.3.6.1.2.1.2.2.1.10.1', name: 'ifInOctets' },
      { oid: '1.3.6.1.2.1.2.2.1.16.1', name: 'ifOutOctets' },
      { oid: '1.3.6.1.2.1.2.2.1.14.1', name: 'ifInErrors' },
      { oid: '1.3.6.1.2.1.2.2.1.20.1', name: 'ifOutErrors' },
    ];

    let oids = [...baseOIDs, ...resourceOIDs, ...interfaceOIDs];

    // Add device-type-specific OIDs
    if (deviceType === 'mikrotik') {
      // Mikrotik-specific OIDs
      oids.push(
        { oid: '1.3.6.1.4.1.14988.1.1.1.2.1.1', name: 'mtxrCPU' },
        { oid: '1.3.6.1.4.1.14988.1.1.1.2.1.5', name: 'mtxrUsedMemory' },
        { oid: '1.3.6.1.4.1.14988.1.1.1.2.1.6', name: 'mtxrFreeMemory' },
        { oid: '1.3.6.1.4.1.14988.1.1.1.2.1.7', name: 'mtxrTotalMemory' }
      );
    } else if (deviceType === 'switch') {
      // Switch-specific OIDs - get interface statistics
      // Already included in interfaceOIDs
    } else if (deviceType === 'router') {
      // Router-specific OIDs
      // Could add routing table statistics here
    }

    return oids;
  }

  /**
   * Parse SNMP varbinds into structured metrics
   */
  parseVarbinds(varbinds, oids, deviceType) {
    const rawOids = {};
    const metrics = {
      system: {},
      resources: {},
      network: {},
      temperature: null,
      rawOids: {}
    };

    varbinds.forEach((varbind, index) => {
      if (snmp.isVarbindError(varbind)) {
        return; // Skip errors
      }

      const oidConfig = oids[index];
      if (!oidConfig) return;

      const value = varbind.value;
      rawOids[oidConfig.name] = value;

      // Parse based on OID name
      switch (oidConfig.name) {
        case 'sysDescr':
          metrics.system.sys_descr = value?.toString() || '';
          break;
        case 'sysUpTime':
          metrics.system.uptime_seconds = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
          break;
        case 'sysName':
          metrics.system.hostname = value?.toString() || '';
          break;
        case 'sysLocation':
          metrics.system.sys_location = value?.toString() || '';
          break;

        case 'cpuUser':
        case 'cpuSystem':
        case 'cpuIdle':
          // Calculate CPU percentage from Mikrotik or standard
          if (deviceType === 'mikrotik') {
            const cpuValue = typeof value === 'number' ? value : parseFloat(value?.toString() || '0');
            if (oidConfig.name === 'mtxrCPU') {
              metrics.resources.cpu_percent = cpuValue;
            }
          } else {
            // Calculate from user+system / (user+system+idle)
            const cpuUser = rawOids.cpuUser || 0;
            const cpuSystem = rawOids.cpuSystem || 0;
            const cpuIdle = rawOids.cpuIdle || 0;
            const total = cpuUser + cpuSystem + cpuIdle;
            if (total > 0) {
              metrics.resources.cpu_percent = ((cpuUser + cpuSystem) / total) * 100;
            }
          }
          break;

        case 'memTotalReal':
          metrics.resources.memory_total_mb = typeof value === 'number' ? Math.floor(value / 1024) : Math.floor(parseInt(value?.toString() || '0') / 1024);
          break;
        case 'memAvailReal':
          metrics.resources.memory_free_mb = typeof value === 'number' ? Math.floor(value / 1024) : Math.floor(parseInt(value?.toString() || '0') / 1024);
          if (metrics.resources.memory_total_mb && metrics.resources.memory_free_mb) {
            metrics.resources.memory_used_mb = metrics.resources.memory_total_mb - metrics.resources.memory_free_mb;
            metrics.resources.memory_percent = (metrics.resources.memory_used_mb / metrics.resources.memory_total_mb) * 100;
          }
          break;

        case 'mtxrUsedMemory':
          metrics.resources.memory_used_mb = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
          break;
        case 'mtxrFreeMemory':
          metrics.resources.memory_free_mb = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
          break;
        case 'mtxrTotalMemory':
          metrics.resources.memory_total_mb = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
          if (metrics.resources.memory_total_mb && metrics.resources.memory_used_mb) {
            metrics.resources.memory_percent = (metrics.resources.memory_used_mb / metrics.resources.memory_total_mb) * 100;
          }
          break;

        case 'laLoad1':
        case 'laLoad5':
        case 'laLoad15':
          if (!metrics.resources.load_average) {
            metrics.resources.load_average = [];
          }
          const load = typeof value === 'number' ? value : parseFloat(value?.toString() || '0');
          metrics.resources.load_average.push(load);
          break;

        case 'ifDescr':
          metrics.network.interface_name = value?.toString() || '';
          break;
        case 'ifSpeed':
          metrics.network.interface_speed = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
          break;
        case 'ifOperStatus':
          metrics.network.interface_status = value === 1 ? 'up' : 'down';
          break;
        case 'ifInOctets':
          metrics.network.interface_in_octets = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
          break;
        case 'ifOutOctets':
          metrics.network.interface_out_octets = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
          break;
        case 'ifInErrors':
          metrics.network.interface_in_errors = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
          break;
        case 'ifOutErrors':
          metrics.network.interface_out_errors = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
          break;
      }
    });

    metrics.rawOids = rawOids;
    return metrics;
  }

  /**
   * Manually poll a specific device
   */
  async pollDeviceById(deviceId, tenantId) {
    try {
      const device = await NetworkEquipment.findOne({
        _id: deviceId,
        tenantId: tenantId
      }).lean();

      if (!device) {
        throw new Error('Device not found');
      }

      return await this.pollDevice(device);
    } catch (error) {
      console.error(`[SNMP Polling] Error polling device ${deviceId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new SNMPPollingService();

