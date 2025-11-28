/**
 * SNMP Data Collector Service
 * Handles SNMP polling, trap reception, and data processing for EPC monitoring
 */

const snmp = require('net-snmp');
const EventEmitter = require('events');
const { SNMPMetrics } = require('../models/snmp-metrics-schema');

class SNMPCollectorService extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // Active SNMP sessions
    this.devices = new Map();  // Registered devices
    this.trapListener = null;  // SNMP trap listener
    this.pollingIntervals = new Map(); // Polling intervals
    this.defaultCommunity = process.env.SNMP_DEFAULT_COMMUNITY || 'public';
    this.trapPort = parseInt(process.env.SNMP_TRAP_PORT) || 162;
  }

  /**
   * Initialize SNMP collector service
   */
  async initialize() {
    try {
      // Start SNMP trap listener
      await this.startTrapListener();
      
      console.log('[SNMP Collector] Service initialized');
      return { success: true };
    } catch (error) {
      console.error('[SNMP Collector] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register EPC device for SNMP monitoring
   */
  async registerDevice(deviceConfig) {
    const {
      deviceId,
      tenantId,
      ipAddress,
      snmpVersion = '2c',
      community = this.defaultCommunity,
      username,
      authProtocol,
      authKey,
      privProtocol,
      privKey,
      pollingInterval = 60000, // 1 minute default
      oids = []
    } = deviceConfig;

    try {
      // Create SNMP session based on version
      let session;
      if (snmpVersion === '3') {
        const user = {
          name: username,
          level: snmp.SecurityLevel.authPriv,
          authProtocol: authProtocol === 'SHA' ? snmp.AuthProtocols.sha : snmp.AuthProtocols.md5,
          authKey: authKey,
          privProtocol: privProtocol === 'AES' ? snmp.PrivProtocols.aes : snmp.PrivProtocols.des,
          privKey: privKey
        };
        session = snmp.createV3Session(ipAddress, user);
      } else {
        session = snmp.createSession(ipAddress, community);
      }

      // Store device configuration
      const device = {
        deviceId,
        tenantId,
        ipAddress,
        snmpVersion,
        community,
        session,
        pollingInterval,
        oids: oids.length > 0 ? oids : this.getDefaultOIDs(),
        lastPoll: null,
        status: 'active',
        metrics: {}
      };

      this.devices.set(deviceId, device);
      this.sessions.set(deviceId, session);

      // Start polling for this device
      this.startPolling(deviceId);

      console.log(`[SNMP Collector] Registered device: ${deviceId} (${ipAddress})`);
      return { success: true, deviceId };
    } catch (error) {
      console.error(`[SNMP Collector] Failed to register device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get default OIDs for EPC monitoring
   */
  getDefaultOIDs() {
    return [
      // System information
      { oid: '1.3.6.1.2.1.1.1.0', name: 'sysDescr', type: 'string' },
      { oid: '1.3.6.1.2.1.1.3.0', name: 'sysUpTime', type: 'timeticks' },
      { oid: '1.3.6.1.2.1.1.5.0', name: 'sysName', type: 'string' },
      
      // CPU and Memory
      { oid: '1.3.6.1.4.1.2021.11.9.0', name: 'cpuUser', type: 'integer' },
      { oid: '1.3.6.1.4.1.2021.11.10.0', name: 'cpuSystem', type: 'integer' },
      { oid: '1.3.6.1.4.1.2021.11.11.0', name: 'cpuIdle', type: 'integer' },
      { oid: '1.3.6.1.4.1.2021.4.5.0', name: 'memTotalReal', type: 'integer' },
      { oid: '1.3.6.1.4.1.2021.4.6.0', name: 'memAvailReal', type: 'integer' },
      
      // Network interfaces
      { oid: '1.3.6.1.2.1.2.2.1.10', name: 'ifInOctets', type: 'counter', table: true },
      { oid: '1.3.6.1.2.1.2.2.1.16', name: 'ifOutOctets', type: 'counter', table: true },
      { oid: '1.3.6.1.2.1.2.2.1.8', name: 'ifOperStatus', type: 'integer', table: true },
      
      // Disk usage
      { oid: '1.3.6.1.4.1.2021.9.1.9', name: 'dskPercent', type: 'integer', table: true },
      
      // Load average
      { oid: '1.3.6.1.4.1.2021.10.1.3.1', name: 'laLoad1', type: 'string' },
      { oid: '1.3.6.1.4.1.2021.10.1.3.2', name: 'laLoad5', type: 'string' },
      { oid: '1.3.6.1.4.1.2021.10.1.3.3', name: 'laLoad15', type: 'string' }
    ];
  }

  /**
   * Get Mikrotik-specific OIDs based on device type
   */
  getMikrotikOIDs(deviceType = 'router') {
    const mikrotikOIDs = require('../config/mikrotikOIDs');
    
    let oids = mikrotikOIDs.getDefaultMikrotikOIDs();
    
    if (deviceType === 'ap' || deviceType === 'cpe') {
      oids = [...oids, ...mikrotikOIDs.getWirelessOIDs()];
    }
    
    if (deviceType === 'lte') {
      oids = [...oids, ...mikrotikOIDs.getLTEOIDs()];
    }
    
    return oids;
  }

  /**
   * Start polling for a specific device
   */
  startPolling(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) return;

    const pollDevice = async () => {
      try {
        const metrics = await this.pollDevice(deviceId);
        device.lastPoll = new Date();
        device.metrics = metrics;

        // Save metrics to database
        try {
          await this.saveMetrics(deviceId, device.tenantId, metrics, device.lastPoll);
        } catch (saveError) {
          console.error(`[SNMP Collector] Failed to save metrics for ${deviceId}:`, saveError);
        }
        
        // Emit metrics event for processing
        this.emit('metrics', {
          deviceId,
          tenantId: device.tenantId,
          timestamp: device.lastPoll,
          metrics
        });

      } catch (error) {
        console.error(`[SNMP Collector] Polling failed for device ${deviceId}:`, error);
        device.status = 'error';
        
        this.emit('error', {
          deviceId,
          tenantId: device.tenantId,
          error: error.message
        });
      }
    };

    // Initial poll
    pollDevice();

    // Set up recurring polling
    const intervalId = setInterval(pollDevice, device.pollingInterval);
    this.pollingIntervals.set(deviceId, intervalId);

    console.log(`[SNMP Collector] Started polling for device: ${deviceId}`);
  }

  /**
   * Poll a specific device for metrics
   */
  async pollDevice(deviceId) {
    return new Promise((resolve, reject) => {
      const device = this.devices.get(deviceId);
      if (!device) {
        return reject(new Error(`Device ${deviceId} not found`));
      }

      const session = device.session;
      const oids = device.oids.map(o => o.oid);
      const metrics = {};

      session.get(oids, (error, varbinds) => {
        if (error) {
          return reject(error);
        }

        varbinds.forEach((varbind, index) => {
          if (snmp.isVarbindError(varbind)) {
            console.warn(`[SNMP Collector] OID error for ${device.oids[index].name}:`, snmp.varbindError(varbind));
          } else {
            const oidConfig = device.oids[index];
            metrics[oidConfig.name] = {
              value: varbind.value,
              type: oidConfig.type,
              timestamp: new Date()
            };
          }
        });

        resolve(metrics);
      });
    });
  }

  /**
   * Start SNMP trap listener
   */
  async startTrapListener() {
    return new Promise((resolve, reject) => {
      try {
        this.trapListener = snmp.createReceiver({
          port: this.trapPort,
          disableAuthorization: true
        }, (error, notification) => {
          if (error) {
            console.error('[SNMP Collector] Trap listener error:', error);
            return;
          }

          // Process received trap
          this.processTrap(notification);
        });

        console.log(`[SNMP Collector] Trap listener started on port ${this.trapPort}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Save metrics to database
   */
  async saveMetrics(deviceId, tenantId, metricsData, timestamp) {
    try {
      // Parse OID values into structured format
      const parsedMetrics = this.parseSNMPMetrics(metricsData);
      
      const metricDoc = new SNMPMetrics({
        device_id: deviceId,
        tenant_id: tenantId,
        timestamp: timestamp || new Date(),
        system: parsedMetrics.system,
        resources: parsedMetrics.resources,
        network: parsedMetrics.network,
        temperature: parsedMetrics.temperature,
        raw_oids: metricsData, // Store raw OID data for reference
        collection_method: 'poll'
      });
      
      await metricDoc.save();
      console.log(`[SNMP Collector] Saved metrics for device ${deviceId}`);
    } catch (error) {
      console.error(`[SNMP Collector] Failed to save metrics:`, error);
      throw error;
    }
  }
  
  /**
   * Parse SNMP OID values into structured metrics
   */
  parseSNMPMetrics(oidData) {
    const parsed = {
      system: {},
      resources: {},
      network: {},
      temperature: null
    };
    
    // Parse common SNMP OIDs
    // System Uptime: 1.3.6.1.2.1.1.3.0 (sysUpTime)
    if (oidData['sysUpTime']?.value) {
      parsed.system.uptime_seconds = Math.floor(oidData['sysUpTime'].value / 100); // Convert from centiseconds
    }
    
    // System Description: 1.3.6.1.2.1.1.1.0
    if (oidData['sysDescr']?.value) {
      parsed.system.sys_descr = String(oidData['sysDescr'].value);
    }
    
    // System Contact: 1.3.6.1.2.1.1.4.0
    if (oidData['sysContact']?.value) {
      parsed.system.sys_contact = String(oidData['sysContact'].value);
    }
    
    // System Location: 1.3.6.1.2.1.1.6.0
    if (oidData['sysLocation']?.value) {
      parsed.system.sys_location = String(oidData['sysLocation'].value);
    }
    
    // Host Resources CPU Load: 1.3.6.1.2.1.25.3.3.1.2.1
    if (oidData['hrProcessorLoad']?.value !== undefined) {
      parsed.resources.cpu_percent = parseInt(oidData['hrProcessorLoad'].value) || 0;
    }
    
    // Host Resources Memory: 1.3.6.1.2.1.25.2.3.1.6.1 (used) and 1.3.6.1.2.1.25.2.3.1.5.1 (total)
    if (oidData['hrStorageUsed']?.value !== undefined && oidData['hrStorageSize']?.value !== undefined) {
      const used = parseInt(oidData['hrStorageUsed'].value) || 0;
      const total = parseInt(oidData['hrStorageSize'].value) || 1;
      // Assuming units are in KB (typical for hrStorage)
      parsed.resources.memory_used_mb = Math.floor(used / 1024);
      parsed.resources.memory_total_mb = Math.floor(total / 1024);
      parsed.resources.memory_free_mb = Math.floor((total - used) / 1024);
      parsed.resources.memory_percent = total > 0 ? Math.round((used / total) * 100) : 0;
    }
    
    // Interface Octets: 1.3.6.1.2.1.2.2.1.10.1 (ifInOctets) and 1.3.6.1.2.1.2.2.1.16.1 (ifOutOctets)
    if (oidData['ifInOctets']?.value !== undefined) {
      parsed.network.interface_in_octets = parseInt(oidData['ifInOctets'].value) || 0;
    }
    if (oidData['ifOutOctets']?.value !== undefined) {
      parsed.network.interface_out_octets = parseInt(oidData['ifOutOctets'].value) || 0;
    }
    
    // Interface Errors: 1.3.6.1.2.1.2.2.1.14.1 (ifInErrors) and 1.3.6.1.2.1.2.2.1.20.1 (ifOutErrors)
    if (oidData['ifInErrors']?.value !== undefined) {
      parsed.network.interface_in_errors = parseInt(oidData['ifInErrors'].value) || 0;
    }
    if (oidData['ifOutErrors']?.value !== undefined) {
      parsed.network.interface_out_errors = parseInt(oidData['ifOutErrors'].value) || 0;
    }
    
    // Interface Status: 1.3.6.1.2.1.2.2.1.8.1 (ifOperStatus)
    if (oidData['ifOperStatus']?.value !== undefined) {
      const status = parseInt(oidData['ifOperStatus'].value);
      parsed.network.interface_status = status === 1 ? 'up' : 'down';
    }
    
    // Temperature (device-specific OID, common on network equipment)
    if (oidData['temperature']?.value !== undefined) {
      parsed.temperature = parseFloat(oidData['temperature'].value) || null;
    }
    
    return parsed;
  }

  /**
   * Process received SNMP trap
   */
  processTrap(notification) {
    try {
      const trapData = {
        source: notification.pdu.agent,
        timestamp: new Date(),
        enterprise: notification.pdu.enterprise,
        genericTrap: notification.pdu.genericTrap,
        specificTrap: notification.pdu.specificTrap,
        varbinds: notification.pdu.varbinds
      };

      // Find device by IP address
      let deviceId = null;
      let tenantId = null;
      
      for (const [id, device] of this.devices.entries()) {
        if (device.ipAddress === trapData.source.address) {
          deviceId = id;
          tenantId = device.tenantId;
          break;
        }
      }

      // Emit trap event
      this.emit('trap', {
        deviceId,
        tenantId,
        trapData
      });

      console.log(`[SNMP Collector] Received trap from ${trapData.source.address}`);
    } catch (error) {
      console.error('[SNMP Collector] Trap processing error:', error);
    }
  }

  /**
   * Unregister device
   */
  async unregisterDevice(deviceId) {
    try {
      const device = this.devices.get(deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      // Stop polling
      const intervalId = this.pollingIntervals.get(deviceId);
      if (intervalId) {
        clearInterval(intervalId);
        this.pollingIntervals.delete(deviceId);
      }

      // Close SNMP session
      const session = this.sessions.get(deviceId);
      if (session) {
        session.close();
        this.sessions.delete(deviceId);
      }

      // Remove device
      this.devices.delete(deviceId);

      console.log(`[SNMP Collector] Unregistered device: ${deviceId}`);
      return { success: true };
    } catch (error) {
      console.error(`[SNMP Collector] Failed to unregister device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get device status
   */
  getDeviceStatus(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      return null;
    }

    return {
      deviceId: device.deviceId,
      tenantId: device.tenantId,
      ipAddress: device.ipAddress,
      status: device.status,
      lastPoll: device.lastPoll,
      metrics: device.metrics
    };
  }

  /**
   * Get all devices for tenant
   */
  getTenantDevices(tenantId) {
    const devices = [];
    for (const device of this.devices.values()) {
      if (device.tenantId === tenantId) {
        devices.push(this.getDeviceStatus(device.deviceId));
      }
    }
    return devices;
  }

  /**
   * Update device configuration
   */
  async updateDeviceConfig(deviceId, updates) {
    try {
      const device = this.devices.get(deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      // Update configuration
      Object.assign(device, updates);

      // Restart polling if interval changed
      if (updates.pollingInterval) {
        const intervalId = this.pollingIntervals.get(deviceId);
        if (intervalId) {
          clearInterval(intervalId);
        }
        this.startPolling(deviceId);
      }

      console.log(`[SNMP Collector] Updated configuration for device: ${deviceId}`);
      return { success: true };
    } catch (error) {
      console.error(`[SNMP Collector] Failed to update device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Shutdown collector service
   */
  async shutdown() {
    try {
      // Stop all polling intervals
      for (const intervalId of this.pollingIntervals.values()) {
        clearInterval(intervalId);
      }
      this.pollingIntervals.clear();

      // Close all SNMP sessions
      for (const session of this.sessions.values()) {
        session.close();
      }
      this.sessions.clear();

      // Close trap listener
      if (this.trapListener) {
        this.trapListener.close();
      }

      console.log('[SNMP Collector] Service shutdown complete');
      return { success: true };
    } catch (error) {
      console.error('[SNMP Collector] Shutdown error:', error);
      throw error;
    }
  }
}

module.exports = new SNMPCollectorService();
