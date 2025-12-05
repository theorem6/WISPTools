#!/usr/bin/env node
/**
 * EPC Ping Monitoring Agent
 * Continuously pings devices and sends metrics to the backend for graphing
 * 
 * This script:
 * 1. Fetches list of devices to monitor from backend
 * 2. Pings each device periodically
 * 3. Sends ping metrics to backend for storage and graphing
 * 
 * Runs as a daemon or can be triggered by checkin agent
 */

const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;

const execAsync = promisify(exec);

// Configuration
const CENTRAL_SERVER = process.env.CENTRAL_SERVER || 'hss.wisptools.io';
const API_URL = `https://${CENTRAL_SERVER}/api/epc`;
const CONFIG_DIR = process.env.CONFIG_DIR || '/etc/wisptools';
const LOG_FILE = process.env.LOG_FILE || '/var/log/wisptools-ping-monitor.log';
const PING_INTERVAL = parseInt(process.env.PING_INTERVAL || '300', 10); // Default 5 minutes
const DEVICE_LIST_REFRESH_INTERVAL = 3600; // Refresh device list every hour

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
    
    // Fallback: generate from MAC address
    try {
      const { stdout } = await execAsync("ip link show | grep -A1 'state UP' | grep link/ether | head -1 | awk '{print $2}' | tr -d ':' | cut -c1-8 | tr '[:lower:]' '[:upper:]'");
      return stdout.trim();
    } catch (e) {
      log('ERROR', `Failed to get device code: ${e.message}`);
      return null;
    }
  } catch (error) {
    log('ERROR', `Error getting device code: ${error.message}`);
    return null;
  }
}

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

// Ping a single device
async function pingDevice(ipAddress) {
  try {
    const { stdout } = await execAsync(`ping -c 3 -W 2 ${ipAddress} 2>&1 || true`);
    
    // Parse ping output for Linux
    const timeMatch = stdout.match(/min\/avg\/max\/mdev = [\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
    if (timeMatch) {
      const avgTime = parseFloat(timeMatch[2]);
      return {
        success: true,
        response_time_ms: Math.round(avgTime),
        error: null
      };
    }
    
    // Check if host is unreachable
    if (stdout.includes('100% packet loss') || stdout.includes('Unreachable') || stdout.includes('Name or service not known')) {
      return {
        success: false,
        response_time_ms: null,
        error: 'Host unreachable'
      };
    }
    
    // Try to extract time from different format
    const simpleTimeMatch = stdout.match(/time=([\d.]+)\s*ms/);
    if (simpleTimeMatch) {
      return {
        success: true,
        response_time_ms: Math.round(parseFloat(simpleTimeMatch[1])),
        error: null
      };
    }
    
    // If we got here, ping might have succeeded but we couldn't parse it
    if (!stdout.includes('100% packet loss')) {
      return {
        success: true,
        response_time_ms: null,
        error: null
      };
    }
    
    return {
      success: false,
      response_time_ms: null,
      error: 'Ping failed'
    };
  } catch (error) {
    return {
      success: false,
      response_time_ms: null,
      error: error.message
    };
  }
}

// Fetch list of devices to monitor from backend
async function getMonitoringDevices(deviceCode) {
  try {
    const url = new URL(`${API_URL}/checkin/monitoring-devices?device_code=${deviceCode}`);
    
    return new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              if (response.success && Array.isArray(response.devices)) {
                resolve(response.devices);
              } else {
                log('WARN', `Invalid response format from monitoring-devices endpoint`);
                resolve([]);
              }
            } catch (e) {
              log('ERROR', `Failed to parse response: ${e.message}`);
              resolve([]);
            }
          } else {
            log('WARN', `Failed to fetch monitoring devices: HTTP ${res.statusCode}`);
            resolve([]);
          }
        });
      });
      
      req.on('error', (error) => {
        log('ERROR', `Error fetching monitoring devices: ${error.message}`);
        resolve([]);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        log('WARN', 'Timeout fetching monitoring devices');
        resolve([]);
      });
    });
  } catch (error) {
    log('ERROR', `Error in getMonitoringDevices: ${error.message}`);
    return [];
  }
}

// Send ping metrics to backend
async function sendPingMetrics(deviceCode, pingMetrics) {
  if (!pingMetrics || pingMetrics.length === 0) {
    return;
  }
  
  try {
    const url = new URL(`${API_URL}/checkin/ping-metrics`);
    const payload = JSON.stringify({
      device_code: deviceCode,
      ping_metrics: pingMetrics
    });
    
    return new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : http;
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      
      const req = client.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            log('INFO', `Sent ${pingMetrics.length} ping metrics successfully`);
            resolve(true);
          } else {
            log('WARN', `Failed to send ping metrics: HTTP ${res.statusCode} - ${data}`);
            resolve(false);
          }
        });
      });
      
      req.on('error', (error) => {
        log('ERROR', `Error sending ping metrics: ${error.message}`);
        resolve(false);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        log('WARN', 'Timeout sending ping metrics');
        resolve(false);
      });
      
      req.write(payload);
      req.end();
    });
  } catch (error) {
    log('ERROR', `Error in sendPingMetrics: ${error.message}`);
    return false;
  }
}

// Main ping monitoring cycle
async function pingCycle(deviceCode, devices) {
  if (!devices || devices.length === 0) {
    log('INFO', 'No devices to ping');
    return;
  }
  
  log('INFO', `Starting ping cycle for ${devices.length} device(s)`);
  
  const pingMetrics = [];
  const startTime = Date.now();
  
  // Ping all devices in parallel (with reasonable limit)
  const maxParallel = 10;
  for (let i = 0; i < devices.length; i += maxParallel) {
    const batch = devices.slice(i, i + maxParallel);
    
    const batchPromises = batch.map(async (device) => {
      const { device_id, ip_address } = device;
      
      if (!device_id || !ip_address) {
        log('WARN', `Skipping device with missing device_id or ip_address: ${JSON.stringify(device)}`);
        return;
      }
      
      log('INFO', `Pinging ${ip_address} (device_id: ${device_id})`);
      const pingResult = await pingDevice(ip_address);
      
      pingMetrics.push({
        device_id: device_id.toString(),
        ip_address: ip_address.trim(),
        success: pingResult.success,
        response_time_ms: pingResult.response_time_ms,
        error: pingResult.error
      });
      
      if (pingResult.success) {
        log('INFO', `  ✓ ${ip_address}: ${pingResult.response_time_ms}ms`);
      } else {
        log('WARN', `  ✗ ${ip_address}: ${pingResult.error || 'Failed'}`);
      }
    });
    
    await Promise.all(batchPromises);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log('INFO', `Ping cycle completed in ${duration}s: ${pingMetrics.length} metrics collected`);
  
  // Send metrics to backend
  if (pingMetrics.length > 0) {
    await sendPingMetrics(deviceCode, pingMetrics);
  }
}

// Main monitoring loop
async function startMonitoring() {
  log('INFO', 'Starting EPC Ping Monitoring Agent');
  
  const deviceCode = await getDeviceCode();
  if (!deviceCode) {
    log('ERROR', 'Cannot start monitoring: device code not available');
    process.exit(1);
  }
  
  log('INFO', `Device code: ${deviceCode}`);
  log('INFO', `Ping interval: ${PING_INTERVAL}s`);
  
  let devices = [];
  let lastDeviceListRefresh = 0;
  
  // Initial device list fetch
  log('INFO', 'Fetching initial device list...');
  devices = await getMonitoringDevices(deviceCode);
  log('INFO', `Found ${devices.length} device(s) to monitor`);
  lastDeviceListRefresh = Date.now();
  
  // Main loop
  while (true) {
    try {
      // Refresh device list periodically
      const now = Date.now();
      if (now - lastDeviceListRefresh > (DEVICE_LIST_REFRESH_INTERVAL * 1000)) {
        log('INFO', 'Refreshing device list...');
        const newDevices = await getMonitoringDevices(deviceCode);
        if (newDevices.length > 0) {
          devices = newDevices;
          log('INFO', `Updated device list: ${devices.length} device(s)`);
        }
        lastDeviceListRefresh = now;
      }
      
      // Run ping cycle
      await pingCycle(deviceCode, devices);
      
      // Wait for next interval
      log('INFO', `Waiting ${PING_INTERVAL}s until next ping cycle...`);
      await new Promise(resolve => setTimeout(resolve, PING_INTERVAL * 1000));
      
    } catch (error) {
      log('ERROR', `Error in monitoring loop: ${error.message}`);
      log('ERROR', error.stack);
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 60 * 1000));
    }
  }
}

// Run as daemon or single cycle based on arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'daemon';
  
  if (mode === 'cycle' || mode === 'once') {
    // Run a single ping cycle
    (async () => {
      try {
        log('INFO', 'Running single ping cycle...');
        const deviceCode = await getDeviceCode();
        if (!deviceCode) {
          log('ERROR', 'Cannot run ping cycle: device code not available');
          process.exit(1);
        }
        
        const devices = await getMonitoringDevices(deviceCode);
        log('INFO', `Found ${devices.length} device(s) to monitor`);
        await pingCycle(deviceCode, devices);
        log('INFO', 'Ping cycle completed');
        process.exit(0);
      } catch (error) {
        log('ERROR', `Fatal error: ${error.message}`);
        log('ERROR', error.stack);
        process.exit(1);
      }
    })();
  } else {
    // Run as daemon
    startMonitoring().catch((error) => {
      log('ERROR', `Fatal error: ${error.message}`);
      log('ERROR', error.stack);
      process.exit(1);
    });
  }
}

module.exports = {
  pingDevice,
  getMonitoringDevices,
  sendPingMetrics,
  pingCycle,
  startMonitoring
};
