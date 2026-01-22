#!/usr/bin/env node
/**
 * Improved EPC Ping Monitoring Agent using 'ping' npm package
 * 
 * Uses the reliable 'ping' npm package instead of parsing system ping output
 * This provides better cross-platform support and more reliable results
 * 
 * Usage:
 *   node IMPROVED_PING_MONITOR.js cycle     - Run single ping cycle
 *   node IMPROVED_PING_MONITOR.js sweep     - Run subnet ping sweep
 */

const https = require('https');
const http = require('http');
const ping = require('ping');
const fs = require('fs').promises;

// Configuration
const CENTRAL_SERVER = process.env.CENTRAL_SERVER || 'hss.wisptools.io';
const API_URL = `https://${CENTRAL_SERVER}/api/epc`;
const CONFIG_DIR = process.env.CONFIG_DIR || '/etc/wisptools';
const LOG_FILE = process.env.LOG_FILE || '/var/log/wisptools-ping-monitor.log';

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

// Ping a single device using 'ping' npm package
async function pingDevice(ipAddress, options = {}) {
  try {
    const pingOptions = {
      timeout: options.timeout || 3,      // seconds
      deadline: options.deadline || 5,    // seconds (Linux)
      min_reply: 1,                        // minimum replies to consider success
      ...options
    };

    const result = await ping.promise.probe(ipAddress, pingOptions);

    if (result.alive) {
      // Parse numeric time - handle both string and number formats
      let responseTime = null;
      if (result.time && result.time !== 'unknown') {
        const timeStr = String(result.time).replace(/[^\d.]/g, '');
        responseTime = parseFloat(timeStr);
        if (isNaN(responseTime)) responseTime = null;
      }

      // If we have min/avg/max, use average
      if (result.min && result.avg && result.max) {
        responseTime = parseFloat(result.avg) || responseTime;
      }

      return {
        success: true,
        response_time_ms: responseTime,
        error: null,
        packet_loss: result.packetLoss || 0,
        min: result.min ? parseFloat(result.min) : null,
        max: result.max ? parseFloat(result.max) : null,
        avg: result.avg ? parseFloat(result.avg) : null
      };
    } else {
      return {
        success: false,
        response_time_ms: null,
        error: result.output || 'Host unreachable',
        packet_loss: 100
      };
    }
  } catch (error) {
    log('ERROR', `Error pinging ${ipAddress}: ${error.message}`);
    return {
      success: false,
      response_time_ms: null,
      error: error.message,
      packet_loss: 100
    };
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

// Send ping metrics to backend
async function sendPingMetrics(deviceCode, pingMetrics) {
  if (!pingMetrics || pingMetrics.length === 0) {
    log('INFO', 'No ping metrics to send');
    return false;
  }
  
  try {
    const url = new URL(`${API_URL}/checkin/ping-metrics`);
    const payload = JSON.stringify({
      device_code: deviceCode,
      ping_metrics: pingMetrics.map(m => ({
        device_id: m.device_id,
        ip_address: m.ip_address,
        success: m.success,
        response_time_ms: m.response_time_ms,
        error: m.error
      }))
    });
    
    log('INFO', `Sending ${pingMetrics.length} ping metrics to backend...`);
    
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
              log('INFO', `Successfully sent ${pingMetrics.length} ping metrics (stored: ${response.stored || pingMetrics.length})`);
              resolve(true);
            } catch (e) {
              log('INFO', `Sent ${pingMetrics.length} ping metrics successfully (HTTP ${res.statusCode})`);
              resolve(true);
            }
          } else {
            log('ERROR', `Failed to send ping metrics: HTTP ${res.statusCode} - ${data.substring(0, 200)}`);
            resolve(false);
          }
        });
      });
      
      req.on('error', (error) => {
        log('ERROR', `Error sending ping metrics: ${error.message}`);
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        log('ERROR', 'Timeout sending ping metrics (30s)');
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
      
      // Skip invalid IP addresses
      const trimmedIP = ip_address.trim();
      if (trimmedIP === '0.0.0.0' || trimmedIP === '127.0.0.1' || trimmedIP === 'localhost' || !trimmedIP) {
        log('WARN', `Skipping device with invalid IP address: ${trimmedIP} (device_id: ${device_id})`);
        return;
      }
      
      log('INFO', `Pinging ${trimmedIP} (device_id: ${device_id})`);
      const pingResult = await pingDevice(trimmedIP, {
        timeout: 3,
        deadline: 5
      });
      
      pingMetrics.push({
        device_id: device_id.toString(),
        ip_address: trimmedIP,
        success: pingResult.success,
        response_time_ms: pingResult.response_time_ms,
        error: pingResult.error
      });
      
      if (pingResult.success) {
        log('INFO', `  ✓ ${trimmedIP}: ${pingResult.response_time_ms}ms`);
      } else {
        log('WARN', `  ✗ ${trimmedIP}: ${pingResult.error || 'Failed'}`);
      }
    });
    
    await Promise.all(batchPromises);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log('INFO', `Ping cycle completed in ${duration}s: ${pingMetrics.length} metrics collected`);
  
  // Send metrics to backend
  if (pingMetrics.length > 0) {
    const sent = await sendPingMetrics(deviceCode, pingMetrics);
    if (!sent) {
      log('ERROR', 'Failed to send ping metrics to backend - metrics will be lost');
      return 0;
    }
  } else {
    log('WARN', 'No ping metrics collected - nothing to send');
  }
  
  return pingMetrics.length;
}

// Main execution
async function main() {
  const command = process.argv[2] || 'cycle';
  
  const deviceCode = await getDeviceCode();
  if (!deviceCode) {
    log('ERROR', 'Cannot proceed without device code');
    process.exit(1);
  }
  
  log('INFO', `Starting ping monitoring (command: ${command}, device_code: ${deviceCode})`);
  
  if (command === 'cycle') {
    // Get devices to monitor
    const devices = await getMonitoringDevices(deviceCode);
    log('INFO', `Retrieved ${devices.length} device(s) to monitor`);
    
    // Run ping cycle
    const count = await pingCycle(deviceCode, devices);
    log('INFO', `Ping cycle completed: ${count} metrics sent`);
  } else {
    log('ERROR', `Unknown command: ${command}`);
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

module.exports = { pingDevice, pingCycle, getMonitoringDevices, sendPingMetrics };

