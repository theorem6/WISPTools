/**
 * EPC SNMP Agent
 * SNMP agent that runs on deployed EPCs and reports metrics to the cloud API
 * This script gets embedded in the EPC ISO during generation
 */

const snmp = require('net-snmp');
const os = require('os');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const http = require('http');

const execAsync = promisify(exec);

class EPCSNMPAgent {
  constructor(config = {}) {
    this.config = {
      // EPC identification
      epcId: config.epcId || process.env.EPC_ID,
      tenantId: config.tenantId || process.env.TENANT_ID,
      authCode: config.authCode || process.env.EPC_AUTH_CODE,
      
      // Cloud API configuration
      cloudApiUrl: config.cloudApiUrl || process.env.CLOUD_API_URL || 'https://wisptools.io',
      apiKey: config.apiKey || process.env.EPC_API_KEY,
      
      // SNMP agent configuration
      snmpPort: config.snmpPort || 161,
      snmpCommunity: config.snmpCommunity || 'public',
      
      // Reporting configuration
      reportingInterval: config.reportingInterval || 60000, // 1 minute
      enableSNMPAgent: config.enableSNMPAgent !== false,
      enableCloudReporting: config.enableCloudReporting !== false,
      
      // Health monitoring
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      
      // Custom metrics
      customMetrics: config.customMetrics || {}
    };
    
    this.agent = null;
    this.reportingTimer = null;
    this.healthCheckTimer = null;
    this.lastMetrics = {};
    this.isRunning = false;
  }

  /**
   * Initialize and start the EPC SNMP agent
   */
  async initialize() {
    try {
      console.log('[EPC SNMP Agent] Initializing...');
      
      // Validate configuration
      if (!this.config.epcId || !this.config.tenantId) {
        throw new Error('EPC ID and Tenant ID are required');
      }
      
      // Start SNMP agent if enabled
      if (this.config.enableSNMPAgent) {
        await this.startSNMPAgent();
      }
      
      // Start cloud reporting if enabled
      if (this.config.enableCloudReporting) {
        await this.startCloudReporting();
      }
      
      // Start health monitoring
      await this.startHealthMonitoring();
      
      this.isRunning = true;
      console.log('[EPC SNMP Agent] Initialized successfully');
      
      return { success: true };
    } catch (error) {
      console.error('[EPC SNMP Agent] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start SNMP agent for external polling
   */
  async startSNMPAgent() {
    try {
      // Create SNMP agent
      this.agent = snmp.createAgent({
        port: this.config.snmpPort,
        disableAuthorization: false
      });

      // Define custom MIB for EPC metrics
      const mib = this.agent.getMib();
      
      // EPC System Information (1.3.6.1.4.1.99999.1.1.x)
      const epcSystemOID = '1.3.6.1.4.1.99999.1.1';
      
      // Register EPC-specific OIDs
      mib.registerProvider({
        name: 'epcSystem',
        type: snmp.MibProviderType.Scalar,
        oid: `${epcSystemOID}.1.0`, // EPC ID
        scalarType: snmp.ObjectType.OctetString,
        handler: (mibRequest) => {
          mibRequest.done(snmp.ErrorStatus.NoError, this.config.epcId);
        }
      });

      mib.registerProvider({
        name: 'epcTenantId',
        type: snmp.MibProviderType.Scalar,
        oid: `${epcSystemOID}.2.0`, // Tenant ID
        scalarType: snmp.ObjectType.OctetString,
        handler: (mibRequest) => {
          mibRequest.done(snmp.ErrorStatus.NoError, this.config.tenantId);
        }
      });

      mib.registerProvider({
        name: 'epcUptime',
        type: snmp.MibProviderType.Scalar,
        oid: `${epcSystemOID}.3.0`, // EPC Service Uptime
        scalarType: snmp.ObjectType.TimeTicks,
        handler: async (mibRequest) => {
          const uptime = await this.getEPCUptime();
          mibRequest.done(snmp.ErrorStatus.NoError, uptime);
        }
      });

      mib.registerProvider({
        name: 'epcActiveUsers',
        type: snmp.MibProviderType.Scalar,
        oid: `${epcSystemOID}.4.0`, // Active Users
        scalarType: snmp.ObjectType.Integer,
        handler: async (mibRequest) => {
          const activeUsers = await this.getActiveUsers();
          mibRequest.done(snmp.ErrorStatus.NoError, activeUsers);
        }
      });

      mib.registerProvider({
        name: 'epcThroughput',
        type: snmp.MibProviderType.Scalar,
        oid: `${epcSystemOID}.5.0`, // Current Throughput
        scalarType: snmp.ObjectType.Counter64,
        handler: async (mibRequest) => {
          const throughput = await this.getCurrentThroughput();
          mibRequest.done(snmp.ErrorStatus.NoError, throughput);
        }
      });

      // System resource OIDs (CPU, Memory, etc.)
      const resourceOID = '1.3.6.1.4.1.99999.1.2';
      
      mib.registerProvider({
        name: 'epcCpuUsage',
        type: snmp.MibProviderType.Scalar,
        oid: `${resourceOID}.1.0`,
        scalarType: snmp.ObjectType.Integer,
        handler: async (mibRequest) => {
          const cpuUsage = await this.getCPUUsage();
          mibRequest.done(snmp.ErrorStatus.NoError, Math.round(cpuUsage));
        }
      });

      mib.registerProvider({
        name: 'epcMemoryUsage',
        type: snmp.MibProviderType.Scalar,
        oid: `${resourceOID}.2.0`,
        scalarType: snmp.ObjectType.Integer,
        handler: async (mibRequest) => {
          const memUsage = await this.getMemoryUsage();
          mibRequest.done(snmp.ErrorStatus.NoError, Math.round(memUsage));
        }
      });

      mib.registerProvider({
        name: 'epcDiskUsage',
        type: snmp.MibProviderType.Scalar,
        oid: `${resourceOID}.3.0`,
        scalarType: snmp.ObjectType.Integer,
        handler: async (mibRequest) => {
          const diskUsage = await this.getDiskUsage();
          mibRequest.done(snmp.ErrorStatus.NoError, Math.round(diskUsage));
        }
      });

      console.log(`[EPC SNMP Agent] SNMP agent started on port ${this.config.snmpPort}`);
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to start SNMP agent:', error);
      throw error;
    }
  }

  /**
   * Start cloud reporting timer
   */
  async startCloudReporting() {
    // Initial report
    await this.reportToCloud();
    
    // Set up recurring reporting
    this.reportingTimer = setInterval(async () => {
      try {
        await this.reportToCloud();
      } catch (error) {
        console.error('[EPC SNMP Agent] Cloud reporting failed:', error);
      }
    }, this.config.reportingInterval);
    
    console.log(`[EPC SNMP Agent] Cloud reporting started (interval: ${this.config.reportingInterval}ms)`);
  }

  /**
   * Start health monitoring
   */
  async startHealthMonitoring() {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('[EPC SNMP Agent] Health check failed:', error);
      }
    }, this.config.healthCheckInterval);
    
    console.log(`[EPC SNMP Agent] Health monitoring started (interval: ${this.config.healthCheckInterval}ms)`);
  }

  /**
   * Collect comprehensive EPC metrics
   */
  async collectMetrics() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        epcId: this.config.epcId,
        tenantId: this.config.tenantId,
        
        // System information
        system: {
          uptime: await this.getSystemUptime(),
          epcUptime: await this.getEPCUptime(),
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch(),
          release: os.release()
        },
        
        // Resource utilization
        resources: {
          cpuUsage: await this.getCPUUsage(),
          memoryUsage: await this.getMemoryUsage(),
          diskUsage: await this.getDiskUsage(),
          loadAverage: os.loadavg(),
          freeMemory: os.freemem(),
          totalMemory: os.totalmem()
        },
        
        // Network statistics
        network: {
          interfaces: await this.getNetworkInterfaces(),
          throughput: await this.getCurrentThroughput(),
          connections: await this.getActiveConnections()
        },
        
        // EPC-specific metrics
        epc: {
          activeUsers: await this.getActiveUsers(),
          activeSessions: await this.getActiveSessions(),
          dataUsage: await this.getDataUsage(),
          serviceStatus: await this.getServiceStatus()
        },
        
        // Custom metrics
        custom: await this.getCustomMetrics()
      };
      
      this.lastMetrics = metrics;
      return metrics;
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to collect metrics:', error);
      throw error;
    }
  }

  /**
   * Report metrics to cloud API
   */
  async reportToCloud() {
    try {
      const metrics = await this.collectMetrics();
      
      const payload = {
        epcId: this.config.epcId,
        tenantId: this.config.tenantId,
        authCode: this.config.authCode,
        metrics: metrics,
        timestamp: new Date().toISOString()
      };
      
      await this.sendToCloudAPI('/api/epc/metrics', payload);
      
      console.log('[EPC SNMP Agent] Metrics reported to cloud successfully');
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to report to cloud:', error);
      // Don't throw - continue operation even if cloud reporting fails
    }
  }

  /**
   * Perform health check and send alerts if needed
   */
  async performHealthCheck() {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        epcId: this.config.epcId,
        tenantId: this.config.tenantId,
        
        // System health
        cpuHealth: await this.checkCPUHealth(),
        memoryHealth: await this.checkMemoryHealth(),
        diskHealth: await this.checkDiskHealth(),
        networkHealth: await this.checkNetworkHealth(),
        
        // Service health
        epcServiceHealth: await this.checkEPCServiceHealth(),
        
        // Overall status
        overallStatus: 'healthy' // Will be calculated based on individual checks
      };
      
      // Calculate overall status
      const healthChecks = [
        health.cpuHealth.status,
        health.memoryHealth.status,
        health.diskHealth.status,
        health.networkHealth.status,
        health.epcServiceHealth.status
      ];
      
      if (healthChecks.includes('critical')) {
        health.overallStatus = 'critical';
      } else if (healthChecks.includes('warning')) {
        health.overallStatus = 'warning';
      }
      
      // Send health report to cloud
      if (health.overallStatus !== 'healthy') {
        await this.sendHealthAlert(health);
      }
      
      return health;
    } catch (error) {
      console.error('[EPC SNMP Agent] Health check failed:', error);
      return {
        timestamp: new Date().toISOString(),
        epcId: this.config.epcId,
        overallStatus: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get system uptime in seconds
   */
  async getSystemUptime() {
    return os.uptime();
  }

  /**
   * Get EPC service uptime
   */
  async getEPCUptime() {
    try {
      // Check EPC service uptime (implementation depends on EPC service management)
      const { stdout } = await execAsync('systemctl show --property=ActiveEnterTimestamp epc-service');
      const match = stdout.match(/ActiveEnterTimestamp=(.+)/);
      if (match) {
        const startTime = new Date(match[1]);
        return Math.floor((Date.now() - startTime.getTime()) / 1000);
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get CPU usage percentage
   */
  async getCPUUsage() {
    try {
      const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'");
      return parseFloat(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get memory usage percentage
   */
  async getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    return ((total - free) / total) * 100;
  }

  /**
   * Get disk usage percentage
   */
  async getDiskUsage() {
    try {
      const { stdout } = await execAsync("df -h / | awk 'NR==2 {print $5}' | sed 's/%//'");
      return parseFloat(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get active users count
   */
  async getActiveUsers() {
    try {
      // Implementation depends on EPC user management system
      const { stdout } = await execAsync('who | wc -l');
      return parseInt(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get active sessions count
   */
  async getActiveSessions() {
    try {
      // Implementation depends on EPC session management
      // This is a placeholder - actual implementation would query EPC database
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get current throughput
   */
  async getCurrentThroughput() {
    try {
      // Implementation depends on network interface monitoring
      const interfaces = os.networkInterfaces();
      let totalBytes = 0;
      
      // This is simplified - real implementation would track bytes over time
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (name !== 'lo') { // Skip loopback
          // Would need to track interface statistics over time
          totalBytes += 0; // Placeholder
        }
      }
      
      return totalBytes;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get network interfaces information
   */
  async getNetworkInterfaces() {
    return os.networkInterfaces();
  }

  /**
   * Get active network connections
   */
  async getActiveConnections() {
    try {
      const { stdout } = await execAsync('netstat -tn | grep ESTABLISHED | wc -l');
      return parseInt(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get data usage statistics
   */
  async getDataUsage() {
    try {
      // Implementation depends on EPC data tracking
      return {
        totalBytes: 0,
        uploadBytes: 0,
        downloadBytes: 0
      };
    } catch (error) {
      return { totalBytes: 0, uploadBytes: 0, downloadBytes: 0 };
    }
  }

  /**
   * Get EPC service status
   */
  async getServiceStatus() {
    try {
      const { stdout } = await execAsync('systemctl is-active epc-service');
      return {
        status: stdout.trim(),
        running: stdout.trim() === 'active'
      };
    } catch (error) {
      return {
        status: 'unknown',
        running: false
      };
    }
  }

  /**
   * Get custom metrics
   */
  async getCustomMetrics() {
    const customMetrics = {};
    
    for (const [key, command] of Object.entries(this.config.customMetrics)) {
      try {
        const { stdout } = await execAsync(command);
        customMetrics[key] = stdout.trim();
      } catch (error) {
        customMetrics[key] = null;
      }
    }
    
    return customMetrics;
  }

  /**
   * Health check methods
   */
  async checkCPUHealth() {
    const cpuUsage = await this.getCPUUsage();
    return {
      metric: 'cpu',
      value: cpuUsage,
      status: cpuUsage > 90 ? 'critical' : cpuUsage > 70 ? 'warning' : 'healthy',
      threshold: { warning: 70, critical: 90 }
    };
  }

  async checkMemoryHealth() {
    const memUsage = await this.getMemoryUsage();
    return {
      metric: 'memory',
      value: memUsage,
      status: memUsage > 95 ? 'critical' : memUsage > 80 ? 'warning' : 'healthy',
      threshold: { warning: 80, critical: 95 }
    };
  }

  async checkDiskHealth() {
    const diskUsage = await this.getDiskUsage();
    return {
      metric: 'disk',
      value: diskUsage,
      status: diskUsage > 95 ? 'critical' : diskUsage > 85 ? 'warning' : 'healthy',
      threshold: { warning: 85, critical: 95 }
    };
  }

  async checkNetworkHealth() {
    try {
      // Simple connectivity check
      await execAsync('ping -c 1 8.8.8.8');
      return {
        metric: 'network',
        value: 'connected',
        status: 'healthy'
      };
    } catch (error) {
      return {
        metric: 'network',
        value: 'disconnected',
        status: 'critical'
      };
    }
  }

  async checkEPCServiceHealth() {
    const serviceStatus = await this.getServiceStatus();
    return {
      metric: 'epc_service',
      value: serviceStatus.status,
      status: serviceStatus.running ? 'healthy' : 'critical'
    };
  }

  /**
   * Send health alert to cloud
   */
  async sendHealthAlert(health) {
    try {
      const alert = {
        epcId: this.config.epcId,
        tenantId: this.config.tenantId,
        authCode: this.config.authCode,
        alertType: 'health',
        severity: health.overallStatus,
        health: health,
        timestamp: new Date().toISOString()
      };
      
      await this.sendToCloudAPI('/api/epc/alerts', alert);
      console.log(`[EPC SNMP Agent] Health alert sent: ${health.overallStatus}`);
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to send health alert:', error);
    }
  }

  /**
   * Send data to cloud API
   */
  async sendToCloudAPI(endpoint, data) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.config.cloudApiUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const postData = JSON.stringify(data);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Bearer ${this.config.apiKey}`,
          'x-tenant-id': this.config.tenantId
        }
      };
      
      const req = client.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(responseData || '{}'));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
  }

  /**
   * Shutdown the agent gracefully
   */
  async shutdown() {
    try {
      console.log('[EPC SNMP Agent] Shutting down...');
      
      this.isRunning = false;
      
      // Clear timers
      if (this.reportingTimer) {
        clearInterval(this.reportingTimer);
      }
      
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }
      
      // Close SNMP agent
      if (this.agent) {
        this.agent.close();
      }
      
      console.log('[EPC SNMP Agent] Shutdown complete');
    } catch (error) {
      console.error('[EPC SNMP Agent] Shutdown error:', error);
    }
  }
}

module.exports = EPCSNMPAgent;

// If running as standalone script
if (require.main === module) {
  const agent = new EPCSNMPAgent();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await agent.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await agent.shutdown();
    process.exit(0);
  });
  
  // Start the agent
  agent.initialize().catch((error) => {
    console.error('Failed to start EPC SNMP Agent:', error);
    process.exit(1);
  });
}
