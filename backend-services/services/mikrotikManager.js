/**
 * Mikrotik RouterOS API Management Service
 * Handles Mikrotik device configuration, monitoring, and management via RouterOS API
 */

let RouterOSAPI;
try {
  RouterOSAPI = require('node-routeros').RouterOSAPI;
} catch (error) {
  console.warn('[Mikrotik Manager] node-routeros module not installed. MikroTik features will be disabled.');
  RouterOSAPI = null;
}

const EventEmitter = require('events');

class MikrotikManagerService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // Active RouterOS API connections
    this.devices = new Map();     // Registered Mikrotik devices
    this.monitoringIntervals = new Map(); // Monitoring intervals
    this.defaultPort = 8728; // RouterOS API port
    this.defaultSSLPort = 8729; // RouterOS API SSL port
  }

  /**
   * Initialize Mikrotik manager service
   */
  async initialize() {
    try {
      console.log('[Mikrotik Manager] Service initialized');
      return { success: true };
    } catch (error) {
      console.error('[Mikrotik Manager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register Mikrotik device for management
   */
  async registerDevice(deviceConfig) {
    const {
      deviceId,
      tenantId,
      ipAddress,
      username,
      password,
      port = this.defaultPort,
      useSSL = false,
      deviceType = 'router', // 'router', 'switch', 'ap', 'cpe'
      monitoringEnabled = true,
      monitoringInterval = 30000, // 30 seconds
      configTemplate = null
    } = deviceConfig;

    try {
      // Test connection first
      const connection = await this.createConnection({
        host: ipAddress,
        user: username,
        password: password,
        port: useSSL ? this.defaultSSLPort : port,
        timeout: 10000
      });

      // Get device identity and system info
      const identity = await this.getDeviceIdentity(connection);
      const systemInfo = await this.getSystemInfo(connection);

      // Store device configuration
      const device = {
        deviceId,
        tenantId,
        ipAddress,
        username,
        password,
        port,
        useSSL,
        deviceType,
        identity,
        systemInfo,
        monitoringEnabled,
        monitoringInterval,
        configTemplate,
        lastSeen: new Date(),
        status: 'online',
        connection: null // Will be set when monitoring starts
      };

      this.devices.set(deviceId, device);

      // Start monitoring if enabled
      if (monitoringEnabled) {
        await this.startMonitoring(deviceId);
      }

      // Close test connection
      connection.close();

      console.log(`[Mikrotik Manager] Registered device: ${deviceId} (${identity.name})`);
      return { 
        success: true, 
        deviceId,
        identity,
        systemInfo
      };
    } catch (error) {
      console.error(`[Mikrotik Manager] Failed to register device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Create RouterOS API connection
   */
  async createConnection(config) {
    if (!RouterOSAPI) {
      throw new Error('node-routeros module is not installed. Install it with: npm install node-routeros');
    }
    
    return new Promise((resolve, reject) => {
      const conn = new RouterOSAPI(config);
      
      conn.connect().then(() => {
        resolve(conn);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  /**
   * Get device identity information
   */
  async getDeviceIdentity(connection) {
    try {
      const result = await connection.write('/system/identity/print');
      return {
        name: result[0].name || 'Unknown',
        comment: result[0].comment || ''
      };
    } catch (error) {
      console.error('[Mikrotik Manager] Failed to get device identity:', error);
      return { name: 'Unknown', comment: '' };
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(connection) {
    try {
      const [resource, routerboard, license] = await Promise.all([
        connection.write('/system/resource/print').catch(() => [{}]),
        connection.write('/system/routerboard/print').catch(() => [{}]),
        connection.write('/system/license/print').catch(() => [{}])
      ]);

      return {
        version: resource[0]?.version || 'Unknown',
        architecture: resource[0]?.architecture || 'Unknown',
        boardName: resource[0]?.['board-name'] || 'Unknown',
        model: routerboard[0]?.model || 'Unknown',
        serialNumber: routerboard[0]?.['serial-number'] || 'Unknown',
        firmwareVersion: routerboard[0]?.['firmware-version'] || 'Unknown',
        licenseLevel: license[0]?.level || 'Unknown',
        uptime: resource[0]?.uptime || '0s',
        cpuLoad: resource[0]?.['cpu-load'] || 0,
        freeMemory: resource[0]?.['free-memory'] || 0,
        totalMemory: resource[0]?.['total-memory'] || 0,
        freeHddSpace: resource[0]?.['free-hdd-space'] || 0,
        totalHddSpace: resource[0]?.['total-hdd-space'] || 0
      };
    } catch (error) {
      console.error('[Mikrotik Manager] Failed to get system info:', error);
      return {};
    }
  }

  /**
   * Start monitoring for a device
   */
  async startMonitoring(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) return;

    try {
      // Create persistent connection for monitoring
      const connection = await this.createConnection({
        host: device.ipAddress,
        user: device.username,
        password: device.password,
        port: device.useSSL ? this.defaultSSLPort : device.port,
        timeout: 10000
      });

      device.connection = connection;
      this.connections.set(deviceId, connection);

      // Start monitoring loop
      const monitorDevice = async () => {
        try {
          const metrics = await this.collectMetrics(deviceId);
          device.lastSeen = new Date();
          device.status = 'online';

          // Emit metrics event
          this.emit('metrics', {
            deviceId,
            tenantId: device.tenantId,
            deviceType: device.deviceType,
            timestamp: device.lastSeen,
            metrics
          });

        } catch (error) {
          console.error(`[Mikrotik Manager] Monitoring failed for device ${deviceId}:`, error);
          device.status = 'error';
          
          this.emit('error', {
            deviceId,
            tenantId: device.tenantId,
            error: error.message
          });

          // Try to reconnect
          await this.reconnectDevice(deviceId);
        }
      };

      // Initial collection
      await monitorDevice();

      // Set up recurring monitoring
      const intervalId = setInterval(monitorDevice, device.monitoringInterval);
      this.monitoringIntervals.set(deviceId, intervalId);

      console.log(`[Mikrotik Manager] Started monitoring for device: ${deviceId}`);
    } catch (error) {
      console.error(`[Mikrotik Manager] Failed to start monitoring for ${deviceId}:`, error);
      device.status = 'error';
    }
  }

  /**
   * Collect comprehensive metrics from Mikrotik device
   */
  async collectMetrics(deviceId) {
    const device = this.devices.get(deviceId);
    const connection = device.connection;
    
    if (!connection) {
      throw new Error('No connection available for device');
    }

    try {
      const [
        resource,
        interfaces,
        wireless,
        dhcpLeases,
        pppActive,
        routes,
        firewall,
        queues
      ] = await Promise.all([
        connection.write('/system/resource/print').catch(() => [{}]),
        connection.write('/interface/print').catch(() => []),
        connection.write('/interface/wireless/print').catch(() => []),
        connection.write('/ip/dhcp-server/lease/print', { '?status': 'bound' }).catch(() => []),
        connection.write('/ppp/active/print').catch(() => []),
        connection.write('/ip/route/print', { '?active': 'true' }).catch(() => []),
        connection.write('/ip/firewall/connection/print').catch(() => []),
        connection.write('/queue/simple/print').catch(() => [])
      ]);

      // Process interface statistics
      const interfaceStats = await this.getInterfaceStatistics(connection, interfaces);
      
      // Process wireless statistics if applicable
      const wirelessStats = await this.getWirelessStatistics(connection, wireless);

      return {
        system: {
          uptime: resource[0]?.uptime || '0s',
          cpuLoad: parseInt(resource[0]?.['cpu-load']) || 0,
          freeMemory: parseInt(resource[0]?.['free-memory']) || 0,
          totalMemory: parseInt(resource[0]?.['total-memory']) || 0,
          freeHddSpace: parseInt(resource[0]?.['free-hdd-space']) || 0,
          totalHddSpace: parseInt(resource[0]?.['total-hdd-space']) || 0,
          temperature: parseInt(resource[0]?.['cpu-temperature']) || 0,
          voltage: parseFloat(resource[0]?.voltage) || 0
        },
        interfaces: interfaceStats,
        wireless: wirelessStats,
        clients: {
          dhcpLeases: dhcpLeases.length,
          pppActive: pppActive.length,
          totalConnections: firewall.length
        },
        routing: {
          activeRoutes: routes.length
        },
        queues: {
          totalQueues: queues.length,
          activeQueues: queues.filter(q => q.disabled !== 'true').length
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`[Mikrotik Manager] Failed to collect metrics for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed interface statistics
   */
  async getInterfaceStatistics(connection, interfaces) {
    const stats = {};

    for (const iface of interfaces) {
      try {
        const ifaceStats = await connection.write('/interface/monitor-traffic', {
          interface: iface.name,
          duration: '1'
        });

        stats[iface.name] = {
          name: iface.name,
          type: iface.type,
          running: iface.running === 'true',
          disabled: iface.disabled === 'true',
          mtu: parseInt(iface.mtu) || 0,
          rxBytes: parseInt(ifaceStats[0]?.['rx-bytes-per-second']) || 0,
          txBytes: parseInt(ifaceStats[0]?.['tx-bytes-per-second']) || 0,
          rxPackets: parseInt(ifaceStats[0]?.['rx-packets-per-second']) || 0,
          txPackets: parseInt(ifaceStats[0]?.['tx-packets-per-second']) || 0
        };
      } catch (error) {
        // If monitoring fails, use basic interface info
        stats[iface.name] = {
          name: iface.name,
          type: iface.type,
          running: iface.running === 'true',
          disabled: iface.disabled === 'true',
          mtu: parseInt(iface.mtu) || 0,
          rxBytes: 0,
          txBytes: 0,
          rxPackets: 0,
          txPackets: 0
        };
      }
    }

    return stats;
  }

  /**
   * Get wireless interface statistics
   */
  async getWirelessStatistics(connection, wirelessInterfaces) {
    const stats = {};

    for (const wlan of wirelessInterfaces) {
      try {
        const [registration, scanResults] = await Promise.all([
          connection.write('/interface/wireless/registration-table/print', {
            '?interface': wlan.name
          }).catch(() => []),
          connection.write('/interface/wireless/scan', {
            interface: wlan.name,
            duration: '1'
          }).catch(() => [])
        ]);

        stats[wlan.name] = {
          name: wlan.name,
          mode: wlan.mode,
          band: wlan.band,
          frequency: wlan.frequency,
          channel: wlan.channel,
          ssid: wlan.ssid,
          security: wlan['security-profile'],
          disabled: wlan.disabled === 'true',
          running: wlan.running === 'true',
          connectedClients: registration.length,
          clients: registration.map(client => ({
            macAddress: client['mac-address'],
            signalStrength: parseInt(client['signal-strength']) || 0,
            txRate: client['tx-rate'],
            rxRate: client['rx-rate'],
            uptime: client.uptime
          })),
          nearbyNetworks: scanResults.length
        };
      } catch (error) {
        stats[wlan.name] = {
          name: wlan.name,
          mode: wlan.mode,
          disabled: wlan.disabled === 'true',
          running: wlan.running === 'true',
          connectedClients: 0,
          clients: [],
          nearbyNetworks: 0
        };
      }
    }

    return stats;
  }

  /**
   * Execute RouterOS command
   */
  async executeCommand(deviceId, command, params = {}) {
    const device = this.devices.get(deviceId);
    if (!device || !device.connection) {
      throw new Error(`Device ${deviceId} not found or not connected`);
    }

    try {
      const result = await device.connection.write(command, params);
      console.log(`[Mikrotik Manager] Executed command on ${deviceId}: ${command}`);
      return result;
    } catch (error) {
      console.error(`[Mikrotik Manager] Command execution failed on ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Configure device using template
   */
  async applyConfiguration(deviceId, configTemplate) {
    const device = this.devices.get(deviceId);
    if (!device || !device.connection) {
      throw new Error(`Device ${deviceId} not found or not connected`);
    }

    try {
      const results = [];
      
      for (const command of configTemplate.commands) {
        const result = await this.executeCommand(deviceId, command.path, command.params || {});
        results.push({
          command: command.path,
          success: true,
          result
        });
      }

      console.log(`[Mikrotik Manager] Applied configuration template to ${deviceId}`);
      return { success: true, results };
    } catch (error) {
      console.error(`[Mikrotik Manager] Configuration failed for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Backup device configuration
   */
  async backupConfiguration(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device || !device.connection) {
      throw new Error(`Device ${deviceId} not found or not connected`);
    }

    try {
      // Export configuration
      const backupName = `backup-${deviceId}-${Date.now()}`;
      await this.executeCommand(deviceId, '/export', { file: backupName });
      
      // Get the exported configuration
      const files = await this.executeCommand(deviceId, '/file/print', {
        '?name': `${backupName}.rsc`
      });

      if (files.length > 0) {
        console.log(`[Mikrotik Manager] Configuration backed up for ${deviceId}`);
        return {
          success: true,
          backupName,
          size: files[0].size,
          timestamp: new Date()
        };
      } else {
        throw new Error('Backup file not found');
      }
    } catch (error) {
      console.error(`[Mikrotik Manager] Backup failed for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Reconnect to device
   */
  async reconnectDevice(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) return;

    try {
      // Close existing connection
      if (device.connection) {
        device.connection.close();
      }

      // Clear from connections map
      this.connections.delete(deviceId);

      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Restart monitoring (which will create new connection)
      await this.startMonitoring(deviceId);
      
      console.log(`[Mikrotik Manager] Reconnected to device: ${deviceId}`);
    } catch (error) {
      console.error(`[Mikrotik Manager] Reconnection failed for ${deviceId}:`, error);
      device.status = 'offline';
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

      // Stop monitoring
      const intervalId = this.monitoringIntervals.get(deviceId);
      if (intervalId) {
        clearInterval(intervalId);
        this.monitoringIntervals.delete(deviceId);
      }

      // Close connection
      const connection = this.connections.get(deviceId);
      if (connection) {
        connection.close();
        this.connections.delete(deviceId);
      }

      // Remove device
      this.devices.delete(deviceId);

      console.log(`[Mikrotik Manager] Unregistered device: ${deviceId}`);
      return { success: true };
    } catch (error) {
      console.error(`[Mikrotik Manager] Failed to unregister device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get device status and metrics
   */
  getDeviceStatus(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) return null;

    return {
      deviceId: device.deviceId,
      tenantId: device.tenantId,
      ipAddress: device.ipAddress,
      deviceType: device.deviceType,
      identity: device.identity,
      systemInfo: device.systemInfo,
      status: device.status,
      lastSeen: device.lastSeen,
      monitoringEnabled: device.monitoringEnabled
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
   * Shutdown service
   */
  async shutdown() {
    try {
      // Stop all monitoring intervals
      for (const intervalId of this.monitoringIntervals.values()) {
        clearInterval(intervalId);
      }
      this.monitoringIntervals.clear();

      // Close all connections
      for (const connection of this.connections.values()) {
        connection.close();
      }
      this.connections.clear();

      console.log('[Mikrotik Manager] Service shutdown complete');
      return { success: true };
    } catch (error) {
      console.error('[Mikrotik Manager] Shutdown error:', error);
      throw error;
    }
  }
}

module.exports = new MikrotikManagerService();
