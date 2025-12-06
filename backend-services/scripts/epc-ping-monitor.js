#!/usr/bin/env node
/**
 * EPC Ping Monitoring Agent
 * 
 * This script:
 * 1. Hourly subnet ping sweep - pings all subnets in SNMP settings
 * 2. Every minute before check-in - pings all monitored devices and reports
 * 3. Sends ping metrics to backend for storage and graphing
 * 
 * Usage:
 *   node epc-ping-monitor.js cycle     - Run single ping cycle (for check-in)
 *   node epc-ping-monitor.js sweep     - Run subnet ping sweep (hourly)
 *   node epc-ping-monitor.js daemon    - Run as daemon (not recommended - use checkin agent)
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
    const timeMatch = stdout.match(/min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
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

// Generate IP addresses from subnet CIDR notation
function getIPsFromSubnet(subnet) {
  const ips = [];
  
  try {
    const [network, prefixLength] = subnet.split('/');
    if (!prefixLength) {
      // Single IP, not a subnet
      ips.push(network);
      return ips;
    }
    
    const prefix = parseInt(prefixLength, 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      log('WARN', `Invalid prefix length in subnet ${subnet}`);
      return ips;
    }
    
    const parts = network.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      log('WARN', `Invalid IP address in subnet ${subnet}`);
      return ips;
    }
    
    // Calculate number of hosts (exclude network and broadcast)
    const hostBits = 32 - prefix;
    const numHosts = Math.pow(2, hostBits) - 2;
    
    // Limit to reasonable number of hosts (max /24 = 254 hosts)
    if (prefix < 24) {
      log('WARN', `Subnet ${subnet} is too large (${numHosts} hosts), skipping to avoid excessive pings`);
      return ips;
    }
    
    // Generate all IP addresses in subnet
    const networkNum = (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const networkAddr = networkNum & mask;
    const broadcastAddr = networkAddr | (~mask >>> 0);
    
    // Generate IPs (skip network and broadcast)
    for (let ipNum = networkAddr + 1; ipNum < broadcastAddr; ipNum++) {
      const ip = `${(ipNum >>> 24) & 0xFF}.${(ipNum >>> 16) & 0xFF}.${(ipNum >>> 8) & 0xFF}.${ipNum & 0xFF}`;
      ips.push(ip);
    }
    
    log('INFO', `Generated ${ips.length} IP addresses from subnet ${subnet}`);
  } catch (error) {
    log('ERROR', `Error generating IPs from subnet ${subnet}: ${error.message}`);
  }
  
  return ips;
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

// Fetch SNMP subnets for ping sweep
async function getSNMPSubnets(deviceCode) {
  try {
    const url = new URL(`${API_URL}/checkin/snmp-subnets?device_code=${deviceCode}`);
    
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
              if (response.success && Array.isArray(response.subnets)) {
                resolve(response.subnets);
              } else {
                log('WARN', `Invalid response format from snmp-subnets endpoint`);
                resolve([]);
              }
            } catch (e) {
              log('ERROR', `Failed to parse response: ${e.message}`);
              resolve([]);
            }
          } else {
            log('WARN', `Failed to fetch SNMP subnets: HTTP ${res.statusCode}`);
            resolve([]);
          }
        });
      });
      
      req.on('error', (error) => {
        log('ERROR', `Error fetching SNMP subnets: ${error.message}`);
        resolve([]);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        log('WARN', 'Timeout fetching SNMP subnets');
        resolve([]);
      });
    });
  } catch (error) {
    log('ERROR', `Error in getSNMPSubnets: ${error.message}`);
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
      
      req.setTimeout(30000, () => {
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

// Main ping monitoring cycle (pings known devices)
async function pingCycle(deviceCode, devices) {
  if (!devices || devices.length === 0) {
    log('INFO', 'No devices to ping');
    return;
  }
  
  log('INFO', `Starting ping cycle for ${devices.length} device(s)`);
  
  const pingMetrics = [];
  const startTime = Date.now();
  
  // Ping all devices in parallel (with reasonable limit)
  const maxParallel = 20;
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
  
  return pingMetrics.length;
}

// Subnet ping sweep (hourly)
async function subnetPingSweep(deviceCode, subnets) {
  if (!subnets || subnets.length === 0) {
    log('INFO', 'No subnets to sweep');
    return;
  }
  
  log('INFO', `Starting subnet ping sweep for ${subnets.length} subnet(s)`);
  
  const pingMetrics = [];
  const startTime = Date.now();
  
  for (const subnet of subnets) {
    if (!subnet || !subnet.trim()) {
      continue;
    }
    
    log('INFO', `Sweeping subnet: ${subnet}`);
    
    // Generate IP addresses from subnet
    const ips = getIPsFromSubnet(subnet.trim());
    
    if (ips.length === 0) {
      log('WARN', `No IPs generated from subnet ${subnet}`);
      continue;
    }
    
    log('INFO', `Pinging ${ips.length} IPs in subnet ${subnet}`);
    
    // Ping all IPs in subnet in parallel (with reasonable limit)
    const maxParallel = 50;
    for (let i = 0; i < ips.length; i += maxParallel) {
      const batch = ips.slice(i, i + maxParallel);
      
      const batchPromises = batch.map(async (ip) => {
        const pingResult = await pingDevice(ip);
        
        // Only record successful pings (devices that responded)
        if (pingResult.success) {
          pingMetrics.push({
            device_id: `subnet_${subnet.replace(/[\/\.]/g, '_')}_${ip.replace(/\./g, '_')}`,
            ip_address: ip.trim(),
            success: true,
            response_time_ms: pingResult.response_time_ms,
            error: null
          });
          
          log('INFO', `  ✓ Found device at ${ip}: ${pingResult.response_time_ms}ms`);
        }
      });
      
      await Promise.all(batchPromises);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log('INFO', `Subnet sweep completed in ${duration}s: ${pingMetrics.length} devices found and pinged`);
  
  // Send metrics to backend
  if (pingMetrics.length > 0) {
    await sendPingMetrics(deviceCode, pingMetrics);
  }
  
  return pingMetrics.length;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'cycle';
  
  (async () => {
    try {
      const deviceCode = await getDeviceCode();
      if (!deviceCode) {
        log('ERROR', 'Cannot run ping monitor: device code not available');
        process.exit(1);
      }
      
      if (mode === 'cycle' || mode === 'once') {
        // Run a single ping cycle (for check-in, every minute)
        log('INFO', 'Running single ping cycle for monitored devices...');
        const devices = await getMonitoringDevices(deviceCode);
        log('INFO', `Found ${devices.length} device(s) to monitor`);
        await pingCycle(deviceCode, devices);
        log('INFO', 'Ping cycle completed');
        process.exit(0);
      } else if (mode === 'sweep') {
        // Run subnet ping sweep (hourly)
        log('INFO', 'Running subnet ping sweep...');
        const subnets = await getSNMPSubnets(deviceCode);
        log('INFO', `Found ${subnets.length} subnet(s) to sweep`);
        await subnetPingSweep(deviceCode, subnets);
        log('INFO', 'Subnet sweep completed');
        process.exit(0);
      } else {
        log('ERROR', `Unknown mode: ${mode}. Use 'cycle' or 'sweep'`);
        process.exit(1);
      }
    } catch (error) {
      log('ERROR', `Fatal error: ${error.message}`);
      log('ERROR', error.stack);
      process.exit(1);
    }
  })();
}

module.exports = {
  pingDevice,
  getMonitoringDevices,
  getSNMPSubnets,
  sendPingMetrics,
  pingCycle,
  subnetPingSweep,
  getIPsFromSubnet
};

