#!/usr/bin/env node
/**
 * Improved EPC SNMP Monitoring Agent using 'net-snmp' npm package
 * 
 * Uses the well-maintained 'net-snmp' package for reliable SNMP operations
 * Supports SNMPv1, v2c, and v3 with proper error handling and bulk operations
 * 
 * Usage:
 *   node IMPROVED_SNMP_MONITOR.js <device_id> <ip> <community>  - Query single device
 *   node IMPROVED_SNMP_MONITOR.js cycle                          - Run monitoring cycle
 */

const https = require('https');
const http = require('http');
const snmp = require('net-snmp');
const fs = require('fs').promises;

// Configuration
const CENTRAL_SERVER = process.env.CENTRAL_SERVER || 'hss.wisptools.io';
const API_URL = `https://${CENTRAL_SERVER}/api/epc`;
const CONFIG_DIR = process.env.CONFIG_DIR || '/etc/wisptools';
const LOG_FILE = process.env.LOG_FILE || '/var/log/wisptools-snmp-monitor.log';

// SNMP OIDs for common metrics
const SNMP_OIDS = {
  // System
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysLocation: '1.3.6.1.2.1.1.6.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  
  // CPU (ifTable-based or vendor-specific)
  // These vary by vendor, using generic counters
  cpuIdle: '1.3.6.1.4.1.2021.11.11.0', // UCD-SNMP-MIB
  
  // Memory (UCD-SNMP-MIB)
  memTotalReal: '1.3.6.1.4.1.2021.4.5.0',
  memAvailReal: '1.3.6.1.4.1.2021.4.6.0',
  memBuffer: '1.3.6.1.4.1.2021.4.14.0',
  memCached: '1.3.6.1.4.1.2021.4.15.0',
  
  // Disk (UCD-SNMP-MIB)
  diskTotal: '1.3.6.1.4.1.2021.9.1.6.1',
  diskAvail: '1.3.6.1.4.1.2021.9.1.7.1',
  
  // Interface (RFC1213-MIB)
  ifNumber: '1.3.6.1.2.1.2.1.0',
  ifDescr: '1.3.6.1.2.1.2.2.1.2',
  ifType: '1.3.6.1.2.1.2.2.1.3',
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
  ifInErrors: '1.3.6.1.2.1.2.2.1.14',
  ifOutErrors: '1.3.6.1.2.1.2.2.1.20'
};

// Logging function
function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  
  // Also write to log file
  fs.appendFile(LOG_FILE, logMessage + '\n').catch(() => {
    // Ignore log file errors
  });
}

// Get device code
async function getDeviceCode() {
  try {
    const envFile = `${CONFIG_DIR}/device-code.env`;
    const codeFile = `${CONFIG_DIR}/device_code`;
    
    try {
      const envContent = await fs.readFile(envFile, 'utf8');
      const match = envContent.match(/DEVICE_CODE=(.+)/);
      if (match) return match[1].trim();
    } catch (e) {
      // File doesn't exist, try next option
    }
    
    try {
      return (await fs.readFile(codeFile, 'utf8')).trim();
    } catch (e) {
      // File doesn't exist
    }
    
    log('ERROR', 'Device code file not found');
    return null;
  } catch (error) {
    log('ERROR', `Error getting device code: ${error.message}`);
    return null;
  }
}

// Query SNMP device using net-snmp
async function querySNMPDevice(ipAddress, community, oids, options = {}) {
  return new Promise((resolve) => {
    const sessionOptions = {
      port: options.port || 161,
      retries: options.retries || 1,
      timeout: options.timeout || 3000,
      idBitsSize: 32,
      ...options.sessionOptions
    };

    const session = snmp.createSession(ipAddress, community, sessionOptions);
    const results = {};
    let completed = 0;
    const total = oids.length;
    let hasError = false;

    // Convert string OIDs to array format if needed
    const oidArray = oids.map(oid => {
      if (typeof oid === 'string') {
        return oid.split('.').map(part => parseInt(part, 10));
      }
      return oid;
    });

    const onError = (error) => {
      if (!hasError) {
        hasError = true;
        session.close();
        log('ERROR', `SNMP error for ${ipAddress}: ${error.message}`);
        resolve({
          success: false,
          error: error.message,
          data: {}
        });
      }
    };

    // Use getBulk for better performance when querying tables
    if (options.useBulk && total > 1) {
      session.getBulk(oidArray, options.nonRepeaters || 0, options.maxRepetitions || 10, (error, varbinds) => {
        session.close();
        
        if (error) {
          log('ERROR', `SNMP bulk get error for ${ipAddress}: ${error.message}`);
          resolve({
            success: false,
            error: error.message,
            data: {}
          });
          return;
        }

        const data = {};
        varbinds.forEach((varbind, index) => {
          if (snmp.isVarbindError(varbind)) {
            log('WARN', `SNMP varbind error for ${ipAddress} OID ${oids[index]}: ${snmp.varbindError(varbind)}`);
          } else {
            const oidStr = oids[index] || varbind.oid.toString();
            data[oidStr] = varbind.value;
          }
        });

        resolve({
          success: true,
          error: null,
          data: data
        });
      });
    } else {
      // Use individual get requests
      oidArray.forEach((oid, index) => {
        session.get([oid], (error, varbinds) => {
          completed++;
          
          if (error) {
            if (!hasError) {
              log('ERROR', `SNMP get error for ${ipAddress} OID ${oids[index]}: ${error.message}`);
            }
          } else {
            if (varbinds.length > 0) {
              const varbind = varbinds[0];
              if (snmp.isVarbindError(varbind)) {
                log('WARN', `SNMP varbind error for ${ipAddress} OID ${oids[index]}: ${snmp.varbindError(varbind)}`);
              } else {
                results[oids[index]] = varbind.value;
              }
            }
          }

          if (completed >= total) {
            session.close();
            resolve({
              success: completed > 0 && Object.keys(results).length > 0,
              error: hasError ? 'Some OIDs failed' : null,
              data: results
            });
          }
        });
      });
    }

    // Timeout fallback
    setTimeout(() => {
      if (completed < total && !hasError) {
        hasError = true;
        session.close();
        log('WARN', `SNMP timeout for ${ipAddress}`);
        resolve({
          success: Object.keys(results).length > 0,
          error: 'Timeout',
          data: results
        });
      }
    }, sessionOptions.timeout + 1000);
  });
}

// Get system metrics from SNMP device
async function getSystemMetrics(ipAddress, community, options = {}) {
  const oids = [
    SNMP_OIDS.sysDescr,
    SNMP_OIDS.sysName,
    SNMP_OIDS.sysUpTime,
    SNMP_OIDS.sysLocation
  ];

  const result = await querySNMPDevice(ipAddress, community, oids, options);

  if (!result.success) {
    return result;
  }

  const data = result.data;
  
  return {
    success: true,
    error: null,
    system: {
      sys_descr: data[SNMP_OIDS.sysDescr] ? String(data[SNMP_OIDS.sysDescr]) : null,
      sys_name: data[SNMP_OIDS.sysName] ? String(data[SNMP_OIDS.sysName]) : null,
      uptime_seconds: data[SNMP_OIDS.sysUpTime] ? Math.floor(Number(data[SNMP_OIDS.sysUpTime]) / 100) : null,
      sys_location: data[SNMP_OIDS.sysLocation] ? String(data[SNMP_OIDS.sysLocation]) : null
    }
  };
}

// Get resource metrics (CPU, Memory, Disk)
async function getResourceMetrics(ipAddress, community, options = {}) {
  const oids = [
    SNMP_OIDS.cpuIdle,
    SNMP_OIDS.memTotalReal,
    SNMP_OIDS.memAvailReal,
    SNMP_OIDS.memBuffer,
    SNMP_OIDS.memCached,
    SNMP_OIDS.diskTotal,
    SNMP_OIDS.diskAvail
  ];

  const result = await querySNMPDevice(ipAddress, community, oids, options);

  if (!result.success) {
    return result;
  }

  const data = result.data;
  const memTotal = data[SNMP_OIDS.memTotalReal] ? Number(data[SNMP_OIDS.memTotalReal]) : null;
  const memAvail = data[SNMP_OIDS.memAvailReal] ? Number(data[SNMP_OIDS.memAvailReal]) : null;
  const memBuffer = data[SNMP_OIDS.memBuffer] ? Number(data[SNMP_OIDS.memBuffer]) : 0;
  const memCached = data[SNMP_OIDS.memCached] ? Number(data[SNMP_OIDS.memCached]) : 0;
  
  const memUsed = memTotal && memAvail ? memTotal - memAvail : null;
  const memUsedPercent = memTotal && memUsed ? ((memUsed / memTotal) * 100).toFixed(2) : null;

  const diskTotal = data[SNMP_OIDS.diskTotal] ? Number(data[SNMP_OIDS.diskTotal]) : null;
  const diskAvail = data[SNMP_OIDS.diskAvail] ? Number(data[SNMP_OIDS.diskAvail]) : null;
  const diskUsed = diskTotal && diskAvail ? diskTotal - diskAvail : null;
  const diskPercent = diskTotal && diskUsed ? ((diskUsed / diskTotal) * 100).toFixed(2) : null;

  const cpuIdle = data[SNMP_OIDS.cpuIdle] ? Number(data[SNMP_OIDS.cpuIdle]) : null;
  const cpuPercent = cpuIdle !== null ? (100 - cpuIdle).toFixed(2) : null;

  return {
    success: true,
    error: null,
    resources: {
      cpu_percent: cpuPercent ? parseFloat(cpuPercent) : null,
      memory_percent: memUsedPercent ? parseFloat(memUsedPercent) : null,
      memory_total_mb: memTotal ? Math.floor(memTotal / 1024) : null,
      memory_used_mb: memUsed ? Math.floor(memUsed / 1024) : null,
      memory_free_mb: memAvail ? Math.floor(memAvail / 1024) : null,
      disk_percent: diskPercent ? parseFloat(diskPercent) : null,
      disk_total_gb: diskTotal ? (diskTotal / (1024 * 1024)).toFixed(2) : null,
      disk_used_gb: diskUsed ? (diskUsed / (1024 * 1024)).toFixed(2) : null
    }
  };
}

// Get interface metrics
async function getInterfaceMetrics(ipAddress, community, interfaceIndex = null, options = {}) {
  // First get interface count
  const ifNumberResult = await querySNMPDevice(ipAddress, community, [SNMP_OIDS.ifNumber], options);
  
  if (!ifNumberResult.success) {
    return ifNumberResult;
  }

  const ifNumber = ifNumberResult.data[SNMP_OIDS.ifNumber] ? Number(ifNumberResult.data[SNMP_OIDS.ifNumber]) : 0;

  if (interfaceIndex === null) {
    // Get first operational interface
    // This is a simplified approach - in production you'd iterate interfaces
    interfaceIndex = 1;
  }

  const baseOids = [
    `${SNMP_OIDS.ifDescr}.${interfaceIndex}`,
    `${SNMP_OIDS.ifSpeed}.${interfaceIndex}`,
    `${SNMP_OIDS.ifOperStatus}.${interfaceIndex}`,
    `${SNMP_OIDS.ifInOctets}.${interfaceIndex}`,
    `${SNMP_OIDS.ifOutOctets}.${interfaceIndex}`,
    `${SNMP_OIDS.ifInErrors}.${interfaceIndex}`,
    `${SNMP_OIDS.ifOutErrors}.${interfaceIndex}`
  ];

  const result = await querySNMPDevice(ipAddress, community, baseOids, options);

  if (!result.success) {
    return result;
  }

  const data = result.data;
  const operStatus = data[`${SNMP_OIDS.ifOperStatus}.${interfaceIndex}`];

  return {
    success: true,
    error: null,
    network: {
      interface_name: data[`${SNMP_OIDS.ifDescr}.${interfaceIndex}`] ? String(data[`${SNMP_OIDS.ifDescr}.${interfaceIndex}`]) : null,
      interface_speed: data[`${SNMP_OIDS.ifSpeed}.${interfaceIndex}`] ? Number(data[`${SNMP_OIDS.ifSpeed}.${interfaceIndex}`]) : null,
      interface_status: operStatus !== undefined ? (Number(operStatus) === 1 ? 'up' : 'down') : 'unknown',
      interface_in_octets: data[`${SNMP_OIDS.ifInOctets}.${interfaceIndex}`] ? Number(data[`${SNMP_OIDS.ifInOctets}.${interfaceIndex}`]) : null,
      interface_out_octets: data[`${SNMP_OIDS.ifOutOctets}.${interfaceIndex}`] ? Number(data[`${SNMP_OIDS.ifOutOctets}.${interfaceIndex}`]) : null,
      interface_in_errors: data[`${SNMP_OIDS.ifInErrors}.${interfaceIndex}`] ? Number(data[`${SNMP_OIDS.ifInErrors}.${interfaceIndex}`]) : null,
      interface_out_errors: data[`${SNMP_OIDS.ifOutErrors}.${interfaceIndex}`] ? Number(data[`${SNMP_OIDS.ifOutErrors}.${interfaceIndex}`]) : null
    }
  };
}

// Get all metrics for a device
async function getAllMetrics(ipAddress, community, options = {}) {
  const [systemResult, resourceResult, networkResult] = await Promise.all([
    getSystemMetrics(ipAddress, community, options),
    getResourceMetrics(ipAddress, community, options),
    getInterfaceMetrics(ipAddress, community, null, options)
  ]);

  return {
    success: systemResult.success || resourceResult.success || networkResult.success,
    error: systemResult.error || resourceResult.error || networkResult.error,
    system: systemResult.system || {},
    resources: resourceResult.resources || {},
    network: networkResult.network || {}
  };
}

// Send SNMP metrics to backend
async function sendSNMPMetrics(deviceCode, snmpMetrics) {
  if (!snmpMetrics || snmpMetrics.length === 0) {
    log('INFO', 'No SNMP metrics to send');
    return false;
  }
  
  try {
    const url = new URL(`${API_URL}/checkin/snmp-metrics`);
    const payload = JSON.stringify({
      device_code: deviceCode,
      snmp_metrics: snmpMetrics
    });
    
    log('INFO', `Sending ${snmpMetrics.length} SNMP metrics to backend...`);
    
    return new Promise((resolve) => {
      const client = url.protocol === 'https:' ? https : http;
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 30000
      };
      
      const req = client.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              const response = JSON.parse(data);
              log('INFO', `Successfully sent ${snmpMetrics.length} SNMP metrics (stored: ${response.stored || snmpMetrics.length})`);
              resolve(true);
            } catch (e) {
              log('INFO', `Sent ${snMPMetrics.length} SNMP metrics successfully (HTTP ${res.statusCode})`);
              resolve(true);
            }
          } else {
            log('ERROR', `Failed to send SNMP metrics: HTTP ${res.statusCode} - ${data.substring(0, 200)}`);
            resolve(false);
          }
        });
      });
      
      req.on('error', (error) => {
        log('ERROR', `Error sending SNMP metrics: ${error.message}`);
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        log('ERROR', 'Timeout sending SNMP metrics (30s)');
        resolve(false);
      });
      
      req.write(payload);
      req.end();
    });
  } catch (error) {
    log('ERROR', `Error in sendSNMPMetrics: ${error.message}`);
    return false;
  }
}

// Get monitoring devices from backend
async function getMonitoringDevices(deviceCode) {
  try {
    const url = new URL(`${API_URL}/checkin/monitoring-devices`);
    url.searchParams.set('device_code', deviceCode);
    
    return new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : http;
      
      const options = {
        method: 'GET',
        timeout: 10000
      };
      
      const req = client.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              resolve(response.devices || []);
            } catch (e) {
              log('ERROR', `Failed to parse monitoring devices response: ${e.message}`);
              resolve([]);
            }
          } else {
            log('ERROR', `Failed to get monitoring devices: HTTP ${res.statusCode}`);
            resolve([]);
          }
        });
      });
      
      req.on('error', (error) => {
        log('ERROR', `Error getting monitoring devices: ${error.message}`);
        resolve([]);
      });
      
      req.on('timeout', () => {
        req.destroy();
        log('ERROR', 'Timeout getting monitoring devices');
        resolve([]);
      });
      
      req.end();
    });
  } catch (error) {
    log('ERROR', `Error in getMonitoringDevices: ${error.message}`);
    return [];
  }
}

// Main SNMP monitoring cycle
async function snmpCycle(deviceCode, devices) {
  if (!devices || devices.length === 0) {
    log('INFO', 'No devices to monitor');
    return;
  }
  
  log('INFO', `Starting SNMP cycle for ${devices.length} device(s)`);
  
  const snmpMetrics = [];
  const startTime = Date.now();
  
  for (const device of devices) {
    const { device_id, ip_address, snmp_community, snmp_version } = device;
    
    if (!device_id || !ip_address) {
      log('WARN', `Skipping device with missing device_id or ip_address`);
      continue;
    }
    
    // Skip if SNMP not configured
    const community = snmp_community || 'public';
    
    const trimmedIP = ip_address.trim();
    if (trimmedIP === '0.0.0.0' || trimmedIP === '127.0.0.1' || trimmedIP === 'localhost') {
      log('WARN', `Skipping device with invalid IP address: ${trimmedIP}`);
      continue;
    }
    
    log('INFO', `Querying SNMP device ${trimmedIP} (device_id: ${device_id}, community: ${community})`);
    
    try {
      const metrics = await getAllMetrics(trimmedIP, community, {
        timeout: 3000,
        retries: 1
      });
      
      if (metrics.success) {
        snmpMetrics.push({
          device_id: device_id.toString(),
          system: metrics.system,
          resources: metrics.resources,
          network: metrics.network,
          raw_oids: {}
        });
        
        log('INFO', `  ✓ ${trimmedIP}: System=${metrics.system?.sys_name || 'N/A'}, CPU=${metrics.resources?.cpu_percent || 'N/A'}%, Memory=${metrics.resources?.memory_percent || 'N/A'}%`);
      } else {
        log('WARN', `  ✗ ${trimmedIP}: ${metrics.error || 'SNMP query failed'}`);
      }
    } catch (error) {
      log('ERROR', `  ✗ ${trimmedIP}: ${error.message}`);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log('INFO', `SNMP cycle completed in ${duration}s: ${snmpMetrics.length} metrics collected`);
  
  // Send metrics to backend
  if (snmpMetrics.length > 0) {
    const sent = await sendSNMPMetrics(deviceCode, snmpMetrics);
    if (!sent) {
      log('ERROR', 'Failed to send SNMP metrics to backend - metrics will be lost');
      return 0;
    }
  } else {
    log('WARN', 'No SNMP metrics collected - nothing to send');
  }
  
  return snmpMetrics.length;
}

// Main execution
async function main() {
  const command = process.argv[2];
  const deviceCode = await getDeviceCode();
  
  if (!deviceCode) {
    log('ERROR', 'Cannot proceed without device code');
    process.exit(1);
  }
  
  if (command === 'cycle') {
    // Get devices to monitor
    const devices = await getMonitoringDevices(deviceCode);
    log('INFO', `Retrieved ${devices.length} device(s) to monitor`);
    
    // Run SNMP cycle
    const count = await snmpCycle(deviceCode, devices);
    log('INFO', `SNMP cycle completed: ${count} metrics sent`);
  } else if (command && process.argv[3] && process.argv[4]) {
    // Direct device query: node script.js <device_id> <ip> <community>
    const deviceId = process.argv[2];
    const ipAddress = process.argv[3];
    const community = process.argv[4];
    
    log('INFO', `Querying SNMP device: ${ipAddress} (community: ${community})`);
    const metrics = await getAllMetrics(ipAddress, community);
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    log('ERROR', 'Usage: node IMPROVED_SNMP_MONITOR.js cycle | <device_id> <ip> <community>');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    log('ERROR', `Fatal error: ${error.message}`);
    log('ERROR', error.stack);
    process.exit(1);
  });
}

module.exports = { 
  querySNMPDevice, 
  getSystemMetrics, 
  getResourceMetrics, 
  getInterfaceMetrics, 
  getAllMetrics,
  snmpCycle 
};

